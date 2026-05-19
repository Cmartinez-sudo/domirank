/**
 * Avatar de jugador.
 * Si hay avatarUrl, muestra imagen redonda.
 * Si no, muestra iniciales sobre un fondo de color derivado del username.
 */

type Props = {
  player: { username: string; display_name?: string | null; avatar_url?: string | null };
  size?: number;
  className?: string;
};

const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#6366f1", "#06b6d4",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
  return h;
}

function colorFor(username: string): string {
  return PALETTE[Math.abs(hashStr(username)) % PALETTE.length];
}

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

export function Avatar({ player, size = 36, className = "" }: Props) {
  const name = player.display_name || player.username;
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%",
    display: "grid", placeItems: "center", flexShrink: 0,
    overflow: "hidden", userSelect: "none",
    background: player.avatar_url ? "var(--surface-3)" : colorFor(player.username),
    color: "white",
    fontWeight: 600,
    fontSize: Math.round(size * 0.4),
    lineHeight: 1,
  };
  if (player.avatar_url) {
    return (
      <div style={style} className={className}>
        <img src={player.avatar_url} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return <div style={style} className={className}>{initialsFor(name)}</div>;
}
