/**
 * Shown on a Pro-only surface when the account is on Basic.
 *
 * 🛑 It explains and offers, it does not hide. The keyword list below stays usable on Basic
 * — a user can set up exactly what they want found before paying, and their work is waiting
 * the moment they activate. Locking the whole page would mean asking someone to buy
 * something they have never seen do anything.
 */
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '@ember/ui'

export default function ProGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <Lock className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">The ingestion agent is a Pro feature</div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Set up your keywords now — they are saved either way. Pro runs the search and
          brings back the opportunities that match.
        </p>
      </div>
      <Button icon={Sparkles} onClick={onUpgrade}>See Pro</Button>
    </div>
  )
}
