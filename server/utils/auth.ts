// server/utils/useAuth.ts
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";

function getSecret(): string {
    const config = useRuntimeConfig();
    return config.jwtSecret || "change-me";
}

export function hashPassword(password: string, salt?: string) {
    const s = salt ?? randomBytes(16).toString("hex");
    const hash = createHash("sha256")
        .update(password + s)
        .digest("hex");
    return { hash, salt: s };
}

export function verifyPassword(
    password: string,
    storedHash: string,
    storedSalt: string,
): boolean {
    return hashPassword(password, storedSalt).hash === storedHash;
}

export function signToken(userId: number): string {
    return jwt.sign({ sub: userId }, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: number } {
    return jwt.verify(token, getSecret()) as { sub: number };
}