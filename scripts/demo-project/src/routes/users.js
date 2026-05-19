import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';

export const userRouter = Router();

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

userRouter.get('/', async (_req, res) => {
  const users = await db.users.findAll();
  res.json({ users });
});

userRouter.get('/:id', async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

userRouter.post('/', async (req, res) => {
  const body = CreateUserSchema.parse(req.body);
  const user = await db.users.create(body);
  res.status(201).json({ user });
});

userRouter.delete('/:id', async (req, res) => {
  await db.users.delete(req.params.id);
  res.status(204).end();
});
