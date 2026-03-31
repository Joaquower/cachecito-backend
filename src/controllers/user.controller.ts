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
