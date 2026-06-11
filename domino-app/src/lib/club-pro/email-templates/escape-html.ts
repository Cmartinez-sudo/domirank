/**
 * Escapes HTML special characters in user-provided strings to prevent
 * XSS when an admin enters a tournament name like "<script>alert(1)</script>".
 *
 * Escapes: & < > " '
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
