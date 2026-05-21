# DomiRank · Modelo de negocio

## 1. Resumen ejecutivo

DomiRank es la primera plataforma de ranking competitivo de dominó con un sistema matemático serio (OpenSkill / Plackett-Luce) adaptado a las modalidades regionales (Venezolano, Dominicano, Cubano, Puertorriqueño). El objetivo de negocio es construir el "chess.com del dominó": producto gratis con valor real, monetizado vía suscripción premium + publicidad para usuarios gratuitos, con expansión a torneos organizados y partnerships con marcas en fase 2.

**Modelo:** Freemium con publicidad para usuarios gratuitos · Premium sin ads + features avanzadas.

**Por qué ahora:** El dominó tiene ~65M jugadores frecuentes entre Latinoamérica y diáspora caribeña; ninguna app tiene rating real, ninguna respeta las modalidades regionales, ninguna tiene infraestructura social. La adopción de smartphones en LATAM ya superó 80%. Los grupos de WhatsApp con "pollas" semanales son ubicuos — DomiRank los digitaliza.

---

## 2. Propuesta de valor

| Para | DomiRank ofrece |
|---|---|
| **Jugador casual** | Llevar score sin lápiz y papel; ver su rating; comparar con amigos |
| **Jugador serio** | Ranking oficial; estadísticas; identificar fortalezas (singles vs parejas, 6-6 vs 9-9) |
| **Grupo / club** | Pollas digitales con standings automáticos; historial compartido; comunidad |
| **Comunidad regional** | Leaderboards por país, modalidades respetadas, networking |
| **Patrocinadores** | Audiencia altamente segmentada (LATAM/Caribe, 25-65, social, ya hábito de juego) |

**Diferenciadores defensibles:**

- Único rating matemáticamente correcto para equipos y modalidades múltiples.
- Datos propietarios: histórico de partidas por jugador permite predicciones, matchmaking y métricas que solo nosotros tenemos.
- Network effect: tu rating solo tiene sentido si tus rivales también están. Una vez que un grupo se enraíza, el switching cost es alto.

---

## 3. Mercado y segmentación

**TAM (Total Addressable Market):** ~65M jugadores de dominó habituales

- LATAM hispanohablante: 40-50M (Venezuela, RD, Cuba, PR, Colombia, México, Panamá, Centroamérica)
- Diáspora: 15-20M (Miami, NYC, NJ, Madrid, Barcelona)
- Mercados secundarios: Brasil (poco), Estados Unidos no-latino (muy poco)

**SAM (Serviceable Available Market):** ~15M usuarios con smartphone, juega dominó al menos mensualmente, tiene grupo recurrente

**SOM realista a 18 meses:** 50,000-100,000 MAU (Monthly Active Users) capturando 0.3-0.6% del SAM principalmente en Venezuela, RD, Miami y NYC.

**Persona principal — "Carlos, 34, Caracas":**

Trabajador independiente, juega dominó cada fin de semana con un grupo fijo de amigos. Tiene WhatsApp grupo "Polla sabatina". Ya usa apps como Strava, Chess.com (casualmente). Le frustra que no haya forma decente de llevar el historial. Pagaría $1-3/mes si la app le da estadísticas y "official-ness" de su skill.

**Persona secundaria — "Maria, 28, Miami":**

Cubano-americana, juega doble-nueve en casa de su familia los domingos. Tiene 4 grupos distintos. Quiere consolidar todo en un solo lugar y "presumir" su rating en redes sociales.

---

## 4. Modelo de ingresos

### 4.1 Estructura freemium

**Tier gratis:**
- Captura usuarios y construye network effect.
- Monetizado vía publicidad (display banner + interstitials respetuosos).
- Suficiente valor para que la app sea utilizable y la app no se sienta "limitada artificialmente".

**Tier premium (DomiRank Pro):**
- Sin publicidad.
- Features avanzadas (estadísticas, custom, prioridad).
- Soporta el desarrollo del producto.
- Status symbol: badge verificado, avatar animado.

### 4.2 Comparativa de features

| Feature | Free | Premium |
|---|---|---|
| **Crear partidas (singles y parejas)** | ✅ ilimitadas | ✅ ilimitadas |
| **DomiRank Global rating** | ✅ visible | ✅ visible |
| **Modalidades regionales** | ✅ todas | ✅ todas |
| **Leaderboard global** | ✅ ver | ✅ ver |
| **Amigos** | hasta 10 | ✅ ilimitados |
| **Pollas como creador** | 1 activa | ✅ ilimitadas |
| **Pollas como participante** | ✅ ilimitadas | ✅ ilimitadas |
| **Historial visible** | últimos 90 días | ✅ completo (lifetime) |
| **Gráfica de evolución del rating** | ❌ | ✅ con drill-down |
| **Head-to-head stats** | solo vs amigos | ✅ vs cualquier jugador |
| **Predicción de victoria pre-partida** | ❌ | ✅ |
| **Modalidad personalizada (custom params)** | ❌ | ✅ |
| **Avatar animado (GIF)** | ❌ | ✅ |
| **Badge "Pro" verificado** | ❌ | ✅ |
| **Tema custom (colores personalizados)** | dark/light | ✅ + custom |
| **Exportar historial (CSV/JSON)** | ❌ | ✅ |
| **Estadísticas demográficas (vs país, edad)** | ❌ | ✅ |
| **Sin publicidad** | ❌ | ✅ |
| **Soporte prioritario** | community | ✅ email <24h |
| **Early access a nuevas features** | ❌ | ✅ |

**Principio de diseño:** las features bloqueadas son "nice to have", no "must have". Un usuario gratis puede usar la app normalmente y disfrutarla. Premium se siente como "más sabor", no como "ahora sí funciona". Esto mantiene retención del free tier (que monetiza vía ads y construye el network effect que hace valiosa la app para los premium).

### 4.3 Pricing

**Estrategia:** precios bajos accesibles para LATAM, con anclaje en USD pero pricing local en mercados clave.

| Plan | USD | Equivalente LATAM | Notas |
|---|---|---|---|
| **Premium mensual** | $1.99 | ARS 2,500 / MXN 39 / COP 8,500 | Entry-level |
| **Premium anual** | $14.99 | ARS 18,000 / MXN 299 / COP 65,000 | -37%, equivale a $1.25/mes |
| **Lifetime** (limited) | $39.99 | — | Solo primeros 1,000 usuarios, FOMO de early adopter |

**Por qué bajo:** El benchmark psicológico en LATAM para suscripciones de hobby es ~$1-2/mes. Strava ($11.99) y Chess.com ($14/mes) son caros para el promedio. Spotify se vendió a $4.99 en LATAM por años. DomiRank en $1.99 es accesible para un mercado con sensibilidad alta al precio.

**Métodos de pago:**
- Stripe (tarjetas, Apple Pay, Google Pay).
- MercadoPago en Argentina/México/Colombia/Brasil.
- OXXO en México (efectivo).
- Zelle / Binance Pay para Venezuela (sin tarjetas accesibles).

### 4.4 Modelo de publicidad

**Para usuarios gratis. Principios:**

- **Nunca interrumpir una partida en vivo.** La pantalla en vivo es zero-ad — la experiencia core no se toca.
- **Densidad baja.** Máximo 1 banner visible en cualquier momento. 1 interstitial cada 5 partidas terminadas o cada 7 días de uso, lo que sea menor.
- **Native y contextual.** "Polla patrocinada por Polar" es preferible a banner genérico.
- **Locales y relevantes.** Ron, cerveza, snacks, casas de juego, deportes — no banners aleatorios de SaaS B2B.

**Tipos de ad y placements:**

| Tipo | Placement | CPM esperado (LATAM) | Frecuencia |
|---|---|---|---|
| Banner display | Footer en /dashboard, /leaderboard, /tournaments | $0.30 - $0.80 | Siempre visible |
| Native card | Entre items del feed (cada 10 partidas en historial) | $1.50 - $3.00 | 1 por scroll |
| Interstitial | Después de finalizar una partida (1 de cada 5) | $2.00 - $5.00 | Skippable a los 3s |
| Sponsored polla | Banner en /tournaments listing | Negociado (flat) | 1 spot por semana |
| Sponsored modalidad | Branded variant en picker ("Modalidad Brugal") | Negociado (flat) | Promo events |

**Networks:**
- Google AdSense (display, fácil de integrar).
- Meta Audience Network (apps mobile).
- Acuerdos directos con marcas regionales (cerveza, ron, ridery) — mayor CPM, menos volumen.

**ARPU esperado de free user:** $0.40 - $1.00/mes según mercado y engagement. Latam tiene CPMs más bajos pero también costos menores. Diáspora US-Latino paga CPMs cerca a US rates ($3-5).

### 4.5 Revenue streams adicionales (Fase 2+)

1. **Torneos pagados (Fase 3+):** Organizamos torneos reales con entry fee ($5-20). DomiRank gestiona inscripción + standings + premios. Tomamos 15-20% del pot.
2. **Branded events:** Marcas patrocinan torneos enteros ("Copa Polar 2026"), pagan fee + ofrecen premios. Audiencia segmentada altamente valiosa.
3. **Casa / Club tier ($19.99/mes):** Para casas de dominó y bares con clientes recurrentes. Pantalla pública con leaderboard local, branded skin, multi-user admin.
4. **Merch / brand store:** Camisetas con tu rating y modalidad. Fichas premium. Low margin pero brand-building.
5. **Data licensing (Fase 4):** Empresas de bebidas/snacks quieren entender demografía dominicana — datos agregados (nunca individuales) sobre comportamiento de juego, mercados emergentes.

---

## 5. Economía unitaria (proyecciones)

### 5.1 Cohort hipotético — 1,000 MAU activos

| Métrica | Free | Premium |
|---|---|---|
| % de MAU | 95% (950) | 5% (50) |
| ARPU mensual | $0.60 (ads) | $1.79 (después de fees 10%) |
| Revenue mensual / segmento | $570 | $89.50 |
| **Revenue mensual total** | | **$659.50** |
| **ARPU blendado** | | **$0.66** |

### 5.2 Costos

| Item | Costo mensual @1K MAU |
|---|---|
| Supabase (Free tier inicialmente) | $0 → $25 cuando paguemos Pro |
| Vercel (Free tier) | $0 → $20 cuando paguemos Pro |
| Resend (SMTP) | $0 (free tier 3K correos) |
| Dominio | ~$1.5 |
| Stripe fees | ~3% del revenue Premium |
| **Total** | ~$5 (en free tier de servicios) |

**Margen bruto a 1K MAU:** ~99% (porque Supabase/Vercel están en free tier todavía).

A 10K MAU los costos suben ($100-200/mes en infra), pero revenue también escala ($6,500/mes). Margen sigue >90%.

### 5.3 LTV y CAC objetivo

| Métrica | Free user | Premium user |
|---|---|---|
| Vida media activa | 12 meses | 18 meses |
| ARPU/mes | $0.60 | $1.79 |
| **LTV** | $7.20 | $32.20 |
| **CAC máximo** (LTV/3 rule) | $2.40 | $10.73 |

**Implicación:** podemos gastar hasta ~$2-3 por usuario gratis adquirido vía paid ads, y mucho más en marketing dirigido a conversiones premium directas.

### 5.4 Tasa de conversión objetivo

- Industry benchmark freemium apps: 2-5% conversion.
- Chess.com: ~1.5% (con free chess muy completo).
- Strava: ~10% (premium hace mucha diferencia).
- **DomiRank target a 12 meses: 3-5%.** Realista porque la base es nicho-loyal (vs Strava cuyo mercado es mainstream).

---

## 6. Go-to-market

### Fase 0 — Bootstrap (mes 0-1): tu círculo

**Goal:** 50-100 MAU. Tus amigos + sus amigos. WhatsApp groups, Instagram personal. Sin ads, sin premium. Solo retention + feedback.

### Fase 1 — Soft launch (mes 1-3): comunidad local

**Goal:** 500-2,000 MAU. Activación en Caracas, Maracaibo, Santo Domingo, Miami. Estrategia:
- Influencer marketing micro: 3-5 jugadores reconocidos por ciudad regalan año premium gratis.
- Casas de dominó: contacto directo, ofrecemos branded leaderboard gratis a cambio de promover la app.
- Reddit r/dominoes, FB groups de dominó: posts orgánicos.
- Sin ads todavía. Premium disponible pero no pushed.

### Fase 2 — Premium launch + ads (mes 3-6)

**Goal:** 5,000-15,000 MAU, 2-3% premium conversion.
- Activar ads en tier gratis (suave: solo banner footer al principio).
- Lanzar precio Lifetime $39.99 con countdown (FOMO).
- Email marketing a usuarios activos: "Mira lo que viene en Premium".
- App Store / Play Store launch (App marketing en serio requiere PWA install + ratings).

### Fase 3 — Paid acquisition (mes 6-12)

**Goal:** 30,000-60,000 MAU, 4-5% premium.
- Meta Ads dirigidos a usuarios LATAM 25-55 con interés en dominó / juegos / cerveza.
- Influencer marketing escalado: pago $50-500 por video a creadores locales.
- Sponsored content en YouTube de canales de dominó.
- Empezar conversaciones con marcas (Polar, Brugal, etc.) para sponsored events.

### Fase 4 — Scale + revenue diversification (mes 12-24)

**Goal:** 100K+ MAU. Diversificar revenue streams.
- Torneos reales con entry fees + take rate.
- Brand partnerships ("Copa Polar 2027").
- Casa / Club tier.
- Expansión a Brasil, Estados Unidos no-latino, Europa (mercados secundarios con dominó cubano).

---

## 7. Proyección financiera (escenario base, 18 meses)

| Mes | MAU | Premium % | Premium users | Free revenue | Premium revenue | Total mensual |
|---|---|---|---|---|---|---|
| 1 | 100 | 0% | 0 | $0 (sin ads) | $0 | $0 |
| 3 | 1,000 | 1% | 10 | $0 (sin ads) | $18 | $18 |
| 6 | 5,000 | 2% | 100 | $1,500 | $179 | $1,679 |
| 9 | 15,000 | 3% | 450 | $4,500 | $806 | $5,306 |
| 12 | 30,000 | 4% | 1,200 | $9,000 | $2,150 | $11,150 |
| 18 | 75,000 | 5% | 3,750 | $22,500 | $6,712 | $29,212 |
| 24 | 150,000 | 5% | 7,500 | $45,000 | $13,425 | $58,425 |

**A 24 meses:** ~$700K ARR si las proyecciones se cumplen. Conservador respecto a chess.com (que llegó a $30M+ ARR en años) pero realista para un nicho regional.

**Breakeven estimado:** mes 6-7 si solo cuentas costos de infra. Si cuentas costos de marketing/people, breakeven más cerca a mes 12-15 dependiendo de cuánto gastes adquiriendo.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Network effect insuficiente: usuarios solos no aportan datos | Alta | Alto | Onboarding pide grupo de amigos desde día 1; viralidad orgánica vía polla con link público |
| Conversión premium < 1% | Media | Alto | Iterar features premium con users entrevistados; A/B testing de paywalls |
| Friction de pago en LATAM | Alta | Medio | Multi-payment (Stripe + MercadoPago + Zelle + crypto) |
| Bajo CPM publicitario LATAM | Alta | Medio | Priorizar premium revenue; sponsored content > display ads |
| Competidor con más capital | Baja | Alto | First-mover advantage en modalidades + datos propietarios = moat |
| Volatilidad económica LATAM (Argentina, Venezuela) | Alta | Medio | Pricing en USD con conversión flexible; targets de growth concentrados en mercados más estables (RD, Miami, México) |
| Costos de Supabase/Vercel suben al escalar | Media | Bajo | Eventualmente migrar a self-host de Postgres si el costo cruza umbral; el código no depende de Supabase específicamente más allá del auth |

---

## 9. KPIs a monitorear semanalmente

**Adquisición:**
- Sign-ups por día (split por canal: organic, social, paid).
- Conversion de visitante → sign-up.
- Activation: usuarios que crean ≥1 partida en 7 días.

**Engagement:**
- DAU / MAU ratio (target >25%).
- Partidas registradas por usuario por semana.
- Frecuencia de uso de pollas.
- % de usuarios con >1 amigo.

**Monetización:**
- Free → Premium conversion rate (target 3-5%).
- Premium churn mensual (target <5%).
- ARPU blendado (target $0.80-1.50 a 6 meses).
- Ad fill rate y CPM efectivo.

**Producto:**
- Retention day-7 (target >40%).
- Retention day-30 (target >25%).
- NPS (target >40, top tertil de apps consumer).

---

## 10. Equipo y siguiente paso

A 18 meses con 50K-100K MAU el proyecto justifica al menos 2-3 personas full-time:
- 1 founder técnico (tú, Carlos).
- 1 community manager / marketing dedicado.
- 1 partnership lead para marcas y torneos.

Antes de contratar: validar tracción orgánica primero (mes 0-6). Si los amigos y casas de dominó en Caracas + Santo Domingo no se enganchan sin marketing pagado, hay un problema de producto, no de distribución.

**Siguiente paso inmediato:** Lograr 100 MAU activos mes 1, medir retention día-7, y ajustar producto antes de gastar un peso en marketing.

---

## Apéndice A — Inspiración y benchmarks

- **Chess.com:** 100M+ users, $30M+ ARR, freemium con membership desde $4/mes. Modelo de referencia.
- **Strava:** Hobby app de runners/ciclistas, $11.99/mes Premium, ~10% conversion. Demuestra que comunidades de nicho pagan por estadísticas y badges.
- **Lichess:** Open-source, donation-based, sin ads. Otro path posible si no quieres comercializar, pero no aplica aquí.
- **TheGrint:** Golf scoring app que combina handicap oficial + social. $14.99/mes Premium. Modelo casi 1:1 con DomiRank en lo conceptual.
- **MyDominoes (existe, débil):** Apps locales de dominó que no monetizan ni respetan modalidades. La barra está baja para superarlas.
