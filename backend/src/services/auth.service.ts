import bcrypt from 'bcryptjs'
import prisma from '../lib/prisma'
import { signToken } from '../lib/jwt'

const SALT_ROUNDS = 10

export class EmailTakenError extends Error {
  constructor() {
    super('Email already in use')
    this.name = 'EmailTakenError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials')
    this.name = 'InvalidCredentialsError'
  }
}

export async function signup(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new EmailTakenError()

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, email: true, createdAt: true },
  })

  return { token: signToken({ userId: user.id }), user }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) throw new InvalidCredentialsError()

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new InvalidCredentialsError()

  return {
    token: signToken({ userId: user.id }),
    user: { id: user.id, email: user.email, createdAt: user.createdAt },
  }
}
