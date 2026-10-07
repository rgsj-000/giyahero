export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/#browse";
  const id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const allowed = new RegExp(
    "^/#(?:browse|trips|agency|(?:package|book|request)/" +
      id +
      "|agency/" +
      id +
      "(?:/(?:requests(?:/" +
      id +
      ")?|packages/(?:new|" +
      id +
      ")))?)$",
    "i",
  );
  return allowed.test(value) ? value : "/#browse";
}
export function parseAuthLink(
  value: string,
  callbackUrl: string,
): { code: string } | null {
  let link: URL;
  try {
    link = new URL(value);
  } catch {
    return null;
  }
  const expected = new URL(callbackUrl);
  if (
    link.protocol !== "https:" ||
    link.username ||
    link.password ||
    link.origin !== expected.origin ||
    link.pathname !== expected.pathname ||
    link.hash
  )
    return null;
  if (link.searchParams.has("error"))
    throw new Error("Sign-in was not completed. Please sign in again.");
  const code = link.searchParams.get("code");
  if (!code || link.searchParams.getAll("code").length !== 1)
    throw new Error(
      "The sign-in link has no valid authorization code. Sign in normally if you confirmed your email on another device.",
    );
  return { code };
}
export function createAuthLinkHandler(
  callbackUrl: string,
  exchange: (code: string) => Promise<void>,
  onHandled: () => Promise<void>,
) {
  const completed = new Set<string>();
  const pending = new Map<string, Promise<"handled">>();
  return async (url: string): Promise<"handled" | "ignored"> => {
    const parsed = parseAuthLink(url, callbackUrl);
    if (!parsed) return "ignored";
    const code = parsed.code;
    if (completed.has(code)) return "handled";
    const existing = pending.get(code);
    if (existing) return existing;
    const operation = (async () => {
      await exchange(code);
      completed.add(code);
      if (completed.size > 20)
        completed.delete(completed.values().next().value!);
      await onHandled();
      return "handled" as const;
    })();
    pending.set(code, operation);
    try {
      return await operation;
    } finally {
      pending.delete(code);
    }
  };
}
