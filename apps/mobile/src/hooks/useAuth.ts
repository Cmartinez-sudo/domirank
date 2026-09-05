import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import type { LoginInput, SignupInput, ResetPasswordRequestInput } from "@domirank/shared/auth";

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

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
