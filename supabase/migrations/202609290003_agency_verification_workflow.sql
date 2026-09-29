alter table public.agency_verification_submissions
  alter column status drop default;

create type public.agency_verification_status_v2 as enum (
  'draft',
  'submitted',
  'under_review',
  'verified',
  'rejected'
);

alter table public.agency_verification_submissions
  alter column status type public.agency_verification_status_v2
  using status::text::public.agency_verification_status_v2;

drop type public.agency_verification_status;

alter type public.agency_verification_status_v2
  rename to agency_verification_status;

alter table public.agency_verification_submissions
  alter column status set default 'draft'::public.agency_verification_status,
  alter column submitted_at drop not null,
  alter column submitted_at drop default;

create unique index agency_verification_submissions_one_draft_idx
  on public.agency_verification_submissions (agency_id)
  where status = 'draft';

create unique index agency_verification_documents_submission_type_idx
  on public.agency_verification_documents (submission_id, document_type);

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

create policy "agency verifiers can read agencies"
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
  current_agency_status public.agency_status;
  draft_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency owner or manager role required' using errcode = '42501';
  end if;

  select agency.status
  into current_agency_status
  from public.agencies agency
  where agency.id = target_agency_id;

  if not found then
    raise exception 'agency not found' using errcode = 'P0002';
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

  if current_agency_status <> 'draft' then
    raise exception 'agency is not eligible for a new verification draft'
      using errcode = '55000';
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
  current_submission_status public.agency_verification_status;
  required_path_prefix text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select submission.agency_id, submission.status
  into target_agency_id, current_submission_status
  from public.agency_verification_submissions submission
  where submission.id = target_submission_id;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if current_submission_status <> 'draft' then
    raise exception 'verification submission is not editable' using errcode = '55000';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency owner or manager role required' using errcode = '42501';
  end if;

  if target_document_type not in (
    'business_registration',
    'business_permit',
    'authorized_representative_id',
    'dot_accreditation'
  ) then
    raise exception 'unsupported verification document type' using errcode = '22023';
  end if;

  required_path_prefix := format(
    'agency/%s/%s/%s/',
    target_agency_id,
    target_submission_id,
    target_document_id
  );

  if target_storage_path is null
    or left(target_storage_path, char_length(required_path_prefix)) <> required_path_prefix then
    raise exception 'verification document storage path is invalid'
      using errcode = '22023';
  end if;

  insert into public.agency_verification_documents (
    id,
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
    target_document_id,
    target_submission_id,
    target_agency_id,
    target_document_type,
    target_storage_path,
    target_original_name,
    target_mime_type,
    target_size_bytes,
    current_user_id
  );

  return target_document_id;
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
  current_submission_status public.agency_verification_status;
  removed_storage_path text;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select document.agency_id, submission.status, document.storage_path
  into target_agency_id, current_submission_status, removed_storage_path
  from public.agency_verification_documents document
  join public.agency_verification_submissions submission
    on submission.id = document.submission_id
  where document.id = target_document_id;

  if not found then
    raise exception 'verification document not found' using errcode = 'P0002';
  end if;

  if current_submission_status <> 'draft' then
    raise exception 'verification submission is not editable' using errcode = '55000';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency owner or manager role required' using errcode = '42501';
  end if;

  delete from public.agency_verification_documents
  where id = target_document_id;

  return removed_storage_path;
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
  current_submission_status public.agency_verification_status;
  current_agency_status public.agency_status;
  required_document_count integer;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select submission.agency_id, submission.status, agency.status
  into target_agency_id, current_submission_status, current_agency_status
  from public.agency_verification_submissions submission
  join public.agencies agency on agency.id = submission.agency_id
  where submission.id = target_submission_id;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if not public.has_agency_role(
    target_agency_id,
    array['owner', 'manager']::public.agency_member_role[]
  ) then
    raise exception 'agency owner or manager role required' using errcode = '42501';
  end if;

  if current_submission_status <> 'draft' or current_agency_status <> 'draft' then
    raise exception 'verification submission cannot be submitted'
      using errcode = '55000';
  end if;

  select count(distinct document.document_type)
  into required_document_count
  from public.agency_verification_documents document
  where document.submission_id = target_submission_id
    and document.document_type in (
      'business_registration',
      'business_permit',
      'authorized_representative_id'
    );

  if required_document_count <> 3 then
    raise exception 'all required verification documents must be provided'
      using errcode = '23514';
  end if;

  update public.agency_verification_submissions
  set status = 'submitted',
      submitted_by = current_user_id,
      submitted_at = now()
  where id = target_submission_id
    and status = 'draft';

  if not found then
    raise exception 'verification submission changed before submit'
      using errcode = '40001';
  end if;

  update public.agencies
  set status = 'submitted',
      verified_at = null,
      suspended_at = null
  where id = target_agency_id
    and status = 'draft';

  if not found then
    raise exception 'agency changed before verification submit'
      using errcode = '40001';
  end if;
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
  current_submission_status public.agency_verification_status;
  current_agency_status public.agency_status;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  ) then
    raise exception 'agency verifier role required' using errcode = '42501';
  end if;

  select submission.agency_id, submission.status, agency.status
  into target_agency_id, current_submission_status, current_agency_status
  from public.agency_verification_submissions submission
  join public.agencies agency on agency.id = submission.agency_id
  where submission.id = target_submission_id;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if current_submission_status <> 'submitted'
    or current_agency_status <> 'submitted' then
    raise exception 'verification submission is not ready for review'
      using errcode = '55000';
  end if;

  update public.agency_verification_submissions
  set status = 'under_review'
  where id = target_submission_id
    and status = 'submitted';

  if not found then
    raise exception 'verification submission changed before review'
      using errcode = '40001';
  end if;

  update public.agencies
  set status = 'under_review'
  where id = target_agency_id
    and status = 'submitted';

  if not found then
    raise exception 'agency changed before review' using errcode = '40001';
  end if;
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
  current_submission_status public.agency_verification_status;
  current_agency_status public.agency_status;
  normalized_notes text := nullif(trim(target_notes), '');
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  ) then
    raise exception 'agency verifier role required' using errcode = '42501';
  end if;

  if target_decision not in ('verified', 'rejected') then
    raise exception 'verification decision must be verified or rejected'
      using errcode = '22023';
  end if;

  if target_decision = 'rejected' and normalized_notes is null then
    raise exception 'rejection notes are required' using errcode = '22023';
  end if;

  select submission.agency_id, submission.status, agency.status
  into target_agency_id, current_submission_status, current_agency_status
  from public.agency_verification_submissions submission
  join public.agencies agency on agency.id = submission.agency_id
  where submission.id = target_submission_id;

  if not found then
    raise exception 'verification submission not found' using errcode = 'P0002';
  end if;

  if current_submission_status <> 'under_review'
    or current_agency_status <> 'under_review' then
    raise exception 'verification submission is not under review'
      using errcode = '55000';
  end if;

  update public.agency_verification_submissions
  set status = target_decision,
      reviewed_by = current_user_id,
      reviewed_at = now(),
      decision_notes = normalized_notes
  where id = target_submission_id
    and status = 'under_review';

  if not found then
    raise exception 'verification submission changed before decision'
      using errcode = '40001';
  end if;

  update public.agencies
  set status = target_decision::text::public.agency_status,
      verified_at = case when target_decision = 'verified' then now() else null end,
      suspended_at = null
  where id = target_agency_id
    and status = 'under_review';

  if not found then
    raise exception 'agency changed before verification decision'
      using errcode = '40001';
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
