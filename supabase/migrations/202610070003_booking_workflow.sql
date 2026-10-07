-- All mutations serialize on agency -> package -> departure -> request.
create type public.booking_request_status as enum ('pending','accepted','declined','cancelled');
alter table public.package_prices add constraint package_prices_id_package_unique unique(id,package_id);
alter table public.package_departures add constraint package_departures_id_package_unique unique(id,package_id);
create table public.booking_requests (
 id uuid primary key default gen_random_uuid(),
 traveler_id uuid not null references public.profiles(id) on delete restrict,
 agency_id uuid not null references public.agencies(id) on delete restrict,
 package_id uuid not null references public.packages(id) on delete restrict,
 rate_id uuid not null references public.package_prices(id) on delete restrict,
 departure_id uuid references public.package_departures(id) on delete restrict,
 adults integer not null check(adults between 1 and 32767), children integer not null check(children between 0 and 32767),
 submission_key uuid not null, input_payload jsonb not null, snapshot jsonb not null,
 contact_name text not null, contact_email text not null, contact_phone text not null, notes text not null default '',
 status public.booking_request_status not null default 'pending', decision_reason text not null default '',
 created_at timestamptz not null default now(), decided_at timestamptz,
 unique(traveler_id,submission_key),
 foreign key(package_id,agency_id) references public.packages(id,agency_id) on delete restrict,
 foreign key(rate_id,package_id) references public.package_prices(id,package_id) on delete restrict,
 foreign key(departure_id,package_id) references public.package_departures(id,package_id) on delete restrict
);
create index booking_requests_agency_status on public.booking_requests(agency_id,status,created_at desc);
create index booking_requests_traveler on public.booking_requests(traveler_id,created_at desc);
create index booking_requests_departure on public.booking_requests(departure_id) where status='accepted';
create table public.booking_events (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.booking_requests(id) on delete restrict,
 actor_id uuid not null references public.profiles(id) on delete restrict, status public.booking_request_status not null,
 reason text not null default '', created_at timestamptz not null default now()
);
alter table public.booking_requests enable row level security;
alter table public.booking_events enable row level security;
create policy "travelers and booking staff read requests" on public.booking_requests for select to authenticated using(
 traveler_id=auth.uid() or public.has_agency_role(agency_id,array['owner','manager','booking_staff']::public.agency_member_role[]));
create policy "request readers read history" on public.booking_events for select to authenticated using(exists(
 select 1 from public.booking_requests r where r.id=request_id));
revoke all on public.booking_requests,public.booking_events from anon,authenticated;
grant select on public.booking_requests,public.booking_events to authenticated;

create function public.submit_booking_request(request_input jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.packages; a public.agencies; rate public.package_prices; dep public.package_departures; previous public.booking_requests;
 party integer; adults_n integer; children_n integer; total numeric; start_date date; end_date date; normalized jsonb; snap jsonb; result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to request a booking' using errcode='42501'; end if;
 if request_input is null or jsonb_typeof(request_input)<>'object' or exists(select 1 from jsonb_object_keys(request_input) k where k not in
 ('packageId','expectedVersion','rateId','departureId','startsOn','endsOn','adults','children','contactName','contactEmail','contactPhone','notes','submissionKey')) then raise exception 'Invalid request fields'; end if;
 if jsonb_typeof(request_input->'adults') is distinct from 'number' or jsonb_typeof(request_input->'children') is distinct from 'number'
 or (request_input->>'adults') !~ '^[0-9]+$' or (request_input->>'children') !~ '^[0-9]+$' then raise exception 'Invalid traveler counts'; end if;
 adults_n:=(request_input->>'adults')::integer; children_n:=(request_input->>'children')::integer; party:=adults_n+children_n;
 if adults_n not between 1 and 32767 or children_n not between 0 and 32767 then raise exception 'Invalid traveler counts'; end if;
 if jsonb_typeof(request_input->'contactName') is distinct from 'string' or jsonb_typeof(request_input->'contactPhone') is distinct from 'string'
 or jsonb_typeof(request_input->'contactEmail') is distinct from 'string' or jsonb_typeof(request_input->'notes') is distinct from 'string'
 or char_length(trim(coalesce(request_input->>'contactName',''))) not between 2 and 120
 or char_length(trim(coalesce(request_input->>'contactPhone',''))) not between 7 and 40
 or char_length(trim(coalesce(request_input->>'contactEmail',''))) not between 3 and 254
 or trim(request_input->>'contactEmail') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or char_length(trim(coalesce(request_input->>'notes',''))) >2000 or request_input->>'submissionKey' is null then raise exception 'Invalid contact details or submission key'; end if;
 normalized:=request_input||jsonb_build_object('contactName',trim(request_input->>'contactName'),'contactEmail',trim(request_input->>'contactEmail'),
 'contactPhone',trim(request_input->>'contactPhone'),'notes',trim(coalesce(request_input->>'notes','')));
 -- Key lock prevents same traveler/key racing even across different packages.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||(request_input->>'submissionKey'),0));
 select * into previous from public.booking_requests where traveler_id=auth.uid() and submission_key=(request_input->>'submissionKey')::uuid;
 if previous.id is not null then
  if previous.input_payload<>normalized then raise exception 'Submission key already used with different request details' using errcode='23505'; end if;
  return previous.id;
 end if;
 select * into p from public.packages where id=(request_input->>'packageId')::uuid;
 select * into a from public.agencies where id=p.agency_id for update;
 select * into p from public.packages where id=p.id for update;
 if p.id is null or a.status<>'verified' or p.publication_status<>'published' then raise exception 'Package is no longer available'; end if;
 if p.version is distinct from (request_input->>'expectedVersion')::integer then raise exception 'Package changed; reopen the listing and review the latest quotation and terms' using errcode='40001'; end if;
 select * into rate from public.package_prices where id=(request_input->>'rateId')::uuid and package_id=p.id and is_active;
 if rate.id is null or party not between p.min_travelers and p.max_travelers or party<rate.min_travelers or (rate.max_travelers is not null and party>rate.max_travelers) then raise exception 'Choose an eligible price option and group size'; end if;
 if p.schedule_model='fixed_departures' then
  if request_input->>'startsOn' is not null or request_input->>'endsOn' is not null then raise exception 'Fixed departure determines the dates'; end if;
  select * into dep from public.package_departures where id=(request_input->>'departureId')::uuid and package_id=p.id and is_active for update;
  if dep.id is null or dep.is_cancelled then raise exception 'Choose a valid departure'; end if;
  if dep.booking_cutoff_at<=now() then raise exception 'Booking cutoff has passed'; end if;
  start_date:=(dep.starts_at at time zone 'Asia/Manila')::date;end_date:=(dep.ends_at at time zone 'Asia/Manila')::date;
 else
  if request_input->>'departureId' is not null or coalesce(request_input->>'startsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or coalesce(request_input->>'endsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Choose valid travel dates'; end if;
  start_date:=(request_input->>'startsOn')::date;end_date:=(request_input->>'endsOn')::date;
  if start_date<(now() at time zone 'Asia/Manila')::date or start_date<p.open_date_start or end_date>p.open_date_end
  or end_date-start_date+1<>p.duration_days then raise exception 'Travel dates must match the available window and duration'; end if;
 end if;
 total:=rate.amount_minor::numeric * case when p.pricing_model='per_group' then 1 else party end;
 if total>9007199254740991 then raise exception 'Quotation exceeds the supported amount'; end if;
 snap:=jsonb_build_object('packageVersion',p.version,'title',p.title,'agencyName',a.name,'currencyCode',p.currency_code,'totalAmountMinor',total::bigint,
 'rateLabel',rate.label,'pricingModel',p.pricing_model,'startsOn',start_date,'endsOn',end_date,'startsAt',dep.starts_at,'endsAt',dep.ends_at,
 'adults',adults_n,'children',children_n,'paymentTerms','Agency-arranged payment. Confirmation does not mean payment has been received.')
 || (public.get_public_package_detail(p.id)-array['id','agencyId','slug','title','agencyName','currencyCode','rates','departures','version','fromAmountMinor']);
 insert into public.booking_requests(traveler_id,agency_id,package_id,rate_id,departure_id,adults,children,submission_key,input_payload,snapshot,contact_name,contact_email,contact_phone,notes)
 values(auth.uid(),a.id,p.id,rate.id,dep.id,adults_n,children_n,(request_input->>'submissionKey')::uuid,normalized,snap,
 normalized->>'contactName',normalized->>'contactEmail',normalized->>'contactPhone',normalized->>'notes') returning id into result;
 insert into public.booking_events(request_id,actor_id,status) values(result,auth.uid(),'pending');
 return result;
end;
$$;

create function public.decide_booking_request(target_request_id uuid,target_status public.booking_request_status,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.booking_requests; p public.packages; a public.agencies; d public.package_departures; occupied bigint;
begin
 select * into r from public.booking_requests where id=target_request_id;
 if r.id is null or auth.uid() is null or not public.has_agency_role(r.agency_id,array['owner','manager','booking_staff']::public.agency_member_role[]) then raise exception 'Not authorized' using errcode='42501'; end if;
 select * into a from public.agencies where id=r.agency_id for update;
 select * into p from public.packages where id=r.package_id for update;
 if r.departure_id is not null then select * into d from public.package_departures where id=r.departure_id for update; end if;
 select * into r from public.booking_requests where id=target_request_id for update;
 if target_status is null or target_status not in ('accepted','declined') then raise exception 'Invalid decision'; end if;
 if r.status=target_status then return; end if;
 if r.status<>'pending' then raise exception 'Request changed; refresh before deciding' using errcode='40001'; end if;
 if char_length(trim(coalesce(reason,'')))>2000 or (target_status='declined' and char_length(trim(coalesce(reason,'')))<1) then raise exception 'A decision reason is required (up to 2000 characters)'; end if;
 if target_status='accepted' then
  if a.status<>'verified' or p.publication_status<>'published' then raise exception 'Package is no longer available for acceptance'; end if;
  if r.departure_id is not null then
   if not d.is_active or d.is_cancelled or d.booking_cutoff_at<=now() or d.starts_at is distinct from (r.snapshot->>'startsAt')::timestamptz or d.ends_at is distinct from (r.snapshot->>'endsAt')::timestamptz then raise exception 'Departure changed or booking cutoff passed'; end if;
   select coalesce(sum(adults+children),0) into occupied from public.booking_requests where departure_id=d.id and status='accepted';
   if occupied+r.adults+r.children>d.capacity then raise exception 'Insufficient departure capacity'; end if;
  elsif (r.snapshot->>'startsOn')::date<(now() at time zone 'Asia/Manila')::date then raise exception 'Requested travel dates have passed'; end if;
 end if;
 update public.booking_requests set status=target_status,decision_reason=trim(coalesce(reason,'')),decided_at=now() where id=r.id;
 insert into public.booking_events(request_id,actor_id,status,reason) values(r.id,auth.uid(),target_status,trim(coalesce(reason,'')));
end;
$$;

create function public.cancel_booking_request(target_request_id uuid,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.booking_requests; staff boolean;
begin
 select * into r from public.booking_requests where id=target_request_id;
 staff:=public.has_agency_role(r.agency_id,array['owner','manager','booking_staff']::public.agency_member_role[]);
 if r.id is null or auth.uid() is null or not(staff or r.traveler_id=auth.uid()) then raise exception 'Not authorized' using errcode='42501'; end if;
 perform 1 from public.agencies where id=r.agency_id for update;
 perform 1 from public.packages where id=r.package_id for update;
 if r.departure_id is not null then perform 1 from public.package_departures where id=r.departure_id for update; end if;
 select * into r from public.booking_requests where id=target_request_id for update;
 if r.status='cancelled' then return; end if;
 if r.status not in ('pending','accepted') or (r.status='accepted' and not staff) then raise exception 'Only the agency can cancel a confirmed request'; end if;
 if char_length(trim(coalesce(reason,'')))>2000 or (staff and char_length(trim(coalesce(reason,'')))<1) then raise exception 'A cancellation reason is required'; end if;
 update public.booking_requests set status='cancelled',decision_reason=trim(coalesce(reason,'')),decided_at=now() where id=r.id;
 insert into public.booking_events(request_id,actor_id,status,reason) values(r.id,auth.uid(),'cancelled',trim(coalesce(reason,'')));
end;
$$;

create function public.get_departure_availability(target_package_id uuid) returns table(departure_id uuid,remaining_capacity integer)
language sql stable security definer set search_path='' as $$
 select d.id,greatest(0,d.capacity-coalesce((select sum(r.adults+r.children) from public.booking_requests r where r.departure_id=d.id and r.status='accepted'),0))::integer
 from public.package_departures d join public.packages p on p.id=d.package_id join public.agencies a on a.id=p.agency_id
 where p.id=target_package_id and p.publication_status='published' and a.status='verified' and d.is_active and not d.is_cancelled;
$$;
revoke all on function public.submit_booking_request(jsonb),public.decide_booking_request(uuid,public.booking_request_status,text),public.cancel_booking_request(uuid,text),public.get_departure_availability(uuid) from public;
grant execute on function public.submit_booking_request(jsonb),public.decide_booking_request(uuid,public.booking_request_status,text),public.cancel_booking_request(uuid,text) to authenticated;
grant execute on function public.get_departure_availability(uuid) to anon,authenticated;

-- Referenced price/departure rows become inactive, retaining historical foreign keys.
create function public.preserve_booking_rate() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.booking_requests where rate_id=old.id) then update public.package_prices set is_active=false where id=old.id; return null; end if;
 return old;
end;
$$;
create trigger preserve_booking_rate before delete on public.package_prices for each row execute function public.preserve_booking_rate();
create function public.guard_booking_departure() returns trigger language plpgsql security definer set search_path='' as $$
declare occupied bigint;
begin
 select coalesce(sum(adults+children),0) into occupied from public.booking_requests where departure_id=old.id and status='accepted';
 if occupied>0 and (tg_op='DELETE' or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.capacity<occupied or not new.is_active or new.is_cancelled) then raise exception 'Confirmed bookings prevent departure removal, date changes or insufficient capacity'; end if;
 if tg_op='DELETE' then
  if exists(select 1 from public.booking_requests where departure_id=old.id) then update public.package_departures set is_active=false where id=old.id; return null; end if;
  return old;
 end if;
 return new;
end;
$$;
create trigger guard_booking_departure before update or delete on public.package_departures for each row execute function public.guard_booking_departure();
revoke all on function public.preserve_booking_rate(),public.guard_booking_departure() from public;
-- Refresh public detail without exposing the booking rows used for this aggregate.
do $$ begin
 execute replace(pg_get_functiondef('public.get_public_package_detail(uuid)'::regprocedure),
   '''remainingCapacity'',d.capacity',
   '''remainingCapacity'',(select remaining_capacity from public.get_departure_availability(p.id) av where av.departure_id=d.id)');
end $$;
