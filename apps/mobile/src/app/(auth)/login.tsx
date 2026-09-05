import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { loginSchema } from '@domirank/shared/auth';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-3xl font-bold mb-1">Inicia sesión</Text>
        <Text className="text-gray-500 mb-8">Con tu cuenta DomiRank</Text>

        <View className="gap-4">
          <View>
            <Text className="text-sm font-medium mb-1">Correo</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
          </View>

          <View>
            <Text className="text-sm font-medium mb-1">Contraseña</Text>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres"
              autoComplete="current-password"
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={submit}
              className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
          </View>

          {error ? <Text className="text-red-600 text-sm">{error}</Text> : null}

          <Text
            onPress={submit}
            className={`text-white text-center font-semibold py-3 rounded-lg ${
              pending ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            {pending ? 'Iniciando...' : 'Entrar'}
          </Text>

          <View className="flex-row justify-between mt-2">
            <Link href="/signup" className="text-blue-600 text-sm">
              Crear cuenta
            </Link>
            <Link href="/forgot-password" className="text-blue-600 text-sm">
              Olvidé mi contraseña
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
