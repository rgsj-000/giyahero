import { requireBookingStaff } from "@/features/bookings/require-booking-staff";
import { WebAgencyWorkspace } from "@/features/catalog/web-agency-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ agencyId: string }>;
}) {
  const { agencyId } = await params;
  await requireBookingStaff(agencyId, "/agency/" + agencyId + "/requests");
  return <WebAgencyWorkspace agencyId={agencyId} requests />;
}
