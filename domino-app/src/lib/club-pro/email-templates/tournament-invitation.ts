import { escapeHtml } from './escape-html';

export type TournamentInvitationInput = {
  recipientName: string;
  tournamentName: string;
  orgName: string;
  orgLogoUrl?: string;
  /** Hex color, e.g. "#0066cc". Used for header band. */
  orgBrandColor?: string;
  venue?: string;
  /** ISO timestamp; formatted by Intl.DateTimeFormat in the template. */
  scheduledStartAt: string;
  partnerName: string;
  claimUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function formatDate(iso: string): string {
  // Defensive: invalid ISO → return as-is so tests don't depend on locale.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function tournamentInvitationEmail(input: TournamentInvitationInput): RenderedEmail {
  const {
    recipientName,
    tournamentName,
    orgName,
    orgLogoUrl,
    orgBrandColor,
    venue,
    scheduledStartAt,
    partnerName,
    claimUrl,
  } = input;

  // Safe defaults — if a value is missing, the template degrades gracefully.
  const brandColor = orgBrandColor && /^#[0-9a-f]{6}$/i.test(orgBrandColor) ? orgBrandColor : '#0f172a';
  const safeName = escapeHtml(recipientName);
  const safeTournament = escapeHtml(tournamentName);
  const safeOrg = escapeHtml(orgName);
  const safePartner = escapeHtml(partnerName);
  const safeVenue = venue ? escapeHtml(venue) : '';
  const safeClaimUrl = escapeHtml(claimUrl);

  const subject = `${orgName} — Invitación al torneo "${tournamentName}"`;

  const dateFormatted = formatDate(scheduledStartAt);

  const headerInner = orgLogoUrl
    ? `<img src="${escapeHtml(orgLogoUrl)}" alt="${safeOrg}" style="max-height:48px;display:block;margin:0 auto" />`
    : `<div style="font-size:24px;font-weight:700;color:#ffffff;text-align:center">${safeOrg}</div>`;

  const venueBlock = safeVenue
    ? `<p style="margin:0 0 12px 0"><strong>Lugar:</strong> ${safeVenue}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background-color:#f5f5f5;color:#0f172a">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5;padding:24px 0">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden">
          <tr>
            <td style="background-color:${brandColor};padding:24px">
              ${headerInner}
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700">Hola ${safeName},</h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5">
                ${safeOrg} te invita a participar en el torneo
                <strong>${safeTournament}</strong>.
              </p>
              <div style="margin:24px 0;padding:20px;background:#f8fafc;border-radius:6px;border-left:4px solid ${brandColor}">
                <p style="margin:0 0 12px 0"><strong>Pareja:</strong> ${safeName} &amp; ${safePartner}</p>
                <p style="margin:0 0 12px 0"><strong>Fecha:</strong> ${escapeHtml(dateFormatted)}</p>
                ${venueBlock}
              </div>
              <p style="margin:24px 0 12px 0;font-size:15px;line-height:1.5">
                Para participar necesitás activar tu cuenta en DomiRank.
              </p>
              <p style="margin:0 0 32px 0">
                <a href="${safeClaimUrl}"
                   style="display:inline-block;padding:12px 24px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px">
                  Activar mi cuenta
                </a>
              </p>
              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
                Si el botón no funciona, copiá este enlace:<br />
                <span style="word-break:break-all">${safeClaimUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center">
                Este email fue enviado por ${safeOrg} a través de DomiRank.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hola ${recipientName},

${orgName} te invita al torneo "${tournamentName}".

Pareja: ${recipientName} & ${partnerName}
Fecha: ${dateFormatted}${venue ? `\nLugar: ${venue}` : ''}

Para participar, activá tu cuenta acá:
${claimUrl}

Si el enlace no funciona, copialo y pegalo en tu navegador.

— ${orgName} via DomiRank`;

  return { subject, html, text };
}
