import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/client.js';

export const postRouter = Router();

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string(),
  authorId: z.string().uuid(),
});

postRouter.get('/', async (req, res) => {
  const { authorId } = req.query;
  const posts = authorId
    ? await db.posts.findByAuthor(authorId)
    : await db.posts.findAll();
  res.json({ posts });
});

postRouter.post('/', async (req, res) => {
  const body = CreatePostSchema.parse(req.body);
  const post = await db.posts.create(body);
  res.status(201).json({ post });
});
