/**
 * Account security — change password, and regenerate the offline recovery code.
 *
 * The two halves are deliberately different in kind:
 *   • Change password requires the CURRENT password. PocketBase enforces `oldPassword` on a
 *     user-authenticated update, so a walked-away-from unlocked session cannot be used to
 *     lock the real owner out of their own account.
 *   • Regenerate recovery code also requires the current password, for the same reason —
 *     otherwise it is a one-click way to mint a permanent spare key to someone else's data.
 */
import { useState } from 'react'
import { KeyRound, Lock, AlertTriangle, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Input, Label, Button } from '@ember/ui'
import { changePassword, verifyPassword, currentUserId } from '../lib/db'
import { bridge } from '../lib/bridge'
import RecoveryCode from './RecoveryCode'

export default function SecuritySettings({ email }: { email: string }) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwDone, setPwDone] = useState(false)

  const [codePw, setCodePw] = useState('')
  const [codeBusy, setCodeBusy] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [issued, setIssued] = useState<string | null>(null)

  const canRecover = !!bridge()

  const doChange = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setPwBusy(true); setPwError(''); setPwDone(false)
    try {
      await changePassword(email, oldPw, newPw)
      setPwDone(true); setOldPw(''); setNewPw('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : String(err))
    } finally {
      setPwBusy(false)
    }
  }

  const doIssue = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const api = bridge()
    const uid = currentUserId()
    if (!api || !uid) { setCodeError('Recovery runs in the desktop app.'); return }
    setCodeBusy(true); setCodeError('')
    try {
      // 🛑 Prove it is really them BEFORE minting a key that bypasses the password forever.
      await verifyPassword(email, codePw)
      setIssued(await api.issueRecoveryCode(uid))
      setCodePw('')
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : String(err))
    } finally {
      setCodeBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => void doChange(e)} className="flex max-w-sm flex-col gap-3">
            <div>
              <Label>Current password</Label>
              <Input type="password" required value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <Label>New password</Label>
              <Input type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            {pwError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{pwError}</span>
              </div>
            )}
            {pwDone && (
              <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 p-2.5 text-sm">
                <Check className="h-4 w-4 text-primary" /> Password updated.
              </div>
            )}
            <Button type="submit" icon={Lock} loading={pwBusy} disabled={pwBusy} className="self-start">
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recovery code</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 max-w-prose text-sm text-muted-foreground">
            Your recovery code is the only way back in if you forget your password. It works
            entirely on this computer — no email, and it still works with the network
            unplugged. Generating a new one immediately replaces any previous code.
          </p>
          {!canRecover ? (
            <p className="text-sm text-muted-foreground">Recovery runs in the desktop app.</p>
          ) : (
            <form onSubmit={(e) => void doIssue(e)} className="flex max-w-sm flex-col gap-3">
              <div>
                <Label>Confirm your password</Label>
                <Input type="password" required value={codePw} onChange={(e) => setCodePw(e.target.value)} autoComplete="current-password" />
              </div>
              {codeError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /><span>{codeError}</span>
                </div>
              )}
              <Button type="submit" variant="outline" icon={KeyRound} loading={codeBusy} disabled={codeBusy} className="self-start">
                Generate new recovery code
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {issued && <RecoveryCode code={issued} onDone={() => setIssued(null)} />}
    </>
  )
}
