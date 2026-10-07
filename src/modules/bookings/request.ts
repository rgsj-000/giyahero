import { z } from "zod";
export const bookingInputSchema = z
  .strictObject({
    packageId: z.uuid(),
    expectedVersion: z.number().int().positive(),
    rateId: z.uuid(),
    departureId: z.uuid().nullable(),
    startsOn: z.iso.date().nullable(),
    endsOn: z.iso.date().nullable(),
    adults: z.number().int().min(1).max(32767),
    children: z.number().int().min(0).max(32767),
    contactName: z.string().trim().min(2).max(120),
    contactEmail: z.string().trim().max(254).pipe(z.email()),
    contactPhone: z.string().trim().min(7).max(40),
    notes: z.string().trim().max(2000),
    submissionKey: z.uuid(),
  })
  .superRefine((v, c) => {
    if (
      v.departureId
        ? v.startsOn !== null || v.endsOn !== null
        : !v.startsOn || !v.endsOn || v.endsOn < v.startsOn
    )
      c.addIssue({
        code: "custom",
        message: "Choose one departure or valid travel dates.",
        path: ["startsOn"],
      });
  });
