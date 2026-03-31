"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChat = createChat;
exports.uploadManifest = uploadManifest;
const db_service_1 = require("../services/db.service");
const openai_1 = require("@langchain/openai");
const embeddings = new openai_1.OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
});
async function createChat(req, res) {
    try {
        const { userIds } = req.body; // Array de IDs
        const chat = await db_service_1.prisma.chat.create({
            data: {
                users: {
                    connect: userIds.map((id) => ({ id }))
                }
            }
        });
        res.status(201).json(chat);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}
async function uploadManifest(req, res) {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const vector = await embeddings.embedQuery(content);
        const vectorStr = `[${vector.join(',')}]`;
        // raw sql para insertar manifest con pgvector e id automatico o si existe actualizar
        await db_service_1.prisma.$executeRawUnsafe(`
      INSERT INTO "ProjectManifest" (id, content, embedding, "chatId", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
      ON CONFLICT ("chatId") DO UPDATE SET 
        content = EXCLUDED.content, 
        embedding = EXCLUDED.embedding,
        "updatedAt" = EXCLUDED."updatedAt"
    `, content, vectorStr, id);
        res.status(200).json({ message: 'Manifest uploaded/updated and vectorized' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}
