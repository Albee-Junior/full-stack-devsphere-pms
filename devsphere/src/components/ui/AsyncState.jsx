export function LoadingState({ label = "Loading your workspace…" }) {
  return <div className="async-state" role="status"><span className="loading-spinner" />{label}</div>;
}

export function ErrorState({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="api-error" role="alert">
      <span>{error}</span>
      {onRetry && <button className="text-button" onClick={onRetry}>Try again</button>}
    </div>
  );
}
