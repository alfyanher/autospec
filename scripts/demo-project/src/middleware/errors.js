export function errorHandler(err, _req, res, _next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation failed', issues: err.issues });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
