import { Router } from 'express'

const router = Router()

// GET /api/design-systems
router.get('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

// GET /api/design-systems/:id
router.get('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

// POST /api/design-systems/:id/generate
router.post('/:id/generate', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

// POST /api/design-systems/:id/export
router.post('/:id/export', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

// GET /api/design-systems/:id/exports
router.get('/:id/exports', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
