
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput } from '../schema';
import { createUser, getUsers, getUserById, updateUser, deleteUser } from '../handlers/users';
import { eq } from 'drizzle-orm';

// Test input data
const testUserInput: CreateUserInput = {
  username: 'testuser',
  password: 'password123',
  role: 'cashier'
};

const testAdminInput: CreateUserInput = {
  username: 'admin',
  password: 'adminpass123',
  role: 'admin'
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      const result = await createUser(testUserInput);

      expect(result.username).toEqual('testuser');
      expect(result.role).toEqual('cashier');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
      expect(result.password_hash).not.toEqual('password123'); // Should be hashed
      expect(result.password_hash).toBeTruthy();
    });

    it('should save user to database', async () => {
      const result = await createUser(testUserInput);

      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      expect(users[0].username).toEqual('testuser');
      expect(users[0].role).toEqual('cashier');
      expect(users[0].password_hash).not.toEqual('password123');
    });

    it('should throw error for duplicate username', async () => {
      await createUser(testUserInput);

      await expect(createUser(testUserInput)).rejects.toThrow(/duplicate key value/i);
    });

    it('should create admin user', async () => {
      const result = await createUser(testAdminInput);

      expect(result.username).toEqual('admin');
      expect(result.role).toEqual('admin');
      expect(result.password_hash).not.toEqual('adminpass123');
    });
  });

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const users = await getUsers();
      expect(users).toEqual([]);
    });

    it('should return all users', async () => {
      await createUser(testUserInput);
      await createUser(testAdminInput);

      const users = await getUsers();
      expect(users).toHaveLength(2);
      
      const usernames = users.map(u => u.username);
      expect(usernames).toContain('testuser');
      expect(usernames).toContain('admin');
      
      // All users should have password hashes
      users.forEach(user => {
        expect(user.password_hash).toBeTruthy();
        expect(user.created_at).toBeInstanceOf(Date);
        expect(user.updated_at).toBeInstanceOf(Date);
      });
    });
  });

  describe('getUserById', () => {
    it('should return null for non-existent user', async () => {
      const user = await getUserById(999);
      expect(user).toBeNull();
    });

    it('should return user by ID', async () => {
      const created = await createUser(testUserInput);
      const user = await getUserById(created.id);

      expect(user).not.toBeNull();
      expect(user!.id).toEqual(created.id);
      expect(user!.username).toEqual('testuser');
      expect(user!.role).toEqual('cashier');
      expect(user!.password_hash).toBeTruthy();
      expect(user!.created_at).toBeInstanceOf(Date);
      expect(user!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateUser', () => {
    it('should update username only', async () => {
      const created = await createUser(testUserInput);
      const updateInput: UpdateUserInput = {
        id: created.id,
        username: 'newusername'
      };

      const updated = await updateUser(updateInput);
      expect(updated.username).toEqual('newusername');
      expect(updated.role).toEqual('cashier'); // Should remain unchanged
      expect(updated.password_hash).toEqual(created.password_hash); // Should remain unchanged
      expect(updated.updated_at > created.updated_at).toBe(true);
    });

    it('should update password and hash it', async () => {
      const created = await createUser(testUserInput);
      const updateInput: UpdateUserInput = {
        id: created.id,
        password: 'newpassword123'
      };

      const updated = await updateUser(updateInput);
      expect(updated.password_hash).not.toEqual(created.password_hash);
      expect(updated.password_hash).not.toEqual('newpassword123'); // Should be hashed
      expect(updated.username).toEqual('testuser'); // Should remain unchanged
    });

    it('should update role', async () => {
      const created = await createUser(testUserInput);
      const updateInput: UpdateUserInput = {
        id: created.id,
        role: 'admin'
      };

      const updated = await updateUser(updateInput);
      expect(updated.role).toEqual('admin');
      expect(updated.username).toEqual('testuser'); // Should remain unchanged
    });

    it('should update all fields', async () => {
      const created = await createUser(testUserInput);
      const updateInput: UpdateUserInput = {
        id: created.id,
        username: 'updateduser',
        password: 'newpassword123',
        role: 'admin'
      };

      const updated = await updateUser(updateInput);
      expect(updated.username).toEqual('updateduser');
      expect(updated.role).toEqual('admin');
      expect(updated.password_hash).not.toEqual(created.password_hash);
      expect(updated.password_hash).not.toEqual('newpassword123');
    });

    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        username: 'nonexistent'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for duplicate username', async () => {
      const user1 = await createUser(testUserInput);
      await createUser(testAdminInput);

      const updateInput: UpdateUserInput = {
        id: user1.id,
        username: 'admin' // Try to use existing username
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/duplicate key value/i);
    });
  });

  describe('deleteUser', () => {
    it('should return false for non-existent user', async () => {
      const result = await deleteUser(999);
      expect(result).toBe(false);
    });

    it('should delete user successfully', async () => {
      const created = await createUser(testUserInput);
      const result = await deleteUser(created.id);

      expect(result).toBe(true);

      // Verify user is deleted
      const user = await getUserById(created.id);
      expect(user).toBeNull();
    });

    it('should prevent deletion of last admin user', async () => {
      const admin = await createUser(testAdminInput);

      await expect(deleteUser(admin.id)).rejects.toThrow(/cannot delete the last admin user/i);

      // Verify admin still exists
      const user = await getUserById(admin.id);
      expect(user).not.toBeNull();
    });

    it('should allow deletion of admin when other admins exist', async () => {
      const admin1 = await createUser(testAdminInput);
      const admin2Input: CreateUserInput = {
        username: 'admin2',
        password: 'password123',
        role: 'admin'
      };
      await createUser(admin2Input);

      const result = await deleteUser(admin1.id);
      expect(result).toBe(true);

      // Verify admin1 is deleted
      const user = await getUserById(admin1.id);
      expect(user).toBeNull();
    });

    it('should allow deletion of cashier users', async () => {
      await createUser(testAdminInput); // Create admin first
      const cashier = await createUser(testUserInput);

      const result = await deleteUser(cashier.id);
      expect(result).toBe(true);

      // Verify cashier is deleted
      const user = await getUserById(cashier.id);
      expect(user).toBeNull();
    });
  });
});
