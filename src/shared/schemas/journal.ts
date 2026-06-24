import { z } from "zod";

export const createJournalSchema = z.object({
  journalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  notes: z.string().optional(),
});

export const updateJournalSchema = z.object({
  notes: z.string().optional(),
});

export const journalQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type JournalQueryInput = z.infer<typeof journalQuerySchema>;
