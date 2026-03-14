import { useState, useRef, useEffect } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import html2canvas from 'html2canvas'
import { db, storage } from '../../firebase'
import { useAuth } from '../../AuthContext'
import { useAutoFix } from '../../hooks/useAutoFix'
import { AgentDashboard } from './AgentDashboard'
import './InlineFeedback.css'

export function InlineFeedback() {
  const { user } = useAuth()
  const { triggerAutoFix, loading: autoFixLoading } = useAutoFix()
  const [isOpen, setIsOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [screenshotData, setScreenshotData] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null)
  const [showDashboard, setShowDashboard] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDashboard) {
          setShowDashboard(false)
        } else {
          setIsOpen(false)
        }
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, showDashboard])

  if (!user) return null

  const captureScreenshot = async () => {
    setCapturing(true)
    try {
      // Temporarily hide the feedback panel for the screenshot
      if (panelRef.current) {
        panelRef.current.style.display = 'none'
      }

      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        useCORS: true,
        logging: false,
      })

      if (panelRef.current) {
        panelRef.current.style.display = ''
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
      setScreenshotData(dataUrl)
    } catch {
      setStatusMessage('Failed to capture screenshot.')
      setStatus('error')
    } finally {
      setCapturing(false)
      if (panelRef.current) {
        panelRef.current.style.display = ''
      }
    }
  }

  const uploadScreenshot = async (dataUrl: string): Promise<string> => {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const timestamp = Date.now()
    const storageRef = ref(storage, `feedback/${user.uid}/${timestamp}.jpg`)
    await uploadBytes(storageRef, blob)
    return getDownloadURL(storageRef)
  }

  const resetForm = () => {
    setFeedbackText('')
    setScreenshotData(null)
    setStatus('idle')
    setStatusMessage('')
  }

  const handleSend = async () => {
    if (!feedbackText.trim()) return
    setSending(true)
    setStatus('idle')

    try {
      let screenshotUrl: string | undefined
      if (screenshotData) {
        screenshotUrl = await uploadScreenshot(screenshotData)
      }

      const docRef = await addDoc(collection(db, 'feedback'), {
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
        },
        feedbackText: feedbackText.trim(),
        screenshotUrl: screenshotUrl || null,
        currentUrl: window.location.pathname,
        platform: 'web' as const,
        status: 'new',
        priority: 'medium' as const,
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        progressNotes: [],
      })

      setActiveFeedbackId(docRef.id)
      setStatus('success')
      setStatusMessage('Feedback sent! Thank you.')
      setTimeout(() => {
        resetForm()
        setIsOpen(false)
      }, 2000)
    } catch {
      setStatus('error')
      setStatusMessage('Failed to send feedback. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleAutoFix = async () => {
    if (!feedbackText.trim()) return
    setSending(true)
    setStatus('idle')

    try {
      let screenshotUrl: string | undefined
      if (screenshotData) {
        screenshotUrl = await uploadScreenshot(screenshotData)
      }

      const docRef = await addDoc(collection(db, 'feedback'), {
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || '',
        },
        feedbackText: feedbackText.trim(),
        screenshotUrl: screenshotUrl || null,
        currentUrl: window.location.pathname,
        platform: 'web' as const,
        status: 'new',
        priority: 'high' as const,
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        progressNotes: [],
      })

      setActiveFeedbackId(docRef.id)

      await triggerAutoFix(docRef.id)

      setShowDashboard(true)
      setStatus('success')
      setStatusMessage('Auto-fix triggered! Watch the progress below.')
    } catch (err: unknown) {
      setStatus('error')
      const detail = err instanceof Error ? err.message : 'Unknown error'
      setStatusMessage(`Auto-fix failed: ${detail}`)
    } finally {
      setSending(false)
    }
  }

  const handleCloseDashboard = () => {
    setShowDashboard(false)
    setActiveFeedbackId(null)
    resetForm()
    setIsOpen(false)
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        className="feedback-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close feedback panel' : 'Send feedback'}
        aria-expanded={isOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {isOpen ? (
            <path d="M18 6L6 18M6 6l12 12" />
          ) : (
            <>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <path d="M8 10h.01M12 10h.01M16 10h.01" />
            </>
          )}
        </svg>
      </button>

      {/* Feedback panel */}
      {isOpen && (
        <div className="feedback-panel" ref={panelRef} role="dialog" aria-label="Send feedback">
          <div className="feedback-panel-header">
            <h3 className="feedback-panel-title">Send Feedback</h3>
            <button
              className="feedback-panel-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close feedback panel"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="feedback-panel-body">
            <textarea
              ref={textareaRef}
              className="feedback-textarea"
              placeholder="Describe the issue or suggestion..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={4}
              disabled={sending || autoFixLoading}
              aria-label="Feedback description"
            />

            {/* Screenshot preview */}
            {screenshotData && (
              <div className="feedback-screenshot-preview">
                <img src={screenshotData} alt="Screenshot preview" />
                <button
                  className="feedback-screenshot-remove"
                  onClick={() => setScreenshotData(null)}
                  aria-label="Remove screenshot"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Screenshot capture button */}
            {!screenshotData && (
              <button
                className="feedback-screenshot-btn"
                onClick={captureScreenshot}
                disabled={capturing || sending}
                aria-label="Capture screenshot"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {capturing ? 'Capturing...' : 'Attach Screenshot'}
              </button>
            )}

            {/* Status message */}
            {statusMessage && (
              <div className={`feedback-status feedback-status-${status}`} role="status" aria-live="polite">
                {statusMessage}
              </div>
            )}
          </div>

          <div className="feedback-panel-actions">
            <button
              className="feedback-btn feedback-btn-send"
              onClick={handleSend}
              disabled={!feedbackText.trim() || sending || autoFixLoading}
            >
              {sending && !autoFixLoading ? 'Sending...' : 'Send'}
            </button>
            <button
              className="feedback-btn feedback-btn-autofix"
              onClick={handleAutoFix}
              disabled={!feedbackText.trim() || sending || autoFixLoading}
              title="Send feedback and trigger an AI agent to automatically fix the issue"
            >
              {autoFixLoading ? 'Triggering...' : 'Auto-Fix'}
            </button>
          </div>
        </div>
      )}

      {/* Agent Dashboard */}
      {showDashboard && activeFeedbackId && (
        <AgentDashboard
          feedbackId={activeFeedbackId}
          onClose={handleCloseDashboard}
        />
      )}
    </>
  )
}
