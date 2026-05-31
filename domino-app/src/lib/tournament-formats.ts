export type TournamentFormat =
  | "rotation"
  | "round_robin"
  | "swiss"
  | "single_elim"
  | "double_elim"
  | "points_league"
  | "continuous_league";

export type TournamentFormatInfo = {
  code: TournamentFormat;
  name: string;
  icon: string;
  short: string;
  description: string;
  pros: string[];
  cons: string[];
  minPlayers: number;
  maxPlayers: number;
  durationHint: string;
  fairness: number; // 1-5
  autopairing: boolean;
};

export const TOURNAMENT_FORMATS: Record<TournamentFormat, TournamentFormatInfo> = {
  rotation: {
    code: "rotation",
    name: "Rotación abierta",
    icon: "🔄",
    short: "Sin estructura fija — eliges 4 jugadores cada partida",
    description:
      "Cada partida tomamos 4 jugadores del torneo (sorteo o manual) y los dividimos en 2 parejas. Sin rondas, sin bracket. Standings se calculan por puntos acumulados.",
    pros: [
      "Flexible: empiezas y paras cuando quieras",
      "Ideal para casas de dominó con jugadores rotativos",
      "No requiere todos los jugadores presentes",
    ],
    cons: [
      "Standings menos justos (algunos juegan más que otros)",
      "No define un «ganador único» claro",
    ],
    minPlayers: 4,
    maxPlayers: 64,
    durationHint: "Indefinida (continua) o hasta N partidas",
    fairness: 2,
    autopairing: false,
  },
  round_robin: {
    code: "round_robin",
    name: "Todos contra todos",
    icon: "⚪",
    short: "Cada equipo juega contra todos los demás",
    description:
      "Cada equipo enfrenta a cada uno de los demás exactamente una vez. El ganador es quien sume más victorias. Con N equipos hay N×(N-1)/2 partidas.",
    pros: [
      "Máxima justicia: todos juegan contra todos",
      "Standings claros y transparentes",
      "Ideal para grupos chicos (4-8 equipos)",
    ],
    cons: [
      "Mucho tiempo con muchos equipos (8 equipos = 28 partidas)",
      "Requiere todos presentes o coordinación pesada",
    ],
    minPlayers: 4,
    maxPlayers: 16,
    durationHint: "2-6 horas según equipos",
    fairness: 5,
    autopairing: true,
  },
  swiss: {
    code: "swiss",
    name: "Sistema suizo",
    icon: "🇨🇭",
    short: "Cada ronda empareja a los de score similar",
    description:
      "En cada ronda los equipos se emparejan con otros de score similar acumulado. Sin eliminación: todos juegan todas las rondas. Tras N rondas, el de mejor score gana.",
    pros: [
      "Escala perfectamente a 16-64+ equipos",
      "No hay eliminación temprana decepcionante",
      "Buen balance entre justicia y duración",
    ],
    cons: [
      "Requiere algoritmo de pareo (no se puede hacer a mano fácilmente)",
      "Puede haber empates en score al final",
    ],
    minPlayers: 6,
    maxPlayers: 128,
    durationHint: "5-9 rondas según equipos",
    fairness: 4,
    autopairing: true,
  },
  single_elim: {
    code: "single_elim",
    name: "Eliminación directa",
    icon: "🏆",
    short: "Pierdes una vez y estás fuera",
    description:
      "Bracket clásico estilo Wimbledon. Quien pierde queda eliminado. Con N=8 equipos hay 7 partidas. Si N no es potencia de 2, se asignan «byes» a los mejor seedeados.",
    pros: [
      "Rápido: una sola partida por equipo y ronda",
      "Drama y emoción crecientes hacia la final",
      "Resultado inequívoco: un ganador claro",
    ],
    cons: [
      "Equipos buenos pueden eliminarse temprano por mala suerte",
      "Pocos juegos por equipo (puede ser frustrante)",
    ],
    minPlayers: 4,
    maxPlayers: 64,
    durationHint: "2-4 horas",
    fairness: 3,
    autopairing: true,
  },
  double_elim: {
    code: "double_elim",
    name: "Doble eliminación",
    icon: "🥊",
    short: "Pierdes dos veces para quedar fuera",
    description:
      "Bracket con segunda chance: al perder pasas al «loser bracket», y solo quedas eliminado al perder ahí también. La final enfrenta al ganador de cada bracket.",
    pros: [
      "Más justo que eliminación simple",
      "Permite recuperarse de un mal día",
    ],
    cons: [
      "Más partidas (~2× single elim)",
      "Complejo de visualizar para nuevos jugadores",
    ],
    minPlayers: 4,
    maxPlayers: 32,
    durationHint: "4-7 horas",
    fairness: 4,
    autopairing: true,
  },
  points_league: {
    code: "points_league",
    name: "Liga por puntos",
    icon: "📊",
    short: "Acumula puntos a lo largo del tiempo",
    description:
      "Torneo sin estructura fija pero con duración definida (ej. «Liga marzo»). Cada partida ganada da puntos. Al cerrar la liga, el que más puntos tenga gana.",
    pros: [
      "Perfecto para grupos que juegan de forma irregular",
      "Premia consistencia, no el día específico",
      "Puede correr semanas o meses",
    ],
    cons: [
      "Final puede ser predecible si alguien lleva mucha ventaja",
      "Requiere disciplina de registrar todas las partidas",
    ],
    minPlayers: 4,
    maxPlayers: 50,
    durationHint: "1-8 semanas",
    fairness: 4,
    autopairing: false,
  },
  continuous_league: {
    code: "continuous_league",
    name: "Polla",
    icon: "🎯",
    short: "Partidas libres — parejas se arman en cada match",
    description:
      "Formato libre donde las parejas se forman al crear cada partida. Sin bracket ni rondas fijas. Los standings reflejan el desempeño acumulado de cada jugador.",
    pros: [
      "Máxima flexibilidad en la formación de parejas",
      "Ideal para grupos que juegan de forma continua",
      "Sin restricciones de rondas ni brackets",
    ],
    cons: [
      "No define un ganador único por eliminación",
      "Requiere organización manual de cada partida",
    ],
    minPlayers: 4,
    maxPlayers: 64,
    durationHint: "Indefinido",
    fairness: 3,
    autopairing: false,
  },
};

export const FORMAT_LIST = Object.values(TOURNAMENT_FORMATS);

export function formatInfo(code: string | null | undefined): TournamentFormatInfo {
  if (code && code in TOURNAMENT_FORMATS) return TOURNAMENT_FORMATS[code as TournamentFormat];
  return TOURNAMENT_FORMATS.rotation;
}
