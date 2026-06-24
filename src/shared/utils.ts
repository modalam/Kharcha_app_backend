const CURRENCY = "INR";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function toISODate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function getStartOfWeek(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toISODate(d);
}

export function getStartOfMonth(date: Date = new Date()): string {
  const d = new Date(date);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function getEndOfMonth(date: Date = new Date()): string {
  const d = new Date(date);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
