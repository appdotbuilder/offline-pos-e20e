
import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput, type Category } from '../schema';
import { eq, count } from 'drizzle-orm';

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  try {
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .orderBy(categoriesTable.name)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const result = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch category by ID:', error);
    throw error;
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  try {
    // Check if category exists
    const existing = await getCategoryById(input.id);
    if (!existing) {
      throw new Error(`Category with ID ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
}

export async function deleteCategory(id: number): Promise<boolean> {
  try {
    // Check if category exists
    const existing = await getCategoryById(id);
    if (!existing) {
      return false;
    }

    // Check if category has associated products
    const productCount = await db.select({ count: count() })
      .from(productsTable)
      .where(eq(productsTable.category_id, id))
      .execute();

    if (productCount[0].count > 0) {
      throw new Error('Cannot delete category that has associated products');
    }

    // Delete the category
    await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return true;
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
}
