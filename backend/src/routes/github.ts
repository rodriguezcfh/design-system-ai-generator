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

// GET /api/auth/github/callback — recibe el code de GitHub. Es una navegación de browser
// (redirect de GitHub), así que no puede llevar el header Authorization: el JWT viaja en `state`.
router.get('/callback', githubController.oauthCallback)

// GET /api/auth/github/status — chequeo real de si el usuario ya conectó su cuenta
router.get('/status', requireAuth, githubController.getStatus)

export default router
