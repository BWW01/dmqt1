// server/api/auth/register.post.ts
import { db } from "~~/server/utils/db";
import { eq } from "drizzle-orm";
import { users } from "~~/server/database/schema"; // Ensure this path matches your Drizzle schema

// Added hashPassword to the import list since it's used below
import { hashPassword, signToken } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { email, password } = body;

    if (!email || !password) {
        throw createError({
            statusCode: 400,
            message: "Email and password required",
        });
    }

    // --- Drizzle: Check for existing user ---
    const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (existing) {
        throw createError({
            statusCode: 409,
            message: "Email already registered",
        });
    }

    const { hash, salt } = await hashPassword(password);

    // --- Drizzle: Insert new user ---
    // The .returning() clause is required to get the newly created user data back,
    // similar to how Prisma returns the object by default.
    const [user] = await db
        .insert(users)
        .values({
            email,
            passwordHash: hash,
            passwordSalt: salt,
            role: "user",
        })
        .returning();

    return {
        token: signToken(user.id),
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            credits: user.credits,
        },
    };
});