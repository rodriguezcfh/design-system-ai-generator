import { Router } from 'express'

const router = Router()

// POST /api/chat/message
router.post('/message', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

// POST /api/chat/attachment
router.post('/attachment', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
