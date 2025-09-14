-- Create batch jobs table for background image generation
CREATE TABLE IF NOT EXISTS batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL DEFAULT 'image_generation',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    
    -- Job configuration
    original_image_id UUID REFERENCES image_catalog(id),
    config JSONB NOT NULL, -- Store variation config
    target_age TEXT,
    
    -- Progress tracking
    total_items INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    successful_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion_at TIMESTAMPTZ,
    
    -- Results
    generated_image_ids UUID[] DEFAULT '{}',
    error_log TEXT[],
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID -- Could reference user if needed
);

-- Create batch job items for individual variations
CREATE TABLE IF NOT EXISTS batch_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
    
    -- Item details
    item_index INTEGER NOT NULL,
    breed_id UUID,
    coat_id UUID,
    outfit_id UUID,
    format_id UUID,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    
    -- Results
    generated_image_id UUID REFERENCES image_catalog(id),
    error_message TEXT,
    gemini_duration_ms INTEGER,
    total_duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON batch_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_job_items_job_id ON batch_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_job_items_status ON batch_job_items(status);

-- RLS policies
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_job_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service role (admin operations)
CREATE POLICY "Service role can manage batch jobs" ON batch_jobs
    FOR ALL TO service_role USING (true);

CREATE POLICY "Service role can manage batch job items" ON batch_job_items
    FOR ALL TO service_role USING (true);

-- Update trigger for batch_jobs
CREATE OR REPLACE FUNCTION update_batch_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batch_jobs_updated_at
    BEFORE UPDATE ON batch_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_batch_job_updated_at();

COMMENT ON TABLE batch_jobs IS 'Background batch jobs for image generation and processing';
COMMENT ON TABLE batch_job_items IS 'Individual items within batch jobs for detailed tracking';