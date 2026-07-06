import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { upload } from '../lib/multer'
import * as chatController from '../controllers/chat.controller'

const router = Router()

router.post('/message', requireAuth, chatController.sendMessage)
router.post('/attachment', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message })
      return
    }
    next()
  })
}, chatController.saveAttachment)

export default router
