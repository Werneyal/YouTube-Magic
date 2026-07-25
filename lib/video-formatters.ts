export function formatVideoDate(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(value));
  const getPart = (type: "day" | "month" | "year") =>
    parts.find((part) => part.type === type)?.value ?? "";
  const month = getPart("month").replace(".", "").toLocaleUpperCase("pt-BR");

  return `${getPart("day")} ${month} ${getPart("year")}`;
}