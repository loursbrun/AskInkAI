import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

import authRouter from './routes/auth'
import apiKeyRouter from './routes/apiKey'
import claudeRouter from './routes/claude'

// Validate required env vars at startup
const required = ['ENCRYPTION_KEY', 'JWT_SECRET']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json({ limit: '50kb' }))
app.use(cookieParser())

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter)
app.use('/api/key', apiKeyRouter)
app.use('/api/ask', claudeRouter)

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }))

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`AskInkAI server running on http://localhost:${PORT}`)
})
