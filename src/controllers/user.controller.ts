import { Request, Response } from 'express';
import { prisma } from '../services/db.service';

export async function registerUser(req: Request, res: Response) {
  try {
    const { name, aiPersona } = req.body;
    const user = await prisma.user.create({
      data: { name, aiPersona }
    });
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getAllUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function getUserChats(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const chats = await prisma.chat.findMany({
      where: {
        users: { some: { id } }
      },
      include: {
        users: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(chats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
