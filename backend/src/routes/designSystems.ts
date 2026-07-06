import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import * as dsController from '../controllers/designSystem.controller'

const router = Router()

router.post('/', requireAuth, dsController.create)
router.get('/', requireAuth, dsController.list)
router.get('/:id', requireAuth, dsController.getById)

router.post('/:id/generate', requireAuth, dsController.generate)
router.post('/:id/export', requireAuth, (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})
router.get('/:id/exports', requireAuth, (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
