import { useState } from 'react'
import { ClipboardList, Trash2, Pencil, X } from 'lucide-react'
import { Card, CardContent, Input, Textarea, Select, Label, Button, EmptyState } from '@ember/ui'
import { usd } from '../format'
import type { ApplicationProfile } from '../lib/grantTypes'
import type { useStore } from '../state/useStore'

const BUSINESS_TYPES = ['LLC', 'Corporation', 'Partnership', 'Sole Proprietorship', 'Nonprofit', 'Other']
const blank = (): Omit<ApplicationProfile, 'id'> => ({ profile_name: '' })

export default function Apply({ store }: { store: ReturnType<typeof useStore> }) {
  const { profiles, addProfile, updateProfile, deleteProfile } = store
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<ApplicationProfile, 'id'>>(blank())

  const set = (k: keyof ApplicationProfile, v: string | number) => setForm((f) => ({ ...f, [k]: v }))
  const num = (v: string) => (v === '' ? undefined : Number(v))

  function startEdit(p: ApplicationProfile) {
    const { id, ...rest } = p
    setEditingId(id)
    setForm(rest)
  }
  function reset() { setEditingId(null); setForm(blank()) }
  async function save() {
    if (!form.profile_name.trim()) return
    if (editingId) await updateProfile(editingId, form)
    else await addProfile(form)
    reset()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Application Profiles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable business profiles so you don't re-type the same details on every grant application.
        </p>
      </div>

      {profiles.length === 0 ? (
        <Card>
          <EmptyState icon={ClipboardList} title="No profiles yet" message="Create a profile below with your business details, then reuse it across applications." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {profiles.map((p) => (
            <Card key={p.id} accent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.profile_name}</div>
                  <div className="truncate text-sm text-muted-foreground">
                    {p.business_name || '—'}{p.business_type ? ` · ${p.business_type}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" icon={Pencil} onClick={() => startEdit(p)} aria-label="Edit profile" />
                  <Button variant="ghost" size="icon" icon={Trash2} onClick={() => deleteProfile(p.id)} aria-label="Delete profile" />
                </div>
              </div>
              {p.funding_needed != null && (
                <div className="mt-2 text-sm text-muted-foreground">Seeking {usd(p.funding_needed)}{p.funding_purpose ? ` · ${p.funding_purpose}` : ''}</div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{editingId ? 'Edit profile' : 'New profile'}</h2>
            {editingId && <Button variant="ghost" size="sm" icon={X} onClick={reset}>Cancel edit</Button>}
          </div>

          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Profile name *"><Input value={form.profile_name} onChange={(e) => set('profile_name', e.target.value)} placeholder="e.g. Acme Robotics — Core" /></Field>
              <Field label="Applicant name"><Input value={form.applicant_name ?? ''} onChange={(e) => set('applicant_name', e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Phone"><Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            </div>
          </section>

          <section className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Business name"><Input value={form.business_name ?? ''} onChange={(e) => set('business_name', e.target.value)} /></Field>
              <Field label="Business type">
                <Select options={[{ value: '', label: '—' }, ...BUSINESS_TYPES.map((t) => ({ value: t, label: t }))]} value={form.business_type ?? ''} onChange={(e) => set('business_type', e.target.value)} />
              </Field>
              <Field label="EIN"><Input value={form.ein ?? ''} onChange={(e) => set('ein', e.target.value)} /></Field>
              <Field label="Industry"><Input value={form.industry ?? ''} onChange={(e) => set('industry', e.target.value)} /></Field>
              <Field label="Annual revenue ($)"><Input type="number" value={form.annual_revenue ?? ''} onChange={(e) => set('annual_revenue', num(e.target.value) as number)} /></Field>
              <Field label="Employees"><Input type="number" value={form.employees ?? ''} onChange={(e) => set('employees', num(e.target.value) as number)} /></Field>
              <Field label="Funding needed ($)"><Input type="number" value={form.funding_needed ?? ''} onChange={(e) => set('funding_needed', num(e.target.value) as number)} /></Field>
              <Field label="Funding purpose"><Input value={form.funding_purpose ?? ''} onChange={(e) => set('funding_purpose', e.target.value)} /></Field>
            </div>
            <Field label="Mission statement"><Textarea rows={3} value={form.mission_statement ?? ''} onChange={(e) => set('mission_statement', e.target.value)} /></Field>
          </section>

          <div className="flex gap-2">
            <Button onClick={save}>{editingId ? 'Save changes' : 'Create profile'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}
