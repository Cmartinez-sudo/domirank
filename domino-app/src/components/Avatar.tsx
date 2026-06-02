/**
 * Avatar de jugador.
 * Si hay avatarUrl, muestra imagen redonda.
 * Si no, muestra iniciales sobre un fondo de color derivado del username.
 */

type Props = {
  player: { username: string; display_name?: string | null; avatar_url?: string | null } | null | undefined;
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
  // Defensa: el caller puede pasar null (e.g., notificación sin actor,
  // partida con jugador huérfano). En lugar del "?" gris, mostramos el
  // logo icon (V3) — más alineado con la marca y reconocible como
  // "system/anonymous player".
  if (!player) {
    const inner = Math.round(size * 0.7);
    return (
      <div
        style={{
          width: size, height: size, borderRadius: "50%",
          background: "var(--bg-2)",
          display: "grid", placeItems: "center", flexShrink: 0,
          overflow: "hidden", userSelect: "none",
        }}
        className={className}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/logo-icon.svg"
          alt=""
          width={inner}
          height={inner}
          style={{ width: inner, height: inner, display: "block" }}
        />
      </div>
    );
  }

  const username = player.username || "?";
  const name = player.display_name || username;
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: "50%",
    display: "grid", placeItems: "center", flexShrink: 0,
    overflow: "hidden", userSelect: "none",
    background: player.avatar_url ? "var(--surface-3)" : colorFor(username),
    color: "white",
    fontWeight: 600,
    fontSize: Math.round(size * 0.4),
    lineHeight: 1,
  };
  if (player.avatar_url) {
    return (
      <div style={style} className={className}>
        {/* width/height declarados para prevenir CLS al cargar */}
        <img
          src={player.avatar_url}
          alt={name}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    );
  }
  return <div style={style} className={className}>{initialsFor(name)}</div>;
}
