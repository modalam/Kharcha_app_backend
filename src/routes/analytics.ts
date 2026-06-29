import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  getDashboardData,
  getMonthlyAnalytics,
  getWeeklyAnalytics,
  getCategoryAnalytics,
  getPaymentMethodAnalytics,
  getReportData,
  getExpensesForExport,
} from "../services/analytics";
import { nowISO } from "../lib/crypto";

function monthStartISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

const dashboard = new Hono<{ Bindings: Env; Variables: AppVariables }>();
dashboard.use("*", authMiddleware);
dashboard.get("/", async (c) => {
  const tz = Number.parseInt(c.req.query("tz") ?? "", 10);
  const data = await getDashboardData(c.env, c.get("userId"), Number.isFinite(tz) ? tz : 0);
  return c.json(data);
});

const analytics = new Hono<{ Bindings: Env; Variables: AppVariables }>();
analytics.use("*", authMiddleware);

analytics.get("/monthly", async (c) => {
  const data = await getMonthlyAnalytics(c.env, c.get("userId"));
  return c.json(data);
});

analytics.get("/weekly", async (c) => {
  const data = await getWeeklyAnalytics(c.env, c.get("userId"));
  return c.json(data);
});

analytics.get("/categories", async (c) => {
  const data = await getCategoryAnalytics(c.env, c.get("userId"), monthStartISO());
  return c.json(data);
});

analytics.get("/payment-methods", async (c) => {
  const data = await getPaymentMethodAnalytics(c.env, c.get("userId"), monthStartISO());
  return c.json(data);
});

const reports = new Hono<{ Bindings: Env; Variables: AppVariables }>();
reports.use("*", authMiddleware);
reports.get("/", async (c) => {
  const data = await getReportData(
    c.env,
    c.get("userId"),
    c.req.query("dateFrom") || undefined,
    c.req.query("dateTo") || undefined
  );
  return c.json(data);
});

const exportRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();
exportRoutes.use("*", authMiddleware);

function getFilters(c: { req: { query: (k: string) => string | undefined } }) {
  return {
    dateFrom: c.req.query("dateFrom") ?? "",
    dateTo: c.req.query("dateTo") ?? "",
    categoryId: c.req.query("categoryId") ?? "",
  };
}

exportRoutes.get("/csv", async (c) => {
  const userId = c.get("userId");
  const rows = await getExpensesForExport(c.env, userId, getFilters(c));

  const header = "Date,Title,Amount,Category,Subcategory,Payment Method,Notes\n";
  const csv = rows.map((r) => {
    const row = r as Record<string, unknown>;
    const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [
      row.expense_date, row.title, row.amount, row.category_name,
      row.subcategory, row.payment_method, row.notes,
    ].map(escape).join(",");
  }).join("\n");

  return new Response(header + csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="kharcha-expenses.csv"',
    },
  });
});

exportRoutes.get("/excel", async (c) => {
  const userId = c.get("userId");
  const rows = await getExpensesForExport(c.env, userId, getFilters(c));

  const header = "Date\tTitle\tAmount\tCategory\tSubcategory\tPayment Method\tNotes\n";
  const tsv = rows.map((r) => {
    const row = r as Record<string, unknown>;
    return [
      row.expense_date, row.title, row.amount, row.category_name,
      row.subcategory, row.payment_method, row.notes,
    ].join("\t");
  }).join("\n");

  return new Response(header + tsv, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": 'attachment; filename="kharcha-expenses.xls"',
    },
  });
});

exportRoutes.get("/pdf", async (c) => {
  const userId = c.get("userId");
  const filters = getFilters(c);
  const rows = await getExpensesForExport(c.env, userId, filters);
  const report = await getReportData(c.env, userId, filters.dateFrom || undefined, filters.dateTo || undefined);

  const total = rows.reduce((sum, r) => sum + ((r as Record<string, number>).amount ?? 0), 0);
  const esc = (v: unknown) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
  h1 { color: #16a34a; } table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f0fdf4; } .summary { display: flex; gap: 20px; margin: 20px 0; }
  .card { background: #f9fafb; padding: 16px; border-radius: 8px; flex: 1; }
  .card h3 { margin: 0 0 8px; font-size: 14px; color: #6b7280; }
  .card p { margin: 0; font-size: 20px; font-weight: bold; }
</style></head><body>
  <h1>Kharcha Journal — Expense Report</h1>
  <p>Generated: ${nowISO().split("T")[0]}</p>
  <div class="summary">
    <div class="card"><h3>Total Expenses</h3><p>₹${Math.round(total).toLocaleString("en-IN")}</p></div>
    <div class="card"><h3>Avg Daily</h3><p>₹${Math.round(report.averageDailySpending).toLocaleString("en-IN")}</p></div>
    <div class="card"><h3>Transactions</h3><p>${rows.length}</p></div>
  </div>
  <table><thead><tr><th>Date</th><th>Title</th><th>Amount</th><th>Category</th><th>Subcategory</th><th>Payment</th><th>Notes</th></tr></thead>
  <tbody>${rows.map((r) => {
    const row = r as Record<string, unknown>;
    return `<tr><td>${esc(row.expense_date)}</td><td>${esc(row.title)}</td><td>₹${esc(row.amount)}</td><td>${esc(row.category_name)}</td><td>${esc(row.subcategory)}</td><td>${esc(row.payment_method)}</td><td>${esc(row.notes)}</td></tr>`;
  }).join("")}</tbody></table>
  ${report.insights.length ? `<h2>Insights</h2><ul>${report.insights.map((i) => `<li>${esc(i.message)}</li>`).join("")}</ul>` : ""}
</body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": 'attachment; filename="kharcha-report.html"',
    },
  });
});

export { dashboard, analytics, reports, exportRoutes };
