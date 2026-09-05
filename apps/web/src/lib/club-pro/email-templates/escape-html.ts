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

/**
 * Validates that a URL uses an allowed protocol (http/https) before being
 * injected into an href or src attribute. Some email clients with WebView
 * (Outlook app, certain Android clients) will execute `javascript:` and
 * `data:text/html,...` URIs on click — `escapeHtml` alone does NOT block
 * these because they contain no HTML-special chars.
 *
 * Returns the URL escaped for HTML if safe, or "#" as a neutral fallback
 * when the protocol is not allowed (or input is empty/whitespace).
 */
export function safeUrl(input: string): string {
  if (!input) return '#';
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '#';
  return escapeHtml(trimmed);
}
