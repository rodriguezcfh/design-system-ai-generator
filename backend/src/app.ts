import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import authRouter from './routes/auth'
import chatRouter from './routes/chat'
import designSystemsRouter from './routes/designSystems'

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/chat', chatRouter)
app.use('/api/design-systems', designSystemsRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

export default app
