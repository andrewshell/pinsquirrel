import { eq } from "drizzle-orm";
import type {
  User,
  CreateUserData,
  UpdateUserData,
  UserRepository,
} from "@pinsquirrel/core";
import { db } from "../client.js";
import { users } from "../schema/users.js";

export class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return result[0] || null;
  }

  async findAll(): Promise<User[]> {
    return await db.select().from(users);
  }

  async create(data: CreateUserData): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date();

    const result = await db
      .insert(users)
      .values({
        id,
        email: data.email,
        name: data.name,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }

  async update(id: string, data: UpdateUserData): Promise<User | null> {
    const result = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return result[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}
