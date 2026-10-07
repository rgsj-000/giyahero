import { requireBookingStaff } from "@/features/bookings/require-booking-staff";
import { WebAgencyWorkspace } from "@/features/catalog/web-agency-workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ agencyId: string; requestId: string }>;
}) {
  const { agencyId, requestId } = await params;
  await requireBookingStaff(
    agencyId,
    "/agency/" + agencyId + "/requests/" + requestId,
  );
  return (
    <WebAgencyWorkspace agencyId={agencyId} requests requestId={requestId} />
  );
}
