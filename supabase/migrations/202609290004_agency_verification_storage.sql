insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agency-verification',
  'agency-verification',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "agency verification draft evidence upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'agency-verification'
  and (storage.foldername(name))[1] = 'agency'
  and exists (
    select 1
    from public.agency_verification_submissions submission
    where submission.agency_id::text = (storage.foldername(name))[2]
      and submission.id::text = (storage.foldername(name))[3]
      and submission.status = 'draft'
      and public.has_agency_role(
        submission.agency_id,
        array['owner', 'manager']::public.agency_member_role[]
      )
  )
);

create policy "agency verification evidence read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'agency-verification'
  and (storage.foldername(name))[1] = 'agency'
  and exists (
    select 1
    from public.agency_verification_submissions submission
    where submission.agency_id::text = (storage.foldername(name))[2]
      and submission.id::text = (storage.foldername(name))[3]
      and (
        public.has_agency_role(
          submission.agency_id,
          array['owner', 'manager']::public.agency_member_role[]
        )
        or (
          submission.status in (
            'submitted',
            'under_review',
            'verified',
            'rejected'
          )
          and public.has_platform_admin_role(
            array['super_admin', 'agency_verifier']::public.platform_admin_role[]
          )
        )
      )
  )
);

create policy "agency verification draft evidence delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'agency-verification'
  and (storage.foldername(name))[1] = 'agency'
  and exists (
    select 1
    from public.agency_verification_submissions submission
    where submission.agency_id::text = (storage.foldername(name))[2]
      and submission.id::text = (storage.foldername(name))[3]
      and submission.status = 'draft'
      and public.has_agency_role(
        submission.agency_id,
        array['owner', 'manager']::public.agency_member_role[]
      )
  )
);
