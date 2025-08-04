
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  updateUserInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  createTransactionInputSchema,
  getTransactionsQuerySchema,
  getSalesReportQuerySchema,
  updateSettingsInputSchema
} from './schema';

// Import handlers
import { login, verifyToken } from './handlers/auth';
import { createUser, getUsers, getUserById, updateUser, deleteUser } from './handlers/users';
import { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory } from './handlers/categories';
import { 
  createProduct, 
  getProducts, 
  getActiveProducts, 
  getProductById, 
  getProductsByCategory, 
  getLowStockProducts, 
  updateProduct, 
  updateProductStock, 
  deleteProduct 
} from './handlers/products';
import { 
  createTransaction, 
  getTransactions, 
  getTransactionById, 
  getTransactionItems, 
  cancelTransaction, 
  refundTransaction 
} from './handlers/transactions';
import { 
  getSalesReport, 
  getDailySales, 
  getMonthlySales, 
  getTopSellingProducts, 
  getCategorySales, 
  getHourlySales 
} from './handlers/reports';
import { 
  getSettings, 
  getSettingByKey, 
  updateSetting, 
  initializeDefaultSettings, 
  resetAllData, 
  exportData, 
  importData 
} from './handlers/settings';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => login(input)),

  verifyToken: publicProcedure
    .input(z.string())
    .query(({ input }) => verifyToken(input)),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  getUserById: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserById(input)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  deleteUser: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteUser(input)),

  // Category management routes
  createCategory: publicProcedure
    .input(createCategoryInputSchema)
    .mutation(({ input }) => createCategory(input)),

  getCategories: publicProcedure
    .query(() => getCategories()),

  getCategoryById: publicProcedure
    .input(z.number())
    .query(({ input }) => getCategoryById(input)),

  updateCategory: publicProcedure
    .input(updateCategoryInputSchema)
    .mutation(({ input }) => updateCategory(input)),

  deleteCategory: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteCategory(input)),

  // Product management routes
  createProduct: publicProcedure
    .input(createProductInputSchema)
    .mutation(({ input }) => createProduct(input)),

  getProducts: publicProcedure
    .query(() => getProducts()),

  getActiveProducts: publicProcedure
    .query(() => getActiveProducts()),

  getProductById: publicProcedure
    .input(z.number())
    .query(({ input }) => getProductById(input)),

  getProductsByCategory: publicProcedure
    .input(z.number())
    .query(({ input }) => getProductsByCategory(input)),

  getLowStockProducts: publicProcedure
    .query(() => getLowStockProducts()),

  updateProduct: publicProcedure
    .input(updateProductInputSchema)
    .mutation(({ input }) => updateProduct(input)),

  updateProductStock: publicProcedure
    .input(z.object({ productId: z.number(), quantityChange: z.number() }))
    .mutation(({ input }) => updateProductStock(input.productId, input.quantityChange)),

  deleteProduct: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteProduct(input)),

  // Transaction routes
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  getTransactions: publicProcedure
    .input(getTransactionsQuerySchema.optional())
    .query(({ input }) => getTransactions(input)),

  getTransactionById: publicProcedure
    .input(z.number())
    .query(({ input }) => getTransactionById(input)),

  getTransactionItems: publicProcedure
    .input(z.number())
    .query(({ input }) => getTransactionItems(input)),

  cancelTransaction: publicProcedure
    .input(z.number())
    .mutation(({ input }) => cancelTransaction(input)),

  refundTransaction: publicProcedure
    .input(z.number())
    .mutation(({ input }) => refundTransaction(input)),

  // Reports routes
  getSalesReport: publicProcedure
    .input(getSalesReportQuerySchema)
    .query(({ input }) => getSalesReport(input)),

  getDailySales: publicProcedure
    .input(z.string())
    .query(({ input }) => getDailySales(input)),

  getMonthlySales: publicProcedure
    .input(z.object({ year: z.number(), month: z.number() }))
    .query(({ input }) => getMonthlySales(input.year, input.month)),

  getTopSellingProducts: publicProcedure
    .input(z.number().optional())
    .query(({ input }) => getTopSellingProducts(input)),

  getCategorySales: publicProcedure
    .query(() => getCategorySales()),

  getHourlySales: publicProcedure
    .input(z.string())
    .query(({ input }) => getHourlySales(input)),

  // Settings routes
  getSettings: publicProcedure
    .query(() => getSettings()),

  getSettingByKey: publicProcedure
    .input(z.string())
    .query(({ input }) => getSettingByKey(input)),

  updateSetting: publicProcedure
    .input(updateSettingsInputSchema)
    .mutation(({ input }) => updateSetting(input)),

  initializeDefaultSettings: publicProcedure
    .mutation(() => initializeDefaultSettings()),

  resetAllData: publicProcedure
    .mutation(() => resetAllData()),

  exportData: publicProcedure
    .query(() => exportData()),

  importData: publicProcedure
    .input(z.any())
    .mutation(({ input }) => importData(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
