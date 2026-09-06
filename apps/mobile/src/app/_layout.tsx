import '@/global.css';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/hooks/useAuth';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Ensure splash hides even if the user lands in (auth) first — the (app)
    // layout normally hides it via AnimatedSplashOverlay onLayout, but that
    // never mounts on an unauth'd cold start.
    SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = segments[0] === '(auth)';
    const currentRoute = segments[1] ?? '';

    // Profile is considered complete once terms_accepted_at exists in the
    // user_metadata JWT claim. Manual signup writes it as part of signUp
    // options.data; OAuth users get redirected to /complete-profile which
    // fills it in.
    const metadata = (user?.user_metadata ?? {}) as { terms_accepted_at?: string };
    const profileComplete = Boolean(metadata.terms_accepted_at);

    if (!session) {
      if (!inAuthGroup) router.replace('/login');
      return;
    }

    // Session exists.
    if (!profileComplete) {
      if (currentRoute !== 'complete-profile') {
        router.replace('/complete-profile');
      }
      return;
    }

    // Session exists AND profile complete. Kick out of (auth).
    if (inAuthGroup) {
      router.replace('/');
    }
  }, [session, user, loading, segments, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGuard>
    </QueryClientProvider>
  );
}
