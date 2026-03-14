import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'

interface TriggerResult {
  success: boolean
  feedbackId: string
}

export function useAutoFix() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const triggerAutoFix = async (feedbackId: string): Promise<TriggerResult> => {
    setLoading(true)
    setError(null)

    try {
      const callable = httpsCallable<{ feedbackId: string }, TriggerResult>(
        functions,
        'triggerAutoFix'
      )
      const result = await callable({ feedbackId })
      return result.data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Auto-fix trigger failed'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { triggerAutoFix, loading, error }
}
