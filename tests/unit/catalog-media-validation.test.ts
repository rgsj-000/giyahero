import { expect, it } from "vitest";
import { validatePackageImage } from "@/features/catalog/catalog-media";
it("accepts a valid PNG and rejects a false MIME or extension", async () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  expect(
    await validatePackageImage(
      new File([png], "trip.png", { type: "image/png" }),
    ),
  ).toBe("png");
  await expect(
    validatePackageImage(new File([png], "trip.jpg", { type: "image/jpeg" })),
  ).rejects.toThrow();
  await expect(
    validatePackageImage(new File([png], "trip.jpg", { type: "image/png" })),
  ).rejects.toThrow();
});
it("rejects oversized and empty uploads", async () => {
  await expect(
    validatePackageImage(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "trip.png", {
        type: "image/png",
      }),
    ),
  ).rejects.toThrow();
  await expect(
    validatePackageImage(new File([], "trip.png", { type: "image/png" })),
  ).rejects.toThrow();
});
