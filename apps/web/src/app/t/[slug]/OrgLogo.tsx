'use client';

import { useState } from 'react';

/**
 * Renders an organization logo with a graceful fallback. If the URL is
 * missing, fails to load, or the file 404s, we display the org's
 * initials inside a styled placeholder box — never a broken-image icon.
 *
 * The fallback uses the first 3 alphanumeric characters of the org
 * name, uppercased.
 */
export function OrgLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    const initials =
      (name.match(/[A-Za-z0-9]/g) ?? []).slice(0, 3).join('').toUpperCase() || 'ORG';
    return (
      <div
        aria-label={name}
        className="flex h-[clamp(60px,6vw,100px)] w-[clamp(60px,6vw,100px)] shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold uppercase tracking-wider text-slate-300"
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      className="h-[clamp(60px,6vw,100px)] w-auto shrink-0 object-contain"
    />
  );
}
