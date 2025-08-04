
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test data
const testCategoryInput: CreateCategoryInput = {
  name: 'Electronics',
  description: 'Electronic devices and accessories'
};

const testCategoryWithoutDescription: CreateCategoryInput = {
  name: 'Books',
  description: null
};

describe('Categories Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a category with description', async () => {
      const result = await createCategory(testCategoryInput);

      expect(result.name).toEqual('Electronics');
      expect(result.description).toEqual('Electronic devices and accessories');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a category without description', async () => {
      const result = await createCategory(testCategoryWithoutDescription);

      expect(result.name).toEqual('Books');
      expect(result.description).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save category to database', async () => {
      const result = await createCategory(testCategoryInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Electronics');
      expect(categories[0].description).toEqual('Electronic devices and accessories');
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await getCategories();
      expect(result).toEqual([]);
    });

    it('should return all categories ordered by name', async () => {
      // Create multiple categories
      await createCategory({ name: 'Zebra Products', description: null });
      await createCategory({ name: 'Apple Products', description: null });
      await createCategory({ name: 'Books', description: null });

      const result = await getCategories();

      expect(result).toHaveLength(3);
      expect(result[0].name).toEqual('Apple Products');
      expect(result[1].name).toEqual('Books');
      expect(result[2].name).toEqual('Zebra Products');
    });
  });

  describe('getCategoryById', () => {
    it('should return category when ID exists', async () => {
      const created = await createCategory(testCategoryInput);
      const result = await getCategoryById(created.id);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Electronics');
      expect(result!.description).toEqual('Electronic devices and accessories');
      expect(result!.id).toEqual(created.id);
    });

    it('should return null when ID does not exist', async () => {
      const result = await getCategoryById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateCategory', () => {
    it('should update category name only', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Electronics'
      };

      const result = await updateCategory(updateInput);

      expect(result.name).toEqual('Updated Electronics');
      expect(result.description).toEqual('Electronic devices and accessories'); // Should remain unchanged
      expect(result.id).toEqual(created.id);
    });

    it('should update category description only', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        description: 'Updated description'
      };

      const result = await updateCategory(updateInput);

      expect(result.name).toEqual('Electronics'); // Should remain unchanged
      expect(result.description).toEqual('Updated description');
      expect(result.id).toEqual(created.id);
    });

    it('should update both name and description', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Electronics',
        description: 'Updated description'
      };

      const result = await updateCategory(updateInput);

      expect(result.name).toEqual('Updated Electronics');
      expect(result.description).toEqual('Updated description');
      expect(result.id).toEqual(created.id);
    });

    it('should throw error when category does not exist', async () => {
      const updateInput: UpdateCategoryInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateCategory(updateInput)).rejects.toThrow(/not found/i);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      const created = await createCategory(testCategoryInput);
      const result = await deleteCategory(created.id);

      expect(result).toBe(true);

      // Verify category is deleted
      const deleted = await getCategoryById(created.id);
      expect(deleted).toBeNull();
    });

    it('should return false when category does not exist', async () => {
      const result = await deleteCategory(999);
      expect(result).toBe(false);
    });

    it('should throw error when category has associated products', async () => {
      // First create a category
      const category = await createCategory(testCategoryInput);

      // Create a product associated with this category
      await db.insert(productsTable)
        .values({
          name: 'Test Product',
          category_id: category.id,
          purchase_price: '10.00',
          selling_price: '15.00',
          stock_quantity: 100,
          low_stock_threshold: 10,
          is_active: true
        })
        .execute();

      // Attempt to delete category should throw error
      await expect(deleteCategory(category.id)).rejects.toThrow(/associated products/i);
    });
  });
});
