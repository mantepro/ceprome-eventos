# CLAUDE.md — Plataforma de Eventos Eclesiales (Piloto CEPROME)

## Identidad del proyecto

Plataforma web de inscripciones y gestión de eventos institucionales. Piloto para CEPROME Latinoamérica. Arquitectura multi-tenant desde el inicio para escalar como SaaS independiente.

**Stack:** Next.js 14 (App Router) · Supabase · Tailwind CSS · shadcn/ui · TypeScript

---

## Metodología — Think Before Code (8 fases)

Antes de escribir cualquier código, ejecuta estas fases en orden. No saltes fases.

### Fase 1 — Comprensión
- Lee este archivo completo
- Identifica el módulo o feature que se va a construir
- Confirma que entiendes el flujo de usuario afectado

### Fase 2 — Planificación
- Lista los archivos que vas a crear o modificar
- Identifica dependencias entre módulos
- Detecta riesgos o conflictos antes de tocar código

### Fase 3 — Arquitectura
- Define la estructura de datos involucrada
- Confirma que respeta multi-tenancy (organization_id en todo)
- Verifica que RLS de Supabase cubre el acceso

### Fase 4 — Implementación
- Escribe código limpio, tipado, sin comentarios obvios
- Un componente por archivo
- Funciones pequeñas con responsabilidad única

### Fase 5 — Validación
- Revisa que todos los estados de UI están cubiertos (normal, vacío, cargando, error, éxito)
- Verifica que mobile funciona correctamente
- Confirma que no hay datos de una organización visibles para otra

### Fase 6 — Testing
- Prueba el flujo completo del feature
- Prueba los casos borde (cupo agotado, pago fallido, QR ya usado)
- Prueba con organización diferente para confirmar aislamiento

### Fase 7 — Revisión
- Sin console.log en producción
- Sin credenciales hardcodeadas
- Sin lógica de negocio en componentes UI

### Fase 8 — Documentación
- Actualiza este archivo si cambia algo estructural
- Documenta cualquier decisión técnica no obvia

---

## Arquitectura multi-tenant

**Regla absoluta:** toda tabla tiene `organization_id`. Sin excepción.

Cada organización ve únicamente sus propios datos. Esto se garantiza con Row Level Security en Supabase. Nunca hacer queries sin filtrar por `organization_id`.

```
organizations (tenant raíz)
  └── events
        └── ticket_types
        └── kit_delivery_stations  ← mesas de entrega de kit
        └── registrations
              └── tickets (QR)     ← kit_station_id, kit_delivered
              └── payments
        └── scan_logs
  └── users (staff de la org)
```

---

## Esquema de base de datos

### organizations
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
name            text NOT NULL
slug            text UNIQUE NOT NULL        -- para URLs amigables
email           text
phone           text
logo_url        text
active          boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### events
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE
name            text NOT NULL
description     text
location        text
starts_at       timestamptz NOT NULL
ends_at         timestamptz
modality        text CHECK (modality IN ('presencial','virtual','hibrido'))
status          text CHECK (status IN ('draft','published','closed','cancelled'))
cover_url       text
created_at      timestamptz DEFAULT now()
```

### ticket_types
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
event_id        uuid REFERENCES events(id) ON DELETE CASCADE
organization_id uuid REFERENCES organizations(id)
name            text NOT NULL              -- General, VIP, Estudiante
price           numeric(10,2) DEFAULT 0
currency        text DEFAULT 'MXN'
capacity        integer                    -- null = ilimitado
sold_count      integer DEFAULT 0
active          boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

### registrations
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
organization_id uuid REFERENCES organizations(id)
event_id        uuid REFERENCES events(id)
folio           text UNIQUE NOT NULL       -- REG-XXXX-XXXX legible
status          text CHECK (status IN ('draft','pending','paid','cancelled'))
payment_method  text CHECK (payment_method IN ('online','manual'))
total_amount    numeric(10,2) DEFAULT 0
notes           text
created_at      timestamptz DEFAULT now()
```

### attendees
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
registration_id uuid REFERENCES registrations(id) ON DELETE CASCADE
organization_id uuid REFERENCES organizations(id)
first_name      text NOT NULL
last_name       text NOT NULL
email           text NOT NULL
phone           text
extra_data      jsonb                      -- campos custom por evento
created_at      timestamptz DEFAULT now()
```

### tickets
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
registration_id uuid REFERENCES registrations(id)
attendee_id     uuid REFERENCES attendees(id)
ticket_type_id  uuid REFERENCES ticket_types(id)
organization_id uuid REFERENCES organizations(id)
event_id        uuid REFERENCES events(id)
token           text UNIQUE NOT NULL       -- UUID v4, lo que va en el QR
qr_url          text                       -- URL de la imagen en Storage
status          text CHECK (status IN ('pending','active','used','cancelled'))
checked_in_at   timestamptz
created_at      timestamptz DEFAULT now()
```

### payments
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
registration_id uuid REFERENCES registrations(id)
organization_id uuid REFERENCES organizations(id)
amount          numeric(10,2) NOT NULL
currency        text DEFAULT 'MXN'
method          text CHECK (method IN ('paypal','manual'))
status          text CHECK (status IN ('pending','completed','failed','refunded'))
external_ref    text                       -- ID de PayPal o referencia manual
verified_by     uuid REFERENCES users(id)  -- quien validó si fue manual
verified_at     timestamptz
created_at      timestamptz DEFAULT now()
```

### scan_logs
```sql
id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
ticket_id       uuid REFERENCES tickets(id)
organization_id uuid REFERENCES organizations(id)
event_id        uuid REFERENCES events(id)
scanned_by      uuid REFERENCES users(id)
result          text CHECK (result IN ('valid','already_used','pending_payment','cancelled','not_found'))
scanned_at      timestamptz DEFAULT now()
```

### users
```sql
id              uuid PRIMARY KEY           -- mismo id que auth.users de Supabase
organization_id uuid REFERENCES organizations(id)
role            text CHECK (role IN ('super_admin','org_admin','event_staff'))
first_name      text
last_name       text
email           text NOT NULL
active          boolean DEFAULT true
created_at      timestamptz DEFAULT now()
```

---

## Roles y permisos

| Rol | Acceso |
|-----|--------|
| `super_admin` | Todo — todas las organizaciones |
| `org_admin` | Su organización completa |
| `event_staff` | Solo escaneo QR de su evento asignado |
| Público | Registro e inscripción sin autenticación |

---

## Módulos y rutas

### Público (sin auth)
```
/[org-slug]/eventos              → listado de eventos
/[org-slug]/eventos/[event-id]   → detalle del evento
/[org-slug]/registro/[event-id]  → flujo de inscripción
/[org-slug]/confirmar/[folio]    → confirmación post-registro
```

### Admin (org_admin)
```
/admin                           → dashboard
/admin/eventos                   → gestión de eventos
/admin/eventos/nuevo             → crear evento
/admin/eventos/[id]              → editar evento
/admin/eventos/[id]/inscritos    → lista de inscritos
/admin/inscritos/[id]            → detalle de inscripción
/admin/pagos                     → pagos pendientes de validación
```

### Escaneo (event_staff)
```
/scan                            → seleccionar evento
/scan/[event-id]                 → escáner activo
```

### Super admin
```
/superadmin                      → todas las organizaciones
/superadmin/[org-id]             → detalle de organización
```

---

## Generación de QR

1. Se dispara al confirmar el pago (webhook PayPal o acción manual del admin)
2. Edge Function `generate-ticket`:
   - Genera token: `crypto.randomUUID()`
   - Genera imagen QR con librería `qrcode` → PNG en base64
   - Sube imagen a Supabase Storage: `tickets/{organization_id}/{event_id}/{token}.png`
   - Guarda ticket en DB con status `active`
   - Actualiza registration a status `paid`
   - Dispara envío de correo con Resend
3. El correo incluye el QR como imagen embebida y link de respaldo

**El QR contiene únicamente el token UUID.** No contiene datos personales.

---

## Validación de QR en escaneo

```
Escáner lee token del QR
  → POST /api/scan { token, event_id, scanned_by }
  → Busca ticket por token
  → Si no existe            → result: not_found
  → Si status = pending     → result: pending_payment
  → Si status = cancelled   → result: cancelled
  → Si status = used        → result: already_used
  → Si status = active      → marca used + registra checked_in_at
                            → result: valid
  → Guarda en scan_logs
  → Retorna result + datos del asistente si es valid
```

---

## Generación del folio

Formato legible: `REG-2027-A3F9`

```typescript
const folio = `REG-${new Date().getFullYear()}-${Math.random().toString(36).substring(2,6).toUpperCase()}`
```

---

## Variables de entorno requeridas

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox                        # sandbox | live
RESEND_API_KEY=
RESEND_FROM=noreply@tudominio.com
NEXT_PUBLIC_APP_URL=
```

---

## Convenciones de código

- TypeScript estricto en todo
- Componentes en `components/` — un archivo por componente
- Server Actions para mutaciones de datos
- Supabase client del lado server para queries con RLS
- Supabase client del lado cliente solo para real-time si se necesita
- Zod para validación de formularios y APIs
- Nombres en inglés en código, español en UI

---

## Estados de UI obligatorios

Todo componente que muestre datos debe manejar:
- `loading` — skeleton o spinner
- `empty` — mensaje útil con acción sugerida
- `error` — mensaje claro con opción de reintentar
- `success` — confirmación visible

---

## Orden de desarrollo recomendado

1. Setup inicial: Next.js + Supabase + Tailwind + shadcn/ui
2. Schema SQL completo en Supabase + RLS policies
3. Auth básico (login para admin y staff)
4. Módulo público: listado y detalle de eventos
5. Flujo de registro e inscripción
6. Integración PayPal (sandbox primero)
7. Flujo de pago manual
8. Generación de QR + envío de correo con Resend
9. Panel admin: dashboard, inscritos, validación de pagos
10. Módulo de escaneo QR
11. Pruebas completas con evento real simulado
12. Deploy en Vercel + dominio

---

## Piloto

**VI Congreso Latinoamericano CEPROME**
Fecha: 2 al 4 de marzo de 2027
URL piloto: registro.cepromelat.com
Organization slug: ceprome

---

*Proyecto TABOR — uso interno*

---

## Tipos de acceso del piloto — VI Congreso CEPROME

Inscripción simple. Dos tipos de acceso, precio fijo, mismos beneficios.

| Tipo | Precio | Método de pago |
|------|--------|----------------|
| Local (México) | $100 USD | Transferencia bancaria · depósito · PayPal |
| Extranjero | $200 USD | PayPal · tarjeta internacional |

**Beneficios incluidos en ambos:**
- Acceso a todas las conferencias y simposios
- Acceso a Expo Buenas Prácticas
- Kit básico de inscripción
- Constancia o diploma de participación
- Acceso a materiales y contenidos del evento

**NO aplica para este piloto:**
- Selección de talleres por bloques
- Agenda personalizada por día
- Sesiones múltiples o cupos por sesión

Esto simplifica el flujo de registro a:
1. Datos personales
2. Tipo de inscripción (Local / Extranjero)
3. Método de pago
4. Confirmación + QR

---

## Referencia visual

Wireframes generados en Claude Design disponibles como referencia.
Pantallas aplicables al MVP:
- Landing del evento
- Flujo de registro (4 pasos simplificados)
- Credencial móvil con QR
- Pantalla de check-in confirmado (escáner)

Pantallas descartadas para el MVP:
- Selección de talleres por bloques
- Agenda personal del día
- Mapa de sede

---

## Feature: Asignación de mesa para entrega de kit

### Contexto
En eventos presenciales (como el Congreso CEPROME), los asistentes reciben un kit físico el día del evento. La sede y número de mesas cambia en cada congreso, por lo que la asignación es manual por el administrador.

### Modelo de datos — agregar a la BD

```sql
-- Mesas de entrega por evento
kit_delivery_stations
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
  event_id        uuid REFERENCES events(id) ON DELETE CASCADE
  organization_id uuid REFERENCES organizations(id)
  name            text NOT NULL    -- "Mesa 1", "Mesa VIP", "Acceso Norte"
  description     text             -- opcional, ej: "Lobby principal"
  active          boolean DEFAULT true
  created_at      timestamptz DEFAULT now()

-- Campo adicional en tickets
ALTER TABLE tickets ADD COLUMN kit_station_id uuid REFERENCES kit_delivery_stations(id);
ALTER TABLE tickets ADD COLUMN kit_delivered boolean DEFAULT false;
ALTER TABLE tickets ADD COLUMN kit_delivered_at timestamptz;
```

### Flujo de operación

1. Admin crea el evento y define las mesas: "Mesa 1", "Mesa 2", "Mesa Extranjeros", etc.
2. Admin asigna mesa a cada inscripción desde el panel (individual o por lote por tipo de acceso)
3. Día del evento — staff escanea QR → pantalla muestra:
   - Nombre del asistente
   - Tipo de acceso
   - **Mesa asignada** (grande y visible)
   - Botón "Marcar kit entregado" (opcional para control)

### Pantalla de resultado del escáner con mesa

```
✅ ACCESO VÁLIDO

María Elena Vázquez
Pase General · CPR-2027-00218

📦 Entregar kit en:
MESA 3

[ Marcar kit entregado ]
```

### Panel admin — gestión de mesas

- Crear/editar/eliminar mesas del evento
- Vista de inscritos con columna "Mesa asignada"
- Asignación individual: dropdown en detalle de inscripción
- Asignación por lote: seleccionar varios → asignar mesa
- Filtro: ver todos los de Mesa 1, Mesa 2, etc.
- Export incluye columna de mesa asignada

### Reglas de negocio

- Un ticket puede tener una sola mesa asignada
- La mesa es opcional — si no se asigna, el escáner no muestra ese bloque
- El campo "kit entregado" es opcional para el staff — útil para control interno
- Solo org_admin puede crear mesas y hacer asignaciones
- event_staff solo ve la mesa asignada al escanear, no puede modificarla
