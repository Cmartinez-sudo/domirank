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
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold mb-3">Correo enviado</Text>
          <Text className="text-gray-600 mb-6">
            Si <Text className="font-semibold">{email}</Text> tiene una cuenta,
            te enviamos un enlace para restablecer la contraseña.
          </Text>
          <Link href="/login" className="text-blue-600">
            Volver al login
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6"
      >
        <Text className="text-3xl font-bold mb-1">Restablecer contraseña</Text>
        <Text className="text-gray-500 mb-8">
          Te enviamos un enlace por correo para elegir una nueva.
        </Text>

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
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!pending) void onSubmit();
              }}
              className="border border-gray-300 rounded-lg px-3 py-3 text-base"
            />
          </View>

          {error ? <Text className="text-red-600 text-sm">{error}</Text> : null}

          <Text
            onPress={() => {
              if (!pending) void onSubmit();
            }}
            className={`text-white text-center font-semibold py-3 rounded-lg ${
              pending ? 'bg-gray-400' : 'bg-blue-600'
            }`}
          >
            {pending ? 'Enviando...' : 'Enviar enlace'}
          </Text>

          <View className="items-center mt-2">
            <Link href="/login" className="text-blue-600 text-sm">
              Volver al login
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
