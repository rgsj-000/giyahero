"use client";
import { useMemo, useEffect } from "react";
import { createBrowserSupabaseClient } from "../../infrastructure/supabase/browser";
import { MarketplaceShell } from "./marketplace-shell";
export function WebAgencyWorkspace({
  agencyId,
  packageId,
  editing = false,
  requests = false,
  requestId,
}: {
  agencyId: string;
  packageId?: string;
  editing?: boolean;
  requests?: boolean;
  requestId?: string;
}) {
  const client = useMemo(() => createBrowserSupabaseClient(), []);
  useEffect(() => {
    if (!window.location.hash)
      window.location.hash =
        "agency/" +
        agencyId +
        (requests
          ? "/requests" + (requestId ? "/" + requestId : "")
          : editing
            ? "/packages/" + (packageId ?? "new")
            : "");
  }, [agencyId, packageId, editing, requests, requestId]);
  return (
    <MarketplaceShell
      client={client}
      onLogin={(path) => {
        window.location.href = "/login?next=" + encodeURIComponent(path);
      }}
      openExternal={(path) => {
        window.location.href = path;
      }}
    />
  );
}
