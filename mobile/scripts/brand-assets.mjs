import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "..");
const logo = resolve(root, "../public/images/logo.webp");
async function brand(path, size, ratio) {
  const mark = await sharp(logo)
    .resize({
      width: Math.round(size * ratio),
      height: Math.round(size * ratio),
      fit: "inside",
    })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(path);
}
async function walk(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) await walk(path);
    else if (item.name.endsWith(".png")) {
      const meta = await sharp(path).metadata();
      if (!meta.width || !meta.height)
        throw new Error("Invalid native asset " + path);
      const splash = item.name.includes("splash");
      const mark = await sharp(logo)
        .resize({
          width: Math.round(
            Math.min(meta.width, meta.height) *
              (splash ? 0.36 : item.name.includes("foreground") ? 0.5 : 0.72),
          ),
          height: Math.round(Math.min(meta.width, meta.height) * 0.72),
          fit: "inside",
        })
        .toBuffer();
      const output = await sharp({
        create: {
          width: meta.width,
          height: meta.height,
          channels: 4,
          background: "#ffffff",
        },
      })
        .composite([{ input: mark, gravity: "center" }])
        .png()
        .toBuffer();
      await (await import("node:fs/promises")).writeFile(path, output);
    }
  }
}
await walk(resolve(root, "android/app/src/main/res"));
await brand(
  resolve(
    root,
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
  ),
  1024,
  0.72,
);
await walk(resolve(root, "ios/App/App/Assets.xcassets/Splash.imageset"));
console.log(
  "Updated Android and iOS icons and splash images from the existing GiyaHero logo.",
);
