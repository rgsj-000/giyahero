create type public.package_publication_status as enum (
  'draft',
  'pending_first_review',
  'published',
  'changes_requested',
  'unpublished',
  'suspended',
  'archived'
);

create type public.package_pricing_model as enum (
  'per_person',
  'per_group',
  'tiered',
  'variant'
);

create type public.package_schedule_model as enum (
  'fixed_departures',
  'open_dates'
);

create table public.countries (
  code char(2) primary key check (code = upper(code)),
  name text not null unique
);

create table public.geographic_regions (
  country_code char(2) not null references public.countries(code) on delete restrict,
  code text not null,
  name text not null,
  primary key (country_code, code)
);

create table public.provinces (
  id uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  region_code text not null,
  code text not null unique,
  name text not null,
  unique (id, country_code),
  foreign key (country_code, region_code)
    references public.geographic_regions(country_code, code)
    on delete restrict
);

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(id) on delete restrict,
  code text,
  name text not null,
  unique (id, province_id),
  unique (province_id, name)
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(id) on delete restrict,
  municipality_id uuid,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, province_id),
  foreign key (municipality_id, province_id)
    references public.municipalities(id, province_id)
    on delete restrict
);

create table public.agency_service_areas (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  province_id uuid not null references public.provinces(id) on delete restrict,
  municipality_id uuid,
  created_at timestamptz not null default now(),
  foreign key (municipality_id, province_id)
    references public.municipalities(id, province_id)
    on delete restrict
);

create unique index agency_service_areas_unique_idx
  on public.agency_service_areas (agency_id, province_id, municipality_id) nulls not distinct;

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(trim(title)) between 5 and 180),
  overview text not null default '',
  trip_type text not null check (char_length(trim(trip_type)) between 2 and 80),
  duration_days smallint not null check (duration_days between 1 and 90),
  min_travelers smallint not null default 1 check (min_travelers > 0),
  max_travelers smallint not null,
  meeting_point text,
  transport_included boolean not null default false,
  accommodation_included boolean not null default false,
  meals_included boolean not null default false,
  currency_code char(3) not null default 'PHP'
    check (currency_code ~ '^[A-Z]{3}$'),
  pricing_model public.package_pricing_model not null,
  schedule_model public.package_schedule_model not null,
  open_date_start date,
  open_date_end date,
  publication_status public.package_publication_status not null default 'draft',
  first_reviewed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, agency_id),
  check (max_travelers >= min_travelers),
  check (
    (open_date_start is null and open_date_end is null)
    or (
      schedule_model = 'open_dates'
      and open_date_start is not null
      and open_date_end is not null
      and open_date_end >= open_date_start
    )
  ),
  check (
    publication_status = 'draft'
    or (
      schedule_model = 'fixed_departures'
      and open_date_start is null
      and open_date_end is null
    )
    or (
      schedule_model = 'open_dates'
      and open_date_start is not null
      and open_date_end is not null
    )
  )
);

create table public.package_destinations (
  package_id uuid not null references public.packages(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete restrict,
  sort_order smallint not null default 0 check (sort_order >= 0),
  primary key (package_id, destination_id)
);

create table public.package_itinerary_days (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  day_number smallint not null check (day_number > 0),
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null,
  unique (package_id, day_number)
);

create table public.package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  feature_type text not null check (feature_type in ('inclusion', 'exclusion')),
  description text not null check (char_length(trim(description)) between 2 and 300),
  sort_order smallint not null default 0 check (sort_order >= 0)
);

create table public.package_media (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null check (char_length(trim(alt_text)) between 2 and 200),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now()
);

create table public.package_prices (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 2 and 120),
  min_travelers smallint not null default 1 check (min_travelers > 0),
  max_travelers smallint,
  amount_minor bigint not null
    check (amount_minor between 1 and 9007199254740991),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  check (max_travelers is null or max_travelers >= min_travelers)
);

create unique index package_prices_label_unique_idx
  on public.package_prices (package_id, lower(label));

create table public.package_policies (
  package_id uuid primary key references public.packages(id) on delete cascade,
  cancellation_terms text not null default '',
  rescheduling_terms text not null default '',
  no_show_terms text not null default '',
  agency_cancellation_terms text not null default '',
  updated_at timestamptz not null default now()
);

create table public.package_departures (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  booking_cutoff_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  is_cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (booking_cutoff_at < starts_at),
  unique (package_id, starts_at)
);

create table public.package_tags (
  package_id uuid not null references public.packages(id) on delete cascade,
  tag text not null check (char_length(trim(tag)) between 2 and 60),
  primary key (package_id, tag)
);

create index provinces_region_idx
  on public.provinces (country_code, region_code);

create index municipalities_province_idx
  on public.municipalities (province_id);

create index destinations_province_active_idx
  on public.destinations (province_id, is_active, name);

create index agency_service_areas_province_idx
  on public.agency_service_areas (province_id, municipality_id);

create index packages_public_search_idx
  on public.packages (publication_status, trip_type, duration_days, created_at desc);

create index packages_agency_status_idx
  on public.packages (agency_id, publication_status, updated_at desc);

create index package_destinations_destination_idx
  on public.package_destinations (destination_id, package_id);

create index package_prices_budget_idx
  on public.package_prices (amount_minor, package_id);

create index package_departures_search_idx
  on public.package_departures (starts_at, package_id)
  where not is_cancelled;

create trigger packages_set_updated_at
before update on public.packages
for each row execute function public.set_updated_at();

create trigger package_policies_set_updated_at
before update on public.package_policies
for each row execute function public.set_updated_at();

alter table public.countries enable row level security;
alter table public.geographic_regions enable row level security;
alter table public.provinces enable row level security;
alter table public.municipalities enable row level security;
alter table public.destinations enable row level security;
alter table public.agency_service_areas enable row level security;
alter table public.packages enable row level security;
alter table public.package_destinations enable row level security;
alter table public.package_itinerary_days enable row level security;
alter table public.package_features enable row level security;
alter table public.package_media enable row level security;
alter table public.package_prices enable row level security;
alter table public.package_policies enable row level security;
alter table public.package_departures enable row level security;
alter table public.package_tags enable row level security;

create or replace function public.can_read_package(target_package_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.packages package
    join public.agencies agency on agency.id = package.agency_id
    where package.id = target_package_id
      and (
        (
          package.publication_status = 'published'
          and agency.status = 'verified'
        )
        or public.has_agency_role(
          package.agency_id,
          array[
            'owner',
            'manager',
            'content_staff',
            'read_only'
          ]::public.agency_member_role[]
        )
        or public.has_platform_admin_role(
          array['super_admin', 'moderator', 'content_admin']::public.platform_admin_role[]
        )
      )
  );
$$;

revoke all on function public.can_read_package(uuid) from public;
grant execute on function public.can_read_package(uuid) to anon, authenticated;

create policy "geography is publicly readable"
on public.countries
for select
to anon, authenticated
using (true);

create policy "geography is publicly readable"
on public.geographic_regions
for select
to anon, authenticated
using (true);

create policy "geography is publicly readable"
on public.provinces
for select
to anon, authenticated
using (true);

create policy "geography is publicly readable"
on public.municipalities
for select
to anon, authenticated
using (true);

create policy "active destinations are publicly readable"
on public.destinations
for select
to anon, authenticated
using (
  is_active
  or exists (
    select 1
    from public.packages package
    where package.id in (
      select package_destination.package_id
      from public.package_destinations package_destination
      where package_destination.destination_id = destinations.id
    )
      and public.can_read_package(package.id)
  )
);

create policy "verified agency service areas are public and members can read own"
on public.agency_service_areas
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.agencies agency
    where agency.id = agency_service_areas.agency_id
      and agency.status = 'verified'
  )
  or (
    (select auth.uid()) is not null
    and public.has_agency_role(
      agency_id,
      array['owner', 'manager', 'booking_staff', 'content_staff', 'read_only']::public.agency_member_role[]
    )
  )
);

create policy "visible packages are readable"
on public.packages
for select
to anon, authenticated
using (public.can_read_package(id));

create policy "visible package destinations are readable"
on public.package_destinations
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package itinerary is readable"
on public.package_itinerary_days
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package features are readable"
on public.package_features
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package media is readable"
on public.package_media
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package prices are readable"
on public.package_prices
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package policies are readable"
on public.package_policies
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package departures are readable"
on public.package_departures
for select
to anon, authenticated
using (public.can_read_package(package_id));

create policy "visible package tags are readable"
on public.package_tags
for select
to anon, authenticated
using (public.can_read_package(package_id));

grant select on
  public.countries,
  public.geographic_regions,
  public.provinces,
  public.municipalities,
  public.destinations,
  public.agency_service_areas,
  public.packages,
  public.package_destinations,
  public.package_itinerary_days,
  public.package_features,
  public.package_media,
  public.package_prices,
  public.package_policies,
  public.package_departures,
  public.package_tags
to anon, authenticated;

insert into public.countries (code, name)
values ('PH', 'Philippines')
on conflict (code) do nothing;

insert into public.geographic_regions (country_code, code, name)
values ('PH', 'PH-4A', 'CALABARZON')
on conflict (country_code, code) do nothing;

insert into public.provinces (country_code, region_code, code, name)
values ('PH', 'PH-4A', 'PH-QUE', 'Quezon')
on conflict (code) do nothing;
