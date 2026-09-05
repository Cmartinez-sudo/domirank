"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { PendingIcon, CheckCircleIcon, AlertTriangleIcon, SlashIcon } from "@/components/icons";
import { attestMatch } from "@/lib/match-attest-actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { analytics } from "@/lib/analytics";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export type AttestationStatus = "pending_attestation" | "confirmed" | "disputed" | "void";

export type AttestPlayer = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Attestation = {
  user_id: string;
  action: "confirm" | "dispute";
  comment: string | null;
  created_at: string;
};

type Props = {
  matchId: string;
  status: AttestationStatus;
  scorekeeperId: string | null;
  viewerId: string;
  players: AttestPlayer[];
  attestations: Attestation[];
  finalizedAt: string | null;
  /** Si confirmed, delta de rating del viewer aplicado por esta partida */
  ratingDelta?: number | null;
};

function relTime(iso: string): string {
  const sec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return "ahora";
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  return `hace ${Math.round(hr / 24)} d`;
}

function daysUntilAutoConfirm(finalizedAt: string | null): number {
  if (!finalizedAt) return 0;
  const finalized = new Date(finalizedAt).getTime();
  const expires = finalized + 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expires - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function AttestationPanel(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [pending, setPending]       = useState(false);
  const [reportText, setReportText] = useState("");

  const isParticipant = props.players.some((p) => p.user_id === props.viewerId);

  // Sprint 3: deeplink #attestation desde emails/notifs. Scrollea al panel
  // si el hash coincide (participantes) — bypasses lo que haya arriba (header,
  // cancelation banner, scorecard). scroll-margin en el wrapper evita quedar
  // debajo del top bar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#attestation") return;
    if (!isParticipant) return;
    // requestAnimationFrame para que corra tras el layout inicial.
    requestAnimationFrame(() => {
      document
        .getElementById("attestation")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [isParticipant]);

  // Realtime: cualquier nueva attestation sobre esta partida → refresh
  // Nombre único por mount para evitar conflict de canal existente
  useEffect(() => {
    if (!isParticipant) return;
    const supabase = supabaseBrowser();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`attest:${props.matchId}:${Math.random().toString(36).slice(2, 9)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "match_attestations", filter: `match_id=eq.${props.matchId}` },
          () => router.refresh()
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${props.matchId}` },
          () => router.refresh()
        )
        .subscribe();
    } catch (e) {
      console.error("[AttestationPanel] subscribe failed:", e);
    }
    return () => {
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.matchId, isParticipant]);

  if (!isParticipant) {
    return <StatusBanner status={props.status} hideDetail />;
  }

  const myAttestation = props.attestations.find((a) => a.user_id === props.viewerId);
  const confirms = props.attestations.filter((a) => a.action === "confirm").length;
  const disputes = props.attestations.filter((a) => a.action === "dispute").length;
  const totalPlayers = props.players.length;
  const remainingForQuorum = Math.max(0, 3 - confirms);
  const daysLeft = daysUntilAutoConfirm(props.finalizedAt);

  async function run(action: "confirm" | "dispute", comment?: string) {
    setPending(true);
    const r = await attestMatch(props.matchId, action, comment);
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    analytics.track("match_attested", { match_id: props.matchId, action });
    if (r.newStatus === "confirmed") {
      toast.success("Resultado confirmado · rating aplicado");
      if (r.groupAttributions && r.groupAttributions.length > 0) {
        const names = r.groupAttributions.join(" · ");
        toast.success(
          r.groupAttributions.length === 1
            ? `Cuenta para el grupo ${names}`
            : `Cuenta para los grupos ${names}`,
        );
      }
    } else if (r.newStatus === "disputed") {
      toast.info("Partida en disputa — esperando resolución");
    } else {
      toast.success(action === "confirm" ? "Firmaste el resultado" : "Reportaste un problema");
    }
    router.refresh();
  }

  function submitReport() {
    run("dispute", reportText.trim() || undefined);
    setReportOpen(false);
    setReportText("");
  }

  return (
    <AnimatePresence mode="wait">
      <motion.section
        id="attestation"
        key={props.status}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: EASE_OUT }}
        className="card scroll-mt-20"
      >
        <StatusHeader
          status={props.status}
          confirms={confirms}
          disputes={disputes}
          remaining={remainingForQuorum}
          daysLeft={daysLeft}
          ratingDelta={props.ratingDelta}
        />

        <div className="mt-4 space-y-2">
          {props.players.map((p) => (
            <PlayerRow
              key={p.user_id}
              player={p}
              attestation={props.attestations.find((a) => a.user_id === p.user_id)}
              isScorekeeper={p.user_id === props.scorekeeperId}
              isViewer={p.user_id === props.viewerId}
            />
          ))}
        </div>

        {props.status === "pending_attestation" && (
          <div className="mt-5 space-y-2">
            {!myAttestation && (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={pending}
                  onClick={() => run("confirm")}
                >
                  {pending ? "…" : "Confirmar resultado"}
                </button>
                <button
                  type="button"
                  className="btn-ghost flex-1 text-text-mute hover:text-danger border-danger/20 hover:border-danger/40"
                  disabled={pending}
                  onClick={() => setReportOpen(true)}
                >
                  Reportar problema
                </button>
              </div>
            )}
            {myAttestation?.action === "confirm" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="text-text-mute text-sm flex-1">
                  Ya firmaste. ¿Cambió tu opinión?
                </div>
                <button
                  type="button"
                  className="text-danger text-sm underline-offset-2 hover:underline"
                  disabled={pending}
                  onClick={() => setReportOpen(true)}
                >
                  Cambiar a reportar problema
                </button>
              </div>
            )}
            {myAttestation?.action === "dispute" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <div className="text-text-mute text-sm flex-1">
                  Reportaste un problema. ¿Lo resolviste?
                </div>
                <button
                  type="button"
                  className="text-primary text-sm underline-offset-2 hover:underline"
                  disabled={pending}
                  onClick={() => run("confirm")}
                >
                  Cambiar a confirmar
                </button>
              </div>
            )}
          </div>
        )}

        {props.status === "disputed" && (
          <DisputeDetails attestations={props.attestations} players={props.players} />
        )}

        <AnimatePresence>
          {reportOpen && (
            <ReportDialog
              onCancel={() => { setReportOpen(false); setReportText(""); }}
              onSubmit={submitReport}
              text={reportText}
              setText={setReportText}
              pending={pending}
            />
          )}
        </AnimatePresence>
      </motion.section>
    </AnimatePresence>
  );
}

/* ──────────── Sub-components ──────────── */

function StatusHeader({
  status, confirms, disputes, remaining, daysLeft, ratingDelta,
}: {
  status: AttestationStatus;
  confirms: number;
  disputes: number;
  remaining: number;
  daysLeft: number;
  ratingDelta?: number | null;
}) {
  if (status === "pending_attestation") {
    return (
      <div>
        <div className="flex items-center gap-2 text-warning">
          <PendingIcon size={20} />
          <h3 className="font-semibold">Pendiente de confirmación</h3>
        </div>
        <p className="text-text-dim text-sm mt-2">
          Necesitamos {remaining > 0 ? `${remaining} firma${remaining === 1 ? "" : "s"} más` : "que se evalúe el quórum"} para que esta partida afecte el rating.
          {daysLeft > 0 && (
            <> Se auto-confirma en {daysLeft} día{daysLeft === 1 ? "" : "s"} si nadie reporta problema.</>
          )}
        </p>
        {disputes > 0 && (
          <p className="text-danger text-sm mt-2">
            {disputes} jugador{disputes === 1 ? "" : "es"} reportó un problema. Si llega a 2, la partida pasa a disputa.
          </p>
        )}
      </div>
    );
  }
  if (status === "confirmed") {
    return (
      <div>
        <div className="flex items-center gap-2 text-primary">
          <CheckCircleIcon size={20} />
          <h3 className="font-semibold">Resultado confirmado</h3>
        </div>
        {ratingDelta != null && (
          <p className="text-text-dim text-sm mt-2">
            Aplicado a tu rating: <span className={`font-mono font-semibold ${ratingDelta >= 0 ? "text-primary" : "text-danger"}`}>
              {ratingDelta >= 0 ? "+" : ""}{ratingDelta.toFixed(2)}
            </span>
          </p>
        )}
      </div>
    );
  }
  if (status === "disputed") {
    return (
      <div>
        <div className="flex items-center gap-2 text-danger">
          <AlertTriangleIcon size={20} />
          <h3 className="font-semibold">Partida en disputa</h3>
        </div>
        <p className="text-text-dim text-sm mt-2">
          Hay 2 o más reportes sobre esta partida. No afecta el rating hasta que un admin la resuelva.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-2 text-text-mute">
        <SlashIcon size={20} />
        <h3 className="font-semibold">Partida anulada</h3>
      </div>
      <p className="text-text-dim text-sm mt-2">
        Esta partida fue marcada como no contar. No afecta al rating de los jugadores.
      </p>
    </div>
  );
}

function StatusBanner({ status, hideDetail }: { status: AttestationStatus; hideDetail?: boolean }) {
  if (status === "pending_attestation") {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-warning">
          <PendingIcon size={20} />
          <h3 className="font-semibold">Pendiente de confirmación</h3>
        </div>
        {!hideDetail && (
          <p className="text-text-dim text-sm mt-2">Esperando a que los jugadores firmen el resultado.</p>
        )}
      </div>
    );
  }
  if (status === "confirmed") return null;
  return <StatusHeader status={status} confirms={0} disputes={0} remaining={0} daysLeft={0} />;
}

function PlayerRow({
  player,
  attestation,
  isScorekeeper,
  isViewer,
}: {
  player: AttestPlayer;
  attestation?: Attestation;
  isScorekeeper: boolean;
  isViewer: boolean;
}) {
  let icon: React.ReactNode = <PendingIcon size={20} className="text-text-mute" />;
  let label: string = "pendiente";
  let labelColor = "text-text-mute";

  if (attestation?.action === "confirm") {
    icon = <CheckCircleIcon size={20} className="text-primary" />;
    label = isScorekeeper ? "firmó · scorekeeper" : `firmó · ${relTime(attestation.created_at)}`;
    labelColor = "text-primary";
  } else if (attestation?.action === "dispute") {
    icon = <AlertTriangleIcon size={20} className="text-danger" />;
    label = `reportó problema · ${relTime(attestation.created_at)}`;
    labelColor = "text-danger";
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-surface-2 rounded-xl">
      <span className="select-none flex-shrink-0" aria-hidden>{icon}</span>
      <Avatar player={player as any} size={32} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">
          {isViewer ? "Tú" : (player.display_name || player.username)}
          {isScorekeeper && !attestation && (
            <span className="text-text-mute text-xs ml-2">· scorekeeper</span>
          )}
        </div>
        <div className={`text-xs ${labelColor}`}>{label}</div>
      </div>
    </div>
  );
}

function DisputeDetails({
  attestations,
  players,
}: {
  attestations: Attestation[];
  players: AttestPlayer[];
}) {
  const disputes = attestations.filter((a) => a.action === "dispute");
  if (disputes.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      <div className="text-text-mute text-xs uppercase tracking-wider font-semibold">
        Reportes
      </div>
      {disputes.map((d) => {
        const player = players.find((p) => p.user_id === d.user_id);
        return (
          <div key={d.user_id} className="flex items-start gap-3 p-3 bg-danger/5 border border-danger/20 rounded-xl">
            <span className="text-danger select-none flex-shrink-0" aria-hidden>
              <AlertTriangleIcon size={20} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">
                {player?.display_name || player?.username || "Jugador"}
              </div>
              <div className="text-text-dim text-sm mt-0.5">
                {d.comment || <span className="italic text-text-mute">Sin comentario</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportDialog({
  onCancel,
  onSubmit,
  text,
  setText,
  pending,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  text: string;
  setText: (s: string) => void;
  pending: boolean;
}) {
  const dialogRef = useFocusTrap<HTMLDivElement>({
    enabled: true,
    onEscape: () => { if (!pending) onCancel(); },
  });
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !pending) onCancel(); }}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-2xl"
      >
        <h2 id="report-dialog-title" className="text-xl font-bold">Reportar problema</h2>
        <p className="text-text-dim text-sm">
          ¿Qué no cuadra con el resultado? (opcional)
        </p>
        <textarea
          className="input min-h-[100px] resize-none"
          placeholder="Ej: el score final es incorrecto…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <p className="text-text-mute text-xs">
          Al reportar, esta partida se marca como en disputa si llega a 2 reportes y no afecta el rating hasta resolverse.
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={onCancel} disabled={pending}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn-primary flex-1 bg-danger/90 hover:bg-danger shadow-none"
            onClick={onSubmit}
            disabled={pending}
          >
            {pending ? "Reportando…" : "Reportar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
