import { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { signInWithPasskey as webAuthnSignIn, linkWithPasskey as webAuthnLinkPasskey } from '@firebase-web-authn/browser'
import { auth, functions } from './firebase'

const googleProvider = new GoogleAuthProvider()

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithPasskey: () => Promise<void>
  registerPasskey: () => Promise<void>
  signOut: () => Promise<void>
  passkeysSupported: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [passkeysSupported] = useState(() => typeof window !== 'undefined' && !!window.PublicKeyCredential)
  const passkeyInProgress = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.isAnonymous) {
        if (passkeyInProgress.current) {
          return
        }
        firebaseSignOut(auth)
        return
      }
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google sign in failed'
      if (message.includes('popup-closed') || message.includes('cancelled')) {
        setError('popup-closed')
      } else {
        setError(message)
      }
      throw err
    }
  }

  const signInWithEmail = async (email: string, password: string) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed'
      setError(message)
      throw err
    }
  }

  const signInWithPasskey = async () => {
    setError(null)
    passkeyInProgress.current = true
    try {
      await webAuthnSignIn(auth, functions)
      passkeyInProgress.current = false
    } catch (err: unknown) {
      passkeyInProgress.current = false
      let message = 'Passkey sign in failed'
      if (err instanceof Error) {
        message = err.message
      }
      if (message.includes('ADMIN_ONLY_OPERATION') || message.includes('admin-restricted-operation')) {
        message = 'passkey-setup-incomplete'
      }
      if (message.includes('NOT_FOUND') || message.includes('not-found')) {
        message = 'passkey-not-found'
      }
      if (message.includes('Cancelled by user') || message.includes('cancelled')) {
        message = 'popup-closed'
      }
      if (auth.currentUser?.isAnonymous) {
        await firebaseSignOut(auth).catch(() => {})
      }
      setError(message)
      throw err
    }
  }

  const registerPasskey = async () => {
    setError(null)
    try {
      if (!user) {
        throw new Error('You must be signed in to register a passkey')
      }
      const name = user.displayName || user.email || 'User'
      await webAuthnLinkPasskey(auth, functions, name)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Passkey registration failed'
      setError(message)
      throw err
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign out failed'
      setError(message)
      throw err
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signInWithPasskey, registerPasskey, signOut, passkeysSupported, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
