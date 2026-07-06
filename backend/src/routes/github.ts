import { Router } from 'express'

const router = Router()

// GET /api/auth/github — inicia el flujo OAuth
router.get('/', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: process.env.GITHUB_CALLBACK_URL ?? '',
    scope: 'repo',
  })
  res.redirect(`https://github.com/login/oauth/authorize?${params}`)
})

// GET /api/auth/github/callback — recibe el code, canjea por access_token
router.get('/callback', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' })
})

export default router
