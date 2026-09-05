// Runtime-only augmentation: React 18's startTransition/useTransition accept
// async callbacks at runtime (the promise is fire-and-forget). @types/react
// tightened the signature to reject async in newer patches, breaking the
// project's existing pattern in ~40 files. This augmentation restores the
// accept-async behavior at the type level without touching runtime code.
import "react";

declare module "react" {
  function useTransition(): [boolean, (callback: () => void | Promise<void>) => void];
  function startTransition(callback: () => void | Promise<void>): void;
}

export {};
