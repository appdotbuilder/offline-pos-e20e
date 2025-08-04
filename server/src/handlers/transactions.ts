
import { db } from '../db';
import { transactionsTable, transactionItemsTable, productsTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction, type TransactionItem, type GetTransactionsQuery } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  try {
    // Generate unique transaction code
    const transactionCode = await generateTransactionCode();
    
    // Calculate totals from items
    let subtotal = 0;
    let totalDiscountAmount = input.transaction_discount;
    
    // Validate products exist and calculate subtotal
    for (const item of input.items) {
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .limit(1)
        .execute();
      
      if (product.length === 0) {
        throw new Error(`Product with ID ${item.product_id} not found`);
      }
      
      if (product[0].stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${product[0].name}`);
      }
      
      const unitPrice = parseFloat(product[0].selling_price);
      const itemTotal = (unitPrice * item.quantity) - item.discount_amount;
      subtotal += itemTotal;
      totalDiscountAmount += item.discount_amount;
    }
    
    // Calculate tax (assuming 0% for now, can be configurable)
    const taxAmount = 0;
    const totalAmount = subtotal - input.transaction_discount + taxAmount;
    
    // Create transaction
    const transactionResult = await db.insert(transactionsTable)
      .values({
        transaction_code: transactionCode,
        user_id: input.user_id,
        subtotal: subtotal.toString(),
        discount_amount: totalDiscountAmount.toString(),
        tax_amount: taxAmount.toString(),
        total_amount: totalAmount.toString(),
        payment_method: input.payment_method,
        status: 'completed'
      })
      .returning()
      .execute();
    
    const transaction = transactionResult[0];
    
    // Create transaction items and update stock
    for (const item of input.items) {
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .limit(1)
        .execute();
      
      const unitPrice = parseFloat(product[0].selling_price);
      const totalPrice = (unitPrice * item.quantity) - item.discount_amount;
      
      // Insert transaction item
      await db.insert(transactionItemsTable)
        .values({
          transaction_id: transaction.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice.toString(),
          discount_amount: item.discount_amount.toString(),
          total_price: totalPrice.toString()
        })
        .execute();
      
      // Update product stock
      await db.update(productsTable)
        .set({
          stock_quantity: product[0].stock_quantity - item.quantity,
          updated_at: new Date()
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();
    }
    
    // Return transaction with converted numeric fields
    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      tax_amount: parseFloat(transaction.tax_amount),
      total_amount: parseFloat(transaction.total_amount)
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
}

export async function getTransactions(query?: GetTransactionsQuery): Promise<Transaction[]> {
  try {
    let results;
    
    // Build conditions array
    const conditions: SQL<unknown>[] = [];
    
    if (query?.start_date) {
      conditions.push(gte(transactionsTable.created_at, new Date(query.start_date)));
    }
    
    if (query?.end_date) {
      conditions.push(lte(transactionsTable.created_at, new Date(query.end_date)));
    }
    
    if (query?.user_id) {
      conditions.push(eq(transactionsTable.user_id, query.user_id));
    }
    
    if (query?.status) {
      conditions.push(eq(transactionsTable.status, query.status));
    }
    
    // Execute appropriate query based on conditions and pagination
    if (conditions.length === 0) {
      // No filters
      if (query?.limit && query?.offset) {
        results = await db.select()
          .from(transactionsTable)
          .orderBy(desc(transactionsTable.created_at))
          .limit(query.limit)
          .offset(query.offset)
          .execute();
      } else if (query?.limit) {
        results = await db.select()
          .from(transactionsTable)
          .orderBy(desc(transactionsTable.created_at))
          .limit(query.limit)
          .execute();
      } else if (query?.offset) {
        results = await db.select()
          .from(transactionsTable)
          .orderBy(desc(transactionsTable.created_at))
          .offset(query.offset)
          .execute();
      } else {
        results = await db.select()
          .from(transactionsTable)
          .orderBy(desc(transactionsTable.created_at))
          .execute();
      }
    } else {
      // With filters
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      
      if (query?.limit && query?.offset) {
        results = await db.select()
          .from(transactionsTable)
          .where(whereCondition)
          .orderBy(desc(transactionsTable.created_at))
          .limit(query.limit)
          .offset(query.offset)
          .execute();
      } else if (query?.limit) {
        results = await db.select()
          .from(transactionsTable)
          .where(whereCondition)
          .orderBy(desc(transactionsTable.created_at))
          .limit(query.limit)
          .execute();
      } else if (query?.offset) {
        results = await db.select()
          .from(transactionsTable)
          .where(whereCondition)
          .orderBy(desc(transactionsTable.created_at))
          .offset(query.offset)
          .execute();
      } else {
        results = await db.select()
          .from(transactionsTable)
          .where(whereCondition)
          .orderBy(desc(transactionsTable.created_at))
          .execute();
      }
    }
    
    // Convert numeric fields
    return results.map(transaction => ({
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      tax_amount: parseFloat(transaction.tax_amount),
      total_amount: parseFloat(transaction.total_amount)
    }));
  } catch (error) {
    console.error('Get transactions failed:', error);
    throw error;
  }
}

export async function getTransactionById(id: number): Promise<Transaction | null> {
  try {
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1)
      .execute();
    
    if (results.length === 0) {
      return null;
    }
    
    const transaction = results[0];
    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      tax_amount: parseFloat(transaction.tax_amount),
      total_amount: parseFloat(transaction.total_amount)
    };
  } catch (error) {
    console.error('Get transaction by ID failed:', error);
    throw error;
  }
}

export async function getTransactionItems(transactionId: number): Promise<TransactionItem[]> {
  try {
    const results = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.transaction_id, transactionId))
      .execute();
    
    // Convert numeric fields
    return results.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      discount_amount: parseFloat(item.discount_amount),
      total_price: parseFloat(item.total_price)
    }));
  } catch (error) {
    console.error('Get transaction items failed:', error);
    throw error;
  }
}

export async function cancelTransaction(id: number): Promise<Transaction> {
  try {
    // Get transaction to verify it exists and is not already cancelled/refunded
    const existingTransaction = await getTransactionById(id);
    if (!existingTransaction) {
      throw new Error(`Transaction with ID ${id} not found`);
    }
    
    if (existingTransaction.status !== 'completed') {
      throw new Error(`Cannot cancel transaction with status: ${existingTransaction.status}`);
    }
    
    // Get transaction items to restore stock
    const items = await getTransactionItems(id);
    
    // Restore stock for each item
    for (const item of items) {
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .limit(1)
        .execute();
      
      if (product.length > 0) {
        await db.update(productsTable)
          .set({
            stock_quantity: product[0].stock_quantity + item.quantity,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
      }
    }
    
    // Update transaction status
    const results = await db.update(transactionsTable)
      .set({ status: 'cancelled' })
      .where(eq(transactionsTable.id, id))
      .returning()
      .execute();
    
    const transaction = results[0];
    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      tax_amount: parseFloat(transaction.tax_amount),
      total_amount: parseFloat(transaction.total_amount)
    };
  } catch (error) {
    console.error('Cancel transaction failed:', error);
    throw error;
  }
}

export async function refundTransaction(id: number): Promise<Transaction> {
  try {
    // Get transaction to verify it exists and is completed
    const existingTransaction = await getTransactionById(id);
    if (!existingTransaction) {
      throw new Error(`Transaction with ID ${id} not found`);
    }
    
    if (existingTransaction.status !== 'completed') {
      throw new Error(`Cannot refund transaction with status: ${existingTransaction.status}`);
    }
    
    // Get transaction items to restore stock
    const items = await getTransactionItems(id);
    
    // Restore stock for each item
    for (const item of items) {
      const product = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .limit(1)
        .execute();
      
      if (product.length > 0) {
        await db.update(productsTable)
          .set({
            stock_quantity: product[0].stock_quantity + item.quantity,
            updated_at: new Date()
          })
          .where(eq(productsTable.id, item.product_id))
          .execute();
      }
    }
    
    // Update transaction status
    const results = await db.update(transactionsTable)
      .set({ status: 'refunded' })
      .where(eq(transactionsTable.id, id))
      .returning()
      .execute();
    
    const transaction = results[0];
    return {
      ...transaction,
      subtotal: parseFloat(transaction.subtotal),
      discount_amount: parseFloat(transaction.discount_amount),
      tax_amount: parseFloat(transaction.tax_amount),
      total_amount: parseFloat(transaction.total_amount)
    };
  } catch (error) {
    console.error('Refund transaction failed:', error);
    throw error;
  }
}

async function generateTransactionCode(): Promise<string> {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of transactions today to generate sequence number
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    const todayTransactions = await db.select()
      .from(transactionsTable)
      .where(and(
        gte(transactionsTable.created_at, startOfDay),
        lte(transactionsTable.created_at, endOfDay)
      ))
      .execute();
    
    const sequence = (todayTransactions.length + 1).toString().padStart(3, '0');
    return `TRX-${dateStr}-${sequence}`;
  } catch (error) {
    console.error('Generate transaction code failed:', error);
    throw error;
  }
}
