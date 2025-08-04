
import { db } from '../db';
import { transactionsTable, transactionItemsTable, productsTable, categoriesTable } from '../db/schema';
import { type GetSalesReportQuery, type SalesReport } from '../schema';
import { eq, and, gte, lte, desc, sum, count, sql } from 'drizzle-orm';

export async function getSalesReport(query: GetSalesReportQuery): Promise<SalesReport> {
  try {
    const startDate = new Date(query.start_date);
    const endDate = new Date(query.end_date);
    
    // Get completed transactions within date range
    const baseConditions = [
      eq(transactionsTable.status, 'completed'),
      gte(transactionsTable.created_at, startDate),
      lte(transactionsTable.created_at, endDate)
    ];

    // Calculate totals
    const totalsResult = await db
      .select({
        total_revenue: sum(transactionsTable.total_amount),
        total_transactions: count(transactionsTable.id)
      })
      .from(transactionsTable)
      .where(and(...baseConditions))
      .execute();

    const totalRevenue = parseFloat(totalsResult[0]?.total_revenue || '0');
    const totalTransactions = Number(totalsResult[0]?.total_transactions || 0);

    // Calculate total profit (revenue - cost)
    const profitResult = await db
      .select({
        total_profit: sql<string>`SUM((${transactionItemsTable.unit_price} - ${productsTable.purchase_price}) * ${transactionItemsTable.quantity})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .where(and(...baseConditions))
      .execute();

    const totalProfit = parseFloat(profitResult[0]?.total_profit || '0');

    // Get period data based on group_by parameter
    const periodData = await getPeriodData(startDate, endDate, query.group_by || 'day');

    // Get top products
    const topProducts = await db
      .select({
        product_id: productsTable.id,
        product_name: productsTable.name,
        quantity_sold: sql<string>`SUM(${transactionItemsTable.quantity})`,
        revenue: sql<string>`SUM(${transactionItemsTable.total_price})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .where(and(...baseConditions))
      .groupBy(productsTable.id, productsTable.name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(10)
      .execute();

    // Get top categories
    const topCategories = await db
      .select({
        category_id: categoriesTable.id,
        category_name: categoriesTable.name,
        quantity_sold: sql<string>`SUM(${transactionItemsTable.quantity})`,
        revenue: sql<string>`SUM(${transactionItemsTable.total_price})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .innerJoin(categoriesTable, eq(productsTable.category_id, categoriesTable.id))
      .where(and(...baseConditions))
      .groupBy(categoriesTable.id, categoriesTable.name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(10)
      .execute();

    return {
      total_revenue: totalRevenue,
      total_profit: totalProfit,
      total_transactions: totalTransactions,
      period_data: periodData,
      top_products: topProducts.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity_sold: Number(p.quantity_sold),
        revenue: parseFloat(p.revenue)
      })),
      top_categories: topCategories.map(c => ({
        category_id: c.category_id,
        category_name: c.category_name,
        quantity_sold: Number(c.quantity_sold),
        revenue: parseFloat(c.revenue)
      }))
    };
  } catch (error) {
    console.error('Sales report generation failed:', error);
    throw error;
  }
}

async function getPeriodData(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month') {
  const baseConditions = [
    eq(transactionsTable.status, 'completed'),
    gte(transactionsTable.created_at, startDate),
    lte(transactionsTable.created_at, endDate)
  ];

  let dateFormatSql: any;
  switch (groupBy) {
    case 'week':
      dateFormatSql = sql`TO_CHAR(${transactionsTable.created_at}, 'YYYY-"W"WW')`;
      break;
    case 'month':
      dateFormatSql = sql`TO_CHAR(${transactionsTable.created_at}, 'YYYY-MM')`;
      break;
    default:
      dateFormatSql = sql`TO_CHAR(${transactionsTable.created_at}, 'YYYY-MM-DD')`;
  }

  const periodResults = await db
    .select({
      period: dateFormatSql,
      revenue: sum(transactionsTable.total_amount),
      transactions: count(transactionsTable.id)
    })
    .from(transactionsTable)
    .where(and(...baseConditions))
    .groupBy(dateFormatSql)
    .orderBy(dateFormatSql)
    .execute();

  // Calculate profit for each period - need to join with transaction items and products
  const profitResults = await db
    .select({
      period: dateFormatSql,
      profit: sql<string>`SUM((${transactionItemsTable.unit_price} - ${productsTable.purchase_price}) * ${transactionItemsTable.quantity})`
    })
    .from(transactionItemsTable)
    .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
    .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
    .where(and(...baseConditions))
    .groupBy(dateFormatSql)
    .execute();

  // Merge revenue and profit data
  const profitMap = new Map(profitResults.map(p => [p.period, parseFloat(p.profit || '0')]));

  return periodResults.map(p => ({
    period: p.period,
    revenue: parseFloat(p.revenue || '0'),
    profit: profitMap.get(p.period) || 0,
    transactions: Number(p.transactions)
  }));
}

export async function getDailySales(date: string): Promise<any> {
  try {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const conditions = [
      eq(transactionsTable.status, 'completed'),
      gte(transactionsTable.created_at, targetDate),
      lte(transactionsTable.created_at, nextDay)
    ];

    const dailyResult = await db
      .select({
        revenue: sum(transactionsTable.total_amount),
        transactions: count(transactionsTable.id)
      })
      .from(transactionsTable)
      .where(and(...conditions))
      .execute();

    const profitResult = await db
      .select({
        profit: sql<string>`SUM((${transactionItemsTable.unit_price} - ${productsTable.purchase_price}) * ${transactionItemsTable.quantity})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .where(and(...conditions))
      .execute();

    const topProducts = await db
      .select({
        product_id: productsTable.id,
        product_name: productsTable.name,
        quantity_sold: sql<string>`SUM(${transactionItemsTable.quantity})`,
        revenue: sql<string>`SUM(${transactionItemsTable.total_price})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .where(and(...conditions))
      .groupBy(productsTable.id, productsTable.name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(5)
      .execute();

    return {
      date: date,
      revenue: parseFloat(dailyResult[0]?.revenue || '0'),
      profit: parseFloat(profitResult[0]?.profit || '0'),
      transactions: Number(dailyResult[0]?.transactions || 0),
      top_products: topProducts.map(p => ({
        product_id: p.product_id,
        product_name: p.product_name,
        quantity_sold: Number(p.quantity_sold),
        revenue: parseFloat(p.revenue)
      }))
    };
  } catch (error) {
    console.error('Daily sales report failed:', error);
    throw error;
  }
}

export async function getMonthlySales(year: number, month: number): Promise<any> {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const conditions = [
      eq(transactionsTable.status, 'completed'),
      gte(transactionsTable.created_at, startDate),
      lte(transactionsTable.created_at, endDate)
    ];

    const monthlyResult = await db
      .select({
        revenue: sum(transactionsTable.total_amount),
        transactions: count(transactionsTable.id)
      })
      .from(transactionsTable)
      .where(and(...conditions))
      .execute();

    const profitResult = await db
      .select({
        profit: sql<string>`SUM((${transactionItemsTable.unit_price} - ${productsTable.purchase_price}) * ${transactionItemsTable.quantity})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .where(and(...conditions))
      .execute();

    const dayExtract = sql`EXTRACT(DAY FROM ${transactionsTable.created_at})`;
    const dailyBreakdown = await db
      .select({
        day: dayExtract,
        revenue: sum(transactionsTable.total_amount),
        transactions: count(transactionsTable.id)
      })
      .from(transactionsTable)
      .where(and(...conditions))
      .groupBy(dayExtract)
      .orderBy(dayExtract)
      .execute();

    return {
      year: year,
      month: month,
      revenue: parseFloat(monthlyResult[0]?.revenue || '0'),
      profit: parseFloat(profitResult[0]?.profit || '0'),
      transactions: Number(monthlyResult[0]?.transactions || 0),
      daily_breakdown: dailyBreakdown.map(d => ({
        day: Number(d.day),
        revenue: parseFloat(d.revenue || '0'),
        transactions: Number(d.transactions)
      }))
    };
  } catch (error) {
    console.error('Monthly sales report failed:', error);
    throw error;
  }
}

export async function getTopSellingProducts(limit: number = 10): Promise<any[]> {
  try {
    const topProducts = await db
      .select({
        product_id: productsTable.id,
        product_name: productsTable.name,
        quantity_sold: sql<string>`SUM(${transactionItemsTable.quantity})`,
        revenue: sql<string>`SUM(${transactionItemsTable.total_price})`,
        profit: sql<string>`SUM((${transactionItemsTable.unit_price} - ${productsTable.purchase_price}) * ${transactionItemsTable.quantity})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .where(eq(transactionsTable.status, 'completed'))
      .groupBy(productsTable.id, productsTable.name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.quantity})`))
      .limit(limit)
      .execute();

    return topProducts.map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      quantity_sold: Number(p.quantity_sold),
      revenue: parseFloat(p.revenue),
      profit: parseFloat(p.profit)
    }));
  } catch (error) {
    console.error('Top selling products query failed:', error);
    throw error;
  }
}

export async function getCategorySales(): Promise<any[]> {
  try {
    const categorySales = await db
      .select({
        category_id: categoriesTable.id,
        category_name: categoriesTable.name,
        quantity_sold: sql<string>`SUM(${transactionItemsTable.quantity})`,
        revenue: sql<string>`SUM(${transactionItemsTable.total_price})`,
        profit: sql<string>`SUM((${transactionItemsTable.unit_price} - ${productsTable.purchase_price}) * ${transactionItemsTable.quantity})`,
        product_count: sql<string>`COUNT(DISTINCT ${productsTable.id})`
      })
      .from(transactionItemsTable)
      .innerJoin(transactionsTable, eq(transactionItemsTable.transaction_id, transactionsTable.id))
      .innerJoin(productsTable, eq(transactionItemsTable.product_id, productsTable.id))
      .innerJoin(categoriesTable, eq(productsTable.category_id, categoriesTable.id))
      .where(eq(transactionsTable.status, 'completed'))
      .groupBy(categoriesTable.id, categoriesTable.name)
      .orderBy(desc(sql`SUM(${transactionItemsTable.total_price})`))
      .execute();

    return categorySales.map(c => ({
      category_id: c.category_id,
      category_name: c.category_name,
      quantity_sold: Number(c.quantity_sold),
      revenue: parseFloat(c.revenue),
      profit: parseFloat(c.profit),
      product_count: Number(c.product_count)
    }));
  } catch (error) {
    console.error('Category sales query failed:', error);
    throw error;
  }
}

export async function getHourlySales(date: string): Promise<any[]> {
  try {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const conditions = [
      eq(transactionsTable.status, 'completed'),
      gte(transactionsTable.created_at, targetDate),
      lte(transactionsTable.created_at, nextDay)
    ];

    const hourExtract = sql`EXTRACT(HOUR FROM ${transactionsTable.created_at})`;
    const hourlySales = await db
      .select({
        hour: hourExtract,
        revenue: sum(transactionsTable.total_amount),
        transactions: count(transactionsTable.id)
      })
      .from(transactionsTable)
      .where(and(...conditions))
      .groupBy(hourExtract)
      .orderBy(hourExtract)
      .execute();

    return hourlySales.map(h => ({
      hour: Number(h.hour),
      revenue: parseFloat(h.revenue || '0'),
      transactions: Number(h.transactions)
    }));
  } catch (error) {
    console.error('Hourly sales query failed:', error);
    throw error;
  }
}
