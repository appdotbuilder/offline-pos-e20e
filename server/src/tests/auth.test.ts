
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, verifyToken } from '../handlers/auth';

// Test inputs
const testUser = {
  username: 'testuser',
  password_hash: 'testpassword',
  role: 'admin' as const
};

const loginInput: LoginInput = {
  username: 'testuser',
  password: 'testpassword'
};

const invalidLoginInput: LoginInput = {
  username: 'testuser',
  password: 'wrongpassword'
};

describe('auth handlers', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create test user
    await db.insert(usersTable)
      .values(testUser)
      .execute();
  });

  afterEach(resetDB);

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const result = await login(loginInput);

      expect(result.user.username).toEqual('testuser');
      expect(result.user.role).toEqual('admin');
      expect(result.user.id).toBeDefined();
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);
      expect(result.token).toBeDefined();
      expect(result.token).toMatch(/^token_\d+_\d+$/);
      
      // Should not return password_hash
      expect((result.user as any).password_hash).toBeUndefined();
    });

    it('should reject invalid username', async () => {
      const invalidInput: LoginInput = {
        username: 'nonexistent',
        password: 'testpassword'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid credentials/i);
    });

    it('should reject invalid password', async () => {
      await expect(login(invalidLoginInput)).rejects.toThrow(/invalid credentials/i);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const loginResult = await login(loginInput);
      const user = await verifyToken(loginResult.token);

      expect(user).not.toBeNull();
      expect(user!.username).toEqual('testuser');
      expect(user!.role).toEqual('admin');
      expect(user!.id).toBeDefined();
      expect(user!.password_hash).toEqual('testpassword');
    });

    it('should reject invalid token format', async () => {
      const user = await verifyToken('invalid_token');
      expect(user).toBeNull();
    });

    it('should reject token with invalid user ID', async () => {
      const user = await verifyToken('token_999_1234567890');
      expect(user).toBeNull();
    });

    it('should reject malformed token', async () => {
      const user = await verifyToken('token_abc_def');
      expect(user).toBeNull();
    });

    it('should reject token without proper parts', async () => {
      const user = await verifyToken('token_123');
      expect(user).toBeNull();
    });
  });
});
