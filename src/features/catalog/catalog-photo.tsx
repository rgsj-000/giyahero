"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MapPin } from "lucide-react";
import { catalogImageUrl } from "./catalog-service";
import { useData } from "./catalog-state";
export function CatalogPhoto({
  client,
  path,
  alt,
}: {
  client: SupabaseClient;
  path: string | null;
  alt: string;
}) {
  const { data } = useData(
    useCallback(() => catalogImageUrl(client, path), [client, path]),
  );
  return data ? (
    <img className="gh-cover" src={data} alt={alt} loading="lazy" />
  ) : (
    <div className="gh-cover gh-no-photo">
      <MapPin aria-hidden="true" />
      <span>Explore Quezon</span>
    </div>
  );
}
