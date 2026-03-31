import { Request, Response } from 'express';
import { prisma } from '../services/db.service';
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
});

export async function createChat(req: Request, res: Response) {
  try {
    const { userIds } = req.body; // Array de IDs
    const chat = await prisma.chat.create({
      data: {
        users: {
          connect: userIds.map((id: string) => ({ id }))
        }
      }
    });
    res.status(201).json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function uploadManifest(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const vector = await embeddings.embedQuery(content);
    const vectorStr = `[${vector.join(',')}]`;

    // raw sql para insertar manifest con pgvector e id automatico o si existe actualizar
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ProjectManifest" (id, content, embedding, "chatId", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2::vector, $3, NOW())
      ON CONFLICT ("chatId") DO UPDATE SET 
        content = EXCLUDED.content, 
        embedding = EXCLUDED.embedding,
        "updatedAt" = EXCLUDED."updatedAt"
    `, content, vectorStr, id);

    res.status(200).json({ message: 'Manifest uploaded/updated and vectorized' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getChatDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        users: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        projectManifest: true
      }
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.status(200).json(chat);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
