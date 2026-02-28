import { PrismaClient } from "./src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
    const categories = await prisma.category.findMany({
        select: { name: true, slug: true }
    });
    console.log(JSON.stringify(categories, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
