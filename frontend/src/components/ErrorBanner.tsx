export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return <section className="error">{message}</section>;
}
