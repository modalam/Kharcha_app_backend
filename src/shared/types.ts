export interface User {
  id: string;
  name: string;
  email: string;
  isVerified: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  color: string | null;
  createdAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  categoryId: string;
  title: string;
  amount: number;
  expenseDate: string;
  subcategory: string | null;
  notes: string | null;
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface DailyJournal {
  id: string;
  userId: string;
  journalDate: string;
  notes: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardData {
  cards: {
    todaySpending: number;
    weeklySpending: number;
    monthlySpending: number;
    lifetimeSpending: number;
    highestCategory: { name: string; amount: number } | null;
  };
  widgets: {
    recentExpenses: Expense[];
    spendingTrend: { date: string; amount: number }[];
    topCategories: { name: string; amount: number; color: string | null }[];
    financialSummary: {
      totalExpenses: number;
      averageDaily: number;
      expenseCount: number;
    };
  };
}

export interface Insight {
  type: "increase" | "decrease" | "savings" | "info";
  message: string;
  category?: string;
  amount?: number;
  percentage?: number;
}

export interface ReportData {
  dateFrom: string;
  dateTo: string;
  totalSpending: number;
  transactionCount: number;
  highestExpenseDay: { date: string; amount: number } | null;
  averageDailySpending: number;
  averageMonthlySpending: number;
  topCategories: { name: string; amount: number; color: string | null }[];
  monthlySummary: { month: string; amount: number; count: number }[];
  insights: Insight[];
}
