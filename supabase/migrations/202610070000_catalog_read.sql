-- Public RPCs deliberately exclude staff-only drafts and traveler information.
alter table public.package_prices add column is_active boolean not null default true;
alter table public.package_departures add column is_active boolean not null default true;
create function public.catalog_card(target_package_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'id',p.id,'agencyId',a.id,'agencyName',a.name,'slug',p.slug,'title',p.title,
  'durationDays',p.duration_days,'currencyCode',p.currency_code,
  'fromAmountMinor',(select min(r.amount_minor) from public.package_prices r where r.package_id=p.id and r.is_active),
  'imagePath',(select m.storage_path from public.package_media m where m.package_id=p.id order by m.sort_order,m.id limit 1),
  'destinationNames',coalesce((select jsonb_agg(d.name order by pd.sort_order,d.name) from public.package_destinations pd join public.destinations d on d.id=pd.destination_id where pd.package_id=p.id),'[]'::jsonb)
 ) from public.packages p join public.agencies a on a.id=p.agency_id
 where p.id=target_package_id and p.publication_status='published' and a.status='verified';
$$;
revoke all on function public.catalog_card(uuid) from public;

create function public.search_published_packages(filters jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
 n integer:=coalesce((filters->>'limit')::integer,20);
 party integer:=(filters->>'travelers')::integer;
 budget numeric:=(filters->>'maxBudgetMinor')::numeric;
 cursor_at timestamptz;
 cursor_id uuid;
 result jsonb;
begin
 if n not between 1 and 50 or (party is not null and party not between 1 and 32767)
 or (budget is not null and (budget<0 or budget>9007199254740991 or budget<>trunc(budget))) then
  raise exception 'Invalid catalog filters' using errcode='22023';
 end if;
 if filters->>'cursor' is not null then
  cursor_at:=split_part(filters->>'cursor','|',1)::timestamptz;
  cursor_id:=split_part(filters->>'cursor','|',2)::uuid;
 end if;
 with candidates as (
  select p.id,p.created_at from public.packages p join public.agencies a on a.id=p.agency_id
  where p.publication_status='published' and a.status='verified'
  and (cursor_at is null or (p.created_at,p.id)<(cursor_at,cursor_id))
  and (party is null or party between p.min_travelers and p.max_travelers)
  and (filters->>'destinationId' is null or exists(select 1 from public.package_destinations d where d.package_id=p.id and d.destination_id=(filters->>'destinationId')::uuid))
  and exists(select 1 from public.package_prices r where r.package_id=p.id and r.is_active
   and (party is null or (party>=r.min_travelers and (r.max_travelers is null or party<=r.max_travelers)))
   and (budget is null or (p.currency_code='PHP' and r.amount_minor::numeric * case when party is null or p.pricing_model='per_group' then 1 else party end<=budget)))
  and (filters->>'startsOn' is null or (
   (p.schedule_model='open_dates' and (filters->>'startsOn')::date between p.open_date_start and p.open_date_end-p.duration_days+1)
   or (p.schedule_model='fixed_departures' and exists(select 1 from public.package_departures d where d.package_id=p.id and d.is_active and not d.is_cancelled
    and (d.starts_at at time zone 'Asia/Manila')::date=(filters->>'startsOn')::date and d.booking_cutoff_at>now()))))
  order by p.created_at desc,p.id desc limit n+1
 ), page as (select * from candidates order by created_at desc,id desc limit n)
 select jsonb_build_object(
  'items',coalesce((select jsonb_agg(public.catalog_card(id) order by created_at desc,id desc) from page),'[]'::jsonb),
  'nextCursor',case when (select count(*) from candidates)>n then
    (select created_at::text||'|'||id::text from page order by created_at asc,id asc limit 1) else null end
 ) into result;
 return result;
end;
$$;
revoke all on function public.search_published_packages(jsonb) from public;
grant execute on function public.search_published_packages(jsonb) to anon,authenticated;

create function public.get_public_package_detail(target_package_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select public.catalog_card(p.id)||jsonb_build_object(
  'version',p.version,'overview',p.overview,'agencyDescription',a.description,
  'agencyContactEmail',a.contact_email,'agencyContactPhone',a.contact_phone,
  'pricingModel',p.pricing_model,'scheduleModel',p.schedule_model,'minTravelers',p.min_travelers,'maxTravelers',p.max_travelers,
  'openDateWindow',case when p.open_date_start is not null then jsonb_build_object('startsOn',p.open_date_start,'endsOn',p.open_date_end) else null end,
  'rates',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'label',r.label,'amountMinor',r.amount_minor,'minTravelers',r.min_travelers,'maxTravelers',r.max_travelers) order by r.sort_order,r.id) from public.package_prices r where r.package_id=p.id and r.is_active),'[]'::jsonb),
  'departures',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'startsAt',d.starts_at,'endsAt',d.ends_at,'bookingCutoffAt',d.booking_cutoff_at,'capacity',d.capacity,'remainingCapacity',d.capacity) order by d.starts_at) from public.package_departures d where d.package_id=p.id and d.is_active and not d.is_cancelled),'[]'::jsonb),
  'itinerary',coalesce((select jsonb_agg(jsonb_build_object('dayNumber',d.day_number,'title',d.title,'description',d.description) order by d.day_number) from public.package_itinerary_days d where d.package_id=p.id),'[]'::jsonb),
  'inclusions',coalesce((select jsonb_agg(f.description order by f.sort_order,f.id) from public.package_features f where f.package_id=p.id and f.feature_type='inclusion'),'[]'::jsonb),
  'exclusions',coalesce((select jsonb_agg(f.description order by f.sort_order,f.id) from public.package_features f where f.package_id=p.id and f.feature_type='exclusion'),'[]'::jsonb),
  'media',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'storagePath',m.storage_path,'altText',m.alt_text) order by m.sort_order,m.id) from public.package_media m where m.package_id=p.id),'[]'::jsonb),
  'policies',jsonb_build_object('cancellationTerms',pol.cancellation_terms,'reschedulingTerms',pol.rescheduling_terms,'noShowTerms',pol.no_show_terms,'agencyCancellationTerms',pol.agency_cancellation_terms)
 ) from public.packages p join public.agencies a on a.id=p.agency_id
 left join public.package_policies pol on pol.package_id=p.id
 where p.id=target_package_id and p.publication_status='published' and a.status='verified';
$$;
revoke all on function public.get_public_package_detail(uuid) from public;
grant execute on function public.get_public_package_detail(uuid) to anon,authenticated;
