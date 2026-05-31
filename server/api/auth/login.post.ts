// server/api/auth/login.post.ts
import { db } from "~~/server/utils/db";
import { eq } from "drizzle-orm";
// 👇 Make sure to update this path to wherever your Drizzle schema is defined
import { users } from "~~/server/database/schema";

import { verifyPassword, signToken } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
    const body = await readBody(event);
    const { email, password } = body;

    if (!email || !password) {
        throw createError({
            statusCode: 400,
            message: "Email and password required",
        });
    }

    // --- Drizzle implementation replacing Prisma ---
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

    if (
        !user ||
        !await verifyPassword(password, user.passwordHash, user.passwordSalt)
    ) {
        throw createError({
            statusCode: 401,
            message: "Invalid credentials",
        });
    }

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