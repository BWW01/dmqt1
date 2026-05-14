// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const hash = createHash("sha256")
        .update(password + salt)
        .digest("hex");
    return { hash, salt };
}

async function main() {
    const { hash, salt } = hashPassword("admin123");

    await prisma.user.upsert({
        where: { email: "admin@dmqt.local" },
        update: {},
        create: {
            email: "admin@dmqt.local",
            passwordHash: hash,
            passwordSalt: salt,
            role: "admin",
        },
    });

    console.log("Seed kész: admin@dmqt.local / admin123");
}

main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });