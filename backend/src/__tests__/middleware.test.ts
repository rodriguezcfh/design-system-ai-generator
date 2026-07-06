import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { requireAuth } from '../middleware/auth'
import { signToken } from '../lib/jwt'

const testApp = express()
testApp.get('/protected', requireAuth, (_req, res) => {
  res.json({ userId: res.locals.userId })
})

describe('requireAuth middleware', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(testApp).get('/protected')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 401 with invalid token', async () => {
    const res = await request(testApp)
      .get('/protected')
      .set('Authorization', 'Bearer invalid.token.here')
    expect(res.status).toBe(401)
  })

  it('returns 401 with malformed Authorization header', async () => {
    const res = await request(testApp)
      .get('/protected')
      .set('Authorization', 'Basic somebase64')
    expect(res.status).toBe(401)
  })

  it('calls next and sets userId for valid token', async () => {
    const token = signToken({ userId: 'user-1' })
    const res = await request(testApp)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.userId).toBe('user-1')
  })
})
