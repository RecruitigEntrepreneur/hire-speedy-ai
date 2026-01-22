-- Create skill-based similarity function as fallback when no embeddings exist
CREATE OR REPLACE FUNCTION find_similar_candidates_by_skills(
  source_id UUID,
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
WITH source AS (
  SELECT skills, seniority, job_title, city
  FROM candidates WHERE candidates.id = source_id
)
SELECT 
  c.id,
  c.full_name,
  c.job_title,
  c.skills,
  c.city,
  (
    -- Skill Overlap (60%)
    COALESCE(
      array_length(
        ARRAY(SELECT unnest(c.skills) INTERSECT SELECT unnest(s.skills)), 1
      )::FLOAT / NULLIF(GREATEST(
        array_length(c.skills, 1), 
        array_length(s.skills, 1)
      ), 0),
      0
    ) * 0.6
    +
    -- Seniority Match (20%)
    CASE WHEN c.seniority = s.seniority THEN 0.2 ELSE 0 END
    +
    -- City Match (10%)
    CASE WHEN LOWER(c.city) = LOWER(s.city) THEN 0.1 ELSE 0 END
    +
    -- Job Title Similarity (10%)
    CASE WHEN s.job_title IS NOT NULL AND c.job_title ILIKE '%' || split_part(s.job_title, ' ', 1) || '%' 
         THEN 0.1 ELSE 0 END
  ) AS similarity
FROM candidates c, source s
WHERE c.id != source_id
  AND c.skills IS NOT NULL
  AND array_length(c.skills, 1) > 0
ORDER BY similarity DESC
LIMIT limit_count;
$$ LANGUAGE sql STABLE;

-- Reset failed embedding queue items for retry
UPDATE embedding_queue 
SET status = 'pending', error_message = NULL 
WHERE status = 'failed';