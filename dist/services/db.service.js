"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.initDb = initDb;
const client_1 = require("@prisma/client");
exports.prisma = new client_1.PrismaClient();
/**
 * Asegurar que pgvector esté habilitado en la DB.
 */
async function initDb() {
    try {
        await exports.prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
        console.log('PostgreSQL pgvector extension verified.');
    }
    catch (err) {
        console.error('Error verifying pgvector:', err);
    }
}
