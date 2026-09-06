import { Redirect } from 'expo-router';

// Bootstrap route: '/' has no screen of its own now that the (app) group
// scopes the real screens. Immediately hop to /dashboard so the AuthGuard
// can decide login vs dashboard from a known route.
export default function Index() {
  return <Redirect href="/dashboard" />;
}
