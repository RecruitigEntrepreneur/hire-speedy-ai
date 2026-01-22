-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to candidates
ALTER TABLE candidates 
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';

-- Add embedding columns to jobs
ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT DEFAULT 'text-embedding-3-small';

-- Embedding queue for async processing
CREATE TABLE IF NOT EXISTS embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('candidate', 'job')),
  entity_id UUID NOT NULL,
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(entity_type, entity_id, status)
);

-- Enable RLS on embedding_queue
ALTER TABLE embedding_queue ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role full access to embedding_queue" ON embedding_queue
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast vector similarity search (IVFFlat) - will be created after data exists
-- For now, create HNSW index which works better with small datasets
CREATE INDEX IF NOT EXISTS candidates_embedding_idx 
  ON candidates USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS jobs_embedding_idx 
  ON jobs USING hnsw (embedding vector_cosine_ops);

-- Index for queue processing
CREATE INDEX IF NOT EXISTS embedding_queue_pending_idx 
  ON embedding_queue (status, priority DESC, created_at ASC)
  WHERE status = 'pending';

-- Trigger: Queue embedding update when candidate changes
CREATE OR REPLACE FUNCTION queue_candidate_embedding_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if relevant fields changed
  IF TG_OP = 'INSERT' OR
     OLD.skills IS DISTINCT FROM NEW.skills OR
     OLD.job_title IS DISTINCT FROM NEW.job_title OR
     OLD.cv_ai_summary IS DISTINCT FROM NEW.cv_ai_summary OR
     OLD.seniority IS DISTINCT FROM NEW.seniority OR
     OLD.specializations IS DISTINCT FROM NEW.specializations
  THEN
    INSERT INTO embedding_queue (entity_type, entity_id, priority)
    VALUES ('candidate', NEW.id, 
            CASE WHEN NEW.embedding IS NULL THEN 2 ELSE 1 END)
    ON CONFLICT (entity_type, entity_id, status) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_queue_candidate_embedding
AFTER INSERT OR UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION queue_candidate_embedding_update();

-- Trigger: Queue embedding update when job changes
CREATE OR REPLACE FUNCTION queue_job_embedding_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR
     OLD.title IS DISTINCT FROM NEW.title OR
     OLD.description IS DISTINCT FROM NEW.description OR
     OLD.must_haves IS DISTINCT FROM NEW.must_haves OR
     OLD.nice_to_haves IS DISTINCT FROM NEW.nice_to_haves
  THEN
    INSERT INTO embedding_queue (entity_type, entity_id, priority)
    VALUES ('job', NEW.id, 
            CASE WHEN NEW.embedding IS NULL THEN 2 ELSE 1 END)
    ON CONFLICT (entity_type, entity_id, status) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_queue_job_embedding
AFTER INSERT OR UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION queue_job_embedding_update();

-- Function to find similar candidates by embedding
CREATE OR REPLACE FUNCTION find_similar_candidates(
  source_embedding vector(1536),
  exclude_id UUID DEFAULT NULL,
  limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  job_title TEXT,
  skills TEXT[],
  city TEXT,
  similarity FLOAT
) AS $$
SELECT 
  c.id,
  c.full_name,
  c.job_title,
  c.skills,
  c.city,
  (1 - (c.embedding <=> source_embedding))::FLOAT as similarity
FROM candidates c
WHERE c.embedding IS NOT NULL
  AND (exclude_id IS NULL OR c.id != exclude_id)
ORDER BY c.embedding <=> source_embedding
LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Hybrid search function combining semantic and keyword search
CREATE OR REPLACE FUNCTION search_candidates_hybrid(
  query_embedding vector(1536),
  keyword_skills TEXT[] DEFAULT NULL,
  salary_max INTEGER DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  candidate_id UUID,
  full_name TEXT,
  job_title TEXT,
  skills TEXT[],
  city TEXT,
  semantic_score FLOAT,
  keyword_score FLOAT,
  hybrid_score FLOAT,
  match_explanation TEXT
) AS $$
WITH semantic_results AS (
  SELECT 
    c.id,
    c.full_name,
    c.job_title,
    c.skills,
    c.city,
    (1 - (c.embedding <=> query_embedding))::FLOAT as score,
    ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) as rank
  FROM candidates c
  WHERE c.embedding IS NOT NULL
    AND (salary_max IS NULL OR COALESCE(c.salary_expectation_min, 0) <= salary_max * 1.2)
  ORDER BY c.embedding <=> query_embedding
  LIMIT 100
),
keyword_results AS (
  SELECT 
    c.id,
    c.full_name,
    c.job_title,
    c.skills,
    c.city,
    CASE 
      WHEN keyword_skills IS NULL OR array_length(keyword_skills, 1) IS NULL THEN 0::FLOAT
      ELSE COALESCE(
        (SELECT COUNT(*)::FLOAT FROM unnest(c.skills) s WHERE s = ANY(keyword_skills)) / 
        array_length(keyword_skills, 1)::FLOAT,
        0
      )
    END as score,
    ROW_NUMBER() OVER (
      ORDER BY (SELECT COUNT(*) FROM unnest(c.skills) s WHERE s = ANY(keyword_skills)) DESC NULLS LAST
    ) as rank
  FROM candidates c
  WHERE keyword_skills IS NULL 
     OR c.skills && keyword_skills
  LIMIT 100
)
SELECT 
  COALESCE(s.id, k.id) as candidate_id,
  COALESCE(s.full_name, k.full_name) as full_name,
  COALESCE(s.job_title, k.job_title) as job_title,
  COALESCE(s.skills, k.skills) as skills,
  COALESCE(s.city, k.city) as city,
  COALESCE(s.score, 0)::FLOAT as semantic_score,
  COALESCE(k.score, 0)::FLOAT as keyword_score,
  (COALESCE(1.0 / (60 + s.rank), 0) + COALESCE(1.0 / (60 + k.rank), 0))::FLOAT as hybrid_score,
  CASE 
    WHEN s.score > 0.8 AND k.score > 0.5 THEN 'Starke semantische + Skill-Übereinstimmung'
    WHEN s.score > 0.8 THEN 'Starke semantische Ähnlichkeit'
    WHEN k.score > 0.7 THEN 'Starke Skill-Übereinstimmung'
    WHEN s.score > 0.6 THEN 'Gute semantische Ähnlichkeit'
    ELSE 'Teilweise Übereinstimmung'
  END as match_explanation
FROM semantic_results s
FULL OUTER JOIN keyword_results k ON s.id = k.id
ORDER BY (COALESCE(1.0 / (60 + s.rank), 0) + COALESCE(1.0 / (60 + k.rank), 0)) DESC
LIMIT limit_count;
$$ LANGUAGE sql STABLE;