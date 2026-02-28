import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies?.token;
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    request.user = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}
