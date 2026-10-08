-- Opt-in synthetic data for GHDB. Not part of db reset or production migrations.
-- Auth users and Storage bytes are provisioned by scripts/seed-demo.mjs.
begin;
select pg_advisory_xact_lock(hashtextextended('giyahero-demo-v1', 0));

do $$
declare
  owner_id uuid; reviewer_id uuid; v_traveler_id uuid;
  aid uuid; pid uuid; did uuid; rid uuid; depid uuid; bid uuid; mid uuid; legacy_did uuid;
  v_province_id uuid; member record; agency record; tour record; day_n integer;
  payload jsonb; itinerary jsonb; departure jsonb;
  start_day date := (now() at time zone 'Asia/Manila')::date + 21;
  desired public.package_publication_status;
begin
  if (select count(*) from auth.users where email in (
    'traveler@demo.giyahero.test','owner@demo.giyahero.test','manager@demo.giyahero.test',
    'booking-staff@demo.giyahero.test','content-staff@demo.giyahero.test','read-only@demo.giyahero.test',
    'super-admin@demo.giyahero.test','agency-verifier@demo.giyahero.test','moderator@demo.giyahero.test',
    'support@demo.giyahero.test','finance@demo.giyahero.test','content-admin@demo.giyahero.test',
    'island-owner@demo.giyahero.test','heritage-owner@demo.giyahero.test','pending-owner@demo.giyahero.test')) <> 15 then
    raise exception 'Provision all fifteen demo Auth users with scripts/seed-demo.mjs first';
  end if;
  select id into reviewer_id from auth.users where email='content-admin@demo.giyahero.test';
  select id into v_traveler_id from auth.users where email='traveler@demo.giyahero.test';
  select id into v_province_id from public.provinces where code='PH-QUE';
  if v_province_id is null then raise exception 'Apply catalog migrations first'; end if;

  for member in select * from (values
    ('super-admin','super_admin'),('agency-verifier','agency_verifier'),('moderator','moderator'),
    ('support','support'),('finance','finance'),('content-admin','content_admin')
  ) as roles(account, role) loop
    insert into public.platform_admin_memberships(user_id,role)
    select id,member.role::public.platform_admin_role from auth.users
    where email=member.account||'@demo.giyahero.test' on conflict do nothing;
  end loop;

  for agency in select * from (values
    ('demo-quezon-trails','Quezon Trails (Demo)','owner',true),
    ('demo-island-days','Island Days (Demo)','island-owner',true),
    ('demo-heritage-table','Heritage & Table (Demo)','heritage-owner',true),
    ('demo-new-horizons','New Horizons (Demo)','pending-owner',false)
  ) as agencies(slug,name,account,verified) loop
    aid := md5('giyahero-demo-v1:agency:'||agency.slug)::uuid;
    select id into owner_id from auth.users where email=agency.account||'@demo.giyahero.test';
    insert into public.agencies(id,name,legal_name,slug,description,contact_email,contact_phone,status,created_by,verified_at)
    values(aid,agency.name,agency.name,agency.slug,'Synthetic travel agency for GiyaHero demonstrations. These are sample offerings, not real services.',
      agency.account||'@demo.giyahero.test','+63 900 000 0000',
      case when agency.verified then 'verified'::public.agency_status else 'submitted'::public.agency_status end,
      owner_id,case when agency.verified then now() else null end) on conflict(id) do nothing;
    insert into public.agency_members(agency_id,user_id,role) values(aid,owner_id,'owner') on conflict do nothing;
    if not exists(select 1 from public.agency_service_areas a where a.agency_id=aid and a.province_id=v_province_id and a.municipality_id is null) then
      insert into public.agency_service_areas(agency_id,province_id) values(aid,v_province_id);
    end if;
    insert into public.agency_verification_submissions(id,agency_id,status,submitted_by,submitted_at,reviewed_by,reviewed_at,decision_notes)
    values(md5('giyahero-demo-v1:verification:'||agency.slug)::uuid,aid,
      case when agency.verified then 'verified'::public.agency_verification_status else 'submitted'::public.agency_verification_status end,
      owner_id,now(),case when agency.verified then reviewer_id else null end,
      case when agency.verified then now() else null end,case when agency.verified then 'Synthetic demo approval; no real accreditation is claimed.' else null end)
    on conflict(id) do nothing;
  end loop;

  aid := md5('giyahero-demo-v1:agency:demo-quezon-trails')::uuid;
  for member in select * from (values
    ('manager','manager'),('booking-staff','booking_staff'),('content-staff','content_staff'),('read-only','read_only')
  ) as roles(account, role) loop
    insert into public.agency_members(agency_id,user_id,role)
    select aid,id,member.role::public.agency_member_role from auth.users
    where email=member.account||'@demo.giyahero.test' on conflict do nothing;
  end loop;

  for tour in select * from (values
    ('cagbalete','Cagbalete Island','White sand, tidal flats and relaxed island walks.'),
    ('jomalig','Jomalig Island','Golden beaches and quiet island villages.'),
    ('burdeos','Burdeos Islands','Coastal scenery and island hopping in northern Quezon.'),
    ('mauban','Mauban Coast','Coastal walks, local food and town heritage.'),
    ('lucban','Lucban','Local cuisine, craft shops and town heritage.'),
    ('tayabas','Tayabas','Historic streets, stone bridges and local cuisine.'),
    ('lucena','Lucena','City markets, food stops and waterfront views.'),
    ('tiaong','Tiaong','Countryside views and cultural experiences.'),
    ('pagbilao','Pagbilao','Coastal coves and mangrove scenery.'),
    ('atimonan','Atimonan','Forest trails and views along the Quezon coast.')
  ) as places(slug,name,description) loop
    legacy_did := md5('giyahero-demo-v1:destination:'||tour.slug)::uuid;
    -- Normalize UUID version/variant bits so frontend UUID validation accepts filters and editor inputs.
    did := overlay(overlay(md5('giyahero-demo-v1:destination:'||tour.slug) placing '4' from 13) placing '8' from 17)::uuid;
    if legacy_did<>did then
      update public.destinations set slug='demo-'||tour.slug||'-legacy',is_active=false
      where id=legacy_did and slug='demo-'||tour.slug;
    end if;
    insert into public.destinations(id,province_id,slug,name,description)
    values(did,v_province_id,'demo-'||tour.slug,tour.name,tour.description)
    on conflict(id) do nothing;
    if legacy_did<>did then
      update public.package_destinations pd set destination_id=did
      from public.packages p where p.id=pd.package_id and p.slug like 'demo-%' and pd.destination_id=legacy_did;
      update public.packages p set draft_payload=jsonb_set(p.draft_payload,'{destinationIds}',
        (select jsonb_agg(case when value=to_jsonb(legacy_did::text) then to_jsonb(did::text) else value end order by ordinality)
          from jsonb_array_elements(p.draft_payload->'destinationIds') with ordinality))
      where p.slug like 'demo-%' and p.draft_payload->'destinationIds' @> jsonb_build_array(legacy_did);
    end if;
  end loop;

  for tour in select * from (values
    (1,'pagbilao-cove','Pagbilao Cove Day Escape','demo-quezon-trails','pagbilao','beach',1,149900,'beach.webp','open_dates','published'),
    (2,'mauban-coast','Mauban Coastal Weekend','demo-quezon-trails','mauban','coastal',2,329900,'mauban.webp','fixed_departures','published'),
    (3,'atimonan-trails','Atimonan Forest & Coast','demo-quezon-trails','atimonan','nature',2,289900,'river.webp','open_dates','published'),
    (4,'pagbilao-family','Pagbilao Family Beach Break','demo-quezon-trails','pagbilao','family',3,599900,'bay.webp','fixed_departures','published'),
    (5,'cagbalete-getaway','Cagbalete Island Getaway','demo-island-days','cagbalete','island',2,399900,'beach.webp','fixed_departures','published'),
    (6,'jomalig-golden','Jomalig Golden Sands Adventure','demo-island-days','jomalig','island',3,749900,'bay.webp','fixed_departures','published'),
    (7,'burdeos-hopping','Burdeos Island Hopping','demo-island-days','burdeos','island',3,699900,'beach.webp','fixed_departures','published'),
    (8,'cagbalete-private','Private Cagbalete Group Escape','demo-island-days','cagbalete','private',2,1899900,'mauban.webp','open_dates','published'),
    (9,'lucban-food','Lucban Food & Heritage Walk','demo-heritage-table','lucban','food',1,129900,'lucban.webp','open_dates','published'),
    (10,'tayabas-history','Tayabas Heritage & Cuisine','demo-heritage-table','tayabas','heritage',1,159900,'tayabas.webp','open_dates','published'),
    (11,'lucena-tastes','Lucena Market & Food Trail','demo-heritage-table','lucena','food',1,99900,'lucban.webp','open_dates','published'),
    (12,'tiaong-countryside','Tiaong Countryside Weekend','demo-heritage-table','tiaong','culture',2,449900,'river.webp','open_dates','published'),
    (13,'mauban-review','Mauban Sunset & Seafood','demo-quezon-trails','mauban','food',1,179900,'mauban.webp','open_dates','pending_first_review'),
    (14,'tayabas-review','Tayabas Bridges & Stories','demo-heritage-table','tayabas','heritage',1,139900,'tayabas.webp','open_dates','pending_first_review'),
    (15,'forest-draft','Quezon Forest Picnic','demo-quezon-trails','atimonan','nature',1,119900,'river.webp','open_dates','draft')
  ) as tours(n,slug,title,agency_slug,destination_slug,trip_type,days,price,image,schedule,status) loop
    -- Preserve existing demo edits, review decisions and reservations on rerun.
    aid := md5('giyahero-demo-v1:agency:'||tour.agency_slug)::uuid;
    select created_by into owner_id from public.agencies where id=aid;
    select e.package_id into pid from public.package_publication_events e
    join public.packages p on p.id=e.package_id
    where e.note='giyahero-demo-v1:package:'||tour.slug and p.agency_id=aid
      and e.actor_id=owner_id limit 1;
    if pid is not null then continue; end if;
    -- Adopt fixtures from an earlier seed version once, then use the immutable audit marker.
    select id into pid from public.packages where slug='demo-'||tour.slug and agency_id=aid;
    if pid is not null then
      insert into public.package_publication_events(package_id,actor_id,status,note)
      select pid,owner_id,publication_status,'giyahero-demo-v1:package:'||tour.slug
      from public.packages where id=pid;
      continue;
    end if;
    did := overlay(overlay(md5('giyahero-demo-v1:destination:'||tour.destination_slug) placing '4' from 13) placing '8' from 17)::uuid;
    itinerary := '[]'::jsonb;
    for day_n in 1..tour.days loop
      itinerary := itinerary || jsonb_build_array(jsonb_build_object('dayNumber',day_n,
        'title',case when day_n=1 then 'Meet, explore and taste' else 'Discover more of '||tour.destination_slug end,
        'description',case when day_n=1 then 'Meet your local guide at the agreed pickup point. Explore the main sights at a relaxed pace, pause for lunch and enjoy time for photos.'
          else 'After breakfast, continue the guided route with scenic stops and free time. Your guide coordinates the return transfer and final meeting point.' end));
    end loop;
    departure := '[]'::jsonb;
    if tour.schedule='fixed_departures' then
      for day_n in 0..2 loop
        departure := departure || jsonb_build_array(jsonb_build_object(
          'startsAt',to_char((start_day + tour.n + day_n*14)::timestamp + interval '0 hours','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'endsAt',to_char((start_day + tour.n + day_n*14 + tour.days - 1)::timestamp + interval '9 hours','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'bookingCutoffAt',to_char((start_day + tour.n + day_n*14 - 3)::timestamp,'YYYY-MM-DD"T"HH24:MI:SS"Z"'),'capacity',20));
      end loop;
    end if;
    payload := jsonb_build_object('slug','demo-'||tour.slug,'title',tour.title||' (Demo)',
      'overview','Explore '||tour.title||' with a local guide, planned transfers and time to enjoy Quezon. This is a synthetic demo itinerary; prices, photos and availability illustrate the app and are not a real travel offer.',
      'tripType',tour.trip_type,'durationDays',tour.days,'minTravelers',1,'maxTravelers',case when tour.n=8 then 8 else 20 end,
      'currencyCode','PHP','pricingModel',case when tour.n=8 then 'per_group' else 'per_person' end,
      'scheduleModel',tour.schedule,'openDateWindow',case when tour.schedule='open_dates' then jsonb_build_object('startsOn',start_day,'endsOn',start_day+180) else null end,
      'destinationIds',jsonb_build_array(did),'itinerary',itinerary,
      'inclusions',jsonb_build_array('Local guide and planned activities','Coordinated local transfers',case when tour.days>1 then 'Shared accommodation for the itinerary' else 'Lunch at a local food stop' end),
      'exclusions',jsonb_build_array('Travel insurance and personal expenses','Transport to the initial meeting point'),
      'prices',jsonb_build_array(jsonb_build_object('label',case when tour.n=8 then 'Private group (up to 8)' else 'Standard traveler' end,
        'minTravelers',1,'maxTravelers',case when tour.n=8 then 8 else 20 end,'amountMinor',tour.price)),
      'policies',jsonb_build_object('cancellationTerms','Demo policy: cancel at least 7 days before departure for a refund; later cancellation is subject to agency review.',
        'reschedulingTerms','Demo policy: request a date change at least 3 days before travel; changes depend on availability.',
        'noShowTerms','Demo policy: missed departures without notice are non-refundable.',
        'agencyCancellationTerms','Demo policy: agency cancellation offers a full refund or an alternative date. Payments are arranged with the agency.'),
      'departures',departure);
    perform set_config('request.jwt.claim.sub',owner_id::text,true);
    pid := public.save_package_draft(aid,null,null,payload);
    insert into public.package_publication_events(package_id,actor_id,status,note)
    values(pid,owner_id,'draft','giyahero-demo-v1:package:'||tour.slug);
    update public.packages set meeting_point='Agreed town pickup point in Quezon (Demo)',transport_included=true,
      accommodation_included=tour.days>1,meals_included=true where id=pid;
    mid := md5('giyahero-demo-v1:media:'||tour.slug)::uuid;
    insert into public.package_media(id,package_id,storage_path,alt_text)
    values(mid,pid,'agency/'||aid||'/package/'||pid||'/'||mid||'.webp','Illustrative demo image for '||tour.title);
    desired := tour.status::public.package_publication_status;
    if desired <> 'draft' then
      perform public.submit_package_review(pid,1);
      if desired='published' then
        perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
        perform public.review_package(pid,2,true,'Independent synthetic demo review.');
      end if;
    end if;
  end loop;

  -- Repair only this seed's legacy image paths when retrying an interrupted run.
  update public.package_media m
  set storage_path='agency/'||p.agency_id||'/package/'||p.id||'/'||m.id||'.webp'
  from public.packages p
  where p.id=m.package_id and p.slug like 'demo-%'
    and m.id=md5('giyahero-demo-v1:media:'||substr(p.slug,6))::uuid
    and m.storage_path=p.agency_id||'/'||p.id||'/'||m.id||'.webp';

  for tour in select * from (values
    (1,'pagbilao-cove','pending'),(2,'mauban-coast','accepted'),(3,'atimonan-trails','declined'),(4,'pagbilao-family','cancelled')
  ) as bookings(n,slug,status) loop
    mid := md5('giyahero-demo-v1:booking:'||tour.slug)::uuid;
    if exists(select 1 from public.booking_requests r where r.traveler_id=v_traveler_id and submission_key=mid) then continue; end if;
    select p.id,p.agency_id,p.created_by into pid,aid,owner_id
    from public.packages p join public.package_publication_events e on e.package_id=p.id
    where e.note='giyahero-demo-v1:package:'||tour.slug and e.actor_id=p.created_by limit 1;
    select id into rid from public.package_prices where package_id=pid and is_active order by sort_order limit 1;
    select id into depid from public.package_departures where package_id=pid and is_active order by starts_at limit 1;
    select jsonb_build_object('packageId',p.id,'expectedVersion',p.version,'rateId',rid,'adults',2,'children',0,
      'contactName','Alex Demo Traveler','contactEmail','traveler@demo.giyahero.test','contactPhone','+63 900 000 0000',
      'notes','Synthetic booking for a GiyaHero demonstration. No payment or real reservation.', 'submissionKey',mid)
      || case when p.schedule_model='fixed_departures' then jsonb_build_object('departureId',depid)
      else jsonb_build_object('startsOn',start_day+7,'endsOn',start_day+7+p.duration_days-1) end
    into payload from public.packages p where id=pid;
    perform set_config('request.jwt.claim.sub',v_traveler_id::text,true);
    bid := public.submit_booking_request(payload);
    if tour.status in ('accepted','declined') then
      perform set_config('request.jwt.claim.sub',owner_id::text,true);
      perform public.decide_booking_request(bid,tour.status::public.booking_request_status,
        case when tour.status='accepted' then 'Demo: availability checked and request accepted.' else 'Demo: requested guide is unavailable; please choose another date.' end);
    elsif tour.status='cancelled' then
      perform public.cancel_booking_request(bid,'Demo: traveler changed plans.');
    end if;
  end loop;
end;
$$;
commit;
