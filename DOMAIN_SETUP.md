# Setup de dominio domirank.io + correos @domirank.io

Guía completa de A a Z para tener:
- `https://domirank.io` apuntando a la app en Vercel
- Correos transaccionales `noreply@domirank.io` (magic links, friend requests, etc.) vía Resend
- (Opcional) Buzones reales para recibir `hello@domirank.io`, `support@domirank.io`

Tiempo total: 45-60 minutos. Costo: ~$48/año (.io) + $0-6/mes según opción de correo.

---

## Paso 1 · Comprar el dominio

**Opciones recomendadas para .io:**

| Registrar | Precio .io año 1 | Renovación | Pro |
|---|---|---|---|
| **Porkbun** | ~$36 | ~$48 | Más barato, UI limpia, DNS gratis, soporta APIs |
| **Cloudflare Registrar** | ~$48 (precio costo) | ~$48 | Costo limpio, no markup, integración con Cloudflare DNS |
| Namecheap | ~$45 | ~$55 | Marca conocida, soporte ok |

**Mi recomendación:** Porkbun. Más barato + DNS gratis incluido + interfaz simple.

**Pasos:**

1. Ve a https://porkbun.com → busca `domirank.io` → si está disponible, agrégalo al carrito.
2. Crea cuenta (correo + contraseña + 2FA recomendado).
3. **NO añadas extras** al checkout: rechaza WHOIS Privacy (Porkbun lo da gratis automáticamente), no necesitas hosting de email todavía, no necesitas SSL premium (Vercel da SSL gratis).
4. Paga con tarjeta. ~$36 USD.
5. El dominio aparece en tu cuenta inmediatamente.

Verifica que tienes WHOIS Privacy activo: ve a "Account → Domain Management → domirank.io" y debe decir "WHOIS Privacy: Enabled" (oculta tu nombre y dirección personal del registro público).

---

## Paso 2 · Conectar el dominio a Vercel

Tu app ya está en Vercel en una URL tipo `domirank-xxxxx.vercel.app`. Vamos a hacer que `domirank.io` apunte ahí.

1. **En Vercel:**
   - Dashboard → proyecto **domirank** → **Settings → Domains**.
   - Click **Add Domain** → escribe `domirank.io` → Add.
   - Vercel te muestra "Add the following records to your domain registrar":
     - Tipo: **A** · Nombre: `@` · Valor: `76.76.21.21`
     - (Y para `www.domirank.io` usualmente CNAME a `cname.vercel-dns.com`)
   - Deja esta ventana abierta. Hay otra opción "Recommended": agregar dominio `www.domirank.io` también y configurarlo como redirect.

2. **En Porkbun:**
   - Account → Domain Management → click `domirank.io` → **DNS Records**.
   - Vas a ver registros por defecto. Borra todos los CNAME y A que Porkbun puso (alias, parking page).
   - Agrega los registros que te dio Vercel:
     - **A** record: Host = (vacío o `@`) · Answer = `76.76.21.21` · TTL default
     - **CNAME** record: Host = `www` · Answer = `cname.vercel-dns.com` · TTL default
   - Save.

3. **Espera la propagación.** DNS tarda entre 5 min y 24h. Generalmente 5-30 min en .io.

4. **Verifica en Vercel.** Vuelve a Vercel → Domains. Cuando esté propagado verás un check verde junto a `domirank.io`. Vercel emite el certificado SSL automáticamente (1-2 min más).

5. **Configura `www` redirect.** Una vez ambos dominios estén validados, configura `domirank.io` como **Primary Domain** y `www.domirank.io` como redirect (Vercel lo hace en un toggle).

6. **Actualiza Supabase Auth URLs:**
   - Supabase → Authentication → URL Configuration.
   - **Site URL**: `https://domirank.io`.
   - **Redirect URLs**: agrega `https://domirank.io/auth/callback` y `https://domirank.io/reset-password`.
   - Mantén también las URLs viejas de Vercel mientras transicionas.

7. **Actualiza variables en Vercel:**
   - Settings → Environment Variables.
   - Edita `NEXT_PUBLIC_APP_URL` → cambia a `https://domirank.io`.
   - Redeploy (Deployments → último → ⋯ → Redeploy).

8. **Actualiza Google OAuth:**
   - Google Cloud Console → Credentials → DomiRank Web OAuth Client.
   - En **Authorized JavaScript origins**: agrega `https://domirank.io`.
   - En **Authorized redirect URIs**: ya está el de Supabase, no cambies eso.
   - Save.

**Verificación:** abre `https://domirank.io` — debe cargar tu app con SSL válido (candado verde). El login con magic link, password y Google debe seguir funcionando.

---

## Paso 3 · Correos transaccionales (noreply@domirank.io)

Esto es lo que la app **envía** automáticamente: magic links, confirmación de cuenta, friend requests, reset de contraseña. Lo manejamos con **Resend** (ya lo tenías considerado en el roadmap).

### 3.1 Verificar dominio en Resend

1. Ve a https://resend.com → si no tienes cuenta, regístrate.
2. Dashboard → **Domains** (sidebar) → **Add Domain**.
3. Escribe `domirank.io` → click Add.
4. Resend te muestra varios registros DNS para verificar el dominio:
   - **SPF** (TXT): autoriza a Resend a enviar correo en tu nombre.
   - **DKIM** (TXT, 2-3 registros): firma criptográfica para evitar spoofing.
   - **DMARC** (TXT, opcional pero recomendado): política de qué hacer con correos no autenticados.
   - **MX** record para `send.domirank.io`: para procesar bounces y feedback.
5. **Copia uno por uno y pégalos en Porkbun:**
   - Cada registro tiene Host y Value que Resend te indica. Cópialos textualmente.
   - En Porkbun → DNS → Add record → elige tipo (TXT, MX, CNAME según indique Resend).
6. Cuando termines de pegar todos, vuelve a Resend → click **Verify DNS Records**.
7. Espera 5-30 min. Cuando todos los registros estén verificados (✓ verde junto a cada uno), el dominio pasa a "Verified".

### 3.2 Configurar Supabase para usar Resend SMTP con tu dominio

Vas a reemplazar el SMTP de Gmail que tienes ahora.

1. Resend → **API Keys** → **Create API Key** → nombre `domirank-supabase` → permisos "Sending access" → Create. Copia la key (`re_...`).
2. Supabase → Authentication → **Emails** → **SMTP Settings** → edita:
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: la API key que acabas de copiar (`re_...`)
   - **Sender email**: `noreply@domirank.io`
   - **Sender name**: `DomiRank`
3. Save. Espera 2 min.
4. Prueba: pídete a ti mismo un magic link desde la app. El correo debe llegar **desde** `noreply@domirank.io` (no desde tu Gmail).

### 3.3 Configurar la app para envíos directos vía Resend (futuro)

Para friend requests por email, notificaciones de partidas, etc., la app va a llamar a Resend directamente (no vía Supabase SMTP).

1. Crea otra API key en Resend → `domirank-app` → Sending access → copia.
2. En Vercel → Environment Variables → agrega `RESEND_API_KEY` = `re_...`.
3. Cuando hagas las stories L1/N1 del backlog (USER_STORIES_v2.md), Claude Code usará esta env var.

**Límites del plan free de Resend:**
- 3,000 correos/mes gratis.
- 100 correos/día gratis.
- Suficiente para empezar. Cuando crezcas pasas al plan Pro ($20/mes, 50K correos/mes).

---

## Paso 4 (Opcional) · Correos para recibir (hello@domirank.io)

Si quieres poder **recibir** correos en `hello@domirank.io` o `support@domirank.io` (no solo enviar transaccionales), necesitas un mail provider con buzones.

Tres opciones, de más barato a más completo:

### Opción A — Zoho Mail Free (gratis hasta 5 usuarios, 5 GB c/u)

1. https://www.zoho.com/mail → Sign up Free.
2. Te pide tu dominio: `domirank.io`.
3. Zoho te da registros DNS (MX, SPF, DKIM). **OJO:** los registros SPF/DKIM de Zoho van a chocar con los de Resend. Hay que combinarlos:
   - SPF: combina en un solo registro TXT en `@` con valor `v=spf1 include:zoho.com include:_spf.resend.com ~all`.
   - DKIM: ambos servicios usan selectores distintos, no chocan.
4. En Porkbun: agrega los registros MX de Zoho (varios, con prioridades 10, 20, 50).
5. Crea el primer usuario en Zoho admin: `hello@domirank.io` o el que quieras.
6. Configura SMTP/IMAP para recibirlo en tu cliente (Apple Mail, Gmail con redirect, etc.).

**Pro:** gratis. **Contra:** interfaz Zoho no es la mejor; calidad de deliverability menor que Google.

### Opción B — Google Workspace ($6/mes/usuario)

1. https://workspace.google.com → Get started.
2. Configura tu dominio: `domirank.io`.
3. Google te da registros MX y otros. Agrégalos en Porkbun (igual cuidado con SPF).
4. Crea usuario `hello@domirank.io`. Llega a Gmail.
5. Combinable con Resend: SPF en Porkbun debe incluir ambos: `v=spf1 include:_spf.google.com include:_spf.resend.com ~all`.

**Pro:** Gmail interfaz, alta deliverability, integra con Google Drive. **Contra:** $6 USD/mes/buzón.

### Opción C — Cloudflare Email Routing (gratis, forwarding only)

Si solo quieres que `hello@domirank.io` reenvíe a tu Gmail personal sin tener un buzón propio:

1. Mueve los nameservers del dominio a Cloudflare (gratis):
   - Cloudflare → Add Site → `domirank.io` → free plan.
   - Cloudflare te asigna 2 nameservers. Cópialos.
   - Porkbun → Domain → Nameservers → reemplaza por los de Cloudflare → Save. Espera 5-30 min.
   - Migra TODOS tus registros DNS (Vercel A record, Resend TXT/MX, etc.) a Cloudflare. Cloudflare suele importarlos automáticamente.
2. Cloudflare → Email → **Email Routing** → enable.
3. Cloudflare te pide agregar MX records para email routing (los hace automático).
4. Crea regla: `hello@domirank.io` → forward to `cmartinezegana@gmail.com`.
5. Repite para `support@`, `contact@`, etc.

**Pro:** Gratis, sin buzón que mantener. **Contra:** No puedes enviar DESDE esas direcciones (solo recibes), aunque Gmail tiene "Send as" para emular.

**Mi recomendación:** empieza con **Opción C (Cloudflare forwarding)** mientras crece la app. Cuando ya tengas tracción y necesites buzones reales para responder, migra a Google Workspace.

---

## Paso 5 · Checklist final

Verifica que todo funciona:

- [ ] `https://domirank.io` carga la app (no `domirank-xxxxx.vercel.app`).
- [ ] SSL válido (candado verde en navegador).
- [ ] `https://www.domirank.io` redirige a `https://domirank.io`.
- [ ] Magic link recibido viene desde `noreply@domirank.io`.
- [ ] Google OAuth funciona en el nuevo dominio.
- [ ] Resend Dashboard muestra emails enviados (Domains → domirank.io → Logs).
- [ ] (Opcional) `hello@domirank.io` recibe correos y forward funciona.

---

## Resumen de costos anuales

| Item | Costo |
|---|---|
| Dominio `.io` (Porkbun) | $36 año 1, $48 renovación |
| DNS (Porkbun o Cloudflare) | Gratis |
| Resend (transaccional) | Gratis hasta 3K correos/mes; $20/mes en Pro |
| Mailbox Zoho Free | Gratis hasta 5 buzones |
| Mailbox Google Workspace | $72/año/buzón |
| Cloudflare Email Routing | Gratis (solo forwarding) |
| **Mínimo total año 1** | **~$36** (dominio + Resend free + Cloudflare forward) |
| **Cómodo total año 1** | **~$108** (dominio + Resend free + 1 buzón Google) |

---

## Troubleshooting común

**"Domain not yet verified" en Vercel después de 1 hora:**
- Verifica que en Porkbun no haya un registro CNAME para `@` (no se permite, solo A). Borra cualquier CNAME para el root domain.
- Asegura que el TTL no esté muy alto (debe ser 600s o 1h máximo durante la migración).

**Magic link sigue llegando desde Gmail antiguo:**
- Asegúrate de haber guardado en Supabase Auth → Emails → SMTP. El Sender Email debe ser `noreply@domirank.io`.
- Algunas veces hay que dar Save dos veces.

**Resend dice "Domain not verified" después de pegar todos los TXT:**
- Algunos registradores anexan el dominio automáticamente. Si Resend dice "agrega TXT en `_resend.domirank.io`" no agregues el sufijo `.domirank.io` en Porkbun (Porkbun lo añade solo). Pon solo `_resend`.

**SPF roto (correos rebotan):**
- Solo puede haber UN registro SPF por dominio. Si tienes Zoho + Resend + Google, combínalos en un solo TXT: `v=spf1 include:_spf.google.com include:_spf.resend.com include:zoho.com ~all`.

**OAuth de Google da error tras cambiar dominio:**
- Verifica que en Google Cloud Console → Credentials → OAuth client → Authorized JavaScript origins esté `https://domirank.io` AGREGADO (no reemplaces el de Vercel, agrega ambos durante la transición).
