import { z } from "zod";
import { PAYMENT_METHODS } from "../constants";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const updateCategoryBodySchema = updateCategorySchema.extend({
  id: z.string().min(1, "ID is required"),
});

export const deleteCategorySchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const getCategorySchema = deleteCategorySchema;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type UpdateCategoryBodyInput = z.infer<typeof updateCategoryBodySchema>;
export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
export type GetCategoryInput = z.infer<typeof getCategorySchema>;

export const createExpenseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  amount: z.number().positive("Amount must be positive"),
  categoryId: z.string().min(1, "Category is required"),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  subcategory: z.string().optional(),
  notes: z.string().optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const expenseQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["expense_date", "amount", "title", "created_at"]).default("expense_date"),
  order: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().optional(),
  categoryId: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).optional(),
  paymentMethod: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID required"),
});

export const duplicateExpenseSchema = z.object({
  id: z.string().min(1),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const bulkCreateExpenseSchema = z.object({
  expenses: z.array(createExpenseSchema).min(1, "At least one expense is required").max(500, "Max 500 expenses per import"),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type ExpenseQueryInput = z.infer<typeof expenseQuerySchema>;
