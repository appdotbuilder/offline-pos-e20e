
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type LoginResponse, type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function login(input: LoginInput): Promise<LoginResponse> {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = users[0];

    // Verify password (simple comparison for now - in production would use bcrypt)
    if (user.password_hash !== input.password) {
      throw new Error('Invalid credentials');
    }

    // Generate simple token (in production would use JWT)
    const token = `token_${user.id}_${Date.now()}`;

    // Return user without password hash
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    // Simple token verification (in production would decode JWT)
    if (!token.startsWith('token_')) {
      return null;
    }

    const parts = token.split('_');
    if (parts.length !== 3) {
      return null;
    }

    const userId = parseInt(parts[1]);
    if (isNaN(userId)) {
      return null;
    }

    // Find user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    return users[0];
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
