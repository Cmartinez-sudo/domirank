import { escapeHtml } from './escape-html';
import type { RenderedEmail } from './tournament-invitation';

export type ClaimSuccessInput = {
  recipientName: string;
  tournamentName: string;
  orgName: string;
  playerDashboardUrl: string;
};

export function claimSuccessEmail(input: ClaimSuccessInput): RenderedEmail {
  const { recipientName, tournamentName, orgName, playerDashboardUrl } = input;
  const safeName = escapeHtml(recipientName);
  const safeTournament = escapeHtml(tournamentName);
  const safeOrg = escapeHtml(orgName);
  const safeUrl = escapeHtml(playerDashboardUrl);

  const subject = `Bienvenido a DomiRank, ${recipientName}`;

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
            <td style="padding:32px">
              <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700">¡Cuenta activada, ${safeName}!</h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5">
                Tu cuenta de DomiRank ya está lista. Vas a competir en
                <strong>${safeTournament}</strong> organizado por ${safeOrg}.
              </p>
              <p style="margin:24px 0">
                <a href="${safeUrl}"
                   style="display:inline-block;padding:12px 24px;background-color:#0f172a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px">
                  Ver mi próximo torneo
                </a>
              </p>
              <p style="margin:24px 0 0 0;font-size:14px;color:#64748b;line-height:1.5">
                Te vamos a enviar otro email cuando arranque cada ronda con tu mesa
                asignada y tus oponentes.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#64748b;text-align:center">
                DomiRank — la app de ranking de dominó.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `¡Cuenta activada, ${recipientName}!

Tu cuenta de DomiRank ya está lista. Vas a competir en "${tournamentName}" organizado por ${orgName}.

Ver tu próximo torneo:
${playerDashboardUrl}

Te enviaremos otro email cuando arranque cada ronda.

— DomiRank`;

  return { subject, html, text };
}
