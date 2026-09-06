import { View, type ViewProps } from 'react-native';

type Padding = 'sm' | 'md' | 'lg' | 'none';

type Props = ViewProps & {
  children: React.ReactNode;
  padding?: Padding;
};

const paddingClasses: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({ children, padding = 'md', className, ...rest }: Props) {
  return (
    <View
      {...rest}
      className={`bg-surface dark:bg-surface-dark border border-border dark:border-surface-2-dark rounded-lg ${paddingClasses[padding]} ${className ?? ''}`}
    >
      {children}
    </View>
  );
}
