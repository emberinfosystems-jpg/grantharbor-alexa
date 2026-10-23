interface Props {
  label: string
  value: string
  tone?: 'danger' | 'success' | 'warning'
}

export default function StatCard({ label, value, tone }: Props) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${tone ? ' ' + tone : ''}`}>{value}</div>
    </div>
  )
}
