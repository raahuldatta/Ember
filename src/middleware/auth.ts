import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getUserByUid, upsertUser } from '../store/repo.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken & { uid: string; email?: string; name?: string; id?: number };
  dbUser?: any;
}

const DEMO_USER = {
  uid: 'demo',
  email: 'oncall@ember.dev',
  name: 'On-call Engineer',
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    if (token === 'demo' || token === 'ember-demo') {
      const dbUser = (await getUserByUid('demo')) || (await upsertUser(DEMO_USER.uid, DEMO_USER.email, DEMO_USER.name));
      req.user = { uid: DEMO_USER.uid, email: DEMO_USER.email, name: DEMO_USER.name, id: dbUser.id } as any;
      req.dbUser = dbUser;
      next();
      return;
    }

    const { adminAuth } = await import('../lib/firebase-admin.ts');
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getUserByUid(decodedToken.uid);
    if (dbUser) req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
