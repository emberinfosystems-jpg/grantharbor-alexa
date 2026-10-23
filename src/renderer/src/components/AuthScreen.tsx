import { useState } from 'react'
import { AuthShell } from '@ember/ui'
// 🛑 Auth calls go through db.ts so they inherit `explained()` — without it PocketBase's
// real reason ("email must be unique", "server not running") is replaced by a shrug.
import { signIn, register, currentUserId } from '../lib/db'
import { bridge } from '../lib/bridge'
import ForgotPassword from './ForgotPassword'
import RecoveryCode from './RecoveryCode'

/**
 * GrantHarbor auth.
 *
 * 🛑 "Forgot password?" is NOT the AuthShell email flow. Verified 2026-08-25 against the
 * shipped `pb_template`: `smtp.enabled = false`, host `smtp.example.com`. PocketBase answers
 * request-password-reset with 204 whether or not the address exists, so the old screen said
 * "Check your email for a reset link" and no email was ever sent, to anyone, ever. It is
 * replaced by an offline recovery-code flow — see ForgotPassword.tsx and main/auth.ts.
 *
 * `onRequestReset` is deliberately omitted so AuthShell hides its own link; ours lives below.
 */
export default function AuthScreen() {
  const [view, setView] = useState<'auth' | 'forgot'>('auth')
  const [newCode, setNewCode] = useState<string | null>(null)

  if (view === 'forgot') return <ForgotPassword onBack={() => setView('auth')} />

  const handleRegister = async (email: string, password: string): Promise<void> => {
    await register(email, password)
    // 🛑 Issue the recovery code immediately after the account exists, while the user is
    // still here to write it down. Deferring it to "later" means the one moment they are
    // guaranteed to be looking at the screen is spent, and lockout stays possible.
    const api = bridge()
    const uid = currentUserId()
    if (api && uid) {
      try {
        setNewCode(await api.issueRecoveryCode(uid))
      } catch {
        // Never block a successful sign-up on this. The account is real and usable; the
        // user can generate a code from Settings, which is exactly what Settings is for.
      }
    }
  }

  return (
    <>
      <AuthShell
        brand="GrantHarbor"
        tagline="Sign in to your grant workspace"
        onSignIn={(email, password) => signIn(email, password)}
        onRegister={handleRegister}
      />

      {/* Rendered outside AuthShell because the shell owns its own form; this is a peer
          route, not a field. Hidden entirely when the bridge is absent (browser preview),
          since a recovery link that cannot recover is the exact problem being fixed here. */}
      {bridge() && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 flex justify-center">
          <button
            type="button"
            onClick={() => setView('forgot')}
            className="pointer-events-auto text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </button>
        </div>
      )}

      {newCode && <RecoveryCode code={newCode} onDone={() => setNewCode(null)} />}
    </>
  )
}
