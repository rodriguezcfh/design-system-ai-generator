import { Request, Response } from 'express'
import { z } from 'zod'
import * as authService from '../services/auth.service'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function signup(req: Request, res: Response): Promise<void> {
  const parsed = signupSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await authService.signup(parsed.data.email, parsed.data.password)
    res.status(201).json(result)
  } catch (err) {
    if (err instanceof authService.EmailTakenError) {
      res.status(409).json({ error: err.message })
      return
    }
    console.error('Error during signup:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await authService.login(parsed.data.email, parsed.data.password)
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof authService.InvalidCredentialsError) {
      res.status(401).json({ error: err.message })
      return
    }
    console.error('Error during login:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
