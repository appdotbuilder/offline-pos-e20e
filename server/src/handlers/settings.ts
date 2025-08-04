
import { db } from '../db';
import { settingsTable, usersTable, categoriesTable, productsTable, transactionsTable, transactionItemsTable } from '../db/schema';
import { type UpdateSettingsInput, type Settings } from '../schema';
import { eq } from 'drizzle-orm';

export async function getSettings(): Promise<Settings[]> {
  try {
    const results = await db.select()
      .from(settingsTable)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    throw error;
  }
}

export async function getSettingByKey(key: string): Promise<Settings | null> {
  try {
    const results = await db.select()
      .from(settingsTable)
      .where(eq(settingsTable.key, key))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch setting by key:', error);
    throw error;
  }
}

export async function updateSetting(input: UpdateSettingsInput): Promise<Settings> {
  try {
    // Try to update existing setting first
    const updateResult = await db.update(settingsTable)
      .set({
        value: input.value,
        updated_at: new Date()
      })
      .where(eq(settingsTable.key, input.key))
      .returning()
      .execute();

    // If no rows were updated, insert a new setting
    if (updateResult.length === 0) {
      const insertResult = await db.insert(settingsTable)
        .values({
          key: input.key,
          value: input.value
        })
        .returning()
        .execute();

      return insertResult[0];
    }

    return updateResult[0];
  } catch (error) {
    console.error('Failed to update setting:', error);
    throw error;
  }
}

export async function initializeDefaultSettings(): Promise<void> {
  try {
    const defaultSettings = [
      { key: 'store_name', value: 'My Store' },
      { key: 'tax_rate', value: '0.10' },
      { key: 'currency', value: 'USD' },
      { key: 'receipt_header', value: 'Thank you for your purchase!' },
      { key: 'receipt_footer', value: 'Visit us again!' },
      { key: 'auto_print_receipt', value: 'true' },
      { key: 'low_stock_alert', value: 'true' }
    ];

    for (const setting of defaultSettings) {
      // Only create if it doesn't exist
      const existing = await getSettingByKey(setting.key);
      if (!existing) {
        await db.insert(settingsTable)
          .values(setting)
          .execute();
      }
    }
  } catch (error) {
    console.error('Failed to initialize default settings:', error);
    throw error;
  }
}

export async function resetAllData(): Promise<void> {
  try {
    // Delete in reverse dependency order to avoid foreign key constraint violations
    await db.delete(transactionItemsTable).execute();
    await db.delete(transactionsTable).execute();
    await db.delete(productsTable).execute();
    await db.delete(categoriesTable).execute();
    await db.delete(usersTable).execute();
    await db.delete(settingsTable).execute();

    // Reinitialize default settings
    await initializeDefaultSettings();
  } catch (error) {
    console.error('Failed to reset all data:', error);
    throw error;
  }
}

export async function exportData(): Promise<any> {
  try {
    const [users, categories, products, transactions, transactionItems, settings] = await Promise.all([
      db.select().from(usersTable).execute(),
      db.select().from(categoriesTable).execute(),
      db.select().from(productsTable).execute(),
      db.select().from(transactionsTable).execute(),
      db.select().from(transactionItemsTable).execute(),
      db.select().from(settingsTable).execute()
    ]);

    return {
      users,
      categories,
      products,
      transactions,
      transaction_items: transactionItems,
      settings,
      export_date: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to export data:', error);
    throw error;
  }
}

export async function importData(data: any): Promise<void> {
  try {
    // Validate required structure
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data structure');
    }

    // Clear existing data first
    await resetAllData();

    // Import data in dependency order
    if (data.users && Array.isArray(data.users)) {
      for (const user of data.users) {
        await db.insert(usersTable)
          .values({
            username: user.username,
            password_hash: user.password_hash,
            role: user.role
          })
          .execute();
      }
    }

    if (data.categories && Array.isArray(data.categories)) {
      for (const category of data.categories) {
        await db.insert(categoriesTable)
          .values({
            name: category.name,
            description: category.description
          })
          .execute();
      }
    }

    if (data.products && Array.isArray(data.products)) {
      for (const product of data.products) {
        await db.insert(productsTable)
          .values({
            name: product.name,
            description: product.description,
            category_id: product.category_id,
            image_url: product.image_url,
            purchase_price: product.purchase_price.toString(),
            selling_price: product.selling_price.toString(),
            stock_quantity: product.stock_quantity,
            low_stock_threshold: product.low_stock_threshold,
            is_active: product.is_active
          })
          .execute();
      }
    }

    if (data.transactions && Array.isArray(data.transactions)) {
      for (const transaction of data.transactions) {
        await db.insert(transactionsTable)
          .values({
            transaction_code: transaction.transaction_code,
            user_id: transaction.user_id,
            subtotal: transaction.subtotal.toString(),
            discount_amount: transaction.discount_amount.toString(),
            tax_amount: transaction.tax_amount.toString(),
            total_amount: transaction.total_amount.toString(),
            payment_method: transaction.payment_method,
            status: transaction.status
          })
          .execute();
      }
    }

    if (data.transaction_items && Array.isArray(data.transaction_items)) {
      for (const item of data.transaction_items) {
        await db.insert(transactionItemsTable)
          .values({
            transaction_id: item.transaction_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price.toString(),
            discount_amount: item.discount_amount.toString(),
            total_price: item.total_price.toString()
          })
          .execute();
      }
    }

    if (data.settings && Array.isArray(data.settings)) {
      for (const setting of data.settings) {
        await db.insert(settingsTable)
          .values({
            key: setting.key,
            value: setting.value
          })
          .execute();
      }
    }
  } catch (error) {
    console.error('Failed to import data:', error);
    throw error;
  }
}
