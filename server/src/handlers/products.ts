
import { db } from '../db';
import { productsTable, categoriesTable, transactionItemsTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type Product } from '../schema';
import { eq, and, lt, exists } from 'drizzle-orm';

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        category_id: input.category_id,
        image_url: input.image_url,
        purchase_price: input.purchase_price.toString(),
        selling_price: input.selling_price.toString(),
        stock_quantity: input.stock_quantity,
        low_stock_threshold: input.low_stock_threshold,
        is_active: input.is_active
      })
      .returning()
      .execute();

    const product = result[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}

export async function getProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}

export async function getActiveProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Failed to fetch active products:', error);
    throw error;
  }
}

export async function getProductById(id: number): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const product = results[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Failed to fetch product by ID:', error);
    throw error;
  }
}

export async function getProductsByCategory(categoryId: number): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.category_id, categoryId))
      .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Failed to fetch products by category:', error);
    throw error;
  }
}

export async function getLowStockProducts(): Promise<Product[]> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.is_active, true),
        lt(productsTable.stock_quantity, productsTable.low_stock_threshold)
      ))
      .execute();

    return results.map(product => ({
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    }));
  } catch (error) {
    console.error('Failed to fetch low stock products:', error);
    throw error;
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  try {
    const updateData: any = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category_id !== undefined) updateData.category_id = input.category_id;
    if (input.image_url !== undefined) updateData.image_url = input.image_url;
    if (input.purchase_price !== undefined) updateData.purchase_price = input.purchase_price.toString();
    if (input.selling_price !== undefined) updateData.selling_price = input.selling_price.toString();
    if (input.stock_quantity !== undefined) updateData.stock_quantity = input.stock_quantity;
    if (input.low_stock_threshold !== undefined) updateData.low_stock_threshold = input.low_stock_threshold;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const result = await db.update(productsTable)
      .set(updateData)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Product not found');
    }

    const product = result[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
}

export async function updateProductStock(productId: number, quantityChange: number): Promise<Product> {
  try {
    // First get current product to calculate new stock
    const currentProduct = await getProductById(productId);
    if (!currentProduct) {
      throw new Error('Product not found');
    }

    const newStockQuantity = Math.max(0, currentProduct.stock_quantity + quantityChange);

    const result = await db.update(productsTable)
      .set({ 
        stock_quantity: newStockQuantity,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, productId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Product not found');
    }

    const product = result[0];
    return {
      ...product,
      purchase_price: parseFloat(product.purchase_price),
      selling_price: parseFloat(product.selling_price)
    };
  } catch (error) {
    console.error('Product stock update failed:', error);
    throw error;
  }
}

export async function deleteProduct(id: number): Promise<boolean> {
  try {
    // Check if product has associated transaction items
    const hasTransactionItems = await db.select()
      .from(transactionItemsTable)
      .where(eq(transactionItemsTable.product_id, id))
      .limit(1)
      .execute();

    if (hasTransactionItems.length > 0) {
      throw new Error('Cannot delete product with existing transaction history');
    }

    const result = await db.delete(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
}
