"use client";

// Sprint 1b: primera pantalla post-onboarding.
// Variantes:
//   - "standard": Header + 3 CTAs (Invitar WhatsApp / Crear grupo / Crear partida)
//     + link "Solo explorar por ahora".
//   - "referred": Header con el referrer + Add friend + 3 CTAs orientados
//     a jugar/agrupar con el referrer.
//
// Se re-muestra cada apertura del dashboard hasta que el user cumpla
// first_valuable_action_at != null O hasta que descarte 3 veces.

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { dismissP1 } from "@/app/onboarding/actions";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { sendFriendRequest } from "@/lib/friends";

type Referrer = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  rating_display: number | null;
  is_rated: boolean;
  first_group_with_code: { id: string; name: string; join_code: string } | null;
};

export function P1({
  currentUserId,
  currentDisplayName,
  invitesSentCount,
  referrer,
  origin,
}: {
  currentUserId: string;
  currentDisplayName: string;
  invitesSentCount: number;
  referrer: Referrer | null;
  origin: string; // e.g. "https://domirank.app"
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [friendAdded, setFriendAdded] = useState(false);
  const [friendPending, setFriendPending] = useState(false);

  const variant = referrer ? "referred" : "standard";
  const inviteLink = `${origin}/?ref=${currentUserId}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(
    referrer
      ? `Me estoy uniendo a DomiRank — ¿te sumas? ${inviteLink}`
      : `Únete a mí en DomiRank — la app de ranking de dominó: ${inviteLink}`,
  )}`;

  // Fire p1_screen_viewed once on mount.
  if (typeof window !== "undefined") {
    // Idempotencia soft: solo primer render de la page. React StrictMode dispara
    // 2x en dev pero PostHog dedupe por event+timestamp.
    void 0;
  }

  function trackView() {
    analytics.track("p1_screen_viewed", {
      variant,
      invites_sent_count: invitesSentCount,
    });
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useOnMount(trackView);

  function tap(cta: string, href: string | null) {
    analytics.track("p1_cta_tapped", { variant, cta });
    if (cta === "invite_whatsapp" || cta === "invite_more") {
      analytics.track("first_invite_sent", { via: "whatsapp" });
    }
    if (href) window.location.assign(href);
  }

  async function handleAddFriend() {
    if (!referrer) return;
    setFriendPending(true);
    try {
      const r = await sendFriendRequest(referrer.id);
      if (r.ok) {
        setFriendAdded(true);
        analytics.track("p1_cta_tapped", { variant, cta: "add_friend" });
      }
    } finally {
      setFriendPending(false);
    }
  }

  function handleDismiss() {
    analytics.track("p1_dismissed", { variant });
    startTransition(async () => {
      await dismissP1();
      router.refresh();
    });
  }

  if (variant === "referred" && referrer) {
    return (
      <div className="max-w-md mx-auto space-y-5 py-4">
        <div className="text-center space-y-2">
          {referrer.avatar_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={referrer.avatar_url}
              alt={referrer.display_name ?? referrer.username}
              className="w-16 h-16 rounded-full object-cover mx-auto"
            />
          ) : (
            <div className="mx-auto w-fit">
              <InitialsAvatar
                name={referrer.display_name ?? referrer.username}
                size={64}
              />
            </div>
          )}
          <h1 className="text-2xl font-bold">
            {referrer.display_name ?? referrer.username} te invitó a DomiRank
          </h1>
          {referrer.rating_display != null && referrer.is_rated && (
            <p className="text-text-mute text-sm">
              Su DomiRank: <span className="font-mono font-bold text-primary">{referrer.rating_display.toFixed(1)}</span>
            </p>
          )}
        </div>

        {!friendAdded && (
          <div className="card flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold">Añadir a {referrer.display_name ?? referrer.username} como amigo</div>
              <p className="text-text-mute text-xs">Verás sus partidas y estadísticas.</p>
            </div>
            <button
              type="button"
              className="btn-primary !min-h-0 !py-1.5 !px-3 text-sm"
              onClick={handleAddFriend}
              disabled={friendPending}
            >
              {friendPending ? "…" : "Añadir"}
            </button>
          </div>
        )}
        {friendAdded && (
          <div className="card text-center text-sm text-primary">
            ✓ Solicitud enviada
          </div>
        )}

        <div className="space-y-2">
          <Link
            href={`/matches/new?preload=${referrer.id}`}
            className="btn-primary w-full text-center"
            onClick={() => tap("match_with_referrer", null)}
          >
            Registrar una partida con {referrer.display_name ?? referrer.username}
          </Link>

          {referrer.first_group_with_code && (
            <Link
              href={`/g/${referrer.first_group_with_code.join_code}`}
              className="btn-secondary w-full text-center"
              onClick={() => tap("join_referrer_group", null)}
            >
              Unirme al grupo: {referrer.first_group_with_code.name}
            </Link>
          )}

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary w-full text-center"
            onClick={() => tap("invite_more", null)}
          >
            Invitar a más de mi mesa
          </a>
        </div>

        <div className="text-center">
          <button
            type="button"
            className="text-text-mute text-xs hover:text-text"
            onClick={handleDismiss}
          >
            Solo explorar por ahora →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-5 py-4">
      <div className="text-center space-y-2">
        <div className="mx-auto w-fit">
          <InitialsAvatar name={currentDisplayName} size={64} />
        </div>
        <h1 className="text-2xl font-bold">Hola, {currentDisplayName}</h1>
        <p className="text-text-dim">El dominó no se juega solo.</p>
      </div>

      <div className="space-y-2">
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary w-full text-center"
          onClick={() => tap("invite_whatsapp", null)}
        >
          {invitesSentCount > 0
            ? `Invitar a más (invitaste a ${invitesSentCount})`
            : "Invitar por WhatsApp"}
        </a>
        <Link
          href="/groups/new"
          className="btn-secondary w-full text-center"
          onClick={() => tap("create_group", null)}
        >
          Crear un grupo
        </Link>
        <Link
          href="/matches/new"
          className="btn-secondary w-full text-center"
          onClick={() => tap("create_match", null)}
        >
          Ya tengo mi mesa, crear partida
        </Link>
      </div>

      <div className="text-center">
        <button
          type="button"
          className="text-text-mute text-xs hover:text-text"
          onClick={handleDismiss}
        >
          Solo explorar por ahora →
        </button>
      </div>
    </div>
  );
}

// Tiny helper to fire an effect once on mount without complicating imports.
function useOnMount(fn: () => void) {
  const [done, setDone] = useState(false);
  if (!done && typeof window !== "undefined") {
    setDone(true);
    setTimeout(fn, 0);
  }
}
