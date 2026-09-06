import { forwardRef } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, className, ...rest },
  ref,
) {
  return (
    <View>
      {label ? (
        <Text className="text-sm font-medium mb-1 text-text dark:text-text-inverse">{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#94a3b8"
        {...rest}
        className={`border rounded-lg px-3 py-3 text-base bg-surface dark:bg-surface-dark text-text dark:text-text-inverse ${
          error ? 'border-danger' : 'border-border dark:border-surface-2-dark'
        } ${className ?? ''}`}
      />
      {error ? (
        <Text className="text-xs text-danger mt-1">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-text-mute dark:text-text-dim-dark mt-1">{hint}</Text>
      ) : null}
    </View>
  );
});
