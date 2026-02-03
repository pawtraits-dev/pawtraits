-- Migration: Create Archive Tables for Old Catalog Data
-- Date: 2026-02-15
-- Purpose: Safe archival of existing catalog before pivot to curated approach
-- CRITICAL: This preserves ALL data before deletion

-- =============================================================================
-- 1. IMAGE CATALOG ARCHIVE
-- =============================================================================
-- Stores complete snapshot of image_catalog table with all original columns
CREATE TABLE IF NOT EXISTS public.image_catalog_archive (
  -- Archive metadata
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL, -- References original image_catalog.id
  archived_at timestamp with time zone DEFAULT now(),
  archived_by uuid REFERENCES public.user_profiles(id),
  archive_reason text DEFAULT 'Catalog pivot to curated approach',

  -- Original image_catalog columns (snapshot at time of archival)
  filename text NOT NULL,
  original_filename text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  prompt_text text NOT NULL,
  description text,
  tags text[],
  breed_id uuid,
  theme_id uuid,
  style_id uuid,
  format_id uuid,
  coat_id uuid,
  ai_model text,
  generation_parameters jsonb DEFAULT '{}'::jsonb,
  rating integer,
  is_featured boolean,
  is_public boolean,
  share_count integer,
  last_shared_at timestamp with time zone,
  like_count integer,
  view_count integer,
  last_liked_at timestamp with time zone,
  last_viewed_at timestamp with time zone,
  cloudinary_public_id text,
  cloudinary_version character varying,
  cloudinary_signature text,
  image_variants jsonb DEFAULT '{}'::jsonb,
  access_level text,
  migration_status text,
  migrated_at timestamp with time zone,
  created_by_customer_id uuid,
  is_customer_generated boolean,

  -- Original timestamps
  original_created_at timestamp with time zone,
  original_updated_at timestamp with time zone,

  -- Interaction data snapshot (for quick reference)
  interaction_snapshot jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT image_catalog_archive_pkey PRIMARY KEY (id)
);

-- Indexes for efficient archive queries
CREATE INDEX IF NOT EXISTS idx_catalog_archive_original_id
  ON public.image_catalog_archive(original_id);
CREATE INDEX IF NOT EXISTS idx_catalog_archive_breed
  ON public.image_catalog_archive(breed_id);
CREATE INDEX IF NOT EXISTS idx_catalog_archive_theme
  ON public.image_catalog_archive(theme_id);
CREATE INDEX IF NOT EXISTS idx_catalog_archive_style
  ON public.image_catalog_archive(style_id);
CREATE INDEX IF NOT EXISTS idx_catalog_archive_archived_at
  ON public.image_catalog_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_archive_is_featured
  ON public.image_catalog_archive(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_catalog_archive_cloudinary
  ON public.image_catalog_archive(cloudinary_public_id);

-- Comment
COMMENT ON TABLE public.image_catalog_archive IS
  'Archive of image_catalog records before catalog pivot. Retains all original data for 90 days with rollback capability.';

-- =============================================================================
-- 2. INTERACTION ANALYTICS ARCHIVE
-- =============================================================================
-- Stores interaction analytics associated with archived images
CREATE TABLE IF NOT EXISTS public.interaction_analytics_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL, -- Original interaction_analytics.id
  archived_image_id uuid REFERENCES public.image_catalog_archive(id),

  -- Original analytics data
  total_likes integer DEFAULT 0,
  total_unlikes integer DEFAULT 0,
  net_likes integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  total_views integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  unique_likers integer DEFAULT 0,
  unique_sharers integer DEFAULT 0,
  unique_viewers integer DEFAULT 0,
  first_interaction_at timestamp with time zone,
  last_interaction_at timestamp with time zone,
  original_updated_at timestamp with time zone,

  -- Archive metadata
  archived_at timestamp with time zone DEFAULT now(),

  CONSTRAINT interaction_analytics_archive_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_archive_image
  ON public.interaction_analytics_archive(archived_image_id);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_archive_original
  ON public.interaction_analytics_archive(original_id);
CREATE INDEX IF NOT EXISTS idx_interaction_analytics_archive_archived_at
  ON public.interaction_analytics_archive(archived_at DESC);

COMMENT ON TABLE public.interaction_analytics_archive IS
  'Archive of interaction analytics for deleted catalog images. Used for historical analysis and potential rollback.';

-- =============================================================================
-- 3. USER INTERACTIONS ARCHIVE
-- =============================================================================
-- Stores individual user interaction events for archived images
CREATE TABLE IF NOT EXISTS public.user_interactions_archive (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  original_id uuid NOT NULL, -- Original user_interactions.id
  archived_image_id uuid REFERENCES public.image_catalog_archive(id),

  -- Original interaction data
  user_id uuid,
  session_id text,
  interaction_type text,
  platform text,
  user_agent text,
  ip_address inet,
  referrer text,
  metadata jsonb DEFAULT '{}'::jsonb,
  original_created_at timestamp with time zone,

  -- Archive metadata
  archived_at timestamp with time zone DEFAULT now(),

  CONSTRAINT user_interactions_archive_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_interactions_archive_image
  ON public.user_interactions_archive(archived_image_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_archive_user
  ON public.user_interactions_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_archive_type
  ON public.user_interactions_archive(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_archive_archived_at
  ON public.user_interactions_archive(archived_at DESC);

COMMENT ON TABLE public.user_interactions_archive IS
  'Archive of individual user interactions with deleted catalog images. Preserves behavioral data for analysis.';

-- =============================================================================
-- 4. ARCHIVE METADATA TABLE
-- =============================================================================
-- Tracks archival operations and provides rollback information
CREATE TABLE IF NOT EXISTS public.archive_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  operation_type text NOT NULL CHECK (operation_type = ANY (ARRAY['catalog_archival', 'catalog_deletion'])),
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  performed_by uuid REFERENCES public.user_profiles(id),

  -- Statistics
  images_archived integer DEFAULT 0,
  analytics_archived integer DEFAULT 0,
  interactions_archived integer DEFAULT 0,
  total_size_bytes bigint,

  -- Status
  status text DEFAULT 'in_progress' CHECK (status = ANY (ARRAY['in_progress', 'completed', 'failed', 'rolled_back'])),
  error_message text,

  -- Rollback information
  rollback_script_path text,
  can_rollback boolean DEFAULT true,
  rollback_deadline timestamp with time zone, -- Archive retention deadline (90 days)

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  CONSTRAINT archive_operations_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_archive_operations_status
  ON public.archive_operations(status);
CREATE INDEX IF NOT EXISTS idx_archive_operations_type
  ON public.archive_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_archive_operations_started_at
  ON public.archive_operations(started_at DESC);

COMMENT ON TABLE public.archive_operations IS
  'Tracks archival and deletion operations with rollback metadata. Supports audit trail and recovery procedures.';

-- =============================================================================
-- 5. GRANT PERMISSIONS
-- =============================================================================
-- Ensure appropriate access for service role and admin users
-- Note: Adjust permissions based on your RLS policies

-- Grant read access to authenticated users (for archive viewing)
GRANT SELECT ON public.image_catalog_archive TO authenticated;
GRANT SELECT ON public.interaction_analytics_archive TO authenticated;
GRANT SELECT ON public.user_interactions_archive TO authenticated;
GRANT SELECT ON public.archive_operations TO authenticated;

-- Grant full access to service role (for archival operations)
GRANT ALL ON public.image_catalog_archive TO service_role;
GRANT ALL ON public.interaction_analytics_archive TO service_role;
GRANT ALL ON public.user_interactions_archive TO service_role;
GRANT ALL ON public.archive_operations TO service_role;

-- =============================================================================
-- 6. VERIFICATION QUERIES
-- =============================================================================
-- Run these after migration to verify tables created successfully

-- Verify all archive tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'image_catalog_archive') THEN
    RAISE EXCEPTION 'image_catalog_archive table was not created';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'interaction_analytics_archive') THEN
    RAISE EXCEPTION 'interaction_analytics_archive table was not created';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_interactions_archive') THEN
    RAISE EXCEPTION 'user_interactions_archive table was not created';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'archive_operations') THEN
    RAISE EXCEPTION 'archive_operations table was not created';
  END IF;
  RAISE NOTICE 'All archive tables created successfully';
END $$;

-- Verify indexes created
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('image_catalog_archive', 'interaction_analytics_archive', 'user_interactions_archive', 'archive_operations')
ORDER BY tablename, indexname;

-- =============================================================================
-- ROLLBACK INSTRUCTIONS
-- =============================================================================
-- To rollback this migration (WARNING: Will lose archive capability):
/*
DROP TABLE IF EXISTS public.user_interactions_archive CASCADE;
DROP TABLE IF EXISTS public.interaction_analytics_archive CASCADE;
DROP TABLE IF EXISTS public.image_catalog_archive CASCADE;
DROP TABLE IF EXISTS public.archive_operations CASCADE;
*/
