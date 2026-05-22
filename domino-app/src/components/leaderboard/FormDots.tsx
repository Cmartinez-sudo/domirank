interface FormDotsProps {
  /** Array "W"/"L", orden más viejo → más reciente. Hasta 5 elementos. */
  last5: string[];
}

export function FormDots({ last5 }: FormDotsProps) {
  // Rellena hasta 5 posiciones; faltantes van como undefined
  const dots: (string | undefined)[] = [...last5];
  while (dots.length < 5) dots.unshift(undefined);

  return (
    <span className="flex items-center gap-0.5" aria-label="Forma últimas 5 partidas">
      {dots.map((result, i) => {
        if (result === undefined) {
          return (
            <span
              key={i}
              className="w-2 h-2 rounded-sm bg-surface-3"
              aria-hidden="true"
            />
          );
        }
        const isWin = result === "W";
        return (
          <span
            key={i}
            className={`w-2 h-2 rounded-sm ${isWin ? "bg-primary" : "bg-danger"}`}
            aria-label={isWin ? "Victoria" : "Derrota"}
          />
        );
      })}
    </span>
  );
}
