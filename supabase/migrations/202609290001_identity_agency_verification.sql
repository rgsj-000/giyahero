create type public.agency_status as enum (
  'draft',
  'submitted',
  'under_review',
  'verified',
  'rejected',
  'suspended'
);

create type public.agency_member_role as enum (
  'owner',
  'manager',
  'booking_staff',
  'content_staff',
  'read_only'
);

create type public.platform_admin_role as enum (
  'super_admin',
  'agency_verifier',
  'moderator',
  'support',
  'finance',
  'content_admin'
);

create type public.agency_invitation_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

create type public.agency_verification_status as enum (
  'submitted',
  'under_review',
  'verified',
  'rejected'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admin_memberships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.platform_admin_role not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  legal_name text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  contact_email text,
  contact_phone text,
  website_url text,
  status public.agency_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.agency_member_role not null,
  joined_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table public.agency_invitations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  invitee_email text not null check (invitee_email = lower(invitee_email)),
  role public.agency_member_role not null,
  token_hash text not null unique,
  status public.agency_invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.agency_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  status public.agency_verification_status not null default 'submitted',
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_notes text,
  unique (id, agency_id),
  check (
    (reviewed_at is null and reviewed_by is null)
    or (reviewed_at is not null and reviewed_by is not null)
  )
);

create table public.agency_verification_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  agency_id uuid not null,
  document_type text not null check (char_length(trim(document_type)) between 2 and 80),
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  foreign key (submission_id, agency_id)
    references public.agency_verification_submissions(id, agency_id)
    on delete cascade
);

create index agency_members_user_id_idx
  on public.agency_members(user_id);

create index agency_invitations_agency_status_idx
  on public.agency_invitations(agency_id, status);

create index agency_verification_submissions_agency_idx
  on public.agency_verification_submissions(agency_id, submitted_at desc);

create index agency_verification_documents_submission_idx
  on public.agency_verification_documents(submission_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger agencies_set_updated_at
before update on public.agencies
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1),
      ''
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_agency_role(
  target_agency_id uuid,
  allowed_roles public.agency_member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.agency_members member
    where member.agency_id = target_agency_id
      and member.user_id = (select auth.uid())
      and member.role = any(allowed_roles)
  );
$$;

create or replace function public.has_platform_admin_role(
  allowed_roles public.platform_admin_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admin_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function public.is_mfa_verified()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

revoke all on function public.has_agency_role(uuid, public.agency_member_role[]) from public;
revoke all on function public.has_platform_admin_role(public.platform_admin_role[]) from public;
revoke all on function public.is_mfa_verified() from public;

grant execute on function public.has_agency_role(uuid, public.agency_member_role[]) to authenticated;
grant execute on function public.has_platform_admin_role(public.platform_admin_role[]) to authenticated;
grant execute on function public.is_mfa_verified() to authenticated;

alter table public.profiles enable row level security;
alter table public.platform_admin_memberships enable row level security;
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_invitations enable row level security;
alter table public.agency_verification_submissions enable row level security;
alter table public.agency_verification_documents enable row level security;

create policy "profiles read own"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

create policy "profiles update own"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "admin memberships read own"
on public.platform_admin_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "verified agencies are public and members can read own agency"
on public.agencies
for select
to anon, authenticated
using (
  status = 'verified'
  or created_by = (select auth.uid())
  or public.has_agency_role(
    id,
    array['owner', 'manager', 'booking_staff', 'content_staff', 'read_only']::public.agency_member_role[]
  )
);

create policy "agency members can read their roster"
on public.agency_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_agency_role(
    agency_id,
    array['owner', 'manager', 'booking_staff', 'content_staff', 'read_only']::public.agency_member_role[]
  )
);

create policy "agency managers can read invitations"
on public.agency_invitations
for select
to authenticated
using (
  public.has_agency_role(
    agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  )
);

create policy "authorized users can read verification submissions"
on public.agency_verification_submissions
for select
to authenticated
using (
  public.has_agency_role(
    agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  )
  or public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  )
);

create policy "authorized users can read verification documents"
on public.agency_verification_documents
for select
to authenticated
using (
  public.has_agency_role(
    agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  )
  or public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  )
);
