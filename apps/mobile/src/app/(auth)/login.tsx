import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';
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

        <View className="mb-4">
          <Button
            label="Continuar con Google"
            variant="secondary"
            onPress={onGoogle}
            loading={googlePending}
          />
        </View>

        <View className="flex-row items-center mb-4">
          <View className="flex-1 h-px bg-border dark:bg-surface-2-dark" />
          <Text className="text-xs uppercase tracking-wider text-text-mute dark:text-text-dim-dark px-3">
            o con email
          </Text>
          <View className="flex-1 h-px bg-border dark:bg-surface-2-dark" />
        </View>

        <View className="gap-4">
          <Input
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <Input
            ref={passwordRef}
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="Mínimo 8 caracteres"
            autoComplete="current-password"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={() => {
              if (!pending) void onSubmit();
            }}
            error={error}
          />

          <Button
            label={pending ? 'Iniciando...' : 'Entrar'}
            onPress={onSubmit}
            loading={pending}
          />

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
