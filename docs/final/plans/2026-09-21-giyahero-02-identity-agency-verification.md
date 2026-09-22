# GiyaHero 02 Identity, Agency Organizations, and Verification Implementation Plan

**Goal:** Implement secure traveler authentication, agency organizations with multiple staff accounts, platform admin capabilities, invitation workflows, and manual agency verification with private supporting documents.

## Core model

Supabase Auth owns credentials and OAuth sessions. GiyaHero owns profiles, agency memberships, invitations, roles, platform admin permissions, and verification state in PostgreSQL.

## Tasks

1. Create `profiles` linked to `auth.users`.
2. Implement traveler email/password registration, Google OAuth, email verification, login, logout, and password reset.
3. Create `agencies`, `agency_members`, and `agency_invitations`.
4. Implement roles: Owner, Manager, Booking Staff, Content Staff, Read Only.
5. Add server side permission helpers that combine capability checks with agency ownership.
6. Create platform admin membership/capability tables separated from agency roles.
7. Require MFA for admin access.
8. Implement agency onboarding profile flow.
9. Create manual verification submissions and verification document records.
10. Use a private storage bucket for agency verification documents.
11. Serve sensitive verification documents only through authorized short lived signed URLs.
12. Implement verification states: Draft, Submitted, Under Review, Needs Changes, Verified, Rejected, Suspended.
13. Add audit events for staff invitations, role changes, verification decisions, and suspensions.
14. Add RLS policies protecting traveler, agency, and admin private data.

## Security rules

1. A traveler may read and update only their own private profile data.
2. Agency staff may access private agency resources only for organizations they belong to.
3. Content Staff cannot manage organization membership.
4. Booking Staff cannot manage commission or ownership configuration.
5. Agency roles cannot grant platform admin access.
6. Platform admin capabilities are explicit rather than a single broad `is_admin` flag.
7. Service role credentials remain server only.
8. Verification documents are never placed in public buckets.

## Required tests

1. Traveler A cannot read Traveler B private profile state.
2. Agency A staff cannot read or mutate Agency B private records.
3. Staff role permissions are enforced server side.
4. Invitation tokens expire and cannot be replayed after acceptance.
5. Unverified agencies cannot publish marketplace content.
6. Verification document signed URLs require authorization.
7. Admin only actions reject non admin sessions.
8. Admin MFA gate is enforced before privileged operations.

## Release gate

Travelers can authenticate, an agency can create an organization and invite staff, roles are enforced, an agency can submit verification documents, authorized admins can review and verify/reject, private documents remain protected, and RLS integration tests prove tenant isolation.
