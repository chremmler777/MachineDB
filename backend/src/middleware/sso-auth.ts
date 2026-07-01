import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';

export interface SSOPayload {
  sub: string;
  username: string;
  roles: Array<{
    name: string;
    system: string;
    permissions?: string;
  }>;
  exp: number;
}

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
    role: 'master' | 'viewer';
    roles: SSOPayload['roles'];
  };
}

/**
 * Role mapping: convert admin panel roles to MachineDB roles
 */
function mapRoleToMachineDB(roles: SSOPayload['roles']): 'master' | 'viewer' | null {
  for (const role of roles) {
    if (role.system === 'machinedb') {
      // Admin -> master; Viewer -> viewer
      if (role.name === 'machinedb_Admin') {
        return 'master';
      }
      if (role.name === 'machinedb_Viewer') {
        return 'viewer';
      }
    }
  }
  return null;
}

/**
 * Resolve the SSO user to a *local* MachineDB users.id.
 *
 * The JWT `sub` is the AdminPanel user id, which lives in a different id space
 * than MachineDB's local `users` table (only master/viewer_usa/viewer_mexico are
 * seeded, ids 1/2/3). Writing the raw `sub` into created_by/updated_by/changed_by
 * (all FK -> users(id)) throws a foreign-key violation -> 500 whenever the SSO id
 * isn't coincidentally 1/2/3. We therefore mirror the SSO identity into the local
 * table keyed by *username* (never by id — the id spaces collide) and return the
 * local id so the FK columns stay valid.
 *
 * Hot path is a single indexed SELECT; the INSERT only runs on first-ever login.
 * password_hash is a non-loginable sentinel: these users authenticate via SSO only.
 */
async function resolveLocalUserId(
  username: string,
  role: 'master' | 'viewer',
): Promise<number> {
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }
  // ON CONFLICT guards against a race between two concurrent first-logins.
  const inserted = await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id`,
    [username, 'sso:no-local-login', role]
  );
  return inserted.rows[0].id;
}

/**
 * SSO middleware: validate JWT from HttpOnly cookie or Bearer header
 * Enriches request with user info and mapped role
 */
export async function ssoAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | null = null;

  // Try to get token from HttpOnly cookie first (SSO)
  if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  }

  // Fall back to Authorization Bearer header (backward compat)
  if (!token && req.headers.authorization) {
    const match = req.headers.authorization.match(/^Bearer\s+(.+)$/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'No authentication token provided' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET || 'change-me-in-production';
    const payload = jwt.verify(token, secret) as SSOPayload;

    // Map roles to machinedb-specific role
    const mappedRole = mapRoleToMachineDB(payload.roles || []);

    if (!mappedRole) {
      res.status(403).json({ error: 'No valid machinedb role found' });
      return;
    }

    // Resolve to a LOCAL users.id so FK columns (created_by/updated_by/changed_by)
    // stay valid. The JWT sub is an AdminPanel id from a different id space and
    // must not be used directly. Falls back to a synthetic username if the token
    // somehow omits one, so the unique-username upsert always has a stable key.
    const localUsername = payload.username || `sso_user_${payload.sub}`;
    let localUserId: number;
    try {
      localUserId = await resolveLocalUserId(localUsername, mappedRole);
    } catch (dbErr) {
      console.error('SSO user resolution failed:', dbErr);
      res.status(500).json({ error: 'Failed to resolve user account' });
      return;
    }

    // Enrich request with user and mapped role
    req.user = {
      userId: localUserId,
      username: payload.username,
      role: mappedRole,
      roles: payload.roles || [],
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
}

/**
 * Check if user has master role
 */
export function requireMaster(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  if (req.user.role !== 'master') {
    res.status(403).json({ error: 'Master role required' });
    return;
  }

  next();
}
