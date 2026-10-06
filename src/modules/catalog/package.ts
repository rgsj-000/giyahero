import { z } from "zod";

const priceSchema = z.object({
  label: z.string().trim().min(2).max(120),
  minTravelers: z.number().int().positive(),
  maxTravelers: z.number().int().positive().nullable(),
  amountMinor: z.number().int().positive().safe(),
});

const departureSchema = z
  .object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    bookingCutoffAt: z.iso.datetime(),
    capacity: z.number().int().positive(),
  })
  .superRefine((departure, context) => {
    const startsAt = Date.parse(departure.startsAt);
    const endsAt = Date.parse(departure.endsAt);
    const bookingCutoffAt = Date.parse(departure.bookingCutoffAt);

    if (endsAt <= startsAt) {
      context.addIssue({
        code: "custom",
        message: "Departure end must be after its start.",
        path: ["endsAt"],
      });
    }

    if (bookingCutoffAt >= startsAt) {
      context.addIssue({
        code: "custom",
        message: "Booking cutoff must be before departure.",
        path: ["bookingCutoffAt"],
      });
    }
  });

export const packagePublicationInputSchema = z
  .object({
    title: z.string().trim().min(5).max(180),
    overview: z.string().trim().min(30).max(8000),
    tripType: z.string().trim().min(2).max(80),
    durationDays: z.number().int().min(1).max(90),
    minTravelers: z.number().int().positive(),
    maxTravelers: z.number().int().positive(),
    currencyCode: z.string().regex(/^[A-Z]{3}$/),
    pricingModel: z.enum(["per_person", "per_group", "tiered", "variant"]),
    scheduleModel: z.enum(["fixed_departures", "open_dates"]),
    openDateWindow: z
      .object({
        startsOn: z.iso.date(),
        endsOn: z.iso.date(),
      })
      .nullable(),
    destinationIds: z.array(z.uuid()).min(1),
    itinerary: z
      .array(
        z.object({
          dayNumber: z.number().int().positive(),
          title: z.string().trim().min(2).max(160),
          description: z.string().trim().min(1).max(3000),
        }),
      )
      .min(1),
    inclusions: z.array(z.string().trim().min(2).max(300)).min(1),
    exclusions: z.array(z.string().trim().min(2).max(300)).min(1),
    prices: z.array(priceSchema).min(1),
    policies: z.object({
      cancellationTerms: z.string().trim().min(10).max(4000),
      reschedulingTerms: z.string().trim().min(10).max(4000),
      noShowTerms: z.string().trim().min(10).max(4000),
      agencyCancellationTerms: z.string().trim().min(10).max(4000),
    }),
    departures: z.array(departureSchema),
  })
  .superRefine((packageInput, context) => {
    if (
      new Set(packageInput.destinationIds).size !==
      packageInput.destinationIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Each destination can only be added once.",
        path: ["destinationIds"],
      });
    }

    if (
      new Set(packageInput.itinerary.map((day) => day.dayNumber)).size !==
      packageInput.itinerary.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Each itinerary day number must be unique.",
        path: ["itinerary"],
      });
    }

    if (
      new Set(packageInput.prices.map((price) => price.label.toLowerCase()))
        .size !== packageInput.prices.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Price labels must be unique.",
        path: ["prices"],
      });
    }

    if (packageInput.maxTravelers < packageInput.minTravelers) {
      context.addIssue({
        code: "custom",
        message: "Maximum group size must be at least the minimum group size.",
        path: ["maxTravelers"],
      });
    }

    if (
      packageInput.itinerary.some(
        (day) => day.dayNumber > packageInput.durationDays,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Itinerary days cannot exceed the package duration.",
        path: ["itinerary"],
      });
    }

    if (packageInput.scheduleModel === "fixed_departures") {
      if (packageInput.departures.length === 0) {
        context.addIssue({
          code: "custom",
          message:
            "At least one departure is required for fixed-date packages.",
          path: ["departures"],
        });
      }

      if (packageInput.openDateWindow !== null) {
        context.addIssue({
          code: "custom",
          message: "Fixed-date packages cannot have an open-date window.",
          path: ["openDateWindow"],
        });
      }
    } else {
      if (packageInput.departures.length > 0) {
        context.addIssue({
          code: "custom",
          message: "Open-date packages cannot contain fixed departures.",
          path: ["departures"],
        });
      }

      if (
        packageInput.openDateWindow === null ||
        packageInput.openDateWindow.endsOn <
          packageInput.openDateWindow.startsOn
      ) {
        context.addIssue({
          code: "custom",
          message: "Open-date packages need a valid availability window.",
          path: ["openDateWindow"],
        });
      }
    }

    if (
      packageInput.prices.some(
        (price) =>
          price.maxTravelers !== null &&
          price.maxTravelers < price.minTravelers,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Price tier maximum group size must be at least its minimum.",
        path: ["prices"],
      });
    }
  });

export type PackagePublicationInput = z.infer<
  typeof packagePublicationInputSchema
>;

export type AgencyPublishingState = "verified" | "unverified" | "suspended";

export function canPublishPackage(
  agencyState: AgencyPublishingState,
  input: unknown,
): boolean {
  return (
    agencyState === "verified" &&
    packagePublicationInputSchema.safeParse(input).success
  );
}

export function formatPrice(
  amountMinor: number,
  currencyCode: string,
  locale = "en-PH",
): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError(
      "Price must be a non-negative safe integer in minor units.",
    );
  }

  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  });
  const fractionDigits =
    currencyFormatter.resolvedOptions().maximumFractionDigits;

  if (fractionDigits === undefined) {
    throw new Error(
      `Could not determine minor-unit precision for ${currencyCode}.`,
    );
  }

  return currencyFormatter.format(amountMinor / 10 ** fractionDigits);
}
