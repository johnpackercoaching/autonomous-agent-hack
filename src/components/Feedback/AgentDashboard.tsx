import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../../firebase'
import type { FeedbackItem, ProgressNote } from '../../types/feedback'
import './AgentDashboard.css'

interface AgentDashboardProps {
  feedbackId: string
  onClose: () => void
}

const PHASES = ['Plan', 'Validate', 'Execute', 'Test'] as const

function getPhaseIndex(notes: ProgressNote[]): number {
  const allText = notes.map((n) => n.text.toLowerCase()).join(' ')
  if (allText.includes('test') || allText.includes('verif') || allText.includes('playwright')) return 3
  if (allText.includes('execut') || allText.includes('implement') || allText.includes('fix')) return 2
  if (allText.includes('validat') || allText.includes('confirm')) return 1
  if (allText.includes('plan') || allText.includes('analyz') || allText.includes('diagnos')) return 0
  return notes.length > 0 ? 0 : -1
}

export function AgentDashboard({ feedbackId, onClose }: AgentDashboardProps) {
  const [feedback, setFeedback] = useState<FeedbackItem | null>(null)
  const [elapsed, setElapsed] = useState('00:00')
  const [error, setError] = useState<string | null>(null)
  const activityRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Subscribe to feedback document
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined

    try {
      const feedbackRef = doc(db, 'feedback', feedbackId)
      unsubscribe = onSnapshot(
        feedbackRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            setFeedback({
              id: snap.id,
              user: data.user,
              feedbackText: data.feedbackText,
              screenshotUrl: data.screenshotUrl,
              currentUrl: data.currentUrl,
              platform: data.platform,
              status: data.status,
              priority: data.priority,
              timestamp: data.timestamp?.toDate?.() || new Date(),
              lastUpdated: data.lastUpdated?.toDate?.() || new Date(),
              progressNotes: (data.progressNotes || []).map((n: { text: string; timestamp: string; author: string }) => ({
                ...n,
                timestamp: new Date(n.timestamp),
              })),
              autoFixResult: data.autoFixResult
                ? {
                    ...data.autoFixResult,
                    completedAt: data.autoFixResult.completedAt
                      ? new Date(data.autoFixResult.completedAt)
                      : new Date(),
                  }
                : undefined,
            })
            setError(null)
          }
        },
        (err) => {
          setError(err.message)
        }
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [feedbackId])

  // Elapsed timer
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const mins = String(Math.floor(diff / 60)).padStart(2, '0')
      const secs = String(diff % 60).padStart(2, '0')
      setElapsed(`${mins}:${secs}`)
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Auto-scroll activity feed
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [feedback?.progressNotes.length])

  const isComplete = feedback?.status === 'completed'
  const isFailed = feedback?.status === 'failed'
  const isActive = !isComplete && !isFailed
  const currentPhase = feedback ? getPhaseIndex(feedback.progressNotes) : -1

  return (
    <div className="agent-dashboard" role="complementary" aria-label="Auto-fix progress">
      {/* Header */}
      <div className="agent-dashboard-header">
        <div className="agent-dashboard-header-left">
          <div className={`agent-dashboard-indicator ${isActive ? 'active' : isComplete ? 'complete' : 'failed'}`} />
          <h3 className="agent-dashboard-title">
            {isComplete ? 'Fix Deployed' : isFailed ? 'Fix Failed' : 'Agent Working'}
          </h3>
        </div>
        <div className="agent-dashboard-header-right">
          <span className="agent-dashboard-timer" aria-label={`Elapsed time: ${elapsed}`}>
            {elapsed}
          </span>
          <button
            className="agent-dashboard-close"
            onClick={onClose}
            aria-label="Close agent dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="agent-dashboard-phases" role="progressbar" aria-valuenow={currentPhase + 1} aria-valuemin={0} aria-valuemax={4}>
        {PHASES.map((phase, i) => (
          <div key={phase} className="agent-phase">
            <div
              className={`agent-phase-dot ${
                isFailed && i === currentPhase
                  ? 'failed'
                  : i < currentPhase
                  ? 'done'
                  : i === currentPhase
                  ? 'active'
                  : ''
              }`}
            />
            <span className={`agent-phase-label ${i === currentPhase ? 'current' : ''}`}>
              {phase}
            </span>
            {i < PHASES.length - 1 && (
              <div className={`agent-phase-line ${i < currentPhase ? 'done' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="agent-dashboard-error" role="alert">
          {error}
        </div>
      )}

      {/* Activity Feed */}
      <div className="agent-dashboard-activity" ref={activityRef}>
        {feedback?.progressNotes.length === 0 && (
          <p className="agent-dashboard-empty">Waiting for agent to start...</p>
        )}
        {feedback?.progressNotes.map((note, i) => (
          <div key={i} className="agent-activity-item">
            <div className="agent-activity-dot" />
            <div className="agent-activity-content">
              <p className="agent-activity-text">{note.text}</p>
              <span className="agent-activity-time">
                {note.timestamp instanceof Date
                  ? note.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : ''}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Completion / PR link */}
      {isComplete && feedback?.autoFixResult?.prUrl && (
        <div className="agent-dashboard-result">
          <a
            href={feedback.autoFixResult.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="agent-dashboard-pr-link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View Pull Request
          </a>
          {feedback.autoFixResult.fixDescription && (
            <p className="agent-dashboard-fix-desc">{feedback.autoFixResult.fixDescription}</p>
          )}
        </div>
      )}

      {isFailed && (
        <div className="agent-dashboard-failed-msg" role="alert">
          The auto-fix agent was unable to resolve this issue. Your feedback has been saved for manual review.
        </div>
      )}
    </div>
  )
}
