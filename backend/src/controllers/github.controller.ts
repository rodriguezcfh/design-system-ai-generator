import { Request, Response } from 'express'
import * as githubService from '../services/github.service'
import { verifyToken } from '../lib/jwt'

// GitHub redirects the browser here as a plain top-level navigation, so there's no
// Authorization header available — the frontend passes the user's JWT via `state` instead.
export async function oauthCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined
  const state = req.query.state as string | undefined

  if (!code) {
    res.status(400).json({ error: 'Missing OAuth code' })
    return
  }

  let userId: string
  try {
    userId = verifyToken(state ?? '').userId
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { accessToken, login } = await githubService.exchangeCodeForToken(code)
    await githubService.saveGithubConnection(userId, accessToken, login)
    res.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/github/connected`)
  } catch (err) {
    console.error('GitHub OAuth error:', err)
    res.status(500).json({ error: 'GitHub authentication failed' })
  }
}

export async function getStatus(_req: Request, res: Response): Promise<void> {
  try {
    const status = await githubService.getConnectionStatus(res.locals.userId as string)
    res.status(200).json(status)
  } catch (err) {
    console.error('Error checking GitHub connection status:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}
