import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "@/lib/supabase";
import type { LoginInput, SignupInput, ResetPasswordRequestInput } from "@domirank/shared/auth";

// Ensures the auth session completes cleanly if the browser is dismissed
// (e.g. user closes the tab manually). Safe no-op if never invoked.
WebBrowser.maybeCompleteAuthSession();

function extractTokensFromCallbackUrl(url: string): {
  access_token: string | null;
  refresh_token: string | null;
} {
  // Supabase returns tokens in the URL fragment: domirank://#access_token=...&refresh_token=...
  const fragment = url.split("#")[1] ?? "";
  const params = new URLSearchParams(fragment);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
  };
}

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setState({
          session: data.session,
          user: data.session?.user ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ session: null, user: null, loading: false });
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (input: LoginInput) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    return { ok: !error, error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (input: SignupInput) => {
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.full_name,
          date_of_birth: input.date_of_birth,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    return { ok: !error, error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { ok: !error, error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (input: ResetPasswordRequestInput) => {
    const { error } = await supabase.auth.resetPasswordForEmail(input.email);
    return { ok: !error, error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // makeRedirectUri() returns the app-specific scheme that
    // ASWebAuthenticationSession on iOS knows how to intercept:
    //   - Expo Go:            exp+@<username>/<slug>://
    //   - Dev-build / prod:   domirank://
    // A plain exp:// URL like 'Linking.createURL()' returns is NOT valid
    // for ASWebAuthenticationSession — it fails with error 1 (bad scheme).
    const redirectTo = AuthSession.makeRedirectUri();
    if (__DEV__) console.log("[oauth] redirectTo =", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      if (__DEV__) console.log("[oauth] signInWithOAuth error:", error);
      return { ok: false, error: error.message };
    }
    if (!data?.url) return { ok: false, error: "Supabase no devolvió URL de OAuth" };
    if (__DEV__) console.log("[oauth] opening browser to:", data.url);

    // preferEphemeralSession: true isolates the auth browser from Safari's
    // cookie jar. Without it, if the user is signed into the PWA in Safari,
    // Supabase reuses that session and skips Google auth entirely — which
    // masks bugs in the redirect flow (looks like nothing happens, but the
    // browser silently redirects to Site URL because it has a session).
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      preferEphemeralSession: true,
    });
    if (__DEV__) console.log("[oauth] browser result:", JSON.stringify(result));

    if (result.type !== "success") {
      return { ok: false, error: result.type === "cancel" ? "Cancelado" : "OAuth interrumpido" };
    }

    const { access_token, refresh_token } = extractTokensFromCallbackUrl(result.url);
    if (__DEV__) console.log("[oauth] tokens present?", { at: !!access_token, rt: !!refresh_token });
    if (!access_token || !refresh_token) {
      return { ok: false, error: "No recibimos tokens del callback" };
    }

    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) {
      if (__DEV__) console.log("[oauth] setSession error:", setErr);
      return { ok: false, error: setErr.message };
    }
    if (__DEV__) console.log("[oauth] setSession OK, waiting for onAuthStateChange");

    // AuthGuard will react to the onAuthStateChange emitted by setSession.
    return { ok: true, error: null };
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithGoogle,
  };
}
