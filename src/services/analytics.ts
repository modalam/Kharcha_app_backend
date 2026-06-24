import type { Insight } from "@/shared";
import type { Env } from "../types";
import { mapExpense } from "../lib/mappers";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function weekStartISO(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

function monthStartISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export async function getDashboardData(env: Env, userId: string) {
  const today = todayISO();
  const weekStart = weekStartISO();
  const monthStart = monthStartISO();

  const [todayRow, weekRow, monthRow, lifetimeRow, topCat, recent, trend, topCats, summary] =
    await Promise.all([
      env.DB.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND expense_date = ?"
      ).bind(userId, today).first<{ total: number }>(),

      env.DB.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND expense_date >= ?"
      ).bind(userId, weekStart).first<{ total: number }>(),

      env.DB.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND expense_date >= ?"
      ).bind(userId, monthStart).first<{ total: number }>(),

      env.DB.prepare(
        "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?"
      ).bind(userId).first<{ total: number }>(),

      env.DB.prepare(
        `SELECT c.name, SUM(e.amount) as amount FROM expenses e
         JOIN categories c ON e.category_id = c.id
         WHERE e.user_id = ? AND e.expense_date >= ?
         GROUP BY c.id ORDER BY amount DESC LIMIT 1`
      ).bind(userId, monthStart).first<{ name: string; amount: number }>(),

      env.DB.prepare(
        `SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
         FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
         WHERE e.user_id = ? ORDER BY e.created_at DESC LIMIT 10`
      ).bind(userId).all(),

      env.DB.prepare(
        `SELECT expense_date as date, SUM(amount) as amount FROM expenses
         WHERE user_id = ? AND expense_date >= date('now', '-30 days')
         GROUP BY expense_date ORDER BY expense_date ASC`
      ).bind(userId).all(),

      env.DB.prepare(
        `SELECT c.name, c.color, SUM(e.amount) as amount FROM expenses e
         JOIN categories c ON e.category_id = c.id
         WHERE e.user_id = ? AND e.expense_date >= ?
         GROUP BY c.id ORDER BY amount DESC LIMIT 5`
      ).bind(userId, monthStart).all(),

      env.DB.prepare(
        `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total,
         COALESCE(AVG(amount), 0) as avg_amount
         FROM expenses WHERE user_id = ? AND expense_date >= ?`
      ).bind(userId, monthStart).first<{ count: number; total: number; avg_amount: number }>(),
    ]);

  const daysInMonth = new Date().getDate();
  const data = {
    cards: {
      todaySpending: todayRow?.total ?? 0,
      weeklySpending: weekRow?.total ?? 0,
      monthlySpending: monthRow?.total ?? 0,
      lifetimeSpending: lifetimeRow?.total ?? 0,
      highestCategory: topCat ? { name: topCat.name, amount: topCat.amount } : null,
    },
    widgets: {
      recentExpenses: (recent.results ?? []).map((r) =>
        mapExpense(r as Record<string, unknown>)
      ),
      spendingTrend: (trend.results ?? []).map((r) => ({
        date: (r as Record<string, string>).date,
        amount: (r as Record<string, number>).amount,
      })),
      topCategories: (topCats.results ?? []).map((r) => ({
        name: (r as Record<string, string>).name,
        amount: (r as Record<string, number>).amount,
        color: (r as Record<string, string | null>).color,
      })),
      financialSummary: {
        totalExpenses: summary?.total ?? 0,
        averageDaily: daysInMonth > 0 ? (summary?.total ?? 0) / daysInMonth : 0,
        expenseCount: summary?.count ?? 0,
      },
    },
  };

  return data;
}

export async function getMonthlyAnalytics(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as amount, COUNT(*) as count
     FROM expenses WHERE user_id = ? AND expense_date >= date('now', '-12 months')
     GROUP BY month ORDER BY month ASC`
  ).bind(userId).all();
  return results ?? [];
}

export async function getWeeklyAnalytics(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT strftime('%Y-W%W', expense_date) as week, SUM(amount) as amount, COUNT(*) as count
     FROM expenses WHERE user_id = ? AND expense_date >= date('now', '-56 days')
     GROUP BY week ORDER BY week ASC`
  ).bind(userId).all();
  return results ?? [];
}

export async function getCategoryAnalytics(env: Env, userId: string, monthStart: string) {
  const { results } = await env.DB.prepare(
    `SELECT c.name, c.color, SUM(e.amount) as amount, COUNT(*) as count
     FROM expenses e JOIN categories c ON e.category_id = c.id
     WHERE e.user_id = ? AND e.expense_date >= ?
     GROUP BY c.id ORDER BY amount DESC`
  ).bind(userId, monthStart).all();
  return results ?? [];
}

export async function getPaymentMethodAnalytics(env: Env, userId: string, monthStart: string) {
  const { results } = await env.DB.prepare(
    `SELECT COALESCE(payment_method, 'Unknown') as method, SUM(amount) as amount, COUNT(*) as count
     FROM expenses WHERE user_id = ? AND expense_date >= ?
     GROUP BY payment_method ORDER BY amount DESC`
  ).bind(userId, monthStart).all();
  return results ?? [];
}

export async function generateInsights(env: Env, userId: string): Promise<Insight[]> {
  const insights: Insight[] = [];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [thisMonth, lastMonth, categoryComparison] = await Promise.all([
    env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND expense_date >= ?"
    ).bind(userId, thisMonthStart).first<{ total: number }>(),

    env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND expense_date >= ? AND expense_date <= ?"
    ).bind(userId, lastMonthStart, lastMonthEnd).first<{ total: number }>(),

    env.DB.prepare(
      `SELECT c.name,
         SUM(CASE WHEN e.expense_date >= ? THEN e.amount ELSE 0 END) as this_amount,
         SUM(CASE WHEN e.expense_date >= ? AND e.expense_date <= ? THEN e.amount ELSE 0 END) as last_amount
       FROM expenses e JOIN categories c ON e.category_id = c.id
       WHERE e.user_id = ? AND e.expense_date >= ?
       GROUP BY c.id HAVING this_amount > 0 OR last_amount > 0`
    ).bind(thisMonthStart, lastMonthStart, lastMonthEnd, userId, lastMonthStart).all(),
  ]);

  const thisTotal = thisMonth?.total ?? 0;
  const lastTotal = lastMonth?.total ?? 0;

  if (lastTotal > 0) {
    const savings = lastTotal - thisTotal;
    if (savings > 0) {
      insights.push({
        type: "savings",
        message: `You saved ₹${Math.round(savings).toLocaleString("en-IN")} compared to last month`,
        amount: savings,
      });
    } else if (savings < 0) {
      insights.push({
        type: "increase",
        message: `Overall spending increased by ₹${Math.round(Math.abs(savings)).toLocaleString("en-IN")} compared to last month`,
        amount: Math.abs(savings),
      });
    }
  }

  for (const row of categoryComparison.results ?? []) {
    const r = row as Record<string, number | string>;
    const thisAmt = r.this_amount as number;
    const lastAmt = r.last_amount as number;
    const name = r.name as string;

    if (lastAmt > 0 && thisAmt > lastAmt) {
      const pct = Math.round(((thisAmt - lastAmt) / lastAmt) * 100);
      if (pct >= 5) {
        insights.push({
          type: "increase",
          message: `${name} spending increased by ${pct}%`,
          category: name,
          percentage: pct,
        });
      }
    } else if (lastAmt > 0 && thisAmt < lastAmt) {
      const diff = lastAmt - thisAmt;
      if (diff >= 100) {
        insights.push({
          type: "decrease",
          message: `${name} spending decreased by ₹${Math.round(diff).toLocaleString("en-IN")}`,
          category: name,
          amount: diff,
        });
      }
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: "info",
      message: "Keep tracking your expenses to unlock personalized insights!",
    });
  }

  return insights;
}

export async function getReportData(env: Env, userId: string) {
  const [highestDay, avgDaily, avgMonthly, topCategories, monthlySummary, insights] =
    await Promise.all([
      env.DB.prepare(
        `SELECT expense_date as date, SUM(amount) as amount FROM expenses
         WHERE user_id = ? GROUP BY expense_date ORDER BY amount DESC LIMIT 1`
      ).bind(userId).first<{ date: string; amount: number }>(),

      env.DB.prepare(
        "SELECT COALESCE(AVG(daily_total), 0) as avg FROM (SELECT SUM(amount) as daily_total FROM expenses WHERE user_id = ? GROUP BY expense_date)"
      ).bind(userId).first<{ avg: number }>(),

      env.DB.prepare(
        `SELECT COALESCE(AVG(monthly_total), 0) as avg FROM (
           SELECT strftime('%Y-%m', expense_date) as m, SUM(amount) as monthly_total
           FROM expenses WHERE user_id = ? GROUP BY m
         )`
      ).bind(userId).first<{ avg: number }>(),

      env.DB.prepare(
        `SELECT c.name, c.color, SUM(e.amount) as amount FROM expenses e
         JOIN categories c ON e.category_id = c.id WHERE e.user_id = ?
         GROUP BY c.id ORDER BY amount DESC LIMIT 5`
      ).bind(userId).all(),

      env.DB.prepare(
        `SELECT strftime('%Y-%m', expense_date) as month, SUM(amount) as amount, COUNT(*) as count
         FROM expenses WHERE user_id = ? GROUP BY month ORDER BY month DESC LIMIT 12`
      ).bind(userId).all(),

      generateInsights(env, userId),
    ]);

  return {
    highestExpenseDay: highestDay ?? null,
    averageDailySpending: avgDaily?.avg ?? 0,
    averageMonthlySpending: avgMonthly?.avg ?? 0,
    topCategories: (topCategories.results ?? []).map((r) => ({
      name: (r as Record<string, string>).name,
      amount: (r as Record<string, number>).amount,
      color: (r as Record<string, string | null>).color,
    })),
    monthlySummary: (monthlySummary.results ?? []).map((r) => ({
      month: (r as Record<string, string>).month,
      amount: (r as Record<string, number>).amount,
      count: (r as Record<string, number>).count,
    })),
    insights,
  };
}

export async function getExpensesForExport(env: Env, userId: string, filters: Record<string, string>) {
  const conditions = ["e.user_id = ?"];
  const params: unknown[] = [userId];

  if (filters.dateFrom) { conditions.push("e.expense_date >= ?"); params.push(filters.dateFrom); }
  if (filters.dateTo) { conditions.push("e.expense_date <= ?"); params.push(filters.dateTo); }
  if (filters.categoryId) { conditions.push("e.category_id = ?"); params.push(filters.categoryId); }

  const { results } = await env.DB.prepare(
    `SELECT e.*, c.name as category_name FROM expenses e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE ${conditions.join(" AND ")} ORDER BY e.expense_date DESC`
  ).bind(...params).all();

  return results ?? [];
}
