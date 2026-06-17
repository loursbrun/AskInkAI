import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { users } from '../db'
import { requireAuth, AuthRequest } from '../middleware/auth'

const router = Router()

const BCRYPT_ROUNDS = 12

function makeToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {}

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Email invalide' })
    return
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' })
    return
  }

  // Check if email already taken — same error message to avoid user enumeration
  const existing = users.findByEmail.get(email.toLowerCase().trim())
  if (existing) {
    res.status(409).json({ error: 'Cet email est déjà utilisé' })
    return
  }

  try {
    const id = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    users.create.run(id, email.toLowerCase().trim(), passwordHash, Date.now())

    res.status(201).json({ token: makeToken(id), id, email: email.toLowerCase().trim() })
  } catch {
    res.status(500).json({ error: 'Erreur lors de la création du compte' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    res.status(400).json({ error: 'Email et mot de passe requis' })
    return
  }

  const user = users.findByEmail.get((email as string).toLowerCase().trim())
  // Always run bcrypt to prevent timing attacks
  const hash = user?.password_hash ?? '$2a$12$invalidhashtopreventtimingattack000000000000000000'
  const valid = await bcrypt.compare(password as string, hash)

  if (!user || !valid) {
    res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    return
  }

  res.json({ token: makeToken(user.id), id: user.id, email: user.email })
})

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token')
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res: Response): void => {
  const user = users.findById.get(req.userId!)
  if (!user) {
    res.clearCookie('token')
    res.status(401).json({ error: 'Utilisateur introuvable' })
    return
  }
  res.json({ id: user.id, email: user.email })
})

export default router
