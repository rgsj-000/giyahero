import { z } from "zod";
const selectionSchema = z.object({
  rateId: z.string(),
  departureId: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  adults: z.number().int(),
  children: z.number().int(),
  submissionKey: z.uuid(),
});
export type RequestSelection = z.infer<typeof selectionSchema>;
const prefix = "giyahero-request:";
export function newSelection(): RequestSelection {
  return {
    rateId: "",
    departureId: "",
    startsOn: "",
    endsOn: "",
    adults: 1,
    children: 0,
    submissionKey: crypto.randomUUID(),
  };
}
export function readSelection(packageId: string): RequestSelection {
  try {
    const value = localStorage.getItem(prefix + packageId);
    if (value) {
      const result = selectionSchema.safeParse(JSON.parse(value));
      if (result.success) return result.data;
    }
  } catch {}
  return newSelection();
}
export function saveSelection(packageId: string, value: RequestSelection) {
  try {
    localStorage.setItem(
      prefix + packageId,
      JSON.stringify(selectionSchema.parse(value)),
    );
  } catch {
    /* The in-memory key still protects retry during this screen. */
  }
}
export function clearSelection(packageId: string) {
  try {
    localStorage.removeItem(prefix + packageId);
  } catch {}
}
