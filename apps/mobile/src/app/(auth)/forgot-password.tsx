import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';
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
          <Input
            label="Correo"
            value={email}
            onChangeText={setEmail}
            placeholder="tu@correo.com"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (!pending) void onSubmit();
            }}
            error={error}
          />

          <Button
            label={pending ? 'Enviando...' : 'Enviar enlace'}
            onPress={onSubmit}
            loading={pending}
          />

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
