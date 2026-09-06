import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { resetPasswordRequestSchema } from '@domirank/shared/auth';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const parsed = resetPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Correo inválido');
      return;
    }
    setPending(true);
    const result = await resetPassword(parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'No pudimos enviar el correo');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold mb-3 text-text dark:text-text-inverse">
            Correo enviado
          </Text>
          <Text className="text-text-dim dark:text-text-dim-dark mb-6">
            Si <Text className="font-semibold text-text dark:text-text-inverse">{email}</Text>{' '}
            tiene una cuenta, te enviamos un enlace para restablecer la contraseña.
          </Text>
          <Link href="/login" className="text-primary">
            Volver al login
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-3xl font-bold mb-1 text-text dark:text-text-inverse">
          Restablecer contraseña
        </Text>
        <Text className="text-text-mute dark:text-text-dim-dark mb-8">
          Te enviamos un enlace por correo para elegir una nueva.
        </Text>

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
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!pending) void onSubmit();
              }}
              className="border border-border dark:border-surface-2-dark bg-surface dark:bg-surface-dark rounded-lg px-3 py-3 text-base text-text dark:text-text-inverse"
            />
          </View>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          <Text
            onPress={() => {
              if (!pending) void onSubmit();
            }}
            className={`text-primary-ink text-center font-semibold py-3 rounded-lg ${
              pending ? 'bg-text-mute' : 'bg-primary'
            }`}
          >
            {pending ? 'Enviando...' : 'Enviar enlace'}
          </Text>

          <View className="items-center mt-2">
            <Link href="/login" className="text-primary text-sm">
              Volver al login
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
