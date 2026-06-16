import { Router, Response } from 'express'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { apiKeys } from '../db'
import { encrypt, decrypt, makeKeyHint } from '../crypto'

const router = Router()

// All routes require authentication
router.use(requireAuth)

// GET /api/key — returns hint only (never the real key)
router.get('/', (req: AuthRequest, res: Response): void => {
  const row = apiKeys.findByUser.get(req.userId!)
  if (!row) {
    res.json(null)
    return
  }
  res.json({ hint: row.key_hint })
})

// POST /api/key — save or replace the API key
router.post('/', (req: AuthRequest, res: Response): void => {
  const { key } = req.body ?? {}
  if (!key || typeof key !== 'string' || !key.trim().startsWith('sk-')) {
    res.status(400).json({ error: 'Clé API invalide (doit commencer par sk-)' })
    return
  }

  try {
    const trimmed = key.trim()
    const encryptedKey = encrypt(trimmed)
    const hint = makeKeyHint(trimmed)
    apiKeys.upsert.run(req.userId!, encryptedKey, hint, Date.now())
    res.json({ hint })
  } catch {
    res.status(500).json({ error: 'Erreur lors du chiffrement de la clé' })
  }
})

// DELETE /api/key
router.delete('/', (req: AuthRequest, res: Response): void => {
  apiKeys.deleteByUser.run(req.userId!)
  res.json({ ok: true })
})

// Internal helper — decrypt a user's API key (not exposed as an HTTP route)
export function getUserApiKey(userId: string): string | null {
  const row = apiKeys.findByUser.get(userId)
  if (!row) return null
  try {
    return decrypt(row.encrypted_key)
  } catch {
    return null
  }
}

export default router
