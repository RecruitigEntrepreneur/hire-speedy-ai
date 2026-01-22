-- Add new fields for enhanced coaching playbooks
ALTER TABLE coaching_playbooks ADD COLUMN IF NOT EXISTS quick_checklist TEXT[];
ALTER TABLE coaching_playbooks ADD COLUMN IF NOT EXISTS sample_phrases JSONB DEFAULT '[]';
ALTER TABLE coaching_playbooks ADD COLUMN IF NOT EXISTS red_flags TEXT[];
ALTER TABLE coaching_playbooks ADD COLUMN IF NOT EXISTS success_indicators TEXT[];