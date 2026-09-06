import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { Button, Input } from '@/components/ui';
import { signupSchema } from '@domirank/shared/auth';

export default function SignupScreen() {
  const { signUp } = useAuth();
  const dobRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState(''); // YYYY-MM-DD
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const parsed = signupSchema.safeParse({
      full_name: fullName,
      email,
      password,
      date_of_birth: dob,
      terms_accepted: terms,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setPending(true);
    const result = await signUp(parsed.data);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'No pudimos crear la cuenta');
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <SafeAreaView className="flex-1 bg-bg dark:bg-bg-dark">
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold mb-3 text-text dark:text-text-inverse">
            Revisá tu correo
          </Text>
          <Text className="text-text-dim dark:text-text-dim-dark mb-6">
            Te enviamos un enlace de confirmación a{' '}
            <Text className="font-semibold text-text dark:text-text-inverse">{email}</Text>.
            Abrilo desde el mismo dispositivo para activar tu cuenta.
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
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-6 py-8" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-bold mb-1 text-text dark:text-text-inverse">
            Crear cuenta
          </Text>
          <Text className="text-text-mute dark:text-text-dim-dark mb-8">
            Empezá a jugar en DomiRank
          </Text>

          <View className="gap-4">
            <Input
              label="Nombre y apellido"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Carlos Martínez"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => dobRef.current?.focus()}
            />

            <Input
              ref={dobRef}
              label="Fecha de nacimiento"
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              hint="Debés tener al menos 13 años."
            />

            <Input
              ref={emailRef}
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
              autoComplete="new-password"
              secureTextEntry
              returnKeyType="done"
              error={error}
            />

            <Text
              onPress={() => setTerms((v) => !v)}
              className={`text-sm py-2 ${
                terms ? 'text-text dark:text-text-inverse' : 'text-text-mute dark:text-text-dim-dark'
              }`}
            >
              {terms ? '☑' : '☐'}  Acepto los términos y la política de privacidad.
            </Text>

            <Button
              label={pending ? 'Creando...' : 'Crear cuenta'}
              onPress={onSubmit}
              loading={pending}
            />

            <View className="items-center mt-2">
              <Link href="/login" className="text-primary text-sm">
                ¿Ya tenés cuenta? Iniciá sesión
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
