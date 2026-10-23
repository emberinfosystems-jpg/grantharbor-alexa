import { useState } from 'react'
import { ShieldCheck, Trash2, Mail, Globe } from 'lucide-react'
import { Card, CardContent, Input, Select, Button, StatusBadge, EmptyState } from '@ember/ui'
import type { useStore } from '../state/useStore'

export default function ApprovedSenders({ store }: { store: ReturnType<typeof useStore> }) {
  const { approvedSenders, addSender, deleteSender } = store
  const [value, setValue] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'domain' | 'email'>('domain')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approved Senders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trusted email addresses and domains that grant alerts may arrive from. On the free tier you import matching
          alerts by hand; Pro watches these automatically.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="text-sm font-semibold">Add a trusted sender</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Select
                options={[{ value: 'domain', label: 'Domain' }, { value: 'email', label: 'Email address' }]}
                value={type}
                onChange={(e) => setType(e.target.value as 'domain' | 'email')}
              />
            </div>
            <Input
              className="min-w-56 flex-1"
              placeholder={type === 'domain' ? 'grants.gov' : 'alerts@grants.gov'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Input className="w-48" placeholder="Label (optional)" value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              onClick={() => {
                if (!value.trim()) return
                addSender({ email_or_domain: value.trim(), sender_name: name.trim() || undefined, sender_type: type })
                setValue(''); setName('')
              }}
            >
              Add Sender
            </Button>
          </div>
        </CardContent>
      </Card>

      {approvedSenders.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="No trusted senders yet"
            message="Add the agencies and newsletters you receive grant alerts from, so GrantHarbor knows which emails to trust."
          />
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul>
              {approvedSenders.map((s) => (
                <li key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                  {s.sender_type === 'domain' ? <Globe size={16} className="text-muted-foreground" /> : <Mail size={16} className="text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{s.email_or_domain}</div>
                    {s.sender_name && <div className="truncate text-xs text-muted-foreground">{s.sender_name}</div>}
                  </div>
                  <StatusBadge tone={s.sender_type === 'domain' ? 'info' : 'neutral'}>{s.sender_type}</StatusBadge>
                  <Button variant="ghost" size="icon" icon={Trash2} onClick={() => deleteSender(s.id)} aria-label="Remove sender" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
