import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
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
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center px-6">
          <Text className="text-3xl font-bold mb-3">Revisa tu correo</Text>
          <Text className="text-gray-600 mb-6">
            Te enviamos un enlace de confirmación a <Text className="font-semibold">{email}</Text>.
            Ábrelo desde el mismo dispositivo para activar tu cuenta.
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
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-6 py-8" keyboardShouldPersistTaps="handled">
          <Text className="text-3xl font-bold mb-1">Crear cuenta</Text>
          <Text className="text-gray-500 mb-8">Empezá a jugar en DomiRank</Text>

          <View className="gap-4">
            <View>
              <Text className="text-sm font-medium mb-1">Nombre y apellido</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Carlos Martínez"
                autoComplete="name"
                returnKeyType="next"
                onSubmitEditing={() => dobRef.current?.focus()}
                className="border border-gray-300 rounded-lg px-3 py-3 text-base"
              />
            </View>

            <View>
              <Text className="text-sm font-medium mb-1">Fecha de nacimiento</Text>
              <TextInput
                ref={dobRef}
                value={dob}
                onChangeText={setDob}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                className="border border-gray-300 rounded-lg px-3 py-3 text-base"
              />
              <Text className="text-xs text-gray-500 mt-1">Debes tener al menos 13 años.</Text>
            </View>

            <View>
              <Text className="text-sm font-medium mb-1">Correo</Text>
              <TextInput
                ref={emailRef}
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
                autoComplete="new-password"
                secureTextEntry
                returnKeyType="done"
                className="border border-gray-300 rounded-lg px-3 py-3 text-base"
              />
            </View>

            <Text
              onPress={() => setTerms((v) => !v)}
              className={`text-sm py-2 ${terms ? 'text-gray-800' : 'text-gray-500'}`}
            >
              {terms ? '☑' : '☐'}  Acepto los términos y la política de privacidad.
            </Text>

            {error ? <Text className="text-red-600 text-sm">{error}</Text> : null}

            <Text
              onPress={() => {
                if (!pending) void onSubmit();
              }}
              className={`text-white text-center font-semibold py-3 rounded-lg ${
                pending ? 'bg-gray-400' : 'bg-blue-600'
              }`}
            >
              {pending ? 'Creando...' : 'Crear cuenta'}
            </Text>

            <View className="items-center mt-2">
              <Link href="/login" className="text-blue-600 text-sm">
                ¿Ya tenés cuenta? Iniciá sesión
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
