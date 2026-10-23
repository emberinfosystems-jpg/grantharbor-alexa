/**
 * Offline "I'm locked out" recovery: email + recovery code → new password.
 *
 * Replaces the emailed-reset-link flow, which could never work here — the shipped
 * PocketBase has SMTP disabled, and it answers a reset request with 204 whether or not the
 * address exists, so the old screen promised an email that was never sent to anyone.
 *
 * Everything here happens on this machine. Nothing is transmitted.
 */
import { useState } from 'react'
import { KeyRound, ArrowLeft, AlertTriangle, Check } from 'lucide-react'
import { Card, Input, Label, Button } from '@ember/ui'
import { bridge } from '../lib/bridge'

export default function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const api = bridge()
    if (!api) { setError('Password recovery runs in the desktop app.'); return }
    setBusy(true); setError('')
    try {
      await api.resetWithRecoveryCode(email.trim(), code, password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm p-7">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Password updated</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            That recovery code has now been used up. Generate a fresh one from Settings once
            you are back in.
          </p>
          <Button className="mt-5 w-full" onClick={onBack}>Sign in</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Reset your password</h2>
        </div>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Enter the recovery code you saved when you created your account.
        </p>

        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
          <div>
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" autoFocus />
          </div>
          <div>
            <Label>Recovery code</Label>
            <Input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              className="font-mono tracking-wider"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div>
            <Label>New password</Label>
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" loading={busy} disabled={busy}>Reset password</Button>
          <button type="button" onClick={onBack} className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </button>
        </form>
      </Card>
    </div>
  )
}
