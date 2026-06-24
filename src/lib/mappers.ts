import { nanoid } from "nanoid";
import type { Category, DailyJournal, Expense, User } from "@/shared";

export function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    isVerified: Boolean(row.is_verified),
    createdAt: row.created_at as string,
  };
}

export function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    icon: (row.icon as string) ?? null,
    color: (row.color as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function mapExpense(row: Record<string, unknown>): Expense {
  const expense: Expense = {
    id: row.id as string,
    userId: row.user_id as string,
    categoryId: row.category_id as string,
    title: row.title as string,
    amount: row.amount as number,
    expenseDate: row.expense_date as string,
    subcategory: (row.subcategory as string) ?? null,
    notes: (row.notes as string) ?? null,
    paymentMethod: (row.payment_method as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
  if (row.category_name) {
    expense.category = {
      id: row.category_id as string,
      userId: row.user_id as string,
      name: row.category_name as string,
      icon: (row.category_icon as string) ?? null,
      color: (row.category_color as string) ?? null,
      createdAt: row.created_at as string,
    };
  }
  return expense;
}

export function mapJournal(row: Record<string, unknown>): DailyJournal {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    journalDate: row.journal_date as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function newId(): string {
  return nanoid();
}
