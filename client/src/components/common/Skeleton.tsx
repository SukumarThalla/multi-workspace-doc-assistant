export default function Skeleton({ rows = 3 }) {
  return (
    <div className="skeleton-block" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row" style={{ width: `${85 - i * 12}%` }} />
      ))}
    </div>
  );
}
