create policy "verification reviewers can read agencies"
on public.agencies
for select
to authenticated
using (
  public.has_platform_admin_role(
    array['super_admin', 'agency_verifier']::public.platform_admin_role[]
  )
);
