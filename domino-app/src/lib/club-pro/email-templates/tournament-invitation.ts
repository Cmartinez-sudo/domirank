import { escapeHtml, safeUrl } from './escape-html';

export type TournamentInvitationInput = {
  recipientName: string;
  partnerName: string;
  tournamentName: string;
  orgName: string;
  orgLogoUrl?: string;
  /** Per-tournament metric — drives explanation text in the body. */
  targetPoints: number;
  roundsCount: number;
  roundDurationMinutes: number;
  /** Optional sponsor logos uploaded in /admin/.../settings. */
  sponsor1LogoUrl?: string;
  sponsor2LogoUrl?: string;
  /** URL of the DomiRank waitlist landing. CTA target. */
  waitlistUrl: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

// ─── Brand tokens (mirror domino-app/tailwind.config.ts) ──────────────────────
const C = {
  bg: '#0a1020',
  surface: '#131c30',
  surface2: '#18233c',
  surface3: '#1f2c49',
  border: 'rgba(255,255,255,0.07)',
  text: '#eef2ff',
  textDim: '#a6b0c8',
  textMute: '#8a93b0',
  primary: '#10b981',
  primary2: '#059669',
} as const;

const DOMIRANK_LOGO_URL = 'https://domirank.app/branding/logo-square-tagline.svg';

export function tournamentInvitationEmail(input: TournamentInvitationInput): RenderedEmail {
  const {
    recipientName,
    partnerName,
    tournamentName,
    orgName,
    orgLogoUrl,
    targetPoints,
    roundsCount,
    roundDurationMinutes,
    sponsor1LogoUrl,
    sponsor2LogoUrl,
    waitlistUrl,
  } = input;

  const safeName = escapeHtml(recipientName);
  const safePartner = escapeHtml(partnerName);
  const safeTournament = escapeHtml(tournamentName);
  const safeOrg = escapeHtml(orgName);
  const safeOrgLogoUrl = orgLogoUrl ? safeUrl(orgLogoUrl) : '';
  const safeSponsor1Url = sponsor1LogoUrl ? safeUrl(sponsor1LogoUrl) : '';
  const safeSponsor2Url = sponsor2LogoUrl ? safeUrl(sponsor2LogoUrl) : '';
  const safeWaitlistUrl = safeUrl(waitlistUrl);

  const subject = `${orgName} te da la bienvenida a "${tournamentName}"`;

  // Header with org logo. If org has no logo, fall back to name as text only.
  const orgHeader = safeOrgLogoUrl && safeOrgLogoUrl !== '#'
    ? `<img src="${safeOrgLogoUrl}" alt="${safeOrg}" width="100" style="display:block;margin:0 auto 12px auto;height:auto;max-width:100px;" />`
    : '';

  // Sponsors row — only render if at least one sponsor is configured.
  const hasSponsors =
    (safeSponsor1Url && safeSponsor1Url !== '#') ||
    (safeSponsor2Url && safeSponsor2Url !== '#');

  const sponsor1Cell =
    safeSponsor1Url && safeSponsor1Url !== '#'
      ? `<td style="text-align:center;padding:0 8px;">
           <img src="${safeSponsor1Url}" alt="Sponsor 1" height="48" style="height:48px;width:auto;max-width:160px;background:#ffffff;border-radius:6px;padding:6px;" />
         </td>`
      : '';

  const sponsor2Cell =
    safeSponsor2Url && safeSponsor2Url !== '#'
      ? `<td style="text-align:center;padding:0 8px;">
           <img src="${safeSponsor2Url}" alt="Sponsor 2" height="48" style="height:48px;width:auto;max-width:160px;background:#ffffff;border-radius:6px;padding:6px;" />
         </td>`
      : '';

  const sponsorsBlock = hasSponsors
    ? `<tr>
         <td style="padding:28px 32px;text-align:center;background:${C.surface2};border-top:1px solid ${C.border};">
           <p style="margin:0 0 16px 0;font-size:11px;color:${C.textMute};text-transform:uppercase;letter-spacing:2px;font-weight:600;">
             Patrocinan este torneo
           </p>
           <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
             <tr>${sponsor1Cell}${sponsor2Cell}</tr>
           </table>
         </td>
       </tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background-color:${C.bg};color:${C.text};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.bg};padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${C.surface};border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.4);">

          <!-- HERO: DomiRank logo gigante sobre bg negro -->
          <tr>
            <td style="background:${C.bg};padding:48px 32px 40px 32px;text-align:center;border-bottom:2px solid ${C.primary};">
              <img src="${DOMIRANK_LOGO_URL}"
                   alt="DomiRank — Tu app de dominó"
                   width="240"
                   style="display:block;margin:0 auto;width:240px;max-width:240px;height:auto;" />
            </td>
          </tr>

          <!-- Org → te da la bienvenida al torneo -->
          <tr>
            <td style="padding:32px 32px 24px 32px;text-align:center;border-bottom:1px solid ${C.border};">
              ${orgHeader}
              <div style="font-size:12px;color:${C.textDim};text-transform:uppercase;letter-spacing:2px;font-weight:600;margin-bottom:8px;">
                ${safeOrg} te da la bienvenida al
              </div>
              <h1 style="margin:0;font-size:28px;font-weight:800;line-height:1.2;color:${C.text};">
                ${safeTournament}
              </h1>
            </td>
          </tr>

          <!-- Saludo -->
          <tr>
            <td style="padding:32px 32px 8px 32px;">
              <h2 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:${C.text};">
                ¡Bienvenido, ${safeName}!
              </h2>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${C.textDim};">
                Tú y tu pareja <strong style="color:${C.text};">${safePartner}</strong> están confirmados.
                Aquí te contamos cómo va a funcionar el torneo y qué necesitas saber para llevarte la copa.
              </p>
            </td>
          </tr>

          <!-- Cómo funciona el torneo -->
          <tr>
            <td style="padding:8px 32px 16px 32px;">
              <h3 style="margin:0 0 12px 0;font-size:13px;color:${C.textMute};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">
                Cómo funciona el torneo
              </h3>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.surface3};border-radius:10px;border-left:4px solid ${C.primary};">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:${C.textDim};width:160px;">🎯 Meta por partida</td>
                        <td style="padding:6px 0;font-size:15px;color:${C.text};font-weight:600;">${targetPoints} tantos</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:${C.textDim};">🔁 Rondas</td>
                        <td style="padding:6px 0;font-size:15px;color:${C.text};font-weight:600;">${roundsCount}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:${C.textDim};">⏱️ Tiempo por ronda</td>
                        <td style="padding:6px 0;font-size:15px;color:${C.text};font-weight:600;">${roundDurationMinutes} minutos</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:${C.textDim};">🤝 Formato</td>
                        <td style="padding:6px 0;font-size:15px;color:${C.text};font-weight:600;">Sistema Suizo por parejas</td>
                      </tr>
                    </table>
                    <p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:${C.textDim};">
                      Cada partida termina cuando una pareja llega a <strong style="color:${C.primary};">${targetPoints} tantos</strong>,
                      o cuando se cumplen los <strong style="color:${C.primary};">${roundDurationMinutes} minutos</strong>. Si suena el reloj antes, gana la pareja
                      que vaya liderando en ese momento.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cómo se define al campeón -->
          <tr>
            <td style="padding:24px 32px 16px 32px;">
              <h3 style="margin:0 0 16px 0;font-size:13px;color:${C.textMute};text-transform:uppercase;letter-spacing:1.5px;font-weight:700;">
                Cómo se define al campeón
              </h3>
              <p style="margin:0 0 16px 0;font-size:14px;line-height:1.6;color:${C.textDim};">
                Al final del torneo, las parejas se ordenan por <strong style="color:${C.text};">tres criterios en este orden</strong>:
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding:10px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" style="width:48px;padding:0;">
                          <div style="background:${C.primary};color:${C.bg};border-radius:50%;width:36px;height:36px;line-height:36px;text-align:center;font-weight:800;font-size:16px;">1</div>
                        </td>
                        <td style="padding:0 0 4px 12px;">
                          <div style="font-size:16px;font-weight:700;color:${C.text};">Partidas ganadas</div>
                          <div style="font-size:13px;color:${C.textDim};line-height:1.5;">La pareja que gane más partidas durante el torneo lidera.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" style="width:48px;padding:0;">
                          <div style="background:${C.primary};color:${C.bg};border-radius:50%;width:36px;height:36px;line-height:36px;text-align:center;font-weight:800;font-size:16px;">2</div>
                        </td>
                        <td style="padding:0 0 4px 12px;">
                          <div style="font-size:16px;font-weight:700;color:${C.text};">Coeficiente de Efectividad</div>
                          <div style="font-size:13px;color:${C.textDim};line-height:1.5;">Premia ganar contundente y perder ajustado. Una pareja que aplasta a sus rivales suma más que una que apenas les gana.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td valign="top" style="width:48px;padding:0;">
                          <div style="background:${C.primary};color:${C.bg};border-radius:50%;width:36px;height:36px;line-height:36px;text-align:center;font-weight:800;font-size:16px;">3</div>
                        </td>
                        <td style="padding:0 0 4px 12px;">
                          <div style="font-size:16px;font-weight:700;color:${C.text};">Tantos acumulados</div>
                          <div style="font-size:13px;color:${C.textDim};line-height:1.5;">Si las parejas siguen empatadas, gana la que sumó más tantos en total a lo largo del torneo.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA único: waitlist -->
          <tr>
            <td style="padding:24px 32px 40px 32px;">
              <div style="background:linear-gradient(135deg,${C.primary2} 0%,${C.primary} 100%);border-radius:14px;padding:32px 24px;text-align:center;">
                <div style="font-size:12px;color:${C.bg};text-transform:uppercase;letter-spacing:2px;font-weight:800;margin-bottom:12px;opacity:0.7;">
                  ¿Te gusta DomiRank?
                </div>
                <h3 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${C.bg};line-height:1.3;">
                  Únete al waitlist
                </h3>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.5;color:${C.bg};opacity:0.85;">
                  Sé de los primeros en usar DomiRank cuando lancemos al público.
                  Tu ranking, tus partidas, tus torneos — todo en un solo lugar.
                </p>
                <a href="${safeWaitlistUrl}"
                   style="display:inline-block;padding:14px 32px;background:${C.bg};color:${C.primary};text-decoration:none;border-radius:10px;font-weight:800;font-size:16px;">
                  Apuntarme al waitlist →
                </a>
              </div>
            </td>
          </tr>

          ${sponsorsBlock}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:${C.bg};text-align:center;">
              <p style="margin:0;font-size:12px;color:${C.textMute};line-height:1.5;">
                Enviado por <strong style="color:${C.textDim};">${safeOrg}</strong> a través de DomiRank.<br>
                Tu app de dominó.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `¡Bienvenido, ${recipientName}!

${orgName} te da la bienvenida al torneo "${tournamentName}".

Tú y tu pareja ${partnerName} están confirmados.

CÓMO FUNCIONA EL TORNEO
- Meta por partida: ${targetPoints} tantos
- Rondas: ${roundsCount}
- Tiempo por ronda: ${roundDurationMinutes} minutos
- Formato: Sistema Suizo por parejas

Cada partida termina cuando una pareja llega a ${targetPoints} tantos,
o cuando se cumplen los ${roundDurationMinutes} minutos. Si suena el reloj
antes, gana la pareja que vaya liderando en ese momento.

CÓMO SE DEFINE AL CAMPEÓN
1. Partidas ganadas — la pareja que gane más partidas lidera.
2. Coeficiente de Efectividad — premia ganar contundente y perder ajustado.
3. Tantos acumulados — desempate final.

¿TE GUSTA DOMIRANK?
Únete al waitlist para ser de los primeros en usar la app cuando lancemos:
${waitlistUrl}

— ${orgName} vía DomiRank`;

  return { subject, html, text };
}
