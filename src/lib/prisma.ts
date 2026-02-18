import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;

// Create a pg Pool with robust configuration for both local and production
const pool = new Pool({
    connectionString,
    max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Listener for pool errors to prevent process crashes
pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
});

const adapter = new PrismaPg(pool);

// Augment globalThis to prevent multiple instances during hot-reloads
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        adapter,
        log: process.env.DB_LOGGING === 'true' ? ['query', 'error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}






// import 'dotenv/config';
// import { PrismaPg } from '@prisma/adapter-pg';
// import { PrismaClient } from '../generated/prisma/client';

// const connectionString = `${process.env.DATABASE_URL}`;

// // Augment globalThis to prevent multiple instances during hot-reloads
// const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// export const prisma =
//     globalForPrisma.prisma ||
//     (() => {
//         const adapter = new PrismaPg({ connectionString });
//         return new PrismaClient({ adapter });
//     })();

// if (process.env.NODE_ENV !== 'production') {
//     globalForPrisma.prisma = prisma;
// }
