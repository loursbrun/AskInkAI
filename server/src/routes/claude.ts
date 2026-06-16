import { Router, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { getUserApiKey } from './apiKey'

const router = Router()
router.use(requireAuth)

// POST /api/ask
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { question } = req.body ?? {}

  if (!question || typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'La question ne peut pas être vide' })
    return
  }
  if (question.length > 4000) {
    res.status(400).json({ error: 'Question trop longue (max 4000 caractères)' })
    return
  }

  const apiKey = getUserApiKey(req.userId!)
  if (!apiKey) {
    res.status(402).json({ error: 'Aucune clé API Claude configurée' })
    return
  }

  try {
    const client = new Anthropic({ apiKey })
    const model = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'

    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: question.trim() }],
    })

    const textContent = message.content.find(b => b.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      res.status(500).json({ error: 'Réponse inattendue de Claude' })
      return
    }

    res.json({ response: textContent.text })
  } catch (err: unknown) {
    // Never log the raw error (could contain the API key in stack traces from SDK)
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status
      if (status === 401) {
        res.status(400).json({ error: 'Clé API Claude invalide ou expirée' })
        return
      }
      if (status === 429) {
        res.status(429).json({ error: 'Limite de l\'API Claude atteinte, réessayez plus tard' })
        return
      }
    }
    res.status(500).json({ error: 'Erreur lors de l\'appel à Claude' })
  }
})

export default router
