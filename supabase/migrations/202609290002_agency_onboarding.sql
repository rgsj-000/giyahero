create or replace function public.create_agency_with_owner(
  agency_name text,
  agency_slug text,
  agency_legal_name text default null,
  agency_contact_email text default null,
  agency_contact_phone text default null,
  agency_website_url text default null,
  agency_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_agency_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = current_user_id
  ) then
    raise exception 'profile not found' using errcode = '23503';
  end if;

  insert into public.agencies (
    name,
    legal_name,
    slug,
    description,
    contact_email,
    contact_phone,
    website_url,
    created_by
  )
  values (
    trim(agency_name),
    nullif(trim(agency_legal_name), ''),
    lower(trim(agency_slug)),
    nullif(trim(agency_description), ''),
    nullif(lower(trim(agency_contact_email)), ''),
    nullif(trim(agency_contact_phone), ''),
    nullif(trim(agency_website_url), ''),
    current_user_id
  )
  returning id into new_agency_id;

  insert into public.agency_members (agency_id, user_id, role)
  values (new_agency_id, current_user_id, 'owner');

  return new_agency_id;
end;
$$;

revoke all on function public.create_agency_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.create_agency_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
