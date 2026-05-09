interface Props {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ url, name, size = 48, className = '' }: Props) {
  const letter = (name?.[0] ?? '?').toUpperCase();
  const dim = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={dim}
        className={`rounded-xl object-cover border border-gold/20 bg-velvet ${className}`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      style={dim}
      className={`rounded-xl bg-velvet flex items-center justify-center text-bone font-display border border-gold/20 ${className}`}
    >
      <span style={{ fontSize: size * 0.45 }}>{letter}</span>
    </div>
  );
}
