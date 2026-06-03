# DomiRank — Business Model

**Versión:** 2.1 (suma sprint Reliability NR — score de confianza 0-100% + estado "Not Rated" pre-5-partidas)
**Fecha:** junio 2026
**Owner:** Carlos Martínez
**Status:** Pre-launch público, ~75% del producto construido, 0 MAU
**Anterior:** v2.0 — consolidación post-decisiones estratégicas (mayo 2026)

---

## 0. Cover & One-liner

**DomiRank** es la primera plataforma de ranking, torneos y comunidad para jugadores de dominó en Latinoamérica. Equivalente: **Chess.com aplicado a un deporte amateur masivo culturalmente latino que hoy no tiene infraestructura digital**.

**Diferenciador único**: modelo de confianza por consenso (3-of-4 attestation) que protege la integridad del rating sin requerir sensores físicos ni supervisión central.

**Mercado primario**: Venezuela, República Dominicana, Cuba, Puerto Rico, México, Colombia. Diáspora latina en USA como mercado secundario.

**Stage**: Pre-launch (PWA al 70% construida). 0 MAU. Bootstrap. Single founder.

---

## 1. Executive Summary

DomiRank captura una oportunidad **greenfield**: cientos de millones de jugadores de dominó en LatAm sin software equivalente a Playtomic (padel), DUPR (pickleball) o Chess.com (chess).

El producto opera en **3 pilares interconectados**:

1. **Sistema de rating Elo transparente** con MoV (margin of victory) FiveThirtyEight + K-factor escalonado por experiencia/tier (4 buckets: d6/d9 × singles/doubles, fusionados en DomiRank Global 1-20). **Sprint v2.1**: cada rating viene acompañado de un score de confiabilidad 0-100% (volumen + recencia + atestiguado + diversidad) y un estado "NR" (Not Rated) en las primeras 5 partidas — comunica honestamente cuándo el rating es estadísticamente confiable
2. **Modelo de confianza por consenso** (3 de 4 jugadores deben confirmar cada partida) — el moat principal, ahora reforzado por el factor "atestiguado" en el score de confiabilidad
3. **Comunidad estructurada** (amigos, torneos formales, clubes/federaciones, ligas continuas)

**Estrategia comercial**: freemium en 5 fases secuenciales:
1. Tip Jar (signal de willingness to pay)
2. Ads en PWA (revenue inicial)
3. Individual Pro $3.99/mo (sin ads + features avanzados)
4. **Club Pro $10-50/mo** (la gran apuesta — federaciones)
5. Marketplace + sponsorships

**Cero pay-to-win**: el rating es sagrado, nunca paywalleado.

**Apuesta principal**: Club Pro. Las federaciones reales (FIDO chapters, Federación Venezolana, asociaciones de RD/Cuba/PR) tienen presupuesto. Convertir 50-100 federaciones = $1-3K MRR garantizado + social proof masivo.

**Targets honestos a 24 meses**:
- Conservative (60% prob): $10K MRR, ~50K MAU, $117K ARR
- Base (30% prob): $30K MRR, ~120K MAU, $360K ARR
- Optimistic (10% prob): $140K MRR, ~500K MAU, $1.7M ARR

**Stack**: Next.js + Supabase + Vercel + Resend (~$33/mo costos a 10K MAU). Roadmap native iOS/Android en mes 12-18, justificado por revenue de AdMob nativo.

---

## 2. Market Opportunity

### Tamaño del mercado

| Métrica | Estimación | Source |
|---|---|---|
| Jugadores de dominó en LatAm | 200-400M | Federaciones nacionales + cultural research |
| Smartphone penetration LatAm | 72% (2026) | Statista |
| **TAM** (mercado adoptable digital) | ~150-280M | LatAm domino × smartphone penetration |
| **SAM** (target competitivo amateur) | 30-50M | Quienes jugarían rated games regularmente |
| **SOM** (realista 3 años) | 500K-2M MAU | 1-5% de SAM con producto well-executed |

### Distribución geográfica priorizada

| País | Players estimados | Domino cultural significance | Priority |
|---|---|---|---|
| Venezuela | 20-30M | 🇻🇪 Polla nacional, popular en barrios | P0 (founder reach) |
| Rep. Dominicana | 8-12M | 🇩🇴 Deporte oficial casi | P0 |
| Cuba | 5-8M | 🇨🇺 Doble-nueve cultural | P1 |
| Puerto Rico | 2-4M | 🇵🇷 Casinos + casual | P1 |
| México | 15-25M | 🇲🇽 Norte + Yucatán | P1 |
| Colombia | 10-15M | 🇨🇴 Costeño popular | P2 |
| USA (diaspora) | 8-12M | 🇺🇸 Florida + NYC + Texas | P3 |
| Spain (diaspora) | 2-3M | 🇪🇸 Comunidades latinas | P3 |

**Diáspora insight**: comunidades dominicanas en NYC, cubanas en Miami, venezolanas en Doral juegan dominó religiosamente. La app puede llegarles via WhatsApp groups + Spanish-language marketing en USA.

### Análisis cultural — por qué dominó NO es "juego casual" en LatAm

Es:
- **Ritual social** (los domingos en casa, encuentros familiares)
- **Deporte amateur serio** (federaciones, ranking nacional, torneos)
- **Pasatiempo de tres generaciones** (abuelos → padres → hijos)
- **Apuesta social** ("pollas" con cuotas pequeñas, premios simbólicos)

Comparable: ajedrez en Rusia, padel en España. **Cultural depth, no fad**.

### Pain points actuales (sin DomiRank)

1. **No rating sistema** — no hay forma de saber "qué tan bueno soy"
2. **Marcadores en papel** — se pierden, no hay historial
3. **Torneos via Excel + WhatsApp** — caos, errors, sin bracket digital
4. **Comunidad fragmentada** — WhatsApp groups por barrio, no descubrimiento
5. **Federaciones con ranking manual** — FIDO maneja ranking de torneos oficiales sin app, no accesible para amateurs

DomiRank resuelve los 5 pain points en un solo producto.

---

## 3. Customer Personas (3 segmentos)

### Persona 1: "Carlos" — El Casual Host

**Demografía**: 28-45 años, profesional clase media LatAm, vive en ciudad capital, smartphone iPhone/Samsung mid-tier.

**Comportamiento**:
- Invita 3 amigos a casa una vez al mes para jugar dominó
- Antes usaba papel + lápiz para llevar score
- Ya tiene Spotify, WhatsApp, Instagram — app-friendly

**Motivaciones**:
- Diversión social con amigos
- Curiosidad de "qué tan bueno soy realmente"
- Bragging rights ("le gané al pana")

**Como llega a DomiRank**: amigo le manda screenshot del leaderboard por WhatsApp.

**Conversion path**:
- Mes 1: descarga PWA, registra 2-3 partidas
- Mes 3: trae amigos, crea torneos casuales
- Mes 6: power user → considera Pro si features avanzados llaman

**Revenue contribution**: ad impressions + posible Pro ($3.99/mo) si engagement alto.

**Volumen estimado**: **80-85% de la user base**.

### Persona 2: "Erik" — El Competitive Recurring

**Demografía**: 35-55 años, profesional/empresario, juega dominó **religiosamente** todos los sábados.

**Comportamiento**:
- Grupo fijo de 4 amigos. Cada sábado 9pm a 1am.
- Llevan 6+ meses jugando. 25+ partidas históricas.
- Discuten quien es "mejor" basado en feeling, sin datos

**Motivaciones**:
- Validación competitiva ("soy el #1 de mi grupo")
- Histórico (poder ver "quién ganó el sábado pasado")
- Identidad / orgullo

**Como llega a DomiRank**: Persona 1 lo invita a su torneo. O ve el feature "Rey del día" en redes.

**Conversion path**:
- Mes 1: joinea Liga continua creada por amigo
- Mes 3: feature heavy user — usa daily leaderboard, comparte screenshots
- Mes 6: upgrades a Pro por unlimited history + advanced stats
- Mes 12: organiza torneos mensuales con amigos extra

**Revenue contribution**: Pro subscriber ($3.99/mo). LTV alto (12-24 meses retention probable).

**Volumen estimado**: **10-15% de la user base, pero 50-70% del Individual Pro revenue**.

### Persona 3: "Don Julio" — El Federation Admin

**Demografía**: 50-70 años, organizador de asociación local o federación nacional, retired/late-career.

**Comportamiento**:
- Maneja una asociación de 50-500 members
- Organiza torneos mensuales con bracket, premios, cuotas
- Usa Excel + WhatsApp + papel para todo
- Frustrado con la falta de herramientas pro

**Motivaciones**:
- Profesionalizar la operación de su asociación
- Atraer nuevos members con tooling moderno
- Branding (logo del club, presencia digital)
- Legacy ("dejé esto profesional cuando me retire")

**Como llega a DomiRank**: outreach manual del founder. O recomendación de un member casual.

**Conversion path**:
- Mes 1: prueba con free trial de 6 meses Club Elite (oferta del founder)
- Mes 6: si los members lo adoptan, paga Club Pro ($19.99) o Elite ($49.99)
- Mes 12: case study + referencias a otras federaciones

**Revenue contribution**: **Club Pro/Elite $10-50/mo + indirecto: trae 50-500 members al free tier**.

**Volumen estimado**: **<1% de las cuentas pero 30-40% del revenue eventually**.

---

## 4. Value Proposition Canvas

### Para Carlos (Casual Host)

**Jobs to be done**:
- Llevar score de partidas sin papel
- Entretener amigos con stats
- Mostrar "quién ganó" después

**Pains aliviados**: papel + lápiz se pierde, discusiones por marcador olvidado, no hay rivalry tracking.

**Gains creados**: stats personales que generan conversation, compartir screenshot del leaderboard, sense of progress (rating sube).

### Para Erik (Competitive Recurring)

**Jobs to be done**:
- Saber "qué tan bueno soy"
- Trackear histórico vs amigos
- Identidad como jugador

**Pains aliviados**: sin objetividad sobre habilidad, histórico se pierde, rivalidades sin métricas.

**Gains creados**: rating Elo riguroso, histórico permanente, "Rey del día" / "Mejor partner" insights, bragging rights con data.

### Para Don Julio (Federation)

**Jobs to be done**:
- Organizar torneos profesionales
- Mantener ranking oficial de members
- Comunicar a members
- Atraer talento joven

**Pains aliviados**: Excel + WhatsApp es caos, branding inexistente, hard sell para juventud sin tools.

**Gains creados**: tournament management profesional, custom branding (Club Pro), analytics dashboard, modernización institucional.

---

## 5. Revenue Model — 5 Phases Sequential

### Fase 0 — Pre-launch (HOY → mes 2)
**Revenue**: $0
**Foco**: terminar features core (Epic Q, R, S), lanzar PWA pública, primeros 500 MAU orgánicos.
**KPI principal**: D7 retention >40%, D30 >25%.

### Fase 1 — Tip Jar (mes 2-3)
**Revenue**: $200-500/mes marginal
**Foco**: signal de willingness to pay. Botón "Apoyar DomiRank" en /settings con opciones $3 / $10 / $25 one-time.
**Beneficio para tipper**: badge "Founding Supporter" + nombre en credits.
**Importancia**: NO es revenue importante. Es **señal** de qué % de users valora el producto lo suficiente para pagar voluntariamente.

### Fase 2 — Ads en PWA (mes 3-6, post-PMF)
**Revenue**: $200-1,500/mes según MAU (escala con tráfico)
**Stack técnico**: AdSense en PWA (no AdMob — eso requiere native).
**Placement**: banners en dashboard / leaderboard / discover. Native ads en feeds. Sin interstitials agresivos.
**Trigger de lanzamiento**: 5K MAU con D30 retention >25%.

### Fase 3 — Individual Pro (mes 6-9)
**Revenue**: $500-3,000/mes a 10-20K MAU (2-3% conversion)
**Pricing**: $3.99/mes / $29.99/año / $99 lifetime (limited 1000 users)
**Features Pro**:
- Sin ads
- Match history ilimitado (vs 50 free)
- Stats avanzados (head-to-head deep, partner synergy, performance por hora)
- Todos los 4 buckets tracked
- Export CSV
- Custom themes
- Watermark removido en share images

### Fase 4 — Club Pro (mes 9-15) — **LA GRAN APUESTA**
**Revenue**: $1,000-15,000/mes según penetración de federaciones
**Tiers**:
- **Starter** $9.99/mo — hasta 30 members
- **Pro** $19.99/mo — hasta 100 members + custom branding + analytics + tournament priority
- **Elite** $49.99/mo — unlimited + custom subdomain + API + sponsored tournaments

**Estrategia de adquisición**:
- Outreach manual a 20-30 federaciones reales (VE, DO, CU, PR)
- Free 6 meses Club Elite a las primeras 5-10 que aceptan
- Esas 5-10 traen automáticamente 500-1000 members al free tier
- Después de 6 meses gratis, conversion a paid esperada: 60-80%

**Por qué Club Pro es donde está el dinero real**:
- LTV mucho más alto que Individual ($240-1200/año vs $48/año individual)
- Sticky — federaciones no migran entre apps fácilmente
- Brings members (network effect)

### Fase 5 — Marketplace + Sponsorships (mes 15-24)
**Revenue**: variable, alto upside ($5-50K/mes posible)
**Sources**:
- Sponsored tournaments por brands (Polar/Solera/Cerveza Brahma/Brugal/Presidente)
- Affiliate links a dominoes físicos (Amazon, MercadoLibre)
- Branded events (Club Elite tiene built-in revenue share opcional)
- Aggregated insights B2B (anonymous, ético, opt-in)

### Revenue mix proyectado a 24 meses (Base case)

| Source | % Revenue | $/mes |
|---|---|---|
| Ads | 30% | $9,000 |
| Individual Pro | 30% | $9,000 |
| Club Pro | 35% | $10,500 |
| Marketplace | 5% | $1,500 |
| **Total** | **100%** | **$30,000** |

---

## 6. Pricing Strategy

### Principios

1. **LatAm PPP-adjusted** — Spotify cobra $2.50/mo en Venezuela, no $10. Respetar capacidad de pago real.
2. **Cero pay-to-win** — el rating es sagrado. Ningún paywall puede afectar el cálculo del Elo.
3. **Free tier funcional siempre** — recording matches, rating, leaderboard, friends, clubs, tournaments como player. Todo gratis para siempre.
4. **Annual 35% discount** — incentivar commitment + reducir churn.
5. **Lifetime para early adopters** — FOMO play, $99 limited a 1000 users primeros 90 días post-launch de Pro.

### Tabla de pricing (USD, sin localización aún)

| Tier | Mensual | Anual | Lifetime |
|---|---|---|---|
| Free | $0 | $0 | $0 |
| Individual Pro | $3.99 | $29.99 (-37%) | $99 (1000 first) |
| Club Starter | $9.99 | $79.99 (-33%) | — |
| Club Pro | $19.99 | $159.99 (-33%) | — |
| Club Elite | $49.99 | $399.99 (-33%) | — |

### Localización por país (Stripe Tax + price localization)

| País | Individual Pro | Club Pro | Club Elite |
|---|---|---|---|
| US/EU | $4.99/mo | $29.99/mo | $69.99/mo |
| MX, AR | $3.99 | $19.99 | $49.99 |
| CO, CL, PE | $2.99 | $14.99 | $39.99 |
| VE, BO | $1.99 | $9.99 | $24.99 |

NO usar moneda local — todo USD. La gente en LatAm paga con tarjeta internacional o no paga. Estándar de la industria SaaS.

---

## 7. Go-to-Market Strategy

### Fase 1 — Soft launch (mes 0-3)
**Target**: 500-2,000 MAU
- Beta cerrado con 50-100 amigos del founder (Venezuela)
- WhatsApp groups de pollas reales
- Word-of-mouth viral
- Sin marketing pago

**KPI**: D30 retention >25%, viral coefficient >0.5.

### Fase 2 — Public launch + soft marketing (mes 3-6)
**Target**: 5,000-10,000 MAU
- Press release a medios LatAm tech
- Instagram + TikTok organic content
- Padel/sports influencers LatAm
- SEO content

**KPI**: 5K MAU, ads break-even ($200+/mes net).

### Fase 3 — Federation outreach (mes 6-12)
**Target**: 5-10 federaciones onboarded + 30K MAU
- Lista manual de 50 federaciones LatAm con contacto
- Outreach personal del founder (email + WhatsApp + call)
- Pitch directo: "Free 6 meses Club Elite + onboarding gratis si traen 50+ members"
- Las primeras 5-10 federaciones convertidas son social proof masivo
- Case studies + testimonios publicados

**KPI**: 5 federaciones contratadas, $1-3K MRR de Club Pro/Elite.

### Fase 4 — Native app launch (mes 12-15)
**Target**: 50K+ MAU
- Submit iOS + Android apps post-RN port
- AdMob integration habilitada
- ASO (App Store Optimization) español-first
- Push notifications para retention

**KPI**: 50K MAU, $10K MRR.

### Fase 5 — Diaspora expansion (mes 15-24)
**Target**: 200K MAU
- Spanish-language ads en USA (Facebook + Instagram targeting LatAm diaspora)
- Partnerships con bodegas / Latino markets en Florida / NYC / Texas
- Community events (sponsored tournaments en diaspora communities)

**KPI**: 200K MAU, $30K+ MRR.

---

## 8. Unit Economics

### Customer Acquisition Cost (CAC)

| Channel | CAC | Notas |
|---|---|---|
| Word-of-mouth viral | $0 | Cero costo, alto LTV |
| Organic content (social) | $0 | Time invested, no cash |
| Sports influencers | $20-50 | Mid-tier LatAm |
| Facebook/Instagram ads | $5-15 | LatAm low CPM |
| Federation outreach | $0 (time) | Founder hace personalmente |

**Blended CAC realista año 1**: $3-8 (dominantly organic + viral).
**Blended CAC año 2**: $5-12 (mix de paid + organic).

### Customer Lifetime Value (LTV)

| Segment | Months retention avg | Monthly revenue | LTV |
|---|---|---|---|
| Free user con ads | 8 meses | $0.15 | $1.20 |
| Individual Pro | 14 meses | $3.30 (net) | $46 |
| Club Pro | 24 meses | $16 (net) | $384 |
| Club Elite | 36 meses | $42 (net) | $1,512 |

### LTV:CAC Ratio

- Free user: $1.20 / $5 = **0.24** (loss per user, recovered by Pro conversion of 2-3%)
- Individual Pro: $46 / $10 = **4.6** ✓ healthy
- Club Pro: $384 / $50 = **7.7** ✓ excellent
- Club Elite: $1,512 / $100 = **15.1** ✓ stellar

**Estrategia financiera**: free users financiados por Pro + Club Pro. Club Pro y Elite son el real driver de unit economics positive.

### Payback period

- Individual Pro: **2.7 meses**
- Club Pro: **3.2 meses**
- Club Elite: **2.4 meses**

Todos <6 meses = saludables para B2C SaaS.

---

## 9. Financial Projections — 36 meses

### Conservative (60% probability)

| Mes | MAU | DAU | Pro subs | Club subs | MRR | Cumul revenue |
|---|---|---|---|---|---|---|
| 3 | 1K | 350 | 0 | 0 | $50 | $150 |
| 6 | 4K | 1.4K | 30 | 0 | $300 | $1.2K |
| 9 | 8K | 2.8K | 120 | 2 | $800 | $4.5K |
| 12 | 15K | 5.3K | 300 | 8 | $1,800 | $14K |
| 18 | 30K | 10.5K | 700 | 20 | $4,200 | $42K |
| 24 | 50K | 17.5K | 1,200 | 40 | $9,700 | $122K |
| 36 | 90K | 31.5K | 2,200 | 80 | $18,000 | $320K |

**ARR a 24 meses**: $117K | **ARR a 36 meses**: $216K

### Base case (30% probability)

| Mes | MAU | MRR | Cumul revenue |
|---|---|---|---|
| 6 | 8K | $1,000 | $3K |
| 12 | 25K | $4,000 | $25K |
| 18 | 60K | $14,000 | $90K |
| 24 | 120K | $30,000 | $280K |
| 36 | 250K | $65,000 | $900K |

**ARR a 24 meses**: $360K | **ARR a 36 meses**: $780K

### Optimistic (10% probability — viral hit)

| Mes | MAU | MRR | Cumul revenue |
|---|---|---|---|
| 6 | 20K | $5,000 | $15K |
| 12 | 80K | $14,000 | $90K |
| 18 | 200K | $50,000 | $360K |
| 24 | 500K | $140,000 | $1.2M |
| 36 | 1.5M | $400,000 | $4.5M |

**ARR a 24 meses**: $1.7M | **ARR a 36 meses**: $4.8M

### Targets personales del founder

- **6 meses**: validar PMF (D30 retention >25%, viral coefficient >0.5)
- **12 meses**: $5K MRR — "this is a side project that pays for itself"
- **18 meses**: $15K MRR — "esto puede ser full-time"
- **24 meses**: $30K MRR — "negocio real, considerar hiring"
- **36 meses**: $60-100K MRR — "considerar fundraise para acelerar"

---

## 10. Cost Structure

### Stage 1: 0-1K MAU (mes 0-3)
| Item | Cost |
|---|---|
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| Resend Free | $0 |
| Dominio (.app) | $12/año |
| **Total mensual** | **~$1** |

### Stage 2: 1K-10K MAU (mes 3-9)
| Item | Cost |
|---|---|
| Supabase Pro | $25/mo |
| Resend Pro | $20/mo |
| Sentry Team | $26/mo |
| **Total mensual** | **~$70** |

### Stage 3: 10K-50K MAU (mes 9-18)
| Item | Cost |
|---|---|
| Supabase Pro + add-ons | $50-100/mo |
| Vercel Pro | $20/mo |
| Resend Scale | $90/mo |
| Sentry Business | $80/mo |
| PostHog | $50-200/mo |
| **Total mensual** | **~$300-500** |

### Stage 4: 50K-200K MAU (post-native)
| Item | Cost |
|---|---|
| Supabase Pro + escalado | $200-500/mo |
| PostHog self-hosted | $80/mo |
| RevenueCat | 1% MTR |
| EAS Build Production | $199/mo |
| **Total mensual** | **~$500-1,200** |

**Marginal cost per user**: $0.01/MAU a escala. Excelente para LTV.

### Founder compensation

| Mes | MRR | Founder salary realista |
|---|---|---|
| 0-12 | <$5K | $0 (bootstrap) |
| 12-18 | $5-15K | $2-5K (part-time) |
| 18-24 | $15-30K | $5-10K (transition full-time) |
| 24+ | $30K+ | $10K+ + reinvestir el resto |

---

## 11. Competitive Analysis

### Direct competitors
**Ninguno** en el espacio dominó. Greenfield total.

### Indirect competitors

| Competitor | Categoría | Threat level | Lessons |
|---|---|---|---|
| **Apps de scorekeeper** (Domino Puntos, etc.) | Marcadores básicos | Bajo | No tienen rating ni comunidad |
| **Excel + WhatsApp** | DIY tournament management | Medio | El default actual. Hay que ser **10x mejor** |
| **Chess.com / Playtomic** | Apps de otros deportes | Bajo | Validan el modelo pero NO compiten directo |
| **Federaciones con apps custom** | Específicas por país | Medio-Alto | Pueden construir tooling. Aliarse, no competir |

### Posicionamiento

**"Chess.com para dominó, Playtomic para LatAm."**

### Moats — Defensibility analysis

| Moat | Strength | Tiempo a replicar |
|---|---|---|
| **Network effects de clubes** (federaciones sticky) | Alto | 2-3 años |
| **Data moat** (rating histórico de 100K+ players) | Alto | 1-2 años con escala |
| **Cultural depth** (4 modalidades regionales correctas) | Medio-Alto | 6-12 meses |
| **Trust system** (attestation 3-of-4 + community culture) | Alto | Imposible sin comunidad |
| **Federation verifications** (badges oficiales) | Alto | 1-2 años de relationships |
| **Tipografía técnica del rating** (math riguroso) | Medio | 2-3 meses |

**Moat más fuerte**: combinación **federation relationships + community trust**. Un competidor que copie código no copia federaciones ni cultura.

---

## 12. Distribution Strategy

### Phase 1 — PWA (mes 0-12)
**Estrategia**: PWA-first. Stack actual (Next.js + Supabase).
**Pros**: cero costo Apple Dev / Google Play, updates instantáneos, sin review.
**Cons**: no AdMob nativo, no IAP nativo, App Store presence = 0.

### Phase 2 — Native iOS + Android (mes 12-18)
**Estrategia**: React Native + Expo port (16 semanas).
**Pros**: AdMob nativo (3-5× revenue per user), App Store discovery, push notifications confiables.
**Cons**: 4-6 meses sin features nuevas, costos Apple Dev + Mac.

### Trigger para el port nativo
**NO** hacer el port hasta cumplir:
- 10K-20K MAU consistente
- D30 retention >25%
- Tip jar revenue >$500/mes
- Solicitudes de comunidad por iOS/Android

Sin estos signals, port = premature optimization.

---

## 13. Team Plan

### Stage 1: Solo founder (mes 0-12)
**Carlos**: 100% del trabajo (product, dev, design, BD, marketing, support).
**Tooling**: Claude Code para acelerar dev.

### Stage 2: Primer hire (mes 12-18)
**Cuándo**: $5K MRR sostenido + 10K+ MAU
**Hire #1**: **Community Manager / Customer Success** part-time (~$1K/mo LatAm)
- Responde tickets, modera comunidad, outreach a federaciones
- Razón: el founder no escala respondiendo cada WhatsApp

### Stage 3: Producto + dev (mes 18-24)
**Cuándo**: $15K MRR
**Hires #2-3**:
- **Senior RN dev** contract (~$3-5K/mo) — para mantener iOS/Android
- **Product designer** part-time — para refinar UX, design system

### Stage 4: Comercial (mes 24+)
**Cuándo**: $30K MRR + B2B traction
**Hire #4**: **Federation Sales** part-time/commission
- Outreach proactivo a federaciones LatAm

### Estructura a 36 meses (escenario base)

| Role | FTE | Cost |
|---|---|---|
| Founder (Carlos) | 1.0 | $5K |
| Community Manager | 0.5 | $1K |
| RN Dev contract | 0.3 | $2K |
| Product Designer | 0.3 | $1.5K |
| Federation Sales | 0.4 | $1.5K + comissions |
| **Total** | **~2.5 FTE** | **~$11K/mo** |

A $30K MRR = saludable margin.

---

## 14. Funding Strategy

### Bootstrap (mes 0-18, default)
**Estrategia**: cero raise. Self-funded. Revenue financia growth.

**Pros**:
- Sin pérdida de equity
- Sin presión de investors
- Decisión-making libre
- Forced discipline en costos

**Cons**:
- Growth más lento sin marketing budget
- Founder sin salary los primeros 12 meses
- Sin mentorship institucional de VCs

**Sustainability**: si founder tiene runway personal de 12-18 meses, viable. Si no, considerar consulting paralelo.

### Posible raise (mes 18-24, si signals lo justifican)
**Cuándo**: 30K+ MAU + $15K+ MRR + federation relationships establecidas
**Tipo**: Pre-seed / Seed regional LatAm
**Amount target**: $250K-1M
**Investor profile**:
- LatAm VCs (Kaszek, NXTP, Magma Partners, Cometa)
- Angel investors LatAm con experiencia en sports/community apps
- Strategic: ex-Playtomic / Chess.com / Strava

**Use of funds**:
- Marketing budget ($50-150K)
- Native app development ($30-50K)
- 2-3 hires
- 18-month runway buffer

**NO levantar antes de $15K MRR**. Premature funding mata startups.

---

## 15. Risk Analysis

### Top 5 risks + mitigations

#### Risk 1: No PMF (probabilidad: 40%)
**Síntomas**: D30 retention <15%, viral coefficient <0.3, churn alto.
**Mitigación**:
- Validate hard con beta cerrado (50-100 users intensos)
- Iterar features hasta cracking retention
- Si 6 meses sin signals, considerar pivot

#### Risk 2: Federaciones no convierten a paid (probabilidad: 35%)
**Síntomas**: 5+ federaciones onboarded con free, conversion a paid <30%.
**Mitigación**:
- Pricing más bajo regional
- Más valor en tier base
- Free trial extendido a 12 meses para las primeras 5

#### Risk 3: Apple/Google rechaza apps (probabilidad: 20%)
**Síntomas**: Rejection 4.2 (thin wrapper) o 5.3 (gambling concerns).
**Mitigación**:
- Submission con features differentiated
- Privacy Policy clear sobre "no apuestas reales"
- Fallback a PWA-only forever

#### Risk 4: Competencia entra al espacio (probabilidad: 25%)
**Síntomas**: App similar lanza en LatAm con budget.
**Mitigación**:
- Lock federations con free Elite agresivo
- Build attestation culture rápido
- Cultural depth + Spanish-first

#### Risk 5: Burnout del founder (probabilidad: 30%)
**Síntomas**: 12 meses sin ingresos + 12-15h/day = colapso.
**Mitigación**:
- Forced day off cada semana
- Forced vacations cada 3 meses
- Validar runway antes de full-time
- Considerar co-founder si insostenible

### Black swan risks
- Regulación LatAm sobre apps de ranking → educar regulators preventivamente
- Supabase outage prolongado → disaster recovery plan
- Apple changes affecting PWA → diversify a native earlier

---

## 16. KPIs por stage

### Stage 1: Pre-launch
- D1 / D7 / D30 retention (target 50/35/25%)
- Viral coefficient
- NPS
- Tip jar conversion

### Stage 2: Growth
- MAU growth rate MoM
- DAU/MAU ratio (>0.20)
- CAC by channel
- Cohort retention curves
- Time to first match recorded

### Stage 3: Monetization
- Free → Pro conversion (target 2-3%)
- MRR / ARR growth (target 15-20% MoM)
- Churn rate (target <5% Individual, <2% Club)
- ARPU / LTV:CAC ratio

### Stage 4: Scale
- MAU milestones
- Federation conversions
- Net Revenue Retention (NRR > 100%)
- Ad eCPM by network

### Quality KPIs (siempre)
- Error rate (Sentry)
- API latency p95 (<500ms)
- App Store rating (target >4.5)
- Support response time (target <24h)

---

## 17. Operational Milestones (24-month roadmap)

### Q3 2026 (mes 0-3) — Foundation
- Terminar Epic Q (attestation), Epic R (tournament wizard), Epic S MVP (clubes)
- Logo oficial integrado
- PostHog + Sentry instrumentado
- Beta cerrado con 50 amigos
- **Milestone**: 500 MAU, D30 >25%

### Q4 2026 (mes 3-6) — Public launch
- PWA público (sin marketing pago aún)
- Tip jar + AdSense live
- Outreach a primeras 5 federaciones
- **Milestone**: 5K MAU, $1K MRR

### Q1 2027 (mes 6-9) — Pro launch
- Individual Pro tier ($3.99/mo)
- Founder Lifetime offer (1000 users)
- First 100 paying customers
- First 1-2 federaciones convertidas
- **Milestone**: 15K MAU, $5K MRR

### Q2 2027 (mes 9-12) — Club Pro push
- Club Pro tiers (Starter/Pro/Elite)
- Outreach a 30 federaciones LatAm
- 5-10 federaciones convertidas
- **Milestone**: 30K MAU, $10K MRR

### Q3 2027 (mes 12-15) — Native development
- RN + Expo port (16 weeks)
- Beta testers internos
- **Milestone**: 50K MAU, $15K MRR

### Q4 2027 (mes 15-18) — Native launch
- iOS + Android live
- AdMob activated
- First hire (Community Manager)
- **Milestone**: 80K MAU, $20K MRR

### Q1 2028 (mes 18-21) — Scale + diaspora
- Spanish-language ads USA
- Sponsorships con brands
- Marketplace MVP
- **Milestone**: 150K MAU, $30K MRR

### Q2 2028 (mes 21-24) — Consolidation
- Considerar raise
- Federation count: 20+
- **Milestone**: 250K MAU, $50K MRR

---

## 18. Strategic Decisions Already Made

Para no re-debatir:

| Decisión | Razón |
|---|---|
| PWA-first, native después | Premature native = wasted 4-6 meses. Validar PMF primero. |
| Rating Elo (no OpenSkill) | Más simple, mejor para 2v2 con MoV, más entendible para users. |
| Reliability Score 0-100% (v2.1) | 4 factores (volumen 35% + recencia 25% + atestiguado 25% + diversidad 15%) acompañan al rating. Comunica "qué tan confiable es esta medición" sin mezclar conceptos con el skill. |
| NR (Not Rated) pre-5 partidas (v2.1) | Pill "NR" ámbar reemplaza al número provisional faux. Honestidad > placeholder engañoso. Threshold 5 partidas confirmadas (suma de 4 buckets). |
| Cero pay-to-win en rating | El rating es el moat. Touchearlo destruye la integridad. |
| LatAm-first, USA después | Cultural depth + low CAC en mercado primario. |
| Spanish-only en v1 | Mercado primario habla español. English distrae. |
| Club Pro como apuesta principal | LTV 10x mayor que Individual. Federations sticky. |
| Polla = término genérico | Renombre del formato técnico a "Liga continua". |
| Attestation 3-of-4 | Default ON para engagement + integrity. |
| Wizard 3 pasos | Cero fricción para casual hosts. |
| Bottom nav central = ficha 5-3 | Identidad de marca + acción. |
| Logo oficial con corona | Identidad premium pero LatAm. |

---

## 19. Open Questions

1. **¿AppMob mediation via AppLovin MAX?** (cuando native lance)
2. **¿Soporte para tournaments con apuestas de dinero real?** (regulatory complex, probably NO)
3. **¿Apple Watch / WidgetKit?** (post-launch v2)
4. **¿Cuándo expandir a diaspora USA?** (mes 18+)
5. **¿White-label para federaciones grandes?** (B2B premium tier futuro)
6. **¿Cuándo considerar raise?** (señales claras necesarias, no rush)
7. **¿Co-founder técnico?** (si carga es problema)

---

## 20. Apéndice — Docs relacionados

Para detalle profundo de cada área, ver:

- `PITCH_DOMIRANK.md` — Pitch corto para investors / AI cofounder
- `DOMIRANK_SYSTEM_DOCS.md` — Documentación técnica del sistema
- `MONETIZATION_STRATEGY.md` — Estrategia detallada de freemium + ads + Pro tiers
- `ANALYTICS_STRATEGY.md` — PostHog + Sentry setup
- `ADMOB_STRATEGY.md` — Estrategia AdMob (post-native)
- `RATING_MATH_FORMAL.md` — Matemática rigurosa del Elo (revisable por matemático)
- `RELIABILITY_NR_HOW_IT_WORKS.md` — Spec del score de confiabilidad + NR state (sprint v2.1)
- `domino-app/docs/RATING_SYSTEM.md` — Referencia técnica permanente (DB, funciones, triggers, cron, helpers TS)
- `RN_PORT_PLAN.md` — Plan de port a React Native (16 semanas)
- `EPIC_S_CLUBES.md` — Diseño del módulo de clubes
- `PERSONA_ERIK_DUAL_LEADERBOARD.md` — Persona 2 desarrollado (Erik)
- `TOURNAMENT_WIZARD_REFACTOR.md` — Wizard cero fricción (Carlos persona)
- `POLLA_FORMAT_PROMPT.md` — Liga continua (formato técnico)
- `LOGO_INTEGRATION_PROMPT.md` — Branding integration
- `CLAUDE_CODE_ROUTINES.md` — Routines para mantener docs vivos

---

## Cambios principales vs v2.0

Añadidos en v2.1 (junio 2026):

1. **Reliability Score 0-100%** acompaña cada rating en perfil, dashboard y leaderboard. 4 factores con pesos explícitos (volumen 35% + recencia 25% + atestiguado 25% + diversidad 15%). Tooltip interactivo con breakdown.
2. **NR (Not Rated)** estado para los primeros 5 partidos confirmados. Reemplaza el "rating provisional 1.0 con opacidad" anterior. Card de onboarding en dashboard con progress bar n/5 + tip de diversidad.
3. **`/como-funciona` reescrita** — antes describía OpenSkill (μ/σ/Weng-Lin) ya deprecated. Ahora cubre Elo, NR, 4 niveles de confianza, 4 modalidades y auditoría. SEO completo (canonical + OG + sitemap.xml + robots.txt).
4. **Triggers + cron de mantenimiento** — `update_player_reliability` se dispara al cruzar `status=confirmed` (sin latencia para el usuario) y un cron diario 03:30 UTC refresca scores con decay temporal.

## Cambios principales vs v1

Para referencia, qué cambió desde la versión anterior:

1. **Rating system**: OpenSkill/Plackett-Luce → Elo con MoV. v1 mencionaba OpenSkill como diferenciador. v2 documenta el switch decidido.
2. **Personas detalladas**: v1 tenía descripciones genéricas. v2 tiene 3 personas con nombre (Carlos, Erik, Don Julio) + journey maps.
3. **Revenue model**: v1 era genérico "freemium + premium". v2 es estructurado en 5 fases con triggers + targets.
4. **Pricing**: v1 sin números. v2 con tiers detallados + localización por país.
5. **Club Pro**: v1 no existía. v2 es **la gran apuesta** de revenue (LTV 10x).
6. **Roadmap**: v1 era aspiracional. v2 tiene milestones cuantificables por trimestre.
7. **Unit economics**: v1 no las cubría. v2 tiene CAC, LTV, payback period por segment.
8. **Risk analysis**: v1 mínima. v2 con 5 risks principales + mitigations.
9. **Team plan**: v1 no existía. v2 con cuándo/cómo hire los próximos 24 meses.
10. **Funding strategy**: v1 no la cubría. v2 con criterios de bootstrap vs raise.

---

**Versión 2.1 — última actualización junio 2026**
**Próxima revisión recomendada**: post-launch público + 3 meses de data real.
**Owner final del doc**: Carlos Martínez.
