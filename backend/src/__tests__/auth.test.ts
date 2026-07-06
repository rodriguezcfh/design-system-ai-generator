import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import app from '../app'
import prisma from '../lib/prisma'
import bcrypt from 'bcryptjs'

vi.mock('../lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}))

const mockFindUnique = vi.mocked(prisma.user.findUnique)
const mockCreate = vi.mocked(prisma.user.create)
const mockCompare = vi.mocked(bcrypt.compare)

// fakeUser: returned by findUnique (includes passwordHash for bcrypt.compare)
const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  createdAt: new Date(),
  updatedAt: new Date(),
}

// fakeCreatedUser: what Prisma returns after create with select (no passwordHash)
const fakeCreatedUser = {
  id: 'user-1',
  email: 'test@example.com',
  createdAt: new Date(),
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a user and returns token + user without passwordHash', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue(fakeCreatedUser)

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).toMatchObject({ id: 'user-1', email: 'test@example.com' })
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('returns 409 if email already exists', async () => {
    mockFindUnique.mockResolvedValue(fakeUser)

    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(409)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'not-an-email', password: 'password123' })

    expect(res.status).toBe(400)
  })

  it('returns 400 if password is shorter than 8 chars', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com', password: '1234567' })

    expect(res.status).toBe(400)
  })

  it('returns 400 if fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ email: 'test@example.com' })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns token + user for valid credentials', async () => {
    mockFindUnique.mockResolvedValue(fakeUser)
    mockCompare.mockResolvedValue(true as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user).toMatchObject({ email: 'test@example.com' })
    expect(res.body.user).not.toHaveProperty('passwordHash')
  })

  it('returns 401 for wrong password', async () => {
    mockFindUnique.mockResolvedValue(fakeUser)
    mockCompare.mockResolvedValue(false as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
  })

  it('returns 401 for unknown email (same message — no user enumeration)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: 'password123' })

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid credentials')
  })

  it('returns 400 if password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com' })

    expect(res.status).toBe(400)
  })
})
