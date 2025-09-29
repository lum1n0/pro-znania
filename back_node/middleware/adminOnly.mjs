// middleware/adminOnly.mjs
const adminOnly = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'SECRET_KEY_123') {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }
  next();
};

export default adminOnly;