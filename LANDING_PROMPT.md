# Prompt para Claude Code — Rediseño del landing page de DomiRank

Copia el bloque siguiente entero y pégalo en una sesión nueva de Claude Code en la raíz de `domino-app/`.

---

```
Estoy trabajando en DomiRank — una app web (Next.js 14 App Router + TypeScript + Tailwind + Supabase)
para jugadores de dominó que llevan ranking competitivo, registran partidas en vivo y arman torneos
con sus amigos. Está desplegada en https://domirank.app

El landing page actual está en src/app/page.tsx. Es minimalista: solo tiene un hero con título,
subtítulo, dos botones (Crear cuenta gratis / Ver ranking / Cómo funciona) y una card de "Top 5
DomiRank Global". El problema: no explica el producto, menciona terminología técnica que ahuyenta
("OpenSkill", "Plackett-Luce con aproximaciones Weng-Lin"), no tiene botón visible para iniciar
sesión, y se siente vacío. Visitantes no entienden qué pueden hacer ni se sienten invitados a
registrarse.

Tu tarea: rediseñar src/app/page.tsx (y crear los componentes que necesites en
src/components/landing/) para convertirlo en un landing page profesional, atractivo y orientado a
conversión. Mantén el estilo dark con acento verde primario (#10b981) que ya está en
tailwind.config.ts y globals.css. Mobile-first.

REGLAS DE COPY Y VOCABULARIO:

1. NUNCA menciones: "OpenSkill", "Plackett-Luce", "Weng-Lin", "μ", "σ", "Bayesiano",
   "inverse-variance", "ordinal", ni ningún término técnico del motor de cálculo. Reemplaza por
   lenguaje natural: "rating", "sistema profesional de puntuación", "nivel", "habilidad real".

2. Capitalización correcta en español:
   - Marca: "DomiRank" (mayúscula la D y la R).
   - Países: Venezuela, República Dominicana, Cuba, Puerto Rico, Colombia, México (todos con
     mayúscula inicial).
   - Modalidades regionales: Venezolano, Dominicano, Cubano, Puertorriqueño (mayúscula inicial
     porque son gentilicios usados como nombre propio del estilo de juego).
   - Títulos de sección en sentence case ("Cómo funciona", no "COMO FUNCIONA" ni "Como Funciona").
   - Nunca en TODO MAYÚSCULAS excepto el logo "DR" del badge.

3. Tono: cercano y motivador, no formal frío. Como The Grint o Strava pero en español natural
   (no argentino: usa "tú" no "vos", evita "che" / "boludo" / "laburar").

4. NO uses emojis decorativos cada dos palabras. Máximo 1-2 emojis bien colocados (banderas de
   país en la sección de modalidades, por ejemplo).

ESTRUCTURA DEL LANDING (de arriba hacia abajo):

═══════════════════════════════════════════════════════════════════
SECCIÓN 0 — TOP NAV (sticky, fondo translúcido con backdrop-blur)
═══════════════════════════════════════════════════════════════════
- Izquierda: logo (badge "DR" gradient verde + texto "DomiRank")
- Derecha: dos elementos visibles SIEMPRE:
  • Link "Iniciar sesión" (texto plano, sin fondo) → /login
  • Botón "Crear cuenta" (verde primario, redondeado) → /signup
- En mobile: el "Iniciar sesión" también debe ser visible (no esconderlo en un menú). Si por
  espacio no caben los dos, prioriza ambos como pills compactas. Es la queja principal del
  usuario: el log in no se ve.

═══════════════════════════════════════════════════════════════════
SECCIÓN 1 — HERO (above the fold)
═══════════════════════════════════════════════════════════════════
- Headline (~3.5rem en desktop, 2.5rem mobile, font-extrabold, tracking-tight):
  "DomiRank — tu nivel real de dominó, oficial."
- Subtitle (text-text-dim, max-w-2xl, centrado):
  "Lleva el marcador de cada partida, sigue tu rating contra rivales reales y arma torneos con tus
  amigos. La primera plataforma con rankings respetando las modalidades de cada país: Venezolano,
  Dominicano, Cubano y Puertorriqueño."
- Dos CTAs principales lado a lado, centrados:
  • Botón primario verde: "Crear cuenta gratis" → /signup
  • Botón ghost: "Iniciar sesión" → /login
- Animación: framer-motion fade-in con slide-up para el headline (delay 0), subtitle (delay 0.15s),
  y CTAs (delay 0.3s). Stagger natural.
- Visual a la derecha (desktop) o debajo (mobile): un mockup de teléfono con la pantalla del
  dashboard. Puedes hacerlo con un div estilizado (border-radius grande tipo iPhone, sombra suave)
  conteniendo SVG/JSX que simule la UI real con números de rating ticking suavemente. No uses una
  imagen externa — todo inline.

═══════════════════════════════════════════════════════════════════
SECCIÓN 2 — "POR QUÉ DOMIRANK" (3-4 cards de features)
═══════════════════════════════════════════════════════════════════
Título de sección: "Más que un marcador"
Grid de 3-4 cards con icon (Tabler outline) + título + descripción corta:

1. icon "trophy" → "Ranking profesional"
   "Tu rating sube cuando ganas a rivales fuertes y se ajusta a tu nivel real. Sin trampas, sin
   inflación, sin estimaciones a ojo."

2. icon "flag" → "Modalidades de cada país"
   "Soporte completo para dominó Venezolano, Dominicano, Cubano y Puertorriqueño. Cada uno con sus
   reglas, sus puntos y su bonus de capicúa."

3. icon "users" → "Juega con tu gente"
   "Invita a tus amigos, búscalos por usuario, mantén historial conjunto y mira partidas en vivo
   desde tu teléfono mientras juegan los demás."

4. icon "tournament" o "medal" → "Torneos a tu medida"
   "Crea torneos privados con tu grupo o públicos para tu comunidad. Suizo, eliminación, round
   robin, liga por puntos — el formato que prefieras."

Hover: cada card sube ligeramente (translateY -2px), border cambia a primary/40.
Animación de entrada: fade+slide al hacer scroll (useInView con framer-motion).

═══════════════════════════════════════════════════════════════════
SECCIÓN 3 — "CÓMO FUNCIONA" (3 pasos numerados)
═══════════════════════════════════════════════════════════════════
Título: "Empezar es fácil"
Subtitle: "En 3 minutos estás registrando tu primera partida."

Tres columnas en desktop, stack en mobile. Cada paso tiene:
- Número grande (1, 2, 3) en gradient verde→azul.
- Título corto.
- Descripción.

Paso 1: "Crea tu cuenta"
"Regístrate con tu correo, Google o Apple. Te preguntamos qué tan bien juegas para empezar con un
rating cercano a tu nivel."

Paso 2: "Agrega a tus amigos"
"Búscalos por nombre de usuario y mándales solicitud. Solo puedes jugar partidas con amigos
aceptados, así nadie infla rating con cuentas falsas."

Paso 3: "Juega y suma puntos"
"Registra cada partida en vivo desde el teléfono. Los 4 jugadores ven el marcador a tiempo real.
Al cerrar la partida, los ratings se ajustan automáticamente."

═══════════════════════════════════════════════════════════════════
SECCIÓN 4 — MODALIDADES DE JUEGO
═══════════════════════════════════════════════════════════════════
Título: "Tu modalidad favorita, respetada"

Cuatro cards horizontales (grid 4 cols en desktop, 2 en tablet, 1 en mobile):

🇻🇪 Venezolano
"Doble-seis · 100 puntos · capicúa +30"
"El estilo más rápido y limpio. Ideal para mesas con tiempo limitado."

🇩🇴 Dominicano
"Doble-seis · 200 puntos · capicúa +30"
"Más estratégico, partidas largas. El estándar en NY, Miami y la isla."

🇨🇺 Cubano
"Doble-nueve · 150 puntos · capicúa +30"
"Set extendido de 55 fichas. Más memoria, más profundidad."

🇵🇷 Puertorriqueño
"Doble-seis · 200 puntos · capicúa +50"
"Bonus de capicúa más generoso. Ritmo intenso."

(Las banderas son emojis, está bien en este caso porque es una elección consciente de país, no un
adorno de username.)

═══════════════════════════════════════════════════════════════════
SECCIÓN 5 — DEMO VISUAL (opcional pero recomendado)
═══════════════════════════════════════════════════════════════════
Captura de pantalla animada del dashboard mostrando el rating subir, partidas recientes y top 5
del leaderboard. Construida en JSX/CSS, no PNG. Hover sobre las cards las anima sutilmente.

═══════════════════════════════════════════════════════════════════
SECCIÓN 6 — FAQ (acordeón colapsable)
═══════════════════════════════════════════════════════════════════
Título: "Preguntas frecuentes"

5-6 preguntas con respuesta colapsable. Sin librería extra — usa <details> y <summary> o un
componente custom con framer-motion. Sugerencias:

- ¿DomiRank es gratis? "Sí. Crear cuenta, registrar partidas, ver tu rating y armar torneos
  privados con amigos es completamente gratis. Próximamente lanzaremos un plan Pro opcional con
  estadísticas avanzadas, pero el producto base seguirá siendo gratis para siempre."

- ¿Necesito que todos mis amigos tengan cuenta? "Sí, todos los jugadores de una partida deben
  tener cuenta. Es la única forma de que el rating refleje resultados reales."

- ¿Puedo jugar diferentes modalidades? "Por supuesto. Cada partida elige su modalidad al
  iniciarla y los ratings se calculan por separado por formato de juego."

- ¿Qué pasa si registramos mal una partida? "Cuando termina una partida, los 4 jugadores deben
  confirmar el resultado. Si alguien lo disputa, el creador puede corregirla antes de aplicar el
  rating." (esto se va a implementar próximamente, por ahora menciona como característica)

- ¿Puedo crear torneos con personas que no son mis amigos? "Los participantes de torneos privados
  son tus amigos. Para torneos públicos cualquier usuario registrado puede unirse."

- ¿Funciona en iPhone y Android? "Sí, es una app web que se ve y funciona como nativa en
  cualquier teléfono. Puedes agregarla a tu pantalla de inicio desde el navegador."

═══════════════════════════════════════════════════════════════════
SECCIÓN 7 — CTA FINAL
═══════════════════════════════════════════════════════════════════
Card grande, fondo con gradient verde→azul sutil, padding generoso, texto centrado:

"¿Listo para conocer tu nivel real?"
Sub: "Crea tu cuenta gratis en menos de un minuto."
Botón único grande: "Empezar ahora →" → /signup

═══════════════════════════════════════════════════════════════════
SECCIÓN 8 — FOOTER
═══════════════════════════════════════════════════════════════════
- Logo DomiRank a la izquierda.
- Links: Términos · Privacidad · Cómo funciona · Contacto (mailto:hello@domirank.app).
- Copy de copyright: "© 2026 DomiRank. Todos los derechos reservados."

═══════════════════════════════════════════════════════════════════
DETALLES TÉCNICOS
═══════════════════════════════════════════════════════════════════

1. Animaciones con framer-motion. Instálalo si no está: npm install framer-motion. Patrones a
   usar:
   - fade+slide-up al cargar (hero).
   - useInView para animar secciones al hacer scroll dentro de viewport.
   - Hover: scale 1.02 o translateY -2px en cards.
   - Stagger children para listas de features y modalidades.

2. Si el usuario YA está autenticado al visitar /, redirige a /dashboard en lugar de mostrar el
   landing. Usa getCurrentUser() de @/lib/auth.

3. Para el mockup del phone hero, dibújalo inline con divs estilizados (background, border-radius,
   shadow). Adentro: header de la app con un avatar + "Carlos M." + un número grande "12.4" en
   verde (representa el rating ejemplo 1-20). Debajo, 2-3 cards mini de partidas recientes con
   delta +/- en color. Si te queda bien, ánimalo: el número 12.4 hace un tick-up sutil cada 4s
   simulando que sube.

4. Usa el AppShell EXISTENTE solo si te ayuda. El landing puede ser una página independiente del
   AppShell — de hecho probablemente sea mejor que NO use el AppShell con su bottom nav (que es
   solo para autenticados) y use un layout propio: nav simple arriba + main content + footer.
   Verifica src/app/layout.tsx — quizá tengas que detectar si la ruta es "/" y renderizar sin
   AppShell. Una forma: en layout.tsx hacer un check con usePathname, o crear un route group
   (landing) con su propio layout.

5. SEO: agrega metadata correcta en page.tsx:
   - title: "DomiRank · Ranking oficial de dominó por modalidad"
   - description: "La primera plataforma para llevar tu nivel real de dominó. Registra partidas,
     compite con tus amigos y arma torneos en tus modalidades favoritas."
   - openGraph + twitter card con imagen og:image (puedes generar dinámicamente o usar una
     captura fija — si haces dinámica, usa Vercel OG en /app/opengraph-image.tsx).

6. Accessibility:
   - Botones con aria-label cuando solo tengan icono.
   - Contraste suficiente (verde primary sobre fondo dark cumple WCAG AA).
   - Foco visible con outline en navegación con teclado.
   - <h1> único en hero, jerarquía correcta hacia abajo.

7. Performance:
   - Todo lo above-the-fold sin lazy load.
   - Lazy load (Suspense + dynamic) para FAQ y secciones bajas.
   - No agregues imágenes externas pesadas; todo SVG/CSS inline.

CRITERIO DE ACEPTACIÓN

- Visito https://domirank.app (no autenticado) y veo el landing completo con todas las 8
  secciones bien organizadas y animadas.
- Tanto "Iniciar sesión" como "Crear cuenta" están visibles desde el top nav y no se esconden
  en mobile.
- NO hay ninguna mención de OpenSkill, Plackett-Luce, Weng-Lin, μ, σ ni terminología técnica
  del motor.
- El copy usa "tú" (no "vos"), capitalización correcta, sentence case en títulos.
- Las modalidades aparecen con sus banderas y descripciones claras.
- El FAQ funciona como acordeón.
- Si estoy autenticado y abro /, me lleva directo a /dashboard sin mostrar el landing.
- En mobile (375px ancho) todo se ve cómodo, sin scroll horizontal.
- El build de Next.js pasa sin errores ni warnings.

ARCHIVOS A TOCAR O CREAR

- src/app/page.tsx (rewrite completo)
- src/app/layout.tsx (posiblemente ajustar para que / no use AppShell)
- src/components/landing/Hero.tsx (nuevo)
- src/components/landing/Features.tsx (nuevo)
- src/components/landing/HowItWorks.tsx (nuevo)
- src/components/landing/Modalities.tsx (nuevo)
- src/components/landing/FAQ.tsx (nuevo)
- src/components/landing/FinalCTA.tsx (nuevo)
- src/components/landing/Footer.tsx (nuevo)
- src/components/landing/Topnav.tsx (nuevo, navegación específica del landing)
- src/components/landing/PhoneMockup.tsx (nuevo, dibujado inline)
- src/app/opengraph-image.tsx (opcional, OG image dinámica)

Cuando termines, hazme un resumen de lo que cambió y commit con mensaje:
"feat(landing): rediseño completo orientado a conversión + log in visible"
```

---

## Cómo usarlo

1. Abre Claude Code en `domino-app/`.
2. Pega el bloque entero (desde la primera línea hasta el último triple backtick interno).
3. Claude Code va a leer el page.tsx actual, planear el rediseño, crear los componentes y comitear.
4. Revisa el diff antes de aceptar el commit. Especialmente verifica:
   - Que NO quedó ninguna mención técnica del motor.
   - Que "Iniciar sesión" se ve tanto en desktop como en mobile.
   - Que el usuario autenticado va directo al dashboard.
5. Push a Vercel.
