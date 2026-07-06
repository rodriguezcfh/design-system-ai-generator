import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const payload = verifyToken(token)
    res.locals.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
