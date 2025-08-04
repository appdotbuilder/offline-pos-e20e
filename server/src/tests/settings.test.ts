
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { settingsTable, usersTable, categoriesTable } from '../db/schema';
import { type UpdateSettingsInput } from '../schema';
import {
  getSettings,
  getSettingByKey,
  updateSetting,
  initializeDefaultSettings,
  resetAllData,
  exportData,
  importData
} from '../handlers/settings';
import { eq } from 'drizzle-orm';

const testSettingInput: UpdateSettingsInput = {
  key: 'test_setting',
  value: 'test_value'
};

describe('Settings Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getSettings', () => {
    it('should return empty array when no settings exist', async () => {
      const result = await getSettings();
      expect(result).toEqual([]);
    });

    it('should return all settings', async () => {
      // Create test settings
      await db.insert(settingsTable)
        .values([
          { key: 'setting1', value: 'value1' },
          { key: 'setting2', value: 'value2' }
        ])
        .execute();

      const result = await getSettings();
      expect(result).toHaveLength(2);
      expect(result[0].key).toEqual('setting1');
      expect(result[0].value).toEqual('value1');
      expect(result[1].key).toEqual('setting2');
      expect(result[1].value).toEqual('value2');
    });
  });

  describe('getSettingByKey', () => {
    it('should return null when setting does not exist', async () => {
      const result = await getSettingByKey('nonexistent');
      expect(result).toBeNull();
    });

    it('should return setting when it exists', async () => {
      await db.insert(settingsTable)
        .values({ key: 'test_key', value: 'test_value' })
        .execute();

      const result = await getSettingByKey('test_key');
      expect(result).not.toBeNull();
      expect(result?.key).toEqual('test_key');
      expect(result?.value).toEqual('test_value');
      expect(result?.id).toBeDefined();
      expect(result?.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateSetting', () => {
    it('should create new setting when it does not exist', async () => {
      const result = await updateSetting(testSettingInput);

      expect(result.key).toEqual('test_setting');
      expect(result.value).toEqual('test_value');
      expect(result.id).toBeDefined();
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify it was saved to database
      const saved = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'test_setting'))
        .execute();

      expect(saved).toHaveLength(1);
      expect(saved[0].value).toEqual('test_value');
    });

    it('should update existing setting', async () => {
      // Create initial setting
      await db.insert(settingsTable)
        .values({ key: 'existing_key', value: 'old_value' })
        .execute();

      const updateInput: UpdateSettingsInput = {
        key: 'existing_key',
        value: 'new_value'
      };

      const result = await updateSetting(updateInput);

      expect(result.key).toEqual('existing_key');
      expect(result.value).toEqual('new_value');
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify update in database
      const updated = await db.select()
        .from(settingsTable)
        .where(eq(settingsTable.key, 'existing_key'))
        .execute();

      expect(updated).toHaveLength(1);
      expect(updated[0].value).toEqual('new_value');
    });
  });

  describe('initializeDefaultSettings', () => {
    it('should create default settings', async () => {
      await initializeDefaultSettings();

      const settings = await getSettings();
      expect(settings.length).toBeGreaterThan(0);

      const storeNameSetting = settings.find(s => s.key === 'store_name');
      expect(storeNameSetting).toBeDefined();
      expect(storeNameSetting?.value).toEqual('My Store');

      const taxRateSetting = settings.find(s => s.key === 'tax_rate');
      expect(taxRateSetting).toBeDefined();
      expect(taxRateSetting?.value).toEqual('0.10');

      const currencySetting = settings.find(s => s.key === 'currency');
      expect(currencySetting).toBeDefined();
      expect(currencySetting?.value).toEqual('USD');
    });

    it('should not overwrite existing settings', async () => {
      // Create a setting first
      await updateSetting({ key: 'store_name', value: 'Custom Store' });

      await initializeDefaultSettings();

      const storeName = await getSettingByKey('store_name');
      expect(storeName?.value).toEqual('Custom Store'); // Should not be overwritten
    });
  });

  describe('resetAllData', () => {
    it('should clear all data and reinitialize settings', async () => {
      // Create test data
      await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: 'hash',
          role: 'admin'
        })
        .execute();

      await db.insert(categoriesTable)
        .values({
          name: 'Test Category',
          description: 'Test'
        })
        .execute();

      await db.insert(settingsTable)
        .values({ key: 'custom_setting', value: 'custom_value' })
        .execute();

      await resetAllData();

      // Verify all data is cleared
      const users = await db.select().from(usersTable).execute();
      const categories = await db.select().from(categoriesTable).execute();
      
      expect(users).toHaveLength(0);
      expect(categories).toHaveLength(0);

      // Verify default settings are initialized
      const settings = await getSettings();
      expect(settings.length).toBeGreaterThan(0);
      
      const storeNameSetting = settings.find(s => s.key === 'store_name');
      expect(storeNameSetting).toBeDefined();
    });
  });

  describe('exportData', () => {
    it('should export all data', async () => {
      // Create test data
      await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: 'hash',
          role: 'admin'
        })
        .execute();

      await db.insert(settingsTable)
        .values({ key: 'test_setting', value: 'test_value' })
        .execute();

      const result = await exportData();

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(result.categories).toBeDefined();
      expect(result.products).toBeDefined();
      expect(result.transactions).toBeDefined();
      expect(result.transaction_items).toBeDefined();
      expect(result.settings).toBeDefined();
      expect(result.export_date).toBeDefined();

      expect(result.users).toHaveLength(1);
      expect(result.users[0].username).toEqual('testuser');
      expect(result.settings).toHaveLength(1);
      expect(result.settings[0].key).toEqual('test_setting');
    });
  });

  describe('importData', () => {
    it('should import valid data', async () => {
      const testData = {
        users: [{
          username: 'imported_user',
          password_hash: 'imported_hash',
          role: 'cashier'
        }],
        categories: [{
          name: 'Imported Category',
          description: 'Imported description'
        }],
        products: [],
        transactions: [],
        transaction_items: [],
        settings: [{
          key: 'imported_setting',
          value: 'imported_value'
        }]
      };

      await importData(testData);

      // Verify imported data
      const users = await db.select().from(usersTable).execute();
      expect(users).toHaveLength(1);
      expect(users[0].username).toEqual('imported_user');

      const categories = await db.select().from(categoriesTable).execute();
      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Imported Category');

      const settings = await getSettings();
      const importedSetting = settings.find(s => s.key === 'imported_setting');
      expect(importedSetting).toBeDefined();
      expect(importedSetting?.value).toEqual('imported_value');
    });

    it('should handle invalid data structure', async () => {
      await expect(importData(null)).rejects.toThrow(/invalid data structure/i);
      await expect(importData('invalid')).rejects.toThrow(/invalid data structure/i);
    });

    it('should handle empty data arrays', async () => {
      const emptyData = {
        users: [],
        categories: [],
        products: [],
        transactions: [],
        transaction_items: [],
        settings: []
      };

      await importData(emptyData);

      // Should still have default settings after import
      const settings = await getSettings();
      expect(settings.length).toBeGreaterThan(0);
    });
  });
});
