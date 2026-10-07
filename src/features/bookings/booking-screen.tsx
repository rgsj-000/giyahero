"use client";
import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPackageDetail } from "../catalog/catalog-service";
import { CatalogState, useData } from "../catalog/catalog-state";
import type { MarketplaceNavigation } from "../catalog/navigation";
import { RequestForm } from "./request-form";
export function BookingScreen({
  client,
  packageId,
  navigation,
}: {
  client: SupabaseClient;
  packageId: string;
  navigation: MarketplaceNavigation;
}) {
  const detail = useData(
    useCallback(() => getPackageDetail(client, packageId), [client, packageId]),
  );
  return (
    <CatalogState
      loading={detail.loading}
      error={detail.error}
      onRetry={detail.refresh}
    >
      {detail.data ? (
        <RequestForm
          client={client}
          detail={detail.data}
          navigation={navigation}
          onSubmitted={(r) => {
            window.location.hash = "request/" + r.id;
          }}
        />
      ) : (
        <p>
          This package is no longer available. Check My Trips for any previously
          submitted request.
        </p>
      )}
    </CatalogState>
  );
}
