-- ============================================================================
-- EMI Dashboard — ROLLBACK (emergency undo of schema refactoring)
-- Drops all new tables and types. Old 'tickets' table is untouched.
-- Date: April 10, 2026
-- Usage: Only run if something goes wrong. This is the nuclear option.
-- ============================================================================

-- Drop VIEW first (depends on tables)
DROP VIEW IF EXISTS tickets_flat;

-- Drop child tables (CASCADE handles FK constraints)
DROP TABLE IF EXISTS ticket_employee_extractions CASCADE;
DROP TABLE IF EXISTS ticket_vision_results CASCADE;
DROP TABLE IF EXISTS ticket_attachments CASCADE;
DROP TABLE IF EXISTS ticket_emails CASCADE;

-- Drop core table
DROP TABLE IF EXISTS tickets_v2 CASCADE;

-- Drop ENUMs
DROP TYPE IF EXISTS ticket_status CASCADE;
DROP TYPE IF EXISTS ticket_scenario CASCADE;
DROP TYPE IF EXISTS ticket_risk_level CASCADE;
DROP TYPE IF EXISTS ticket_type CASCADE;

-- Drop triggers and functions
DROP FUNCTION IF EXISTS update_updated_at CASCADE;
DROP FUNCTION IF EXISTS generate_ticket_number CASCADE;

-- ============================================================================
-- After running this, the system reverts to the old flat 'tickets' table.
-- Dashboard code should still work if loadState() reads from 'tickets'.
-- ============================================================================
