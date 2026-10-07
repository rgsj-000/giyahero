alter table public.packages add column draft_payload jsonb;
create table public.package_publication_events(
 id uuid primary key default gen_random_uuid(), package_id uuid not null references public.packages(id) on delete restrict,
 actor_id uuid not null references public.profiles(id), status public.package_publication_status not null,
 note text not null default '', created_at timestamptz not null default now()
);
alter table public.package_publication_events enable row level security;
create policy "package reviewers and agency editors read events" on public.package_publication_events for select to authenticated using(
 public.has_agency_role((select p.agency_id from public.packages p where p.id=package_id),array['owner','manager','content_staff']::public.agency_member_role[])
 or public.has_platform_admin_role(array['content_admin','super_admin']::public.platform_admin_role[]));
grant select on public.package_publication_events to authenticated;
create policy "catalog reviewers read packages" on public.packages for select to authenticated using(public.has_platform_admin_role(array['content_admin','super_admin']::public.platform_admin_role[]));

create function public.validate_package_publication(target_package_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare p public.packages; pol public.package_policies;
begin
 select * into strict p from public.packages where id=target_package_id;
 select * into pol from public.package_policies where package_id=p.id;
 if char_length(trim(p.overview)) not between 30 and 8000
 or not exists(select 1 from public.package_destinations where package_id=p.id)
 or not exists(select 1 from public.package_prices where package_id=p.id and is_active)
 or not exists(select 1 from public.package_itinerary_days where package_id=p.id)
 or exists(select 1 from public.package_itinerary_days where package_id=p.id and day_number>p.duration_days)
 or not exists(select 1 from public.package_features where package_id=p.id and feature_type='inclusion')
 or not exists(select 1 from public.package_features where package_id=p.id and feature_type='exclusion')
 or pol.package_id is null or char_length(trim(pol.cancellation_terms)) not between 10 and 4000
 or char_length(trim(pol.rescheduling_terms)) not between 10 and 4000
 or char_length(trim(pol.no_show_terms)) not between 10 and 4000
 or char_length(trim(pol.agency_cancellation_terms)) not between 10 and 4000
 or (p.schedule_model='fixed_departures' and not exists(select 1 from public.package_departures where package_id=p.id and is_active))
 or (p.schedule_model='open_dates' and (p.open_date_start is null or p.open_date_end is null or exists(select 1 from public.package_departures where package_id=p.id and is_active))) then
  raise exception 'Package must be complete before publication or review' using errcode='22023';
 end if;
end;
$$;
revoke all on function public.validate_package_publication(uuid) from public;

create function public.save_package_draft(target_agency_id uuid,target_package_id uuid,expected_version integer,package_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare pid uuid:=coalesce(target_package_id,gen_random_uuid()); p public.packages; item jsonb; rid uuid; kept uuid[]; was_new boolean:=target_package_id is null;
begin
 perform 1 from public.agencies where id=target_agency_id for update;
 if auth.uid() is null or not public.has_agency_role(target_agency_id,array['owner','manager','content_staff']::public.agency_member_role[]) then
  raise exception 'Not authorized to edit this agency' using errcode='42501';
 end if;
 if not was_new then
  select * into p from public.packages where id=pid for update;
  perform 1 from public.package_departures where package_id=pid order by id for update;
  if p.id is null or p.agency_id<>target_agency_id then raise exception 'Not authorized to edit this package' using errcode='42501'; end if;
  if p.version is distinct from expected_version then raise exception 'Package changed; refresh before saving' using errcode='40001'; end if;
  if p.publication_status in ('pending_first_review','archived','suspended') then raise exception 'Package cannot be edited in its current state'; end if;
 end if;
 if jsonb_typeof(package_input->'destinationIds') is distinct from 'array'
 or jsonb_typeof(package_input->'prices') is distinct from 'array'
 or jsonb_typeof(package_input->'departures') is distinct from 'array'
 or jsonb_typeof(package_input->'itinerary') is distinct from 'array'
 or jsonb_typeof(package_input->'inclusions') is distinct from 'array'
 or jsonb_typeof(package_input->'exclusions') is distinct from 'array' then raise exception 'Package lists must be arrays'; end if;
 insert into public.packages(id,agency_id,slug,title,overview,trip_type,duration_days,min_travelers,max_travelers,currency_code,pricing_model,schedule_model,open_date_start,open_date_end,created_by,draft_payload)
 values(pid,target_agency_id,package_input->>'slug',trim(package_input->>'title'),coalesce(trim(package_input->>'overview'),''),package_input->>'tripType',
 (package_input->>'durationDays')::smallint,(package_input->>'minTravelers')::smallint,(package_input->>'maxTravelers')::smallint,
 package_input->>'currencyCode',(package_input->>'pricingModel')::public.package_pricing_model,(package_input->>'scheduleModel')::public.package_schedule_model,
 (package_input#>>'{openDateWindow,startsOn}')::date,(package_input#>>'{openDateWindow,endsOn}')::date,auth.uid(),package_input)
 on conflict(id) do update set slug=excluded.slug,title=excluded.title,overview=excluded.overview,trip_type=excluded.trip_type,
 duration_days=excluded.duration_days,min_travelers=excluded.min_travelers,max_travelers=excluded.max_travelers,currency_code=excluded.currency_code,
 pricing_model=excluded.pricing_model,schedule_model=excluded.schedule_model,open_date_start=excluded.open_date_start,open_date_end=excluded.open_date_end,
 publication_status='draft',version=public.packages.version+1,draft_payload=excluded.draft_payload;
 delete from public.package_destinations where package_id=pid;
 insert into public.package_destinations(package_id,destination_id,sort_order) select pid,value::uuid,(ordinality-1)::smallint from jsonb_array_elements_text(package_input->'destinationIds') with ordinality;
 delete from public.package_itinerary_days where package_id=pid;
 insert into public.package_itinerary_days(package_id,day_number,title,description)
 select pid,(i->>'dayNumber')::smallint,trim(i->>'title'),trim(i->>'description') from jsonb_array_elements(package_input->'itinerary') i;
 delete from public.package_features where package_id=pid;
 insert into public.package_features(package_id,feature_type,description) select pid,'inclusion',trim(value) from jsonb_array_elements_text(package_input->'inclusions');
 insert into public.package_features(package_id,feature_type,description) select pid,'exclusion',trim(value) from jsonb_array_elements_text(package_input->'exclusions');
 kept:='{}';
 for item in select value from jsonb_array_elements(package_input->'prices') loop
  rid:=coalesce((item->>'id')::uuid,(select id from public.package_prices where package_id=pid and lower(label)=lower(trim(item->>'label'))),gen_random_uuid());
  if exists(select 1 from public.package_prices where id=rid and package_id<>pid) then raise exception 'Foreign price option' using errcode='42501'; end if;
  insert into public.package_prices(id,package_id,label,min_travelers,max_travelers,amount_minor)
  values(rid,pid,trim(item->>'label'),(item->>'minTravelers')::smallint,(item->>'maxTravelers')::smallint,(item->>'amountMinor')::bigint)
  on conflict(id) do update set label=excluded.label,min_travelers=excluded.min_travelers,max_travelers=excluded.max_travelers,amount_minor=excluded.amount_minor,is_active=true;
  kept:=array_append(kept,rid);
 end loop;
 delete from public.package_prices where package_id=pid and not(id=any(kept));
 kept:='{}';
 for item in select value from jsonb_array_elements(package_input->'departures') loop
  rid:=coalesce((item->>'id')::uuid,(select id from public.package_departures where package_id=pid and starts_at=(item->>'startsAt')::timestamptz),gen_random_uuid());
  if exists(select 1 from public.package_departures where id=rid and package_id<>pid) then raise exception 'Foreign departure' using errcode='42501'; end if;
  insert into public.package_departures(id,package_id,starts_at,ends_at,booking_cutoff_at,capacity)
  values(rid,pid,(item->>'startsAt')::timestamptz,(item->>'endsAt')::timestamptz,(item->>'bookingCutoffAt')::timestamptz,(item->>'capacity')::integer)
  on conflict(id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,booking_cutoff_at=excluded.booking_cutoff_at,capacity=excluded.capacity,is_active=true;
  kept:=array_append(kept,rid);
 end loop;
 delete from public.package_departures where package_id=pid and not(id=any(kept));
 insert into public.package_policies(package_id,cancellation_terms,rescheduling_terms,no_show_terms,agency_cancellation_terms)
 values(pid,coalesce(package_input#>>'{policies,cancellationTerms}',''),coalesce(package_input#>>'{policies,reschedulingTerms}',''),
 coalesce(package_input#>>'{policies,noShowTerms}',''),coalesce(package_input#>>'{policies,agencyCancellationTerms}',''))
 on conflict(package_id) do update set cancellation_terms=excluded.cancellation_terms,rescheduling_terms=excluded.rescheduling_terms,no_show_terms=excluded.no_show_terms,agency_cancellation_terms=excluded.agency_cancellation_terms;
 return pid;
end;
$$;
revoke all on function public.save_package_draft(uuid,uuid,integer,jsonb) from public;
grant execute on function public.save_package_draft(uuid,uuid,integer,jsonb) to authenticated;

create function public.submit_package_review(target_package_id uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare p public.packages;
begin
 select * into p from public.packages where id=target_package_id;
 perform 1 from public.agencies where id=p.agency_id for update;
 select * into p from public.packages where id=target_package_id for update;
 if p.id is null or auth.uid() is null or not public.has_agency_role(p.agency_id,array['owner','manager']::public.agency_member_role[]) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p.version is distinct from expected_version then raise exception 'Package changed; refresh' using errcode='40001'; end if;
 if p.first_reviewed_at is not null or p.publication_status not in ('draft','changes_requested') then raise exception 'Package cannot enter first review'; end if;
 if not exists(select 1 from public.agencies where id=p.agency_id and status='verified') then raise exception 'Agency must be verified'; end if;
 perform public.validate_package_publication(p.id);
 update public.packages set publication_status='pending_first_review',version=version+1 where id=p.id;
 insert into public.package_publication_events(package_id,actor_id,status) values(p.id,auth.uid(),'pending_first_review');
end;
$$;
create function public.review_package(target_package_id uuid,expected_version integer,approve boolean,review_note text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.packages; next_status public.package_publication_status;
begin
 if auth.uid() is null or not public.has_platform_admin_role(array['content_admin','super_admin']::public.platform_admin_role[]) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into p from public.packages where id=target_package_id;
 perform 1 from public.agencies where id=p.agency_id for update;
 select * into p from public.packages where id=target_package_id for update;
 if p.id is null then raise exception 'Package not found'; end if;
 if public.has_agency_role(p.agency_id,array['owner','manager','content_staff','booking_staff','read_only']::public.agency_member_role[]) then raise exception 'Independent reviewer required'; end if;
 if p.version is distinct from expected_version then raise exception 'Package changed; refresh' using errcode='40001'; end if;
 if p.publication_status<>'pending_first_review' then raise exception 'Package is not awaiting review'; end if;
 if approve is null then raise exception 'Review decision required'; end if;
 if not approve and char_length(trim(coalesce(review_note,'')))<1 then raise exception 'Explain the requested changes'; end if;
 if approve then
  if not exists(select 1 from public.agencies where id=p.agency_id and status='verified') then raise exception 'Agency must be verified'; end if;
  perform public.validate_package_publication(p.id);
 end if;
 next_status:=case when approve then 'published'::public.package_publication_status else 'changes_requested'::public.package_publication_status end;
 update public.packages set publication_status=next_status,first_reviewed_at=case when approve then now() else first_reviewed_at end,version=version+1 where id=p.id;
 insert into public.package_publication_events(package_id,actor_id,status,note) values(p.id,auth.uid(),next_status,trim(coalesce(review_note,'')));
end;
$$;
create function public.set_package_publication(target_package_id uuid,expected_version integer,target_status public.package_publication_status) returns void
language plpgsql security definer set search_path='' as $$
declare p public.packages;
begin
 select * into p from public.packages where id=target_package_id;
 perform 1 from public.agencies where id=p.agency_id for update;
 select * into p from public.packages where id=target_package_id for update;
 if p.id is null or auth.uid() is null or not public.has_agency_role(p.agency_id,array['owner','manager','content_staff']::public.agency_member_role[]) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p.version is distinct from expected_version then raise exception 'Package changed; refresh' using errcode='40001'; end if;
 if target_status is null or target_status not in ('published','unpublished','archived') or p.publication_status in ('pending_first_review','archived','suspended') then raise exception 'Invalid publication transition'; end if;
 if target_status='published' then
  if not exists(select 1 from public.agencies where id=p.agency_id and status='verified') then raise exception 'Agency must be verified'; end if;
  if p.first_reviewed_at is null then raise exception 'First publication requires review'; end if;
  perform public.validate_package_publication(p.id);
 end if;
 update public.packages set publication_status=target_status,version=version+1 where id=p.id;
 insert into public.package_publication_events(package_id,actor_id,status) values(p.id,auth.uid(),target_status);
end;
$$;
revoke all on function public.submit_package_review(uuid,integer),public.review_package(uuid,integer,boolean,text),public.set_package_publication(uuid,integer,public.package_publication_status) from public;
grant execute on function public.submit_package_review(uuid,integer),public.review_package(uuid,integer,boolean,text),public.set_package_publication(uuid,integer,public.package_publication_status) to authenticated;

create function public.get_package_draft(target_package_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p public.packages; payload jsonb;
begin
 select * into p from public.packages where id=target_package_id;
 if p.id is null or auth.uid() is null or not(
 public.has_agency_role(p.agency_id,array['owner','manager','content_staff']::public.agency_member_role[])
 or public.has_platform_admin_role(array['content_admin','super_admin']::public.platform_admin_role[])) then raise exception 'Not authorized' using errcode='42501'; end if;
 payload:=p.draft_payload;
 if payload is null then raise exception 'Legacy package must be migrated to the editor'; end if;
 payload:=payload||jsonb_build_object(
 'prices',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'minTravelers',min_travelers,'maxTravelers',max_travelers,'amountMinor',amount_minor) order by sort_order,id) from public.package_prices where package_id=p.id and is_active),'[]'::jsonb),
 'departures',coalesce((select jsonb_agg(jsonb_build_object('id',id,'startsAt',starts_at,'endsAt',ends_at,'bookingCutoffAt',booking_cutoff_at,'capacity',capacity) order by starts_at) from public.package_departures where package_id=p.id and is_active),'[]'::jsonb));
 return jsonb_build_object('input',payload,'version',p.version,'status',p.publication_status,'firstReviewedAt',p.first_reviewed_at);
end;
$$;
revoke all on function public.get_package_draft(uuid) from public;
grant execute on function public.get_package_draft(uuid) to authenticated;
