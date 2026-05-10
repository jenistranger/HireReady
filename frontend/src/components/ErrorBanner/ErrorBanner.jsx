export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="error-banner">
      <span>{message}</span>
    </div>
  )
}
