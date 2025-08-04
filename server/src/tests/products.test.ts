
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { productsTable, categoriesTable, usersTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput } from '../schema';
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
} from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test data
const testProductInput: CreateProductInput = {
  name: 'Test Product',
  description: 'A product for testing',
  category_id: null,
  image_url: null,
  purchase_price: 10.50,
  selling_price: 19.99,
  stock_quantity: 100,
  low_stock_threshold: 5,
  is_active: true
};

describe('Products Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const result = await createProduct(testProductInput);

      expect(result.name).toEqual('Test Product');
      expect(result.description).toEqual('A product for testing');
      expect(result.category_id).toBeNull();
      expect(result.image_url).toBeNull();
      expect(result.purchase_price).toEqual(10.50);
      expect(result.selling_price).toEqual(19.99);
      expect(result.stock_quantity).toEqual(100);
      expect(result.low_stock_threshold).toEqual(5);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create product with category reference', async () => {
      // Create category first
      const categoryResult = await db.insert(categoriesTable)
        .values({ name: 'Electronics', description: 'Electronic items' })
        .returning()
        .execute();

      const categoryId = categoryResult[0].id;

      const productWithCategory: CreateProductInput = {
        ...testProductInput,
        category_id: categoryId
      };

      const result = await createProduct(productWithCategory);
      expect(result.category_id).toEqual(categoryId);
    });

    it('should save product to database', async () => {
      const result = await createProduct(testProductInput);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Test Product');
      expect(parseFloat(products[0].purchase_price)).toEqual(10.50);
      expect(parseFloat(products[0].selling_price)).toEqual(19.99);
    });
  });

  describe('getProducts', () => {
    it('should return empty array when no products exist', async () => {
      const result = await getProducts();
      expect(result).toEqual([]);
    });

    it('should return all products', async () => {
      await createProduct(testProductInput);
      await createProduct({ ...testProductInput, name: 'Second Product' });

      const result = await getProducts();
      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Test Product');
      expect(result[1].name).toEqual('Second Product');
    });

    it('should convert numeric fields correctly', async () => {
      await createProduct(testProductInput);

      const result = await getProducts();
      expect(typeof result[0].purchase_price).toBe('number');
      expect(typeof result[0].selling_price).toBe('number');
      expect(result[0].purchase_price).toEqual(10.50);
      expect(result[0].selling_price).toEqual(19.99);
    });
  });

  describe('getActiveProducts', () => {
    it('should return only active products', async () => {
      await createProduct(testProductInput);
      await createProduct({ ...testProductInput, name: 'Inactive Product', is_active: false });

      const result = await getActiveProducts();
      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Test Product');
      expect(result[0].is_active).toBe(true);
    });
  });

  describe('getProductById', () => {
    it('should return product by ID', async () => {
      const created = await createProduct(testProductInput);

      const result = await getProductById(created.id);
      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Product');
    });

    it('should return null for non-existent product', async () => {
      const result = await getProductById(999);
      expect(result).toBeNull();
    });
  });

  describe('getProductsByCategory', () => {
    it('should return products filtered by category', async () => {
      // Create category
      const categoryResult = await db.insert(categoriesTable)
        .values({ name: 'Electronics', description: 'Electronic items' })
        .returning()
        .execute();

      const categoryId = categoryResult[0].id;

      // Create products
      await createProduct({ ...testProductInput, category_id: categoryId });
      await createProduct({ ...testProductInput, name: 'Uncategorized Product', category_id: null });

      const result = await getProductsByCategory(categoryId);
      expect(result).toHaveLength(1);
      expect(result[0].category_id).toEqual(categoryId);
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with stock below threshold', async () => {
      await createProduct({ ...testProductInput, stock_quantity: 3, low_stock_threshold: 5 });
      await createProduct({ ...testProductInput, name: 'High Stock Product', stock_quantity: 50, low_stock_threshold: 5 });

      const result = await getLowStockProducts();
      expect(result).toHaveLength(1);
      expect(result[0].stock_quantity).toEqual(3);
      expect(result[0].stock_quantity).toBeLessThan(result[0].low_stock_threshold);
    });

    it('should only return active products', async () => {
      await createProduct({ 
        ...testProductInput, 
        name: 'Inactive Low Stock',
        stock_quantity: 3, 
        low_stock_threshold: 5,
        is_active: false 
      });

      const result = await getLowStockProducts();
      expect(result).toHaveLength(0);
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const created = await createProduct(testProductInput);

      const updateInput: UpdateProductInput = {
        id: created.id,
        name: 'Updated Product',
        selling_price: 25.99
      };

      const result = await updateProduct(updateInput);
      expect(result.name).toEqual('Updated Product');
      expect(result.selling_price).toEqual(25.99);
      expect(result.purchase_price).toEqual(10.50); // Unchanged
    });

    it('should throw error for non-existent product', async () => {
      const updateInput: UpdateProductInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/Product not found/i);
    });
  });

  describe('updateProductStock', () => {
    it('should increase stock', async () => {
      const created = await createProduct({ ...testProductInput, stock_quantity: 50 });

      const result = await updateProductStock(created.id, 25);
      expect(result.stock_quantity).toEqual(75);
    });

    it('should decrease stock', async () => {
      const created = await createProduct({ ...testProductInput, stock_quantity: 50 });

      const result = await updateProductStock(created.id, -20);
      expect(result.stock_quantity).toEqual(30);
    });

    it('should not allow negative stock', async () => {
      const created = await createProduct({ ...testProductInput, stock_quantity: 10 });

      const result = await updateProductStock(created.id, -20);
      expect(result.stock_quantity).toEqual(0);
    });

    it('should throw error for non-existent product', async () => {
      await expect(updateProductStock(999, 10)).rejects.toThrow(/Product not found/i);
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const created = await createProduct(testProductInput);

      const result = await deleteProduct(created.id);
      expect(result).toBe(true);

      const deletedProduct = await getProductById(created.id);
      expect(deletedProduct).toBeNull();
    });

    it('should return false for non-existent product', async () => {
      const result = await deleteProduct(999);
      expect(result).toBe(false);
    });

    it('should prevent deletion of product with transaction history', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: 'hash',
          role: 'cashier'
        })
        .returning()
        .execute();

      const product = await createProduct(testProductInput);

      const transactionResult = await db.insert(transactionsTable)
        .values({
          transaction_code: 'TX001',
          user_id: userResult[0].id,
          subtotal: '19.99',
          discount_amount: '0',
          tax_amount: '0',
          total_amount: '19.99',
          payment_method: 'cash',
          status: 'completed'
        })
        .returning()
        .execute();

      await db.insert(transactionItemsTable)
        .values({
          transaction_id: transactionResult[0].id,
          product_id: product.id,
          quantity: 1,
          unit_price: '19.99',
          discount_amount: '0',
          total_price: '19.99'
        })
        .execute();

      await expect(deleteProduct(product.id)).rejects.toThrow(/Cannot delete product with existing transaction history/i);
    });
  });
});
