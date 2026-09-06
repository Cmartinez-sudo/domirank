import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@domirank/shared/auth';

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setPending(true);
    const result = await signIn(parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'No pudimos iniciar sesión');
    }
    // Successful sign-in triggers onAuthStateChange → AuthGuard redirects.
  };

  const submit = () => {
    if (!pending) void onSubmit();
  };

  const onGoogle = async () => {
    setError(null);
    setGooglePending(true);
    const result = await signInWithGoogle();
    setGooglePending(false);
    if (!result.ok && result.error !== 'Cancelado') {
      setError(result.error ?? 'No pudimos entrar con Google');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-3xl font-bold mb-1 text-text dark:text-text-inverse">
          Iniciá sesión
        </Text>
        <Text className="text-text-mute dark:text-text-dim-dark mb-8">
          Con tu cuenta DomiRank
        </Text>

        <Text
          onPress={() => {
            if (!googlePending) void onGoogle();
          }}
          className={`text-center font-semibold py-3 rounded-lg border border-border dark:border-surface-2-dark bg-surface dark:bg-surface-dark text-text dark:text-text-inverse mb-4 ${
            googlePending ? 'opacity-50' : ''
          }`}
        >
          {googlePending ? 'Abriendo Google...' : 'Continuar con Google'}
        </Text>

        <View className="flex-row items-center mb-4">
          <View className="flex-1 h-px bg-border dark:bg-surface-2-dark" />
          <Text className="text-xs uppercase tracking-wider text-text-mute dark:text-text-dim-dark px-3">
            o con email
          </Text>
          <View className="flex-1 h-px bg-border dark:bg-surface-2-dark" />
        </View>

        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium mb-1 text-text dark:text-text-inverse">
              Correo
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              placeholderTextColor="#94a3b8"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              className="border border-border dark:border-surface-2-dark bg-surface dark:bg-surface-dark rounded-lg px-3 py-3 text-base text-text dark:text-text-inverse"
            />
          </View>

          <View>
            <Text className="text-sm font-medium mb-1 text-text dark:text-text-inverse">
              Contraseña
            </Text>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              placeholderTextColor="#94a3b8"
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={submit}
              className="border border-border dark:border-surface-2-dark bg-surface dark:bg-surface-dark rounded-lg px-3 py-3 text-base text-text dark:text-text-inverse"
            />
          </View>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          <Text
            onPress={submit}
            className={`text-primary-ink text-center font-semibold py-3 rounded-lg ${
              pending ? 'bg-text-mute' : 'bg-primary'
            }`}
          >
            {pending ? 'Iniciando...' : 'Entrar'}
          </Text>

          <View className="flex-row justify-between mt-2">
            <Link href="/signup" className="text-primary text-sm">
              Crear cuenta
            </Link>
            <Link href="/forgot-password" className="text-primary text-sm">
              Olvidé mi contraseña
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
