import type { SupabaseClient } from "@supabase/supabase-js";
import { bookingInputSchema } from "../../modules/bookings/request";
import type {
  BookingInput,
  BookingRecord,
  BookingStatus,
  BookingEvent,
} from "../../modules/bookings/types";
const fields =
  "id,traveler_id,agency_id,package_id,rate_id,departure_id,status,snapshot,contact_name,contact_email,contact_phone,notes,created_at,decided_at,decision_reason";
function record(row: Record<string, unknown>): BookingRecord {
  return {
    id: row.id,
    travelerId: row.traveler_id,
    agencyId: row.agency_id,
    packageId: row.package_id,
    rateId: row.rate_id,
    departureId: row.departure_id,
    status: row.status,
    snapshot: row.snapshot,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    notes: row.notes,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
  } as BookingRecord;
}
export async function getRequest(
  client: SupabaseClient,
  id: string,
): Promise<BookingRecord> {
  const { data, error } = await client
    .from("booking_requests")
    .select(fields)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return record(data);
}
export async function submitBookingRequest(
  client: SupabaseClient,
  input: BookingInput,
): Promise<BookingRecord> {
  const { data, error } = await client.rpc("submit_booking_request", {
    request_input: bookingInputSchema.parse(input),
  });
  if (error) throw new Error(error.message);
  return getRequest(client, data);
}
export async function listMyRequests(
  client: SupabaseClient,
): Promise<BookingRecord[]> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError")
    throw new Error(authError.message);
  if (!user) return [];
  const { data, error } = await client
    .from("booking_requests")
    .select(fields)
    .eq("traveler_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(record);
}
export async function listAgencyRequests(
  client: SupabaseClient,
  agencyId: string,
  status?: BookingStatus,
): Promise<BookingRecord[]> {
  let query = client
    .from("booking_requests")
    .select(fields)
    .eq("agency_id", agencyId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(record);
}
export async function getRequestEvents(
  client: SupabaseClient,
  id: string,
): Promise<BookingEvent[]> {
  const { data, error } = await client
    .from("booking_events")
    .select("id,request_id,status,reason,created_at")
    .eq("request_id", id)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({
    id: e.id,
    requestId: e.request_id,
    status: e.status,
    reason: e.reason,
    createdAt: e.created_at,
  }));
}
export async function decideRequest(
  client: SupabaseClient,
  id: string,
  status: "accepted" | "declined",
  reason: string,
) {
  const { error } = await client.rpc("decide_booking_request", {
    target_request_id: id,
    target_status: status,
    reason,
  });
  if (error) throw new Error(error.message);
}
export async function cancelRequest(
  client: SupabaseClient,
  id: string,
  reason: string,
) {
  const { error } = await client.rpc("cancel_booking_request", {
    target_request_id: id,
    reason,
  });
  if (error) throw new Error(error.message);
}
