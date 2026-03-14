export interface ProgressNote {
  text: string
  timestamp: Date
  author: string
}

export interface FeedbackItem {
  id: string
  user: { uid: string; email: string; displayName: string }
  feedbackText: string
  screenshotUrl?: string
  currentUrl: string
  platform: 'web' | 'ios'
  source?: 'user' | 'autonomous'
  status: 'new' | 'auto-fixing' | 'in-progress' | 'completed' | 'failed'
  priority: 'high' | 'medium' | 'low'
  timestamp: Date
  lastUpdated?: Date
  progressNotes: ProgressNote[]
  autoFixResult?: {
    status: string
    prUrl?: string
    fixDescription?: string
    completedAt: Date
  }
}
