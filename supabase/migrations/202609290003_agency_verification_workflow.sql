alter type public.agency_verification_status
  rename to agency_verification_status_old;

create type public.agency_verification_status as enum (
  'draft',
  'submitted',
  'under_review',
  'verified',
  'rejected'
);

alter table public.agency_verification_submissions
  alter column status drop default,
  alter column submitted_at drop default,
  alter column submitted_at drop not null;

alter table public.agency_verification_submissions
  alter column status type public.agency_verification_status
  using status::text::public.agency_verification_status;

drop type public.agency_verification_status_old;

alter table public.agency_verification_submissions
  alter column status set default 'draft';

alter table public.agency_verification_submissions
  add constraint agency_verification_submissions_state_check
  check (
    (
      status = 'draft'
      and submitted_at is null
      and reviewed_at is null
      and reviewed_by is null
    )
    or (
      status in ('submitted', 'under_review')
      and submitted_at is not null
      and reviewed_at is null
      and reviewed_by is null
    )
    or (
      status in ('verified', 'rejected')
      and submitted_at is not null
      and reviewed_at is not null
      and reviewed_by is not null
    )
  );

create unique index agency_verification_submissions_one_draft_idx
  on public.agency_verification_submissions (agency_id)
  where (status = 'draft');

alter table public.agency_verification_documents
  add constraint agency_verification_documents_supported_type_check
  check (
    document_type in (
      'business_registration',
      'business_permit',
      'authorized_representative_id',
      'dot_accreditation'
    )
  );

create unique index agency_verification_documents_category_idx
  on public.agency_verification_documents (submission_id, document_type);

create policy "verification admins can read agencies for review"
on public.agencies
for select
to authenticated
using (
  public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  )
);

create or replace function public.create_verification_draft(
  target_agency_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  agency_state public.agency_status;
  draft_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency verification access denied' using errcode = '42501';
  end if;

  select agency.status
  into agency_state
  from public.agencies agency
  where agency.id = target_agency_id
  for update;

  if not found then
    raise exception 'agency not found' using errcode = 'P0002';
  end if;

  if agency_state <> 'draft' then
    raise exception 'agency cannot start a verification draft from status %', agency_state
      using errcode = '22023';
  end if;

  select submission.id
  into draft_id
  from public.agency_verification_submissions submission
  where submission.agency_id = target_agency_id
    and submission.status = 'draft'
  limit 1;

  if draft_id is not null then
    return draft_id;
  end if;

  begin
    insert into public.agency_verification_submissions (
      agency_id,
      status,
      submitted_by,
      submitted_at
    )
    values (
      target_agency_id,
      'draft',
      current_user_id,
      null
    )
    returning id into draft_id;
  exception
    when unique_violation then
      select submission.id
      into draft_id
      from public.agency_verification_submissions submission
      where submission.agency_id = target_agency_id
        and submission.status = 'draft'
      limit 1;

      if draft_id is null then
        raise;
      end if;
  end;

  return draft_id;
end;
$$;

create or replace function public.register_verification_document(
  target_submission_id uuid,
  target_document_id uuid,
  target_document_type text,
  target_storage_path text,
  target_original_name text,
  target_mime_type text,
  target_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_agency_id uuid;
  submission_state public.agency_verification_status;
  expected_prefix text;
  new_document_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if target_document_type not in (
    'business_registration',
    'business_permit',
    'authorized_representative_id',
    'dot_accreditation'
  ) then
    raise exception 'unsupported verification document type'
      using errcode = '22023';
  end if;

  select submission.agency_id, submission.status
  into target_agency_id, submission_state
  from public.agency_verification_submissions submission
  where submission.id = target_submission_id
  for update;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency verification access denied' using errcode = '42501';
  end if;

  if submission_state <> 'draft' then
    raise exception 'verification submission is not editable'
      using errcode = '22023';
  end if;

  expected_prefix := format(
    'agency/%s/%s/%s/%s-',
    target_agency_id,
    target_submission_id,
    target_document_type,
    target_document_id
  );

  if target_storage_path is null
    or target_storage_path not like expected_prefix || '%'
    or char_length(target_storage_path) <= char_length(expected_prefix)
  then
    raise exception 'verification storage path does not match submission'
      using errcode = '22023';
  end if;

  if nullif(trim(target_original_name), '') is null
    or nullif(trim(target_mime_type), '') is null
    or target_size_bytes is null
    or target_size_bytes <= 0
  then
    raise exception 'invalid verification document metadata'
      using errcode = '22023';
  end if;

  insert into public.agency_verification_documents (
    submission_id,
    agency_id,
    document_type,
    storage_path,
    original_name,
    mime_type,
    size_bytes,
    uploaded_by
  )
  values (
    target_submission_id,
    target_agency_id,
    target_document_type,
    target_storage_path,
    trim(target_original_name),
    trim(target_mime_type),
    target_size_bytes,
    current_user_id
  )
  returning id into new_document_id;

  return new_document_id;
end;
$$;

create or replace function public.remove_verification_document(
  target_document_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_agency_id uuid;
  submission_state public.agency_verification_status;
  target_storage_path text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select document.agency_id, submission.status, document.storage_path
  into target_agency_id, submission_state, target_storage_path
  from public.agency_verification_documents document
  join public.agency_verification_submissions submission
    on submission.id = document.submission_id
  where document.id = target_document_id
  for update of document, submission;

  if not found then
    raise exception 'verification document not found' using errcode = 'P0002';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency verification access denied' using errcode = '42501';
  end if;

  if submission_state <> 'draft' then
    raise exception 'verification submission is not editable'
      using errcode = '22023';
  end if;

  delete from public.agency_verification_documents
  where id = target_document_id;

  return target_storage_path;
end;
$$;

create or replace function public.submit_agency_verification(
  target_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_agency_id uuid;
  submission_state public.agency_verification_status;
  agency_state public.agency_status;
  required_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select submission.agency_id, submission.status, agency.status
  into target_agency_id, submission_state, agency_state
  from public.agency_verification_submissions submission
  join public.agencies agency on agency.id = submission.agency_id
  where submission.id = target_submission_id
  for update of submission, agency;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency verification access denied' using errcode = '42501';
  end if;

  if submission_state <> 'draft' or agency_state <> 'draft' then
    raise exception 'verification submission cannot be submitted from current status'
      using errcode = '22023';
  end if;

  select count(distinct document.document_type)
  into required_count
  from public.agency_verification_documents document
  where document.submission_id = target_submission_id
    and document.document_type in (
      'business_registration',
      'business_permit',
      'authorized_representative_id'
    );

  if required_count <> 3 then
    raise exception 'verification application is incomplete'
      using errcode = '23514';
  end if;

  update public.agency_verification_submissions
  set status = 'submitted',
      submitted_by = current_user_id,
      submitted_at = now(),
      reviewed_by = null,
      reviewed_at = null,
      decision_notes = null
  where id = target_submission_id;

  update public.agencies
  set status = 'submitted',
      verified_at = null,
      suspended_at = null
  where id = target_agency_id;
end;
$$;

create or replace function public.start_agency_verification_review(
  target_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_agency_id uuid;
  submission_state public.agency_verification_status;
  agency_state public.agency_status;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  ) then
    raise exception 'agency verification review access denied'
      using errcode = '42501';
  end if;

  select submission.agency_id, submission.status, agency.status
  into target_agency_id, submission_state, agency_state
  from public.agency_verification_submissions submission
  join public.agencies agency on agency.id = submission.agency_id
  where submission.id = target_submission_id
  for update of submission, agency;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if submission_state <> 'submitted' or agency_state <> 'submitted' then
    raise exception 'verification submission cannot enter review from current status'
      using errcode = '22023';
  end if;

  update public.agency_verification_submissions
  set status = 'under_review'
  where id = target_submission_id;

  update public.agencies
  set status = 'under_review'
  where id = target_agency_id;
end;
$$;

create or replace function public.decide_agency_verification(
  target_submission_id uuid,
  target_decision public.agency_verification_status,
  target_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_agency_id uuid;
  submission_state public.agency_verification_status;
  agency_state public.agency_status;
  normalized_notes text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  ) then
    raise exception 'agency verification decision access denied'
      using errcode = '42501';
  end if;

  if target_decision not in ('verified', 'rejected') then
    raise exception 'verification decision must be verified or rejected'
      using errcode = '22023';
  end if;

  normalized_notes := nullif(trim(target_notes), '');

  if target_decision = 'rejected' and normalized_notes is null then
    raise exception 'rejection notes are required' using errcode = '23514';
  end if;

  select submission.agency_id, submission.status, agency.status
  into target_agency_id, submission_state, agency_state
  from public.agency_verification_submissions submission
  join public.agencies agency on agency.id = submission.agency_id
  where submission.id = target_submission_id
  for update of submission, agency;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if submission_state <> 'under_review' or agency_state <> 'under_review' then
    raise exception 'verification submission cannot be decided from current status'
      using errcode = '22023';
  end if;

  update public.agency_verification_submissions
  set status = target_decision,
      reviewed_by = current_user_id,
      reviewed_at = now(),
      decision_notes = normalized_notes
  where id = target_submission_id;

  if target_decision = 'verified' then
    update public.agencies
    set status = 'verified',
        verified_at = now(),
        suspended_at = null
    where id = target_agency_id;
  else
    update public.agencies
    set status = 'rejected',
        verified_at = null,
        suspended_at = null
    where id = target_agency_id;
  end if;
end;
$$;

revoke all on function public.create_verification_draft(uuid) from public;
revoke all on function public.register_verification_document(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint
) from public;
revoke all on function public.remove_verification_document(uuid) from public;
revoke all on function public.submit_agency_verification(uuid) from public;
revoke all on function public.start_agency_verification_review(uuid) from public;
revoke all on function public.decide_agency_verification(
  uuid,
  public.agency_verification_status,
  text
) from public;

grant execute on function public.create_verification_draft(uuid) to authenticated;
grant execute on function public.register_verification_document(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  bigint
) to authenticated;
grant execute on function public.remove_verification_document(uuid) to authenticated;
grant execute on function public.submit_agency_verification(uuid) to authenticated;
grant execute on function public.start_agency_verification_review(uuid) to authenticated;
grant execute on function public.decide_agency_verification(
  uuid,
  public.agency_verification_status,
  text
) to authenticated;
