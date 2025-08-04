
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateTransactionInput, type GetTransactionsQuery } from '../schema';
import { 
  createTransaction, 
  getTransactions, 
  getTransactionById, 
  getTransactionItems,
  cancelTransaction,
  refundTransaction
} from '../handlers/transactions';
import { eq } from 'drizzle-orm';

// Test data setup
const createTestUser = async () => {
  const result = await db.insert(usersTable)
    .values({
      username: 'testuser',
      password_hash: 'hashedpassword',
      role: 'cashier'
    })
    .returning()
    .execute();
  return result[0];
};

const createTestCategory = async () => {
  const result = await db.insert(categoriesTable)
    .values({
      name: 'Test Category',
      description: 'Test category description'
    })
    .returning()
    .execute();
  return result[0];
};

const createTestProduct = async (categoryId: number, stock = 100, price = 10.99) => {
  const result = await db.insert(productsTable)
    .values({
      name: 'Test Product',
      description: 'Test product description',
      category_id: categoryId,
      purchase_price: (price * 0.7).toString(),
      selling_price: price.toString(),
      stock_quantity: stock,
      low_stock_threshold: 10,
      is_active: true
    })
    .returning()
    .execute();
  return result[0];
};

describe('Transaction Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createTransaction', () => {
    it('should create a transaction with items', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 50, 19.99);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [
          {
            product_id: product.id,
            quantity: 2,
            discount_amount: 1.00
          }
        ],
        transaction_discount: 2.00,
        payment_method: 'cash'
      };

      const result = await createTransaction(input);

      expect(result.id).toBeDefined();
      expect(result.transaction_code).toMatch(/^TRX-\d{8}-\d{3}$/);
      expect(result.user_id).toEqual(user.id);
      expect(result.payment_method).toEqual('cash');
      expect(result.status).toEqual('completed');
      expect(typeof result.subtotal).toBe('number');
      expect(typeof result.total_amount).toBe('number');
      expect(result.subtotal).toEqual(38.98); // (19.99 * 2) - 1.00
      expect(result.discount_amount).toEqual(3.00); // 1.00 + 2.00
      expect(result.total_amount).toEqual(36.98); // 38.98 - 2.00
    });

    it('should update product stock quantities', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 50, 15.00);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [
          {
            product_id: product.id,
            quantity: 5,
            discount_amount: 0
          }
        ],
        transaction_discount: 0,
        payment_method: 'card'
      };

      await createTransaction(input);

      const updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .limit(1)
        .execute();

      expect(updatedProduct[0].stock_quantity).toEqual(45); // 50 - 5
    });

    it('should create transaction items', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 30, 25.50);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [
          {
            product_id: product.id,
            quantity: 3,
            discount_amount: 2.50
          }
        ],
        transaction_discount: 0,
        payment_method: 'mobile'
      };

      const transaction = await createTransaction(input);

      const items = await db.select()
        .from(transactionItemsTable)
        .where(eq(transactionItemsTable.transaction_id, transaction.id))
        .execute();

      expect(items).toHaveLength(1);
      expect(items[0].product_id).toEqual(product.id);
      expect(items[0].quantity).toEqual(3);
      expect(parseFloat(items[0].unit_price)).toEqual(25.50);
      expect(parseFloat(items[0].discount_amount)).toEqual(2.50);
      expect(parseFloat(items[0].total_price)).toEqual(74.00); // (25.50 * 3) - 2.50
    });

    it('should throw error for insufficient stock', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 5, 10.00);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [
          {
            product_id: product.id,
            quantity: 10, // More than available stock
            discount_amount: 0
          }
        ],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      await expect(createTransaction(input)).rejects.toThrow(/insufficient stock/i);
    });

    it('should throw error for non-existent product', async () => {
      const user = await createTestUser();

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [
          {
            product_id: 999, // Non-existent product
            quantity: 1,
            discount_amount: 0
          }
        ],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      await expect(createTransaction(input)).rejects.toThrow(/product.*not found/i);
    });
  });

  describe('getTransactions', () => {
    it('should return all transactions when no query provided', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      // Create a test transaction
      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };
      await createTransaction(input);

      const results = await getTransactions();

      expect(results).toHaveLength(1);
      expect(results[0].user_id).toEqual(user.id);
      expect(typeof results[0].total_amount).toBe('number');
    });

    it('should filter by user_id', async () => {
      const user1 = await createTestUser();
      const user2 = await db.insert(usersTable)
        .values({
          username: 'testuser2',
          password_hash: 'hashedpassword',
          role: 'admin'
        })
        .returning()
        .execute();

      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      // Create transactions for both users
      const input1: CreateTransactionInput = {
        user_id: user1.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };
      const input2: CreateTransactionInput = {
        user_id: user2[0].id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'card'
      };

      await createTransaction(input1);
      await createTransaction(input2);

      const query: GetTransactionsQuery = { user_id: user1.id };
      const results = await getTransactions(query);

      expect(results).toHaveLength(1);
      expect(results[0].user_id).toEqual(user1.id);
    });

    it('should filter by status', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      const transaction = await createTransaction(input);
      await cancelTransaction(transaction.id);

      const query: GetTransactionsQuery = { status: 'cancelled' };
      const results = await getTransactions(query);

      expect(results).toHaveLength(1);
      expect(results[0].status).toEqual('cancelled');
    });

    it('should apply pagination', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 100);

      // Create multiple transactions
      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      await createTransaction(input);
      await createTransaction(input);
      await createTransaction(input);

      const query: GetTransactionsQuery = { limit: 2, offset: 1 };
      const results = await getTransactions(query);

      expect(results).toHaveLength(2);
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction by id', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      const transaction = await createTransaction(input);
      const result = await getTransactionById(transaction.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(transaction.id);
      expect(result!.user_id).toEqual(user.id);
      expect(typeof result!.total_amount).toBe('number');
    });

    it('should return null for non-existent transaction', async () => {
      const result = await getTransactionById(999);
      expect(result).toBeNull();
    });
  });

  describe('getTransactionItems', () => {
    it('should return transaction items', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 100, 15.75);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [
          {
            product_id: product.id,
            quantity: 2,
            discount_amount: 1.50
          }
        ],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      const transaction = await createTransaction(input);
      const items = await getTransactionItems(transaction.id);

      expect(items).toHaveLength(1);
      expect(items[0].transaction_id).toEqual(transaction.id);
      expect(items[0].product_id).toEqual(product.id);
      expect(items[0].quantity).toEqual(2);
      expect(typeof items[0].unit_price).toBe('number');
      expect(items[0].unit_price).toEqual(15.75);
      expect(items[0].discount_amount).toEqual(1.50);
    });

    it('should return empty array for transaction with no items', async () => {
      const items = await getTransactionItems(999);
      expect(items).toHaveLength(0);
    });
  });

  describe('cancelTransaction', () => {
    it('should cancel transaction and restore stock', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 50);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 10, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      const transaction = await createTransaction(input);

      // Verify stock was reduced
      let updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .limit(1)
        .execute();
      expect(updatedProduct[0].stock_quantity).toEqual(40);

      const cancelledTransaction = await cancelTransaction(transaction.id);

      expect(cancelledTransaction.status).toEqual('cancelled');

      // Verify stock was restored
      updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .limit(1)
        .execute();
      expect(updatedProduct[0].stock_quantity).toEqual(50);
    });

    it('should throw error when cancelling non-existent transaction', async () => {
      await expect(cancelTransaction(999)).rejects.toThrow(/not found/i);
    });

    it('should throw error when cancelling already cancelled transaction', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      const transaction = await createTransaction(input);
      await cancelTransaction(transaction.id);

      await expect(cancelTransaction(transaction.id)).rejects.toThrow(/cannot cancel/i);
    });
  });

  describe('refundTransaction', () => {
    it('should refund transaction and restore stock', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id, 30);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 5, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'card'
      };

      const transaction = await createTransaction(input);

      // Verify stock was reduced
      let updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .limit(1)
        .execute();
      expect(updatedProduct[0].stock_quantity).toEqual(25);

      const refundedTransaction = await refundTransaction(transaction.id);

      expect(refundedTransaction.status).toEqual('refunded');

      // Verify stock was restored
      updatedProduct = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, product.id))
        .limit(1)
        .execute();
      expect(updatedProduct[0].stock_quantity).toEqual(30);
    });

    it('should throw error when refunding non-existent transaction', async () => {
      await expect(refundTransaction(999)).rejects.toThrow(/not found/i);
    });

    it('should throw error when refunding non-completed transaction', async () => {
      const user = await createTestUser();
      const category = await createTestCategory();
      const product = await createTestProduct(category.id);

      const input: CreateTransactionInput = {
        user_id: user.id,
        items: [{ product_id: product.id, quantity: 1, discount_amount: 0 }],
        transaction_discount: 0,
        payment_method: 'cash'
      };

      const transaction = await createTransaction(input);
      await cancelTransaction(transaction.id);

      await expect(refundTransaction(transaction.id)).rejects.toThrow(/cannot refund/i);
    });
  });
});
