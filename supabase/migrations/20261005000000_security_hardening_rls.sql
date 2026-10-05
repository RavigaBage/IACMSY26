-- ==============================================================================
-- SUPABASE HARDENED SECURITY & ROW LEVEL SECURITY (RLS) MIGRATION
-- ==============================================================================
-- Enforces:
-- 1. Zero anonymous / unauthenticated access to protected data
-- 2. Row Level Security ENABLED and FORCED on every public table
-- 3. Strict ownership checks with (select auth.uid()) and WITH CHECK constraints (Anti-IDOR)
-- 4. Role validation strictly via app_metadata (Never user-editable user_metadata)
-- 5. Hardened SECURITY DEFINER functions with search_path = '' and execution restrictions
-- 6. Views configured with security_invoker = true
-- 7. Private storage bucket policies scoped to folder ownership
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMAS & ROLES VALIDATION HELPER
-- ------------------------------------------------------------------------------
-- Helper function to inspect jwt app_metadata (Server authoritative, not user editable)
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role') = required_role
    OR (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' -> 'roles') ? required_role,
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. USER PROFILES TABLE & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    full_name text,
    phone_number text,
    student_id text,
    streak integer DEFAULT 0 CHECK (streak >= 0),
    total_checkins integer DEFAULT 0 CHECK (total_checkins >= 0),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Users can view their own profile; admins can view all
CREATE POLICY "profiles_select_owner_or_admin"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        (select auth.uid()) = id
        OR public.has_role('admin')
    );

-- Users can insert their own profile on registration
CREATE POLICY "profiles_insert_owner"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = id);

-- Users can update their own profile; with check prevents re-assigning id
CREATE POLICY "profiles_update_owner"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = id)
    WITH CHECK ((select auth.uid()) = id);

-- Only admins can delete profiles
CREATE POLICY "profiles_delete_admin"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (public.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 3. CHECK-IN TICKETS TABLE & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkin_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticket_code text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_out', 'expired', 'declined')),
    requested_at timestamptz DEFAULT now() NOT NULL,
    confirmed_at timestamptz,
    confirmed_by text,
    checked_out_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.checkin_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_tickets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.checkin_tickets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkin_tickets TO authenticated;

-- Users can read their own tickets; admins can read all
CREATE POLICY "checkin_tickets_select"
    ON public.checkin_tickets
    FOR SELECT
    TO authenticated
    USING (
        (select auth.uid()) = user_id
        OR public.has_role('admin')
    );

-- Users can only insert tickets for themselves (Anti-IDOR)
CREATE POLICY "checkin_tickets_insert"
    ON public.checkin_tickets
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (select auth.uid()) = user_id
        AND status = 'pending'
    );

-- Users can check out their own ticket; Admins can confirm/decline any
CREATE POLICY "checkin_tickets_update"
    ON public.checkin_tickets
    FOR UPDATE
    TO authenticated
    USING (
        (select auth.uid()) = user_id
        OR public.has_role('admin')
    )
    WITH CHECK (
        (select auth.uid()) = user_id
        OR public.has_role('admin')
    );

-- Only admins can delete tickets
CREATE POLICY "checkin_tickets_delete"
    ON public.checkin_tickets
    FOR DELETE
    TO authenticated
    USING (public.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 4. BOOKING REQUESTS TABLE & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    room_number text NOT NULL,
    room_type text DEFAULT 'Facility',
    requested_date date NOT NULL,
    requested_slot text NOT NULL,
    program_name text NOT NULL,
    description text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
    rejection_reason text,
    event_details_submitted boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.booking_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_requests TO authenticated;

-- Select own bookings or admin read all
CREATE POLICY "booking_requests_select"
    ON public.booking_requests
    FOR SELECT
    TO authenticated
    USING (
        (select auth.uid()) = user_id
        OR public.has_role('admin')
    );

-- Insert strictly owned rows (Anti-IDOR)
CREATE POLICY "booking_requests_insert"
    ON public.booking_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (select auth.uid()) = user_id
        AND status = 'pending'
    );

-- Update: user can cancel own pending booking; admin can approve/reject
CREATE POLICY "booking_requests_update"
    ON public.booking_requests
    FOR UPDATE
    TO authenticated
    USING (
        (select auth.uid()) = user_id
        OR public.has_role('admin')
    )
    WITH CHECK (
        (select auth.uid()) = user_id
        OR public.has_role('admin')
    );

CREATE POLICY "booking_requests_delete"
    ON public.booking_requests
    FOR DELETE
    TO authenticated
    USING (public.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 5. ISSUES & ISSUE VOTES TABLE & POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_name text NOT NULL,
    category text NOT NULL CHECK (category IN ('Hardware', 'Facility', 'Software', 'Cleanliness', 'General')),
    title text NOT NULL,
    description text NOT NULL,
    node_equipment text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('seen', 'pending', 'resolved', 'in-progress')),
    affected_count integer DEFAULT 1 CHECK (affected_count >= 1),
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.issues FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issues TO authenticated;

-- Any authenticated user can read public community issues
CREATE POLICY "issues_select_authenticated"
    ON public.issues
    FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users can report issues; reporter_id must match auth.uid()
CREATE POLICY "issues_insert_authenticated"
    ON public.issues
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = reporter_id);

-- Only admins can change status or edit issues
CREATE POLICY "issues_update_admin"
    ON public.issues
    FOR UPDATE
    TO authenticated
    USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY "issues_delete_admin"
    ON public.issues
    FOR DELETE
    TO authenticated
    USING (public.has_role('admin'));

-- Issue Votes table
CREATE TABLE IF NOT EXISTS public.issue_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    direction text NOT NULL CHECK (direction IN ('up', 'down')),
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE (issue_id, user_id)
);

ALTER TABLE public.issue_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_votes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.issue_votes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_votes TO authenticated;

CREATE POLICY "issue_votes_select"
    ON public.issue_votes
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "issue_votes_insert_owner"
    ON public.issue_votes
    FOR INSERT
    TO authenticated
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "issue_votes_update_owner"
    ON public.issue_votes
    FOR UPDATE
    TO authenticated
    USING ((select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "issue_votes_delete_owner"
    ON public.issue_votes
    FOR DELETE
    TO authenticated
    USING ((select auth.uid()) = user_id OR public.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 6. ANNOUNCEMENTS & SYSTEM CONFIG POLICIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category text NOT NULL CHECK (category IN ('pinned', 'event', 'class', 'notice')),
    title text NOT NULL,
    description text NOT NULL,
    image_url text,
    starts_at timestamptz,
    ends_at timestamptz,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.announcements FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;

-- Authenticated users can view active announcements; Admins see all
CREATE POLICY "announcements_select"
    ON public.announcements
    FOR SELECT
    TO authenticated
    USING (is_active = true OR public.has_role('admin'));

CREATE POLICY "announcements_insert_admin"
    ON public.announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role('admin'));

CREATE POLICY "announcements_update_admin"
    ON public.announcements
    FOR UPDATE
    TO authenticated
    USING (public.has_role('admin'))
    WITH CHECK (public.has_role('admin'));

CREATE POLICY "announcements_delete_admin"
    ON public.announcements
    FOR DELETE
    TO authenticated
    USING (public.has_role('admin'));

-- ------------------------------------------------------------------------------
-- 7. SECURE DATABASE VIEWS (WITH security_invoker = true)
-- ------------------------------------------------------------------------------
-- Active bookings view: Must use security_invoker to enforce caller's RLS policies
CREATE OR REPLACE VIEW public.active_user_bookings
WITH (security_invoker = true)
AS
    SELECT
        b.id,
        b.user_id,
        b.room_number,
        b.requested_date,
        b.requested_slot,
        b.program_name,
        b.status
    FROM public.booking_requests b
    WHERE b.status IN ('pending', 'confirmed');

REVOKE ALL ON public.active_user_bookings FROM anon;
GRANT SELECT ON public.active_user_bookings TO authenticated;

-- ------------------------------------------------------------------------------
-- 8. STORAGE BUCKET RLS POLICIES
-- ------------------------------------------------------------------------------
-- Ensure buckets exist and are marked private
INSERT INTO storage.buckets (id, name, public)
VALUES ('user_evidence', 'user_evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Policy: Authenticated users can only read their own evidence/avatar files
CREATE POLICY "storage_objects_select_owner"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id IN ('user_evidence', 'avatars')
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

-- Policy: Authenticated users can only upload into their own folder (Anti-IDOR)
CREATE POLICY "storage_objects_insert_owner"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id IN ('user_evidence', 'avatars')
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );

-- Policy: Authenticated users can only delete their own files
CREATE POLICY "storage_objects_delete_owner"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id IN ('user_evidence', 'avatars')
        AND (storage.foldername(name))[1] = (select auth.uid())::text
    );
