-- ============================================================================
-- MAIN DATABASE SCHEMA
-- SoldierIQ Knowledge Management System
-- Generated: 2026-03-09 04:13:24
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: documents
-- Current rows: 5
-- ============================================================================

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_documents_created ON public.documents USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents USING btree (folder_name);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON public.documents USING gin (metadata);
CREATE INDEX IF NOT EXISTS idx_documents_org_user ON public.documents USING btree (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents USING btree (status);

-- ============================================================================
-- TABLE: podcasts
-- Current rows: 0
-- ============================================================================

-- Indexes for podcasts
CREATE INDEX IF NOT EXISTS idx_podcasts_created ON public.podcasts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_podcasts_org_user ON public.podcasts USING btree (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_status ON public.podcasts USING btree (status);

-- ============================================================================
-- TABLE: tak_configuration
-- Current rows: 0
-- ============================================================================

-- Indexes for tak_configuration
CREATE INDEX IF NOT EXISTS idx_tak_config_enabled ON public.tak_configuration USING btree (tak_enabled);
CREATE INDEX IF NOT EXISTS idx_tak_config_org ON public.tak_configuration USING btree (organization_id);
CREATE UNIQUE INDEX tak_configuration_organization_id_key ON public.tak_configuration USING btree (organization_id);

-- ============================================================================
-- TABLE: workflows
-- Current rows: 0
-- ============================================================================

-- Indexes for workflows
CREATE INDEX IF NOT EXISTS idx_workflows_created ON public.workflows USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_document_ids ON public.workflows USING gin (document_ids);
CREATE INDEX IF NOT EXISTS idx_workflows_org_user ON public.workflows USING btree (organization_id, user_id);
CREATE INDEX IF NOT EXISTS idx_workflows_type ON public.workflows USING btree (type);
CREATE INDEX IF NOT EXISTS idx_workflows_user ON public.workflows USING btree (user_id);

