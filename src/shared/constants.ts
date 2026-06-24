export const DEFAULT_CATEGORIES = [
  { name: "Food", icon: "utensils", color: "#f97316" },
  { name: "Milk", icon: "milk", color: "#38bdf8" },
  { name: "Vegetables", icon: "carrot", color: "#22c55e" },
  { name: "Fruits", icon: "apple", color: "#f59e0b" },
  { name: "Petrol", icon: "fuel", color: "#3b82f6" },
  { name: "Mobile Recharge", icon: "smartphone", color: "#8b5cf6" },
  { name: "Electricity Bill", icon: "zap", color: "#eab308" },
  { name: "Internet", icon: "wifi", color: "#06b6d4" },
  { name: "Rent", icon: "house", color: "#64748b" },
  { name: "Medical", icon: "heart-pulse", color: "#ef4444" },
  { name: "Education", icon: "book-open", color: "#0891b2" },
  { name: "Travel", icon: "plane", color: "#14b8a6" },
  { name: "Shopping", icon: "shopping-bag", color: "#ec4899" },
  { name: "Hair Cut", icon: "scissors", color: "#FFE4CC" },
  { name: "Salary", icon: "wallet", color: "#16a34a" },
  { name: "Savings", icon: "piggy-bank", color: "#a855f7" },
  { name: "Zakat/Charity", icon: "hand-heart", color: "#f43f5e" },
  { name: "Others", icon: "circle-ellipsis", color: "#E5E7EB" },
] as const;

export const PAYMENT_METHODS = [
  "Cash",
  "UPI",
  "Card",
  "Net Banking",
  "Wallet",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
