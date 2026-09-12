// Sprint 1b: fallback avatar cuando el user no subió foto.
// Iniciales del display_name (max 2 chars) sobre color determinístico
// derivado del hash del display_name. Sin dependencias externas.

const PALETTE = [
  "#EF4444", "#F97316", "#F59E0B", "#84CC16",
  "#10B981", "#14B8A6", "#06B6D4", "#3B82F6",
  "#6366F1", "#8B5CF6", "#A855F7", "#EC4899",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function initialsOf(name: string): string {
  const clean = name.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function InitialsAvatar({
  name,
  size = 40,
  ringClass,
}: {
  name: string;
  size?: number;
  ringClass?: string;
}) {
  const initials = initialsOf(name);
  const color = PALETTE[hashString(name) % PALETTE.length];
  const fontSize = Math.round(size * 0.42);

  return (
    <div
      aria-label={`Avatar de ${name}`}
      className={`shrink-0 rounded-full inline-flex items-center justify-center font-semibold text-white ${ringClass ?? ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize,
        lineHeight: 1,
      }}
    >
      {initials}
    </div>
  );
}
