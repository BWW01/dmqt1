// server/utils/useAuth.ts
import jwt from "jsonwebtoken";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

function getSecret(): string {
    const config = useRuntimeConfig();
    return config.jwtSecret || "change-me";
}

export async function hashPassword(password: string, salt?: string) {
    const s = salt ?? randomBytes(16).toString("hex");
    const hash = (await scryptAsync(password, s, 64) as Buffer).toString("hex");
    return { hash, salt: s };
}

export async function verifyPassword(
    password: string,
    storedHash: string,
    storedSalt: string,
): Promise<boolean> {
    try {
        const { hash } = await hashPassword(password, storedSalt);
        return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
    } catch {
        return false;
    }
}

export function signToken(userId: number): string {
    return jwt.sign({ sub: userId }, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: number } {
    return jwt.verify(token, getSecret()) as { sub: number };
}
