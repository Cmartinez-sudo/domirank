import Link from "next/link";
import { Avatar } from "@/components/Avatar";

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  global_display: number;
  win_rate: number;
};

export function FriendsPreview({ rows, myId }: { rows: Row[]; myId: string }) {
  if (rows.length === 0) return null;
  const top = rows.slice(0, 5);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Ranking entre amigos</h2>
        <Link href="/leaderboard?scope=friends" className="text-sm text-primary hover:underline">Ver todos →</Link>
      </div>
      <ol className="space-y-2">
        {top.map((r, i) => {
          const isMe = r.id === myId;
          return (
            <li key={r.id} className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isMe ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}>
              <span className="w-6 text-center text-sm text-text-mute font-mono">{i + 1}</span>
              <Avatar player={r} size={32} />
              <Link href={`/profile/${r.username}`} className="flex-1 min-w-0 truncate text-sm font-semibold hover:underline">
                {r.display_name || r.username}
              </Link>
              <span className="font-mono text-sm tabular-nums">{Number(r.global_display).toFixed(1)}</span>
              <span className="text-xs text-text-mute tabular-nums w-12 text-right">{(Number(r.win_rate) * 100).toFixed(0)}%</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
