# Modelo de rating: OpenSkill (Plackett-Luce / Weng-Lin)

## Por qué no usar Elo

Elo es elegante para 1v1, pero falla en dominó:

- No modela incertidumbre: un jugador con 5 partidas y otro con 500 con el mismo Elo se tratan igual.
- No maneja equipos. Hay parches (BSV, "team Elo") pero todos son ad-hoc.
- No maneja partidas de más de dos lados (FFA).

## Qué usamos

**OpenSkill** con el modelo **Plackett-Luce** y las aproximaciones analíticas de **Weng & Lin (2011)** — "A Bayesian Approximation Method for Online Ranking". Es el mismo linaje matemático que TrueSkill (Microsoft Research), pero:

- **Sin patentes** (TrueSkill es propiedad de Microsoft).
- **Forma analítica cerrada** — no requiere expectation-propagation iterativa; cada partida es un puñado de operaciones aritméticas.
- **Soporta nativamente** equipos, FFA, ranks con empates y tamaños asimétricos.

## Cada jugador tiene una distribución de skill

El "skill" de un jugador no se modela como un número sino como una **distribución gaussiana**:

- **μ (mu)** = media. El skill estimado más probable.
- **σ (sigma)** = desviación estándar. Qué tan inciertos estamos.

Defaults (mismos que TrueSkill original):

| Parámetro | Valor | Significado |
|---|---|---|
| μ₀ | 25.0 | Skill inicial. |
| σ₀ | 25/3 ≈ 8.333 | Incertidumbre inicial — muy alta. |
| β | 25/6 ≈ 4.167 | Ruido aleatorio inherente al juego. |
| τ | 25/300 ≈ 0.0833 | "Skill drift" entre partidas (mantiene σ vivo). |

En el dashboard mostramos el **rating ordinal**:

```
ordinal = μ − 3σ
```

Es el skill que el modelo considera muy probable que el jugador tenga **al menos** (cuantil ~99.7%). Es conservador: si el ordinal es 28.5, estás casi seguro de que el jugador es mejor que rating 28.5.

## Cómo se actualiza tras una partida

Dado:
- N equipos, cada uno con uno o más jugadores con (μ, σ).
- Rank final por equipo (1 = ganador).

OpenSkill calcula, para cada jugador *i*:

```
μᵢ' = μᵢ + (σᵢ² / cₖ) · Ωₖ
σᵢ' = σᵢ · √(max(1 − (σᵢ² / cₖ²) · Δₖ, ε))
```

donde `cₖ`, `Ωₖ`, `Δₖ` se derivan de:
- la suma de varianzas de los dos equipos comparados,
- la diferencia esperada de skill colectivo entre equipos,
- el rank observado.

La intuición:
- **μ se mueve más** cuando σ es alta (más incertidumbre = mayor ajuste).
- **σ baja** después de cada partida (más datos = menos incertidumbre).
- **Upsets** (ganar siendo inferior, perder siendo superior) producen los mayores ajustes.

## Ejemplos verificados (de `scripts/test-rating.ts`)

**1) Singles desde cero — Alice vence a Bob:**
```
Alice: μ 25.00 → 27.64   (Δ +2.635)   σ 8.33 → 8.22
Bob:   μ 25.00 → 22.36   (Δ −2.635)   σ 8.33 → 8.22
```
Cambio simétrico cuando ambos parten del mismo rating.

**2) Upset — el de 35 pierde contra el de 20:**
```
Strong (35): Δμ = −1.689
Weak  (20): Δμ = +1.689
```
Ganar contra alguien claramente inferior cuesta poco; perder contra él cuesta mucho.

**3) Predicción — favorito (μ=32, σ=3) vs underdog (μ=22, σ=3):**
```
P(favorito gana) = 91.6%
```

**4) Convergencia — 30 victorias seguidas contra rivales de skill base:**
```
σ baja de 8.33 a 5.57 (−33%).  μ termina en ~49.78.
```
La σ baja **gradualmente** porque OpenSkill es bayesiano: si los resultados confirman la predicción, no hace falta ajustar mucho la incertidumbre.

## Singles vs Doubles separados

Cada usuario tiene **dos pares (μ, σ) independientes**:

| Columna | Para qué |
|---|---|
| `singles_mu`, `singles_sigma` | Rating en 1v1 |
| `doubles_mu`, `doubles_sigma` | Rating en 2v2 |

Esto es importante: las habilidades para singles y doubles **no son la misma cosa** — comunicación con pareja, lectura del compañero, etc., son skills distintos. Ratings separados los mide independientemente.

## Snapshot por partida (auditable)

Cada fila de `match_players` guarda:
- `mu_before`, `sigma_before` — rating al momento de jugar.
- `mu_after`, `sigma_after` — rating tras aplicar el modelo.

Esto permite:
- Reconstruir cualquier rating histórico exactamente.
- Mostrar al usuario "ganaste +1.84 μ por esta partida".
- Re-correr el cálculo con un modelo distinto en el futuro sin perder historia.

## Para nerdear más

- Plackett, R. L. (1975). The analysis of permutations.
- Weng, R. C. & Lin, C. J. (2011). A Bayesian approximation method for online ranking. JMLR. ([PDF](https://jmlr.org/papers/v12/weng11a.html))
- Repo OpenSkill: https://github.com/philihp/openskill.js
- Versión Python (referencia): https://github.com/vivekjoshy/openskill.py
