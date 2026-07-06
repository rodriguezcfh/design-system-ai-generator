import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import githubRouter from './github'

const router = Router()

router.post('/signup', authController.signup)
router.post('/login', authController.login)
router.use('/github', githubRouter)

export default router
