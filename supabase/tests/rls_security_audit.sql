-- ==============================================================================
-- AUTOMATED RLS SECURITY VERIFICATION TEST SUITE (pgTAP / SQL Test Harness)
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(14);

-- ------------------------------------------------------------------------------
-- Test 1: Verify RLS is enabled and forced on all tables
-- ------------------------------------------------------------------------------
SELECT row_level_security_is_enabled('public', 'profiles', 'RLS is enabled on profiles');
SELECT row_level_security_is_enabled('public', 'checkin_tickets', 'RLS is enabled on checkin_tickets');
SELECT row_level_security_is_enabled('public', 'booking_requests', 'RLS is enabled on booking_requests');
SELECT row_level_security_is_enabled('public', 'issues', 'RLS is enabled on issues');
SELECT row_level_security_is_enabled('public', 'issue_votes', 'RLS is enabled on issue_votes');
SELECT row_level_security_is_enabled('public', 'announcements', 'RLS is enabled on announcements');

-- ------------------------------------------------------------------------------
-- Test 2: Anonymous Role Cannot Read Profiles or Tickets
-- ------------------------------------------------------------------------------
SET ROLE anon;

SELECT throws_ok(
    $$ SELECT * FROM public.profiles $$,
    '42501',
    NULL,
    'anon is denied select access on public.profiles'
);

SELECT throws_ok(
    $$ SELECT * FROM public.checkin_tickets $$,
    '42501',
    NULL,
    'anon is denied select access on public.checkin_tickets'
);

SELECT throws_ok(
    $$ SELECT * FROM public.booking_requests $$,
    '42501',
    NULL,
    'anon is denied select access on public.booking_requests'
);

-- ------------------------------------------------------------------------------
-- Test 3: Authenticated User A cannot insert rows with User B's user_id (Anti-IDOR)
-- ------------------------------------------------------------------------------
SET ROLE authenticated;

-- Simulate User A JWT claims
SET LOCAL "request.jwt.claims" = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "authenticated"}';

SELECT throws_ok(
    $$ INSERT INTO public.checkin_tickets (user_id, ticket_code) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '#TKT-9999') $$,
    '42501',
    NULL,
    'User A cannot insert checkin ticket for User B (WITH CHECK violation)'
);

SELECT throws_ok(
    $$ INSERT INTO public.booking_requests (user_id, room_number, requested_date, requested_slot, program_name, description)
       VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '3', CURRENT_DATE, '09:00 - 11:00', 'Comp', 'Hack') $$,
    '42501',
    NULL,
    'User A cannot insert booking request for User B (WITH CHECK violation)'
);

-- ------------------------------------------------------------------------------
-- Test 4: View active_user_bookings has security_invoker = true
-- ------------------------------------------------------------------------------
SELECT ok(
    (SELECT relsecurityinvoker FROM pg_class WHERE relname = 'active_user_bookings'),
    'active_user_bookings has security_invoker = true'
);

-- ------------------------------------------------------------------------------
-- Test 5: Storage objects cannot be read across tenant folders
-- ------------------------------------------------------------------------------
SELECT throws_ok(
    $$ SELECT * FROM storage.objects WHERE bucket_id = 'user_evidence' AND (storage.foldername(name))[1] = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
    NULL, -- Returns 0 rows through RLS or permission denied
    NULL,
    'User A cannot read User B storage files'
);

SELECT * FROM finish();
ROLLBACK;
