# Turno Fijo

Plataforma multi-tenant de reservas para barberías. Cada barbería es un tenant
independiente: sus turnos, clientes, barberos y precios están aislados por Row
Level Security en Postgres, no sólo por filtros de aplicación.

- **Stack**: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Tailwind +
  componentes tipo shadcn/ui · despliegue en Vercel.
- **Idioma**: español rioplatense. **Moneda**: pesos argentinos. **Fecha**: DD/MM/AAAA.
- **Identidad del cliente**: sólo Google vía Supabase Auth. No hay contraseñas,
  formularios de datos personales ni WhatsApp.

---

## 1. Puesta en marcha

### 1.1 Crear el proyecto de Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegá y ejecutá el contenido de
   [`supabase/migrations/20260826000001_esquema_inicial.sql`](supabase/migrations/20260826000001_esquema_inicial.sql).
   Crea tablas, triggers, funciones y **todas las políticas de RLS**.
   (Con la CLI: `supabase db push`.)
3. En **Project Settings → API** copiá `URL`, `anon key` y `service_role key`.

### 1.2 Habilitar Google

> **No hace falta activar la prueba gratis ni cargar una tarjeta.** Google Cloud
> ofrece US$300 en créditos apenas entrás, pero eso es para servicios pagos
> (VMs, BigQuery…). Crear credenciales OAuth es gratis y sin límite de uso:
> cerrá ese cartel y seguí. Tampoco hay que habilitar ninguna API.

1. **Proyecto**: en [console.cloud.google.com](https://console.cloud.google.com),
   selector de proyecto (arriba a la izquierda) → *Proyecto nuevo* → nombre
   `Turno Fijo` → Crear. Asegurate de que quede seleccionado.

2. **Pantalla de consentimiento** (*APIs y servicios → Pantalla de consentimiento
   de OAuth*, en consolas nuevas *Google Auth Platform → Branding*):
   - Tipo de usuario: **Externo**.
   - Nombre de la app: `Turno Fijo`. Correo de asistencia y de contacto: el tuyo.
   - Los permisos por defecto (`email`, `profile`, `openid`) alcanzan: no agregues
     scopes. Con esos tres **no se necesita verificación de Google**.

3. **Usuarios de prueba (mientras desarrollás)**: en *Público / Audience* la app
   arranca en **Modo de prueba**, y ahí sólo entran los correos cargados en
   **Usuarios de prueba**. Agregá el tuyo y los de quien vaya a probar (admite
   100). Con eso el flujo funciona completo en `localhost`.

   > **No intentes publicar todavía.** Google exige página de inicio, política de
   > privacidad, términos y un **dominio autorizado real** para publicar una app
   > Externa; `localhost` no califica y el botón queda bloqueado con
   > *"La configuración de OAuth de tu app está incompleta"*. Se publica recién
   > al desplegar (ver 1.6). En Branding, revisá que estén completos el nombre de
   > la app, el correo de asistencia y la **información de contacto del
   > desarrollador**, y **no subas logo**: subirlo dispara la verificación de
   > marca de Google, que tarda días y no hace falta.

4. **Copiar la Callback URL de Supabase**: en Supabase → *Authentication →
   Providers → Google*, activá el proveedor y copiá el campo
   **Callback URL (for OAuth)**. Es exactamente
   `https://<ref-de-tu-proyecto>.supabase.co/auth/v1/callback`.

5. **Credenciales**: *APIs y servicios → Credenciales → Crear credenciales →
   ID de cliente de OAuth → Aplicación web*:
   - *Orígenes autorizados de JavaScript*: `http://localhost:3000` (y tu dominio).
   - *URI de redireccionamiento autorizados*: pegá la Callback URL del paso 4.
     Esta es la que importa; va la de **Supabase**, no la de tu app.

6. Copiá **Client ID** y **Client Secret** y pegalos en Supabase → *Authentication
   → Providers → Google* → Guardar.

7. En **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (y tu dominio en producción).
   - Redirect URLs: `http://localhost:3000/auth/callback` y
     `https://tu-dominio.com/auth/callback`.

Los cambios en Google Cloud pueden tardar unos minutos en propagarse. Si al
entrar ves `redirect_uri_mismatch`, es que la URI del paso 5 no coincide
carácter por carácter con la Callback URL de Supabase.

### 1.3 Correo de confirmación

El mail sale de una casilla genérica de la aplicación, nunca de la barbería. Se
usa [Resend](https://resend.com), cuyo plan gratuito (100 mails/día, 3.000/mes)
no vence.

**Para desarrollar**, alcanza con crear una API key en *API keys* y cargar:

```
RESEND_API_KEY="re_..."
EMAIL_FROM="Turno Fijo <onboarding@resend.dev>"
```

> Sin dominio verificado, Resend sólo permite enviar desde `onboarding@resend.dev`
> y **sólo a la casilla del dueño de la cuenta**. Sirve para probar el flujo
> completo con tu propio correo, pero a un cliente real no le va a llegar.

**Para producción**: *Domains → Add domain*, cargá los registros DNS (SPF, DKIM,
DMARC) en tu proveedor, verificá y cambiá `EMAIL_FROM` a una casilla de ese
dominio (`Turno Fijo <turnos@tudominio.com>`).

Si `RESEND_API_KEY` queda vacío, la reserva funciona igual y el envío se omite
con un aviso en el log. Un rechazo del proveedor tampoco cancela el turno: se
registra el status y nada más, sin destinatario ni contenido en el log.

### 1.4 Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Dónde vive | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | cliente + servidor | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | cliente + servidor | Clave pública; toda la autorización la hace RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **sólo servidor** | Alta de barbería y lectura de horarios ocupados |
| `SITE_URL` | **sólo servidor** | Base para los links del mail y del alta |
| `RESEND_API_KEY` / `EMAIL_FROM` | sólo servidor | Envío de confirmaciones |

`SUPABASE_SERVICE_ROLE_KEY` **nunca** lleva el prefijo `NEXT_PUBLIC_`: bypassea
RLS y no debe llegar al navegador. `src/lib/supabase/admin.ts` está marcado con
`server-only`, así que cualquier import desde un componente cliente rompe el build.

### 1.5 Correr en local

```bash
npm install
npm run dev
```

### 1.6 Desplegar en Vercel

1. Importá el repositorio en Vercel.
2. Cargá las cinco variables en **Settings → Environment Variables**
   (`SUPABASE_SERVICE_ROLE_KEY` sin `NEXT_PUBLIC_`).
3. Actualizá `SITE_URL` y las Redirect URLs de Supabase con el dominio final.
4. Agregá el dominio a *Orígenes autorizados de JavaScript* en Google Cloud.
5. **Recién ahora publicá la app de Google** (paso 1.2.3). En *Branding* completá:
   página de inicio `https://tu-dominio`, política de privacidad
   `https://tu-dominio/privacidad`, términos `https://tu-dominio/terminos` y el
   dominio autorizado. Esas dos páginas legales hay que escribirlas: son
   requisito de Google, no de la app. Hasta publicar, sólo entran los usuarios de
   prueba.

---

## 2. Cómo se usa

**Dueño**: entra con Google → registra su barbería (nombre + dirección web) →
carga barberos (días y horario) y servicios (precio y duración) → comparte
`https://tu-dominio.com/b/<slug>`.

**Cliente**: abre esa página → elige barbero → servicio → día y hora → entra con
Google → recibe el comprobante en pantalla y por correo.

**En el salón**: el barbero abre el turno desde la agenda, tilda los adicionales
que se hicieron, elige efectivo / transferencia / tarjeta y cobra. El total sale
de la suma de los servicios; también puede marcar *no vino* o cancelar.

**Caja**: `/panel/caja` muestra el mes por medio de pago sobre lo realmente
cobrado, turnos completados, ausencias, cancelados, ticket promedio, cuánto
aportaron los adicionales y qué servicios se vendieron más.

---

## 3. Modelo de datos

| Tabla | Contenido |
| --- | --- |
| `tenants` | Una fila por barbería (`slug` público) |
| `tenant_members` | Qué usuario administra qué barbería |
| `barbers` | Barberos, días de trabajo y horario |
| `services` | Catálogo: precio, duración, si es reservable online |
| `clients` | Ficha por (barbería, usuario de Google) |
| `appointments` | Turno: fecha, hora, estado, medio de pago, total, `codigo` público |
| `appointment_services` | **Tabla intermedia turno ↔ servicios (1..N)** |

Un turno **no** tiene un servicio fijo: tiene filas en `appointment_services`.
La reservada online entra como `principal = true`; los adicionales del sillón
entran como filas extra. Cada fila congela nombre y precio al momento de la
carga, así un cambio de lista no altera la caja histórica. Un trigger recalcula
`appointments.total_cent` como la suma de esas filas: **el monto nunca viene del
cliente**.

Los horarios se guardan como `fecha` + `hora_desde` / `hora_hasta` en hora local
del salón, lo que evita corrimientos de zona horaria en la agenda.

---

## 4. Seguridad

### Aislamiento entre barberías

- RLS habilitada **y forzada** (`force row level security`) en las siete tablas.
- `revoke all` sobre `anon` / `authenticated` y `grant` explícito por tabla: sin
  permiso base no hay acceso aunque una política sea permisiva.
- La pertenencia se resuelve con `es_miembro_del_tenant()`, `security definer`
  con `search_path` fijo, para evitar recursión de políticas y secuestro de esquema.
- Un trigger valida coherencia de tenant entre tablas: un turno no puede apuntar
  a un barbero, un cliente o un servicio de otra barbería, ni siquiera con
  service role.
- Cada endpoint del panel vuelve a filtrar por `tenant_id` además de RLS
  (defensa en profundidad).

### Autorización de endpoints

Todo route handler que escribe pasa por `contextoPanel()`: valida el JWT contra
Supabase (`getUser()`, no `getSession()`) y confirma la membresía en la base. La
verificación **no** queda en el frontend. El middleware además corta las rutas
privadas antes de renderizar.

### Exposición de identificadores

El cliente sólo ve el `codigo` público del turno (`TF-2608-K7Q2`), nunca UUIDs.
Cancelar busca por código y RLS descarta los que no son suyos: adivinar un
código ajeno no devuelve nada. La consulta de disponibilidad devuelve sólo
franjas horarias, jamás quién reservó ni qué se hizo.

### Validación y saneamiento

Todo input pasa por Zod (`src/lib/validacion.ts`): se quitan controles,
invisibles y bidireccionales Unicode, se colapsan espacios y se recorta antes de
validar longitud. Se rechazan bodies que no sean JSON o superen 16 KB. React
escapa al renderizar (no hay `dangerouslySetInnerHTML`) y el HTML del mail
escapa cada valor dinámico. El `next` de las redirecciones se valida como ruta
interna: no hay open redirect.

### Rate limiting

Ventana deslizante en `src/lib/rate-limit.ts`: reservas 8/10 min (por IP **y**
por usuario), disponibilidad 90/min, login 12/5 min, alta de barbería 3/hora,
escrituras del panel 120/min. Devuelve 429 con `Retry-After`.

> En serverless el contador es por instancia. Para un límite global, reemplazá
> el `Map` por Redis/Upstash manteniendo la firma de `limitar()`.

### Hardening

- CSP con **nonce por request** y `strict-dynamic` (`src/middleware.ts`); las
  tipografías las sirve `next/font` desde el propio dominio, sin CDNs externos.
- `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, HSTS,
  `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, sin `X-Powered-By`.
- Cookies de sesión `httpOnly`, `sameSite=lax`, `secure` en producción,
  refrescadas en el middleware. Cierre de sesión sólo por POST.
- Los logs registran ruta y causa acotada: nunca mails, nombres, tokens ni ids.
- Doble reserva imposible: constraint de exclusión GiST en Postgres además de la
  revalidación de disponibilidad en el servidor.
- `npm audit`: 0 vulnerabilidades.

### Verificado en esta entrega

`/panel` y `/mis-turnos` sin sesión → 307 al login; APIs sin sesión → 401;
parámetros inválidos → 422; límite de login → corta al intento 13; CSP con nonce
presente en todos los `<script>`; `tsc --noEmit` y `next build` limpios.

---

## 5. Diseño

Paleta única (`tailwind.config.ts`): `#0F0E0D` fondo · `#1B1A18` carbón ·
`#262421` grafito · `#38352F` línea · `#F0EAE0` texto · `#9C948A` texto 2º ·
`#C79A45` oro · `#A65A2E` cobre · `#6F7F52` pagado · `#8C3B2E` cancelado.

Reglas: el oro y el cobre no pasan del 10% de la pantalla y se reservan para
dinero y acciones; la separación es por líneas de 1px, nunca por sombras; los
radios van de 0 a 4px; **todo número va en IBM Plex Mono, tabular y alineado a
la derecha**. Bodoni Moda para titulares, Archivo para interfaz.

**Responsive real, no escalado**: en desktop hay columna lateral fija, tablas
anchas y paneles laterales pegajosos; en mobile hay barra de navegación
inferior, listas en vez de tablas, botones de 52px y el diálogo entra desde
abajo. Cada vista tiene su propia estructura (`lg:hidden` / `hidden lg:block`),
no es la otra achicada.

---

## 6. Mapa del proyecto

```
src/
  app/
    page.tsx                    landing
    ingresar/                   login con Google
    registrar/                  alta de barbería
    b/[slug]/                   reserva pública (4 pasos + comprobante)
    mis-turnos/                 turnos del cliente, con cancelación
    panel/                      agenda, servicios, caja, clientes, barberos
      turno/[id]/               cobro con adicionales
    api/                        route handlers (todos con sesión + tenant + límite)
    auth/callback|salir/        OAuth y cierre de sesión
  components/       ui/ (base tipo shadcn) + panel/ + reserva/
  lib/              supabase/, validacion, rate-limit, disponibilidad, email, sesion
  middleware.ts     CSP con nonce, refresco de sesión, corte de rutas privadas
supabase/migrations/  esquema + RLS
```

> `middleware.ts` vive dentro de `src/` a propósito: con el directorio `src/`,
> Next no lo detecta en la raíz y la CSP no se aplicaría.

---

## 7. Comandos

```bash
npm run dev        # desarrollo
npm run build      # build de producción (corre lint y tipos)
npm run typecheck  # sólo TypeScript
npm run lint       # ESLint
```
