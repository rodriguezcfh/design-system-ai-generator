import { Request, Response } from 'express'
import { z } from 'zod'
import * as chatService from '../services/chat.service'

const messageSchema = z.object({
  designSystemId: z.string().min(1),
  content: z.string().min(1),
})

const attachmentSchema = z.object({
  designSystemId: z.string().min(1),
})

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const parsed = messageSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const result = await chatService.sendMessage(
      res.locals.userId as string,
      parsed.data.designSystemId,
      parsed.data.content,
    )
    res.status(200).json(result)
  } catch (err) {
    if (err instanceof chatService.NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    if (err instanceof chatService.TokensNotReadyError) {
      res.status(422).json({ error: err.message })
      return
    }
    if (
      err instanceof chatService.InvalidComponentCodeError ||
      err instanceof chatService.DisallowedImportError ||
      err instanceof chatService.PatchExportContractError
    ) {
      console.error('Chat-driven edit produced invalid component code:', (err as Error).message)
      res.status(422).json({ error: (err as Error).message })
      return
    }
    console.error('Error sending chat message:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export async function saveAttachment(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }
  const parsed = attachmentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  try {
    const attachment = await chatService.saveAttachment(
      res.locals.userId as string,
      parsed.data.designSystemId,
      req.file,
    )
    res.status(201).json({ id: attachment.id, filename: attachment.filename })
  } catch (err) {
    if (err instanceof chatService.NotFoundError) {
      res.status(404).json({ error: err.message })
      return
    }
    console.error('Error saving chat attachment:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
