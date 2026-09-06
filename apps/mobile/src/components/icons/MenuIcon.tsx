import Svg, { Line } from 'react-native-svg';

type Props = { size?: number; color?: string };

export function MenuIcon({ size = 24, color = 'currentColor' }: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Line x1={3} y1={6} x2={21} y2={6} />
      <Line x1={3} y1={12} x2={21} y2={12} />
      <Line x1={3} y1={18} x2={21} y2={18} />
    </Svg>
  );
}
