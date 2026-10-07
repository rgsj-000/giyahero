export function currencyScale(currency: string): number {
  return (
    10 **
    (new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2)
  );
}
export function manilaDateTimeInput(timestamp: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(timestamp))
    .replace(" ", "T");
}
export function manilaInputToIso(value: string): string {
  return new Date(value + "+08:00").toISOString();
}
