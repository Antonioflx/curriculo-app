import { Request } from 'express';

export interface AuthUser {
  userId: string;
  sessionId: string;
}

export type AppRequest = Request & { id: string; user?: AuthUser };
