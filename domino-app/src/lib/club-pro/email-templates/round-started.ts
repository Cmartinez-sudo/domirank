import { escapeHtml } from './escape-html';
import type { RenderedEmail } from './tournament-invitation';

export type RoundStartedInput = {
  recipientName: string;
  tournamentName: string;
  roundNumber: number;
  tableNumber: number;
  opponentPairName: string;
  targetPoints: number;
};

export function roundStartedEmail(input: RoundStartedInput): RenderedEmail {
  const { recipientName, tournamentName, roundNumber, tableNumber, opponentPairName, targetPoints } = input;
  const safeName = escapeHtml(recipientName);
  const safeTournament = escapeHtml(tournamentName);
  const safeOpponent = escapeHtml(opponentPairName);

  const subject = `Ronda ${roundNumber} — Mesa ${tableNumber}`;

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
              <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700">Ronda ${roundNumber}</h1>
              <p style="margin:0 0 24px 0;font-size:14px;color:#64748b">${safeTournament}</p>

              <div style="text-align:center;margin:24px 0">
                <div style="font-size:64px;font-weight:800;line-height:1;color:#0f172a">${tableNumber}</div>
                <div style="font-size:14px;color:#64748b;margin-top:4px;letter-spacing:1px;text-transform:uppercase">Mesa</div>
              </div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;border-radius:6px;background:#f8fafc">
                <tr>
                  <td style="padding:16px;font-size:15px;line-height:1.5">
                    Hola ${safeName}, tu ronda empieza.<br /><br />
                    <strong>Oponentes:</strong> ${safeOpponent}<br />
                    <strong>Meta:</strong> ${targetPoints} tantos.
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">
                Buena partida. El anotador de tu mesa ingresará los tantos al finalizar.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Ronda ${roundNumber} — Mesa ${tableNumber}
${tournamentName}

Hola ${recipientName}, tu ronda empieza.

Oponentes: ${opponentPairName}
Meta: ${targetPoints} tantos.

Buena partida. El anotador de tu mesa ingresará los tantos al finalizar.

— DomiRank`;

  return { subject, html, text };
}
