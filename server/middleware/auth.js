import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }
}
