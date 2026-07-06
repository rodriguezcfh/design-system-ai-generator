import { Request, Response } from 'express'
import * as githubService from '../services/github.service'

export async function oauthCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined
  if (!code) {
    res.status(400).json({ error: 'Missing OAuth code' })
    return
  }

  try {
    const { accessToken, login } = await githubService.exchangeCodeForToken(code)
    await githubService.saveGithubConnection(res.locals.userId as string, accessToken, login)
    res.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/github/connected`)
  } catch (err) {
    console.error('GitHub OAuth error:', err)
    res.status(500).json({ error: 'GitHub authentication failed' })
  }
}
