/**
 * Generates a URL-safe slug for display routes (e.g. /t/[slug]).
 *
 * Lowercases, strips diacritics, replaces non-alphanumerics with "-",
 * collapses repeats, trims dashes. Truncates to 60 chars to keep URLs
 * readable.
 *
 * Uniqueness is enforced at the DB level (org_tournaments.display_slug
 * has a UNIQUE constraint). Callers that hit a conflict should append
 * a short random suffix and retry — see appendRandomSuffix below.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Appends a 6-char base36 random suffix. Used when the base slug is
 * already taken in the DB.
 */
export function appendRandomSuffix(baseSlug: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  const truncatedBase = baseSlug.slice(0, 53); // 53 + "-" + 6 = 60
  return `${truncatedBase}-${suffix}`;
}
