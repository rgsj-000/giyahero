"use client";
import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listMyAgencies } from "./catalog-management-service";
import { CatalogState, useData } from "./catalog-state";
import { AgencyPackageList } from "./agency-package-list";
import { PackageEditor } from "./package-editor";
import { AgencyInbox } from "../bookings/agency-inbox";
import { AgencyRequestDetail } from "../bookings/agency-request-detail";
export function AgencyWorkspace({
  client,
  agencyId,
  packageId,
  editing = false,
  requests = false,
  requestId,
  onLogin,
  openExternal,
}: {
  client: SupabaseClient;
  agencyId?: string;
  packageId?: string;
  editing?: boolean;
  requests?: boolean;
  requestId?: string;
  onLogin: (returnPath: string) => void;
  openExternal: (path: string) => void;
}) {
  const memberships = useData(
    useCallback(() => listMyAgencies(client), [client]),
  );
  const membership = memberships.data?.find((a) => a.id === agencyId);
  if (!agencyId)
    return (
      <>
        <h1>Agency workspace</h1>
        <CatalogState
          loading={memberships.loading}
          error={memberships.error}
          onRetry={memberships.refresh}
        >
          {memberships.data?.length ? (
            memberships.data.map((a) => (
              <button
                className="gh-action gh-secondary gh-wide"
                key={a.id}
                onClick={() => {
                  window.location.hash = "agency/" + a.id;
                }}
              >
                {a.name}
              </button>
            ))
          ) : (
            <div className="gh-empty">
              <p>
                Sign in to manage your agency packages and booking requests.
              </p>
              <button
                className="gh-action gh-orange"
                onClick={() => onLogin("/#agency")}
              >
                Sign in to continue
              </button>
              <p>
                <button
                  className="gh-action gh-secondary"
                  onClick={() => openExternal("/agency/onboarding")}
                >
                  Register your agency
                </button>
              </p>
            </div>
          )}
        </CatalogState>
      </>
    );
  return (
    <CatalogState
      loading={memberships.loading}
      error={memberships.error}
      onRetry={memberships.refresh}
    >
      {membership ? (
        <>
          <button
            className="gh-action gh-secondary"
            onClick={() => {
              window.location.hash = "agency";
            }}
          >
            Your agencies
          </button>
          <h2>{membership.name}</h2>
          <div className="gh-form-actions">
            <button
              className="gh-action gh-secondary"
              onClick={() => {
                window.location.hash = "agency/" + agencyId;
              }}
            >
              Packages
            </button>
            <button
              className="gh-action gh-secondary"
              onClick={() => {
                window.location.hash = "agency/" + agencyId + "/requests";
              }}
            >
              Booking requests
            </button>
            <button
              className="gh-action gh-secondary"
              onClick={() =>
                openExternal("/agency/" + agencyId + "/verification")
              }
            >
              Verification
            </button>
          </div>
          {requests ? (
            ["owner", "manager", "booking_staff"].includes(membership.role) ? (
              requestId ? (
                <AgencyRequestDetail
                  key={requestId}
                  client={client}
                  agencyId={agencyId}
                  requestId={requestId}
                  onChanged={() => {}}
                />
              ) : (
                <AgencyInbox
                  client={client}
                  agencyId={agencyId}
                  onOpenRequest={(id) => {
                    window.location.hash =
                      "agency/" + agencyId + "/requests/" + id;
                  }}
                />
              )
            ) : (
              <p>
                Your role cannot view booking requests or traveler contacts.
              </p>
            )
          ) : ["owner", "manager", "content_staff"].includes(
              membership.role,
            ) ? (
            editing ? (
              <PackageEditor
                client={client}
                agencyId={agencyId}
                packageId={packageId ?? null}
                onSaved={(id) => {
                  window.location.hash =
                    "agency/" + agencyId + "/packages/" + id;
                }}
              />
            ) : (
              <AgencyPackageList
                client={client}
                agencyId={agencyId}
                onOpen={(id) => {
                  window.location.hash =
                    "agency/" + agencyId + "/packages/" + (id ?? "new");
                }}
              />
            )
          ) : (
            <div className="gh-empty">
              <p>
                Your agency role can view the workspace. Package editing is
                available to owners, managers, and content staff.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="gh-empty">
          <p>You do not have access to this agency workspace.</p>
        </div>
      )}
    </CatalogState>
  );
}
