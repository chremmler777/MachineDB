import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Service-to-service bearer token auth.
 * Validates Authorization: Bearer <token> against MACHINEDB_SERVICE_TOKEN env var.
 * Uses constant-time comparison to avoid timing attacks.
 */
export function serviceAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.MACHINEDB_SERVICE_TOKEN;
  if (!expected) {
    return res.status(500).json({ error: 'service token not configured' });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' });
  }

  const provided = header.slice('Bearer '.length).trim();

  // Constant-time comparison (length-safe)
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'invalid token' });
  }

  next();
}
