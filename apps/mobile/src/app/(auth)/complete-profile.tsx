import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { signupSchema } from '@domirank/shared/auth';

// Subset of signupSchema — OAuth users already have email+password (via
// Google identity), so we only need to collect the fields Google does not
// provide: date_of_birth (age gate) and terms_accepted.
const completeProfileSchema = signupSchema.pick({
  date_of_birth: true,
  terms_accepted: true,
});
type CompleteProfileInput = z.infer<typeof completeProfileSchema>;

export default function CompleteProfileScreen() {
  const { user } = useAuth();
  const dobRef = useRef<TextInput>(null);

  const [dob, setDob] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!user) {
      setError('Sesión no encontrada. Volvé a iniciar sesión.');
      return;
    }

    const parsed = completeProfileSchema.safeParse({
      date_of_birth: dob,
      terms_accepted: terms,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }

    setPending(true);
    const now = new Date().toISOString();
    // full_name defaults to Google's name if we have it in the OAuth metadata.
    const googleName =
      (user.user_metadata as { full_name?: string; name?: string } | null)?.full_name ??
      (user.user_metadata as { full_name?: string; name?: string } | null)?.name ??
      null;

    const { error: upsertErr } = await supabase
      .from('profiles')
      .update({
        date_of_birth: parsed.data.date_of_birth,
        terms_accepted_at: now,
        privacy_accepted_at: now,
        full_name: googleName,
      })
      .eq('id', user.id);

    if (upsertErr) {
      setPending(false);
      setError(upsertErr.message);
      return;
    }

    // Also mirror the flag into user_metadata so the AuthGuard can decide
    // "profile complete?" from the session JWT without an extra profiles
    // query on every navigation.
    const { error: metaErr } = await supabase.auth.updateUser({
      data: {
        terms_accepted_at: now,
        date_of_birth: parsed.data.date_of_birth,
        full_name: googleName,
      },
    });
    setPending(false);

    if (metaErr) {
      setError(metaErr.message);
      return;
    }
    // onAuthStateChange → guard sees terms_accepted_at → redirects to /.
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-3xl font-bold mb-1 text-text dark:text-text-inverse">
          Un paso más
        </Text>
        <Text className="text-text-mute dark:text-text-dim-dark mb-8">
          Necesitamos dos datos antes de que entres a DomiRank.
        </Text>

        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium mb-1 text-text dark:text-text-inverse">
              Fecha de nacimiento
            </Text>
            <TextInput
              ref={dobRef}
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              className="border border-border dark:border-surface-2-dark bg-surface dark:bg-surface-dark rounded-lg px-3 py-3 text-base text-text dark:text-text-inverse"
            />
            <Text className="text-xs text-text-mute dark:text-text-dim-dark mt-1">
              Debés tener al menos 13 años.
            </Text>
          </View>

          <Text
            onPress={() => setTerms((v) => !v)}
            className={`text-sm py-2 ${terms ? 'text-text dark:text-text-inverse' : 'text-text-mute dark:text-text-dim-dark'}`}
          >
            {terms ? '☑' : '☐'}  Acepto los términos y la política de privacidad.
          </Text>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          <Text
            onPress={() => {
              if (!pending) void onSubmit();
            }}
            className={`text-primary-ink text-center font-semibold py-3 rounded-lg ${
              pending ? 'bg-text-mute' : 'bg-primary'
            }`}
          >
            {pending ? 'Guardando...' : 'Continuar'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
