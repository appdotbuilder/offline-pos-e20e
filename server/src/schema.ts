
import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  password_hash: z.string(),
  role: z.enum(['admin', 'cashier']),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  category_id: z.number().nullable(),
  image_url: z.string().nullable(),
  purchase_price: z.number(),
  selling_price: z.number(),
  stock_quantity: z.number().int(),
  low_stock_threshold: z.number().int(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  transaction_code: z.string(),
  user_id: z.number(),
  subtotal: z.number(),
  discount_amount: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  payment_method: z.enum(['cash', 'card', 'mobile']),
  status: z.enum(['completed', 'cancelled', 'refunded']),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Transaction item schema
export const transactionItemSchema = z.object({
  id: z.number(),
  transaction_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  discount_amount: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type TransactionItem = z.infer<typeof transactionItemSchema>;

// Settings schema
export const settingsSchema = z.object({
  id: z.number(),
  key: z.string(),
  value: z.string(),
  updated_at: z.coerce.date()
});

export type Settings = z.infer<typeof settingsSchema>;

// Input schemas for creating/updating records

// User input schemas
export const createUserInputSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(['admin', 'cashier'])
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'cashier']).optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const loginInputSchema = z.object({
  username: z.string(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Category input schemas
export const createCategoryInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Product input schemas
export const createProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  category_id: z.number().nullable(),
  image_url: z.string().nullable(),
  purchase_price: z.number().nonnegative(),
  selling_price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  low_stock_threshold: z.number().int().nonnegative(),
  is_active: z.boolean()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category_id: z.number().nullable().optional(),
  image_url: z.string().nullable().optional(),
  purchase_price: z.number().nonnegative().optional(),
  selling_price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  low_stock_threshold: z.number().int().nonnegative().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

// Transaction input schemas
export const createTransactionInputSchema = z.object({
  user_id: z.number(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive(),
    discount_amount: z.number().nonnegative()
  })),
  transaction_discount: z.number().nonnegative(),
  payment_method: z.enum(['cash', 'card', 'mobile'])
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Settings input schemas
export const updateSettingsInputSchema = z.object({
  key: z.string(),
  value: z.string()
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;

// Query schemas
export const getTransactionsQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_id: z.number().optional(),
  status: z.enum(['completed', 'cancelled', 'refunded']).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional()
});

export type GetTransactionsQuery = z.infer<typeof getTransactionsQuerySchema>;

export const getSalesReportQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  group_by: z.enum(['day', 'week', 'month']).optional()
});

export type GetSalesReportQuery = z.infer<typeof getSalesReportQuerySchema>;

// Response schemas
export const loginResponseSchema = z.object({
  user: userSchema.omit({ password_hash: true }),
  token: z.string()
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const salesReportSchema = z.object({
  total_revenue: z.number(),
  total_profit: z.number(),
  total_transactions: z.number(),
  period_data: z.array(z.object({
    period: z.string(),
    revenue: z.number(),
    profit: z.number(),
    transactions: z.number()
  })),
  top_products: z.array(z.object({
    product_id: z.number(),
    product_name: z.string(),
    quantity_sold: z.number(),
    revenue: z.number()
  })),
  top_categories: z.array(z.object({
    category_id: z.number(),
    category_name: z.string(),
    quantity_sold: z.number(),
    revenue: z.number()
  }))
});

export type SalesReport = z.infer<typeof salesReportSchema>;
