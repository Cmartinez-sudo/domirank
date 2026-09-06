import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
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
    // Google OAuth on iOS uses ASWebAuthenticationSession which requires the
    // callback URL's scheme to be registered by the *running* app. In Expo Go
    // that means 'exp://...' — which iOS 17+ rejects with error 1 for auth
    // sessions. There's no known workaround inside Expo Go; the fix is a
    // dev-build (EAS) where the app owns 'domirank://'. See TECH_DEBT TD-020.
    if (Constants.appOwnership === "expo") {
      return {
        ok: false,
        error:
          "Google requiere el dev-build de DomiRank (no funciona en Expo Go por limitación de iOS). Por ahora, entrá con email y contraseña.",
      };
    }

    // makeRedirectUri() returns the app-specific scheme:
    //   - Dev-build / prod:   domirank://
    const redirectTo = AuthSession.makeRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { ok: false, error: error.message };
    if (!data?.url) return { ok: false, error: "Supabase no devolvió URL de OAuth" };

    // preferEphemeralSession isolates the auth browser from Safari cookies so
    // Supabase doesn't reuse a stale PWA session and skip Google auth.
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
      preferEphemeralSession: true,
    });

    if (result.type !== "success") {
      return { ok: false, error: result.type === "cancel" ? "Cancelado" : "OAuth interrumpido" };
    }

    const { access_token, refresh_token } = extractTokensFromCallbackUrl(result.url);
    if (!access_token || !refresh_token) {
      return { ok: false, error: "No recibimos tokens del callback" };
    }

    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) return { ok: false, error: setErr.message };

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
