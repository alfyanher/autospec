import express from 'express';
import { userRouter } from './routes/users.js';
import { postRouter } from './routes/posts.js';
import { errorHandler } from './middleware/errors.js';

const app = express();
app.use(express.json());

app.use('/api/v1/users', userRouter);
app.use('/api/v1/posts', postRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
