import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
 * SSO middleware: validate JWT from HttpOnly cookie or Bearer header
 * Enriches request with user info and mapped role
 */
export function ssoAuth(req: AuthRequest, res: Response, next: NextFunction): void {
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

    // Enrich request with user and mapped role
    req.user = {
      userId: parseInt(payload.sub, 10),
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
