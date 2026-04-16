interface Props { error: string | null }

export default function ErrorBanner({ error }: Props) {
  if (!error) return null;
  return <div className="error-banner">{error}</div>;
}
