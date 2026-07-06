import { Request, Response } from 'express'
import { z } from 'zod'
import * as dsService from '../services/designSystem.service'

const createSchema = z.object({
  name: z.string().min(1),
})

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const ds = await dsService.createDesignSystem(res.locals.userId as string, parsed.data.name)
    res.status(201).json(ds)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const systems = await dsService.listDesignSystems(res.locals.userId as string)
    res.status(200).json(systems)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const result = await dsService.getDesignSystem(res.locals.userId as string, req.params.id)
    if (!result) {
      res.status(404).json({ error: 'Design system not found' })
      return
    }
    res.status(200).json(result)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
}
