
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type UpdateUserInput, type User } from '../schema';
import { eq, count } from 'drizzle-orm';

export async function createUser(input: CreateUserInput): Promise<User> {
  try {
    // Hash the password using Bun's built-in password hashing
    const passwordHash = await Bun.password.hash(input.password);

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        username: input.username,
        password_hash: passwordHash,
        role: input.role
      })
      .returning()
      .execute();

    const user = result[0];
    return {
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
}

export async function getUsers(): Promise<User[]> {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users.map(user => ({
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    return {
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    const updateData: Partial<typeof usersTable.$inferInsert> = {
      updated_at: new Date()
    };

    // Only update fields that are provided
    if (input.username !== undefined) {
      updateData.username = input.username;
    }

    if (input.password !== undefined) {
      updateData.password_hash = await Bun.password.hash(input.password);
    }

    if (input.role !== undefined) {
      updateData.role = input.role;
    }

    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    const user = result[0];
    return {
      ...user,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('User update failed:', error);
    throw error;
  }
}

export async function deleteUser(id: number): Promise<boolean> {
  try {
    // Check if this is the last admin user
    const adminCount = await db.select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.role, 'admin'))
      .execute();

    // Get the user being deleted to check their role
    const userToDelete = await getUserById(id);
    if (!userToDelete) {
      return false; // User doesn't exist
    }

    // Prevent deletion of the last admin
    if (userToDelete.role === 'admin' && adminCount[0].count <= 1) {
      throw new Error('Cannot delete the last admin user');
    }

    const result = await db.delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('User deletion failed:', error);
    throw error;
  }
}
