insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('package-media','package-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create function public.can_edit_package_media(target_package_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.packages p where p.id=target_package_id
 and p.publication_status not in ('archived','suspended','pending_first_review')
 and public.has_agency_role(p.agency_id,array['owner','manager','content_staff']::public.agency_member_role[]));
$$;
revoke all on function public.can_edit_package_media(uuid) from public;
grant execute on function public.can_edit_package_media(uuid) to authenticated;
create policy "package editors upload images" on storage.objects for insert to authenticated with check(
 bucket_id='package-media' and exists(select 1 from public.packages p
 where name ~ '^agency/[0-9a-f-]{36}/package/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
 and name like 'agency/'||p.agency_id::text||'/package/'||p.id::text||'/%'
 and public.can_edit_package_media(p.id)));
create function public.can_read_package_image(object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.packages p where
 object_name like 'agency/'||p.agency_id::text||'/package/'||p.id::text||'/%' and (
 (auth.uid() is not null and public.has_agency_role(p.agency_id,array['owner','manager','content_staff']::public.agency_member_role[]))
 or (auth.uid() is not null and public.has_platform_admin_role(array['content_admin','super_admin']::public.platform_admin_role[]))
 or (p.publication_status='published' and exists(select 1 from public.agencies a where a.id=p.agency_id and a.status='verified')
 and exists(select 1 from public.package_media m where m.package_id=p.id and m.storage_path=object_name))));
$$;
revoke all on function public.can_read_package_image(text) from public;
grant execute on function public.can_read_package_image(text) to anon,authenticated;
create policy "published package images and editor images readable" on storage.objects for select to anon,authenticated using(
 bucket_id='package-media' and public.can_read_package_image(name));
grant select on public.agencies, public.agency_members, public.profiles, public.platform_admin_memberships to authenticated;
create policy "package editors remove their images" on storage.objects for delete to authenticated using(
 bucket_id='package-media' and exists(select 1 from public.packages p where
 name like 'agency/'||p.agency_id::text||'/package/'||p.id::text||'/%' and public.can_edit_package_media(p.id)
 and not exists(select 1 from public.package_media m where m.storage_path=name)));

create function public.register_package_media(target_package_id uuid,target_media_id uuid,target_storage_path text,target_alt_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.packages; object storage.objects; expected_prefix text;
begin
 select * into p from public.packages where id=target_package_id;
 perform 1 from public.agencies where id=p.agency_id for update;
 select * into p from public.packages where id=target_package_id for update;
 if not public.can_edit_package_media(target_package_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 expected_prefix:='agency/'||p.agency_id::text||'/package/'||p.id::text||'/'||target_media_id::text;
 if target_storage_path is null or target_storage_path not in(expected_prefix||'.jpg',expected_prefix||'.png',expected_prefix||'.webp')
 or char_length(trim(coalesce(target_alt_text,''))) not between 2 and 200 then raise exception 'Invalid image path or description'; end if;
 select * into object from storage.objects where bucket_id='package-media' and name=target_storage_path;
 if object.id is null or (object.owner_id is distinct from auth.uid()::text and object.owner is distinct from auth.uid())
 or object.metadata->>'size' is null or (object.metadata->>'size')::bigint not between 1 and 5242880
 or object.metadata->>'mimetype' not in('image/jpeg','image/png','image/webp')
 or object.metadata->>'mimetype' is null then raise exception 'Uploaded image is missing or invalid'; end if;
 insert into public.package_media(id,package_id,storage_path,alt_text) values(target_media_id,p.id,target_storage_path,trim(target_alt_text));
 update public.packages set version=version+1 where id=p.id;
 return target_media_id;
end;
$$;
create function public.remove_package_media(target_media_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare m public.package_media; aid uuid;
begin
 select * into m from public.package_media where id=target_media_id;
 select agency_id into aid from public.packages where id=m.package_id;
 perform 1 from public.agencies where id=aid for update;
 perform 1 from public.packages where id=m.package_id for update;
 if m.id is null or not public.can_edit_package_media(m.package_id) then raise exception 'Not authorized' using errcode='42501'; end if;
 delete from public.package_media where id=m.id;
 update public.packages set version=version+1 where id=m.package_id;
 return m.storage_path;
end;
$$;
revoke all on function public.register_package_media(uuid,uuid,text,text),public.remove_package_media(uuid) from public;
grant execute on function public.register_package_media(uuid,uuid,text,text),public.remove_package_media(uuid) to authenticated;
create policy "catalog reviewers read media metadata" on public.package_media for select to authenticated using(public.has_platform_admin_role(array['content_admin','super_admin']::public.platform_admin_role[]));
