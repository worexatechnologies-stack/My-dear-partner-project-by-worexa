export default function Loading() {
  return <div className="route-skeleton" role="status" aria-label="Loading page">
    <div className="route-skeleton-inner">
      <div className="skeleton-line" style={{ width: '22%' }} />
      <div className="skeleton-line" style={{ width: '58%', height: '3rem' }} />
      <div className="skeleton-line" style={{ width: '45%' }} />
      <div className="content-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div>
    </div>
  </div>;
}
