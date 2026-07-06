import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import * as githubController from '../controllers/github.controller'

const router = Router()

// GET /api/auth/github — inicia el flujo OAuth (no requiere auth previa)
router.get('/', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: process.env.GITHUB_CALLBACK_URL ?? '',
    scope: 'repo',
  })
  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// GET /api/auth/github/callback — recibe el code de GitHub, requiere JWT del usuario
router.get('/callback', requireAuth, githubController.oauthCallback)

export default router
