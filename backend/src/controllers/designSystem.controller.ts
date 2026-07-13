import { Request, Response } from 'express'
import { z } from 'zod'
import * as dsService from '../services/designSystem.service'
import * as generationService from '../services/generation.service'
import * as exportService from '../services/export.service'

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
  } catch (err) {
    console.error('Error creating design system:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const systems = await dsService.listDesignSystems(res.locals.userId as string)
    res.status(200).json(systems)
  } catch (err) {
    console.error('Error listing design systems:', err)
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
  } catch (err) {
    console.error('Error fetching design system:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await dsService.deleteDesignSystem(res.locals.userId as string, req.params.id)
    res.status(204).send()
  } catch (err) {
    if (err instanceof dsService.NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    console.error('Error deleting design system:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

const exportSchema = z.object({
  repoName: z.string().min(1).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
})

export async function exportDS(req: Request, res: Response): Promise<void> {
  const parsed = exportSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await exportService.exportDesignSystem(
      res.locals.userId as string,
      req.params.id,
      parsed.data,
    )
    res.status(201).json(result)
  } catch (err) {
    if (err instanceof exportService.NotFoundError) {
      res.status(404).json({ error: err.message })
    } else if (err instanceof exportService.GithubNotConnectedError) {
      res.status(403).json({ error: err.message, authUrl: '/api/auth/github' })
    } else if (err instanceof exportService.TokensNotReadyError || err instanceof exportService.WcagFailedError) {
      res.status(422).json({ error: err.message })
    } else if (err instanceof exportService.RepoConflictError) {
      res.status(409).json({ error: err.message, suggestedName: err.suggestedName })
    } else {
      console.error('Error exporting design system:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export async function listExports(req: Request, res: Response): Promise<void> {
  try {
    const exports = await exportService.listExports(res.locals.userId as string, req.params.id)
    res.status(200).json(exports)
  } catch (err) {
    if (err instanceof exportService.NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    console.error('Error listing exports:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function generate(req: Request, res: Response): Promise<void> {
  try {
    const result = await generationService.generateForDesignSystem(
      res.locals.userId as string,
      req.params.id,
    )
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof generationService.NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof generationService.BriefNotReadyError) {
      res.status(422).json({ error: err.message })
      return
    }
    if (err instanceof generationService.InvalidComponentCodeError || err instanceof generationService.DisallowedImportError) {
      console.error('Gemini generated invalid component code:', err.message)
      res.status(422).json({ error: err.message })
      return
    }
    console.error('Error generating design system:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function getFigmaTokens(req: Request, res: Response): Promise<void> {
  try {
    const json = await dsService.getFigmaTokensExport(res.locals.userId as string, req.params.id)
    res.setHeader('Content-Disposition', 'attachment; filename="design-tokens.json"')
    res.status(200).type('application/json').send(json)
  } catch (err) {
    if (err instanceof dsService.NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof dsService.TokensNotReadyError) {
      res.status(422).json({ error: err.message })
      return
    }
    console.error('Error building Figma tokens export:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
