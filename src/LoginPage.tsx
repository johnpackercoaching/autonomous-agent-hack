import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from './AuthContext'

// ── Customizable login text ──
const LOGIN_HEADING = 'Agent Hackathon'
const LOGIN_LABEL = 'Autonomous'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signInWithGoogle, signInWithEmail, signInWithPasskey, passkeysSupported, error } = useAuth()

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasskeySignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithPasskey()
    } catch {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await signInWithEmail(email, password)
    } catch {
      // Error is handled by AuthContext
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <p className="login-label">{LOGIN_LABEL}</p>
          <h1>{LOGIN_HEADING}</h1>
        </div>

        <div className="login-content">
          {error && (
            <div className="login-error" role="alert">
              {error.includes('popup-closed') || error.includes('redirect-cancelled')
                ? 'Sign in was cancelled'
                : error.includes('unauthorized')
                ? 'This account is not authorized'
                : error.includes('invalid-credential')
                ? 'Invalid email or password'
                : error.includes('passkey-setup-incomplete')
                ? 'Passkey sign-in is not yet configured. Please use Google or Email sign-in.'
                : error.includes('passkey-not-found')
                ? 'No passkey found. Sign in with Google or Email first, then register a passkey in Settings.'
                : error.includes('redirect')
                ? 'Sign in redirect failed. Please try again.'
                : 'Unable to sign in. Please try again.'}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            className="google-button"
            disabled={isLoading}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          {passkeysSupported && (
            <button
              onClick={handlePasskeySignIn}
              className="passkey-button"
              disabled={isLoading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {isLoading ? 'Signing in...' : 'Sign in with Passkey'}
            </button>
          )}

          <div className="divider">
            <span>or</span>
          </div>

          {showEmailForm ? (
            <form onSubmit={handleEmailSignIn} className="email-form">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                data-testid="email-input"
              />
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="password-input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              <button type="submit" className="email-button" disabled={isLoading} data-testid="email-submit">
                {isLoading ? 'Signing in...' : 'Sign In with Email'}
              </button>
              <button type="button" className="toggle-link" onClick={() => setShowEmailForm(false)}>
                Back
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowEmailForm(true)}
              className="email-toggle-button"
            >
              Sign in with Email
            </button>
          )}
        </div>

        <div className="login-footer">
          <p>Autonomous Agent Hackathon</p>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1E3F68 0%, #0071BD 50%, #1E3F68 100%);
          padding: 1rem;
        }

        .login-container {
          background: white;
          border-radius: 12px;
          padding: 2.5rem;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .login-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #888;
          margin-bottom: 0.75rem;
        }

        .login-header h1 {
          font-family: 'Playfair Display SC', 'Georgia', 'Times New Roman', serif;
          font-size: 1.75rem;
          font-weight: 400;
          color: #1a1a1a;
          letter-spacing: -0.02em;
        }

        .login-content {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 0.75rem 1rem;
          border-radius: 100px;
          font-size: 0.9rem;
          text-align: center;
        }

        .google-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: white;
          color: #3c4043;
          border: 1px solid #dadce0;
          padding: 0.875rem 1.5rem;
          border-radius: 100px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .google-button:hover:not(:disabled) {
          background: #f8f9fa;
          border-color: #c6c9cc;
        }

        .google-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .passkey-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: #1E3F68;
          color: white;
          border: 1px solid #1E3F68;
          padding: 0.875rem 1.5rem;
          border-radius: 100px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .passkey-button:hover:not(:disabled) {
          background: #16213e;
          border-color: #16213e;
        }

        .passkey-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .email-form {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .email-form input {
          padding: 0.75rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 100px;
          font-size: 1rem;
        }

        .email-form input:focus {
          outline: none;
          border-color: #0071BD;
        }

        .password-field {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-field input {
          width: 100%;
          padding-right: 2.75rem;
        }

        .password-toggle {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          color: #9ca3af;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .password-toggle:hover {
          color: #6b7280;
        }

        .email-button {
          background: #0071BD;
          color: white;
          border: none;
          padding: 0.875rem 1.5rem;
          border-radius: 100px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
        }

        .email-button:hover:not(:disabled) {
          background: #005a96;
        }

        .email-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 0.5rem 0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }

        .divider span {
          color: #9ca3af;
          font-size: 0.85rem;
        }

        .email-toggle-button {
          background: transparent;
          color: #1a5490;
          border: 1px solid #0071BD;
          padding: 0.875rem 1.5rem;
          border-radius: 100px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .email-toggle-button:hover {
          background: #f0f7ff;
        }

        .toggle-link {
          background: none;
          border: none;
          color: #6b7280;
          font-size: 0.9rem;
          cursor: pointer;
          padding: 0.5rem;
        }

        .toggle-link:hover {
          color: #1a5490;
        }

        .login-footer {
          text-align: center;
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }

        .login-footer p {
          color: #9ca3af;
          font-size: 0.8rem;
        }
      `}</style>
    </div>
  )
}
