import Svg, { Line, Rect } from 'react-native-svg';

type Props = { size?: number; color?: string };

export function PodiumIcon({ size = 24, color = 'currentColor' }: Props) {
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
      <Rect x={9} y={7} width={6} height={13} rx={1} />
      <Rect x={3} y={11} width={6} height={9} rx={1} />
      <Rect x={15} y={14} width={6} height={6} rx={1} />
      <Line x1={2} y1={20} x2={22} y2={20} />
      <Line x1={12} y1={10} x2={12} y2={14} strokeWidth={2.5} />
    </Svg>
  );
}
