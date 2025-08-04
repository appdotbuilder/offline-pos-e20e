
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { 
  getSalesReport, 
  getDailySales, 
  getMonthlySales, 
  getTopSellingProducts, 
  getCategorySales, 
  getHourlySales 
} from '../handlers/reports';
import type { GetSalesReportQuery } from '../schema';

describe('Reports Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getSalesReport', () => {
    it('should generate comprehensive sales report', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const category = await db.insert(categoriesTable).values({
        name: 'Test Category',
        description: 'Test description'
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Test Product',
        description: 'Test product',
        category_id: category[0].id,
        purchase_price: '10.00',
        selling_price: '20.00',
        stock_quantity: 100,
        low_stock_threshold: 10,
        is_active: true
      }).returning().execute();

      const testDate = new Date('2024-06-15T10:00:00Z');
      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'TXN001',
        user_id: user[0].id,
        subtotal: '40.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '40.00',
        payment_method: 'cash',
        status: 'completed',
        created_at: testDate
      }).returning().execute();

      await db.insert(transactionItemsTable).values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '20.00',
        discount_amount: '0.00',
        total_price: '40.00'
      }).execute();

      const query: GetSalesReportQuery = {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        group_by: 'day'
      };

      const report = await getSalesReport(query);

      expect(report.total_revenue).toEqual(40.00);
      expect(report.total_profit).toEqual(20.00); // (20 - 10) * 2
      expect(report.total_transactions).toEqual(1);
      expect(report.period_data).toHaveLength(1);
      expect(report.period_data[0].period).toEqual('2024-06-15');
      expect(report.top_products).toHaveLength(1);
      expect(report.top_products[0].product_name).toEqual('Test Product');
      expect(report.top_products[0].quantity_sold).toEqual(2);
      expect(report.top_categories).toHaveLength(1);
      expect(report.top_categories[0].category_name).toEqual('Test Category');
    });

    it('should handle empty date range', async () => {
      const query: GetSalesReportQuery = {
        start_date: '2025-01-01',
        end_date: '2025-01-31'
      };

      const report = await getSalesReport(query);

      expect(report.total_revenue).toEqual(0);
      expect(report.total_profit).toEqual(0);
      expect(report.total_transactions).toEqual(0);
      expect(report.period_data).toHaveLength(0);
      expect(report.top_products).toHaveLength(0);
      expect(report.top_categories).toHaveLength(0);
    });

    it('should group by week correctly', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Test Product',
        description: 'Test product',
        purchase_price: '10.00',
        selling_price: '20.00',
        stock_quantity: 100,
        low_stock_threshold: 10,
        is_active: true
      }).returning().execute();

      const testDate = new Date('2024-06-15T10:00:00Z');
      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'TXN001',
        user_id: user[0].id,
        subtotal: '20.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '20.00',
        payment_method: 'cash',
        status: 'completed',
        created_at: testDate
      }).returning().execute();

      await db.insert(transactionItemsTable).values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 1,
        unit_price: '20.00',
        discount_amount: '0.00',
        total_price: '20.00'
      }).execute();

      const query: GetSalesReportQuery = {
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        group_by: 'week'
      };

      const report = await getSalesReport(query);

      expect(report.period_data).toHaveLength(1);
      expect(report.period_data[0].period).toMatch(/^\d{4}-W\d{2}$/);
    });
  });

  describe('getDailySales', () => {
    it('should get daily sales data', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Daily Product',
        description: 'Test product',
        purchase_price: '5.00',
        selling_price: '15.00',
        stock_quantity: 50,
        low_stock_threshold: 5,
        is_active: true
      }).returning().execute();

      const today = new Date().toISOString().split('T')[0];
      const testDate = new Date(today + 'T10:00:00Z');
      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'DAILY001',
        user_id: user[0].id,
        subtotal: '30.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '30.00',
        payment_method: 'card',
        status: 'completed',
        created_at: testDate
      }).returning().execute();

      await db.insert(transactionItemsTable).values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '15.00',
        discount_amount: '0.00',
        total_price: '30.00'
      }).execute();

      const dailySales = await getDailySales(today);

      expect(dailySales.date).toEqual(today);
      expect(dailySales.revenue).toEqual(30.00);
      expect(dailySales.profit).toEqual(20.00); // (15 - 5) * 2
      expect(dailySales.transactions).toEqual(1);
      expect(dailySales.top_products).toHaveLength(1);
      expect(dailySales.top_products[0].product_name).toEqual('Daily Product');
    });

    it('should handle date with no sales', async () => {
      const dailySales = await getDailySales('2025-06-15');

      expect(dailySales.date).toEqual('2025-06-15');
      expect(dailySales.revenue).toEqual(0);
      expect(dailySales.profit).toEqual(0);
      expect(dailySales.transactions).toEqual(0);
      expect(dailySales.top_products).toHaveLength(0);
    });
  });

  describe('getMonthlySales', () => {
    it('should get monthly sales data', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Monthly Product',
        description: 'Test product',
        purchase_price: '8.00',
        selling_price: '18.00',
        stock_quantity: 75,
        low_stock_threshold: 8,
        is_active: true
      }).returning().execute();

      const currentDate = new Date();
      const testDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15, 10, 0, 0);
      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'MONTH001',
        user_id: user[0].id,
        subtotal: '54.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '54.00',
        payment_method: 'mobile',
        status: 'completed',
        created_at: testDate
      }).returning().execute();

      await db.insert(transactionItemsTable).values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 3,
        unit_price: '18.00',
        discount_amount: '0.00',
        total_price: '54.00'
      }).execute();

      const monthlySales = await getMonthlySales(currentDate.getFullYear(), currentDate.getMonth() + 1);

      expect(monthlySales.year).toEqual(currentDate.getFullYear());
      expect(monthlySales.month).toEqual(currentDate.getMonth() + 1);
      expect(monthlySales.revenue).toEqual(54.00);
      expect(monthlySales.profit).toEqual(30.00); // (18 - 8) * 3
      expect(monthlySales.transactions).toEqual(1);
      expect(monthlySales.daily_breakdown).toHaveLength(1);
    });

    it('should handle month with no sales', async () => {
      const monthlySales = await getMonthlySales(2025, 6);

      expect(monthlySales.year).toEqual(2025);
      expect(monthlySales.month).toEqual(6);
      expect(monthlySales.revenue).toEqual(0);
      expect(monthlySales.profit).toEqual(0);
      expect(monthlySales.transactions).toEqual(0);
      expect(monthlySales.daily_breakdown).toHaveLength(0);
    });
  });

  describe('getTopSellingProducts', () => {
    it('should return top selling products', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const products = await db.insert(productsTable).values([
        {
          name: 'Product A',
          description: 'Product A',
          purchase_price: '5.00',
          selling_price: '10.00',
          stock_quantity: 100,
          low_stock_threshold: 10,
          is_active: true
        },
        {
          name: 'Product B',
          description: 'Product B',
          purchase_price: '3.00',
          selling_price: '8.00',
          stock_quantity: 100,
          low_stock_threshold: 10,
          is_active: true
        }
      ]).returning().execute();

      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'TOP001',
        user_id: user[0].id,
        subtotal: '34.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '34.00',
        payment_method: 'cash',
        status: 'completed'
      }).returning().execute();

      await db.insert(transactionItemsTable).values([
        {
          transaction_id: transaction[0].id,
          product_id: products[0].id,
          quantity: 1,
          unit_price: '10.00',
          discount_amount: '0.00',
          total_price: '10.00'
        },
        {
          transaction_id: transaction[0].id,
          product_id: products[1].id,
          quantity: 3,
          unit_price: '8.00',
          discount_amount: '0.00',
          total_price: '24.00'
        }
      ]).execute();

      const topProducts = await getTopSellingProducts(5);

      expect(topProducts).toHaveLength(2);
      expect(topProducts[0].product_name).toEqual('Product B'); // Higher quantity
      expect(topProducts[0].quantity_sold).toEqual(3);
      expect(topProducts[0].revenue).toEqual(24.00);
      expect(topProducts[0].profit).toEqual(15.00); // (8 - 3) * 3
      expect(topProducts[1].product_name).toEqual('Product A');
      expect(topProducts[1].quantity_sold).toEqual(1);
    });

    it('should handle empty results', async () => {
      const topProducts = await getTopSellingProducts();

      expect(topProducts).toHaveLength(0);
    });
  });

  describe('getCategorySales', () => {
    it('should return category sales data', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const category = await db.insert(categoriesTable).values({
        name: 'Electronics',
        description: 'Electronic items'
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Laptop',
        description: 'Gaming laptop',
        category_id: category[0].id,
        purchase_price: '500.00',
        selling_price: '800.00',
        stock_quantity: 10,
        low_stock_threshold: 2,
        is_active: true
      }).returning().execute();

      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'CAT001',
        user_id: user[0].id,
        subtotal: '1600.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '1600.00',
        payment_method: 'card',
        status: 'completed'
      }).returning().execute();

      await db.insert(transactionItemsTable).values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '800.00',
        discount_amount: '0.00',
        total_price: '1600.00'
      }).execute();

      const categorySales = await getCategorySales();

      expect(categorySales).toHaveLength(1);
      expect(categorySales[0].category_name).toEqual('Electronics');
      expect(categorySales[0].quantity_sold).toEqual(2);
      expect(categorySales[0].revenue).toEqual(1600.00);
      expect(categorySales[0].profit).toEqual(600.00); // (800 - 500) * 2
      expect(categorySales[0].product_count).toEqual(1);
    });

    it('should handle no categories', async () => {
      const categorySales = await getCategorySales();

      expect(categorySales).toHaveLength(0);
    });
  });

  describe('getHourlySales', () => {
    it('should return hourly sales breakdown', async () => {
      // Create test data
      const user = await db.insert(usersTable).values({
        username: 'testuser',
        password_hash: 'hash123',
        role: 'cashier'
      }).returning().execute();

      const product = await db.insert(productsTable).values({
        name: 'Hourly Product',
        description: 'Test product',
        purchase_price: '4.00',
        selling_price: '12.00',
        stock_quantity: 25,
        low_stock_threshold: 5,
        is_active: true
      }).returning().execute();

      const today = new Date().toISOString().split('T')[0];
      const testDate = new Date(today + 'T14:30:00Z');
      const transaction = await db.insert(transactionsTable).values({
        transaction_code: 'HOUR001',
        user_id: user[0].id,
        subtotal: '24.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '24.00',
        payment_method: 'cash',
        status: 'completed',
        created_at: testDate
      }).returning().execute();

      await db.insert(transactionItemsTable).values({
        transaction_id: transaction[0].id,
        product_id: product[0].id,
        quantity: 2,
        unit_price: '12.00',
        discount_amount: '0.00',
        total_price: '24.00'
      }).execute();

      const hourlySales = await getHourlySales(today);

      expect(hourlySales).toHaveLength(1);
      expect(hourlySales[0].hour).toBeTypeOf('number');
      expect(hourlySales[0].hour).toBeGreaterThanOrEqual(0);
      expect(hourlySales[0].hour).toBeLessThan(24);
      expect(hourlySales[0].revenue).toEqual(24.00);
      expect(hourlySales[0].transactions).toEqual(1);
    });

    it('should handle date with no sales', async () => {
      const hourlySales = await getHourlySales('2025-06-15');

      expect(hourlySales).toHaveLength(0);
    });
  });
});
