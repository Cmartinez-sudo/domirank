/**
 * Templates HTML para emails transaccionales.
 * HTML inline-styled (compatible con clientes de email).
 * Cada template devuelve { subject, html, text }.
 */

import { getAppUrl } from "./email";

type FriendTemplateInput = {
  fromUsername:    string;
  fromDisplayName: string | null;
};

type MatchTemplateInput = {
  matchId:        string;
  format:         "singles" | "doubles";
  setSize:        "d6" | "d9";
  scoreTeam1:     number;
  scoreTeam2:     number;
  team1Label:     string;
  team2Label:     string;
  winningTeam?:   1 | 2 | null;
};

const BRAND = {
  bg:        "#0a1020",
  card:      "#0f172a",
  border:    "#1e293b",
  primary:   "#10b981",
  text:      "#e2e8f0",
  textDim:   "#94a3b8",
  textMute:  "#64748b",
};

function shell(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};color:${BRAND.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <div style="display:inline-block;width:42px;height:42px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;text-align:center;line-height:42px;font-weight:800;color:#000;font-size:14px;letter-spacing:-0.5px;">DR</div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px 24px;">
                ${bodyHtml}
                ${cta ? `
                <div style="margin-top:24px;">
                  <a href="${escapeAttr(cta.href)}" style="display:inline-block;background:${BRAND.primary};color:#000;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:14px;">${escapeHtml(cta.label)} →</a>
                </div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px 24px;border-top:1px solid ${BRAND.border};color:${BRAND.textMute};font-size:12px;line-height:1.5;">
                Este correo fue enviado por DomiRank. Si no quieres recibir notificaciones de la app,
                puedes desactivarlas en tu <a href="${escapeAttr(getAppUrl())}/settings" style="color:${BRAND.primary};text-decoration:none;">configuración</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/* ============================================================
   FRIEND REQUEST RECEIVED
   ============================================================ */

export function friendRequestEmail(input: FriendTemplateInput) {
  const { fromUsername, fromDisplayName } = input;
  const displayName = fromDisplayName || fromUsername;
  const url = `${getAppUrl()}/friends?tab=incoming`;

  return {
    subject: `@${fromUsername} quiere ser tu amigo en DomiRank`,
    html: shell(
      `${displayName} quiere ser tu amigo`,
      `
      <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND.text};">Tienes una solicitud de amistad</h1>
      <p style="margin:0;color:${BRAND.textDim};font-size:15px;line-height:1.5;">
        <strong style="color:${BRAND.text};">${escapeHtml(displayName)}</strong> (<span style="color:${BRAND.primary};">@${escapeHtml(fromUsername)}</span>) quiere conectarse contigo en DomiRank.
      </p>
      <p style="margin:12px 0 0 0;color:${BRAND.textDim};font-size:14px;line-height:1.5;">
        Cuando aceptes, podrán crear partidas y torneos juntos y ver sus ratings en mutuo.
      </p>
      `,
      { label: "Ver solicitud", href: url }
    ),
    text: `${displayName} (@${fromUsername}) quiere ser tu amigo en DomiRank.\n\nResponde aquí: ${url}`,
  };
}

/* ============================================================
   FRIEND REQUEST ACCEPTED
   ============================================================ */

export function friendAcceptedEmail(input: FriendTemplateInput) {
  const { fromUsername, fromDisplayName } = input;
  const displayName = fromDisplayName || fromUsername;
  const url = `${getAppUrl()}/profile/${fromUsername}`;

  return {
    subject: `@${fromUsername} aceptó tu solicitud — ya pueden jugar`,
    html: shell(
      `${displayName} aceptó tu solicitud`,
      `
      <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND.text};">¡Ya son amigos!</h1>
      <p style="margin:0;color:${BRAND.textDim};font-size:15px;line-height:1.5;">
        <strong style="color:${BRAND.text};">${escapeHtml(displayName)}</strong> (<span style="color:${BRAND.primary};">@${escapeHtml(fromUsername)}</span>) aceptó tu solicitud.
      </p>
      <p style="margin:12px 0 0 0;color:${BRAND.textDim};font-size:14px;line-height:1.5;">
        Ya pueden crear partidas y torneos juntos. Su rating se actualiza después de cada partida.
      </p>
      `,
      { label: "Ver perfil", href: url }
    ),
    text: `${displayName} (@${fromUsername}) aceptó tu solicitud de amistad en DomiRank.\n\nVer perfil: ${url}`,
  };
}

/* ============================================================
   MATCH HELPERS
   ============================================================ */

function modalityLabel(format: "singles" | "doubles", setSize: "d6" | "d9"): string {
  const f = format === "singles" ? "Individual" : "Pareja";
  const s = setSize === "d6" ? "Doble 6" : "Doble 9";
  return `${f} · ${s}`;
}

function scoreLine(input: MatchTemplateInput): string {
  return `${escapeHtml(input.team1Label)} ${input.scoreTeam1} — ${input.scoreTeam2} ${escapeHtml(input.team2Label)}`;
}

/* ============================================================
   MATCH PENDING_ATTESTATION — "confirma el resultado"
   Enviado a los 3 jugadores no-scorekeeper cuando el creador
   finaliza la partida.
   ============================================================ */

export function matchAttestRequestedEmail(input: MatchTemplateInput) {
  const url = `${getAppUrl()}/matches/${input.matchId}`;
  return {
    subject: `Confirma el resultado de tu partida`,
    html: shell(
      "Confirma el resultado",
      `
      <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND.text};">¿El resultado es correcto?</h1>
      <p style="margin:0 0 12px 0;color:${BRAND.textDim};font-size:15px;line-height:1.5;">
        Acaba de finalizar tu partida (<span style="color:${BRAND.text};">${escapeHtml(modalityLabel(input.format, input.setSize))}</span>).
        El sistema necesita que confirmes el marcador antes de aplicar el rating.
      </p>
      <div style="margin:16px 0;padding:14px 16px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;color:${BRAND.text};font-size:16px;font-weight:700;text-align:center;letter-spacing:0.5px;">
        ${scoreLine(input)}
      </div>
      <p style="margin:0;color:${BRAND.textDim};font-size:14px;line-height:1.5;">
        Si están de acuerdo 3 de los 4 jugadores, el rating se aplica automáticamente.
        Si no firmas en 7 días, se confirma sola.
      </p>
      `,
      { label: "Firmar o disputar", href: url }
    ),
    text: `Confirma tu partida en DomiRank.\n\n${input.team1Label} ${input.scoreTeam1} — ${input.scoreTeam2} ${input.team2Label}\n\nFirma o disputa aquí: ${url}`,
  };
}

/* ============================================================
   MATCH CONFIRMED — "tu rating se actualizó"
   Enviado a los 4 jugadores cuando se alcanza quórum
   (o admin confirma, o auto-confirm tras 7 días).
   ============================================================ */

export function matchConfirmedEmail(input: MatchTemplateInput & { auto?: boolean }) {
  const url = `${getAppUrl()}/matches/${input.matchId}`;
  const winnerLabel = input.winningTeam === 1 ? input.team1Label
                    : input.winningTeam === 2 ? input.team2Label
                    : null;
  const headline = winnerLabel
    ? `Ganador: ${winnerLabel}`
    : "Partida confirmada";
  const subline = input.auto
    ? "Pasaron 7 días sin disputas, así que se confirmó automáticamente."
    : "Los jugadores firmaron el resultado y el rating ya se aplicó.";

  return {
    subject: `Tu partida fue confirmada${winnerLabel ? ` — ${winnerLabel}` : ""}`,
    html: shell(
      "Partida confirmada",
      `
      <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND.text};">${escapeHtml(headline)}</h1>
      <p style="margin:0 0 12px 0;color:${BRAND.textDim};font-size:15px;line-height:1.5;">
        ${escapeHtml(subline)}
      </p>
      <div style="margin:16px 0;padding:14px 16px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;color:${BRAND.text};font-size:16px;font-weight:700;text-align:center;letter-spacing:0.5px;">
        ${scoreLine(input)}
      </div>
      <p style="margin:0;color:${BRAND.textDim};font-size:14px;line-height:1.5;">
        Modalidad: ${escapeHtml(modalityLabel(input.format, input.setSize))}.
        Tu rating ya refleja el resultado en el leaderboard.
      </p>
      `,
      { label: "Ver detalle", href: url }
    ),
    text: `${headline}\n\n${input.team1Label} ${input.scoreTeam1} — ${input.scoreTeam2} ${input.team2Label}\nModalidad: ${modalityLabel(input.format, input.setSize)}\n\n${subline}\n\nDetalle: ${url}`,
  };
}

/* ============================================================
   MATCH DISPUTED — "la partida pasó a disputa"
   Enviado a los 4 jugadores cuando se alcanzan 2+ disputas
   y no hay quórum para confirmar.
   ============================================================ */

export function matchDisputedEmail(input: MatchTemplateInput) {
  const url = `${getAppUrl()}/matches/${input.matchId}`;
  return {
    subject: `Tu partida pasó a disputa`,
    html: shell(
      "Partida en disputa",
      `
      <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;color:${BRAND.text};">No hay acuerdo sobre el resultado</h1>
      <p style="margin:0 0 12px 0;color:${BRAND.textDim};font-size:15px;line-height:1.5;">
        Dos o más jugadores marcaron como disputado el marcador de tu partida
        (<span style="color:${BRAND.text};">${escapeHtml(modalityLabel(input.format, input.setSize))}</span>).
        El rating queda congelado hasta que un administrador resuelva.
      </p>
      <div style="margin:16px 0;padding:14px 16px;background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:10px;color:${BRAND.text};font-size:16px;font-weight:700;text-align:center;letter-spacing:0.5px;">
        ${scoreLine(input)}
      </div>
      <p style="margin:0;color:${BRAND.textDim};font-size:14px;line-height:1.5;">
        Si tienes contexto del problema (mano mal anotada, error de cálculo),
        agrégalo en los comentarios de la partida para acelerar la resolución.
      </p>
      `,
      { label: "Ver disputa", href: url }
    ),
    text: `Tu partida en DomiRank entró en disputa.\n\n${input.team1Label} ${input.scoreTeam1} — ${input.scoreTeam2} ${input.team2Label}\nModalidad: ${modalityLabel(input.format, input.setSize)}\n\nVer disputa: ${url}`,
  };
}
