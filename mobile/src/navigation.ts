import { Browser } from "@capacitor/browser";
import { safeReturnPath } from "./auth/auth-links";
export function returnToMarketplace(path: unknown) {
  window.location.hash = safeReturnPath(path).slice(2);
}
export async function openHostedPage(path: string) {
  const url = new URL(path, import.meta.env.VITE_WEB_ORIGIN);
  if (
    url.protocol !== "https:" ||
    url.origin !== new URL(import.meta.env.VITE_WEB_ORIGIN).origin
  )
    throw new Error("This link is not part of the configured GiyaHero site.");
  await Browser.open({ url: url.href });
}
