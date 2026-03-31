import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool as any);

export const prisma = new PrismaClient({ adapter });

/**
 * Asegurar que pgvector esté habilitado en la DB.
 */
export async function initDb() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('PostgreSQL pgvector extension verified.');
  } catch (err) {
    console.error('Error verifying pgvector:', err);
  }
}
