-- =============================================================
-- TABOR — Plataforma de Eventos CEPROME
-- Schema SQL completo + RLS policies
-- Aplicar en: Supabase SQL Editor
-- =============================================================

-- =============================================================
-- EXTENSIONES
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- =============================================================
-- TABLAS (en orden de dependencias)
-- =============================================================

-- organizations (raíz del tenant)
CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  email       text,
  phone       text,
  logo_url    text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- users (espejo de auth.users con datos de perfil y rol)
CREATE TABLE IF NOT EXISTS public.users (
  id              uuid PRIMARY KEY,  -- mismo id que auth.users
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('super_admin','org_admin','event_staff')),
  first_name      text,
  last_name       text,
  email           text NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- events
CREATE TABLE IF NOT EXISTS public.events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  location        text,
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz,
  modality        text NOT NULL CHECK (modality IN ('presencial','virtual','hibrido')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed','cancelled')),
  cover_url       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ticket_types
CREATE TABLE IF NOT EXISTS public.ticket_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name            text NOT NULL,
  price           numeric(10,2) NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'USD',
  capacity        integer,  -- null = ilimitado
  sold_count      integer NOT NULL DEFAULT 0,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- registrations
CREATE TABLE IF NOT EXISTS public.registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id        uuid NOT NULL REFERENCES public.events(id),
  folio           text UNIQUE NOT NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','paid','cancelled')),
  payment_method  text CHECK (payment_method IN ('online','manual')),
  total_amount    numeric(10,2) NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- attendees
CREATE TABLE IF NOT EXISTS public.attendees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  first_name      text NOT NULL,
  last_name       text NOT NULL,
  email           text NOT NULL,
  phone           text,
  extra_data      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- tickets (QR)
CREATE TABLE IF NOT EXISTS public.tickets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id),
  attendee_id     uuid NOT NULL REFERENCES public.attendees(id),
  ticket_type_id  uuid NOT NULL REFERENCES public.ticket_types(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id        uuid NOT NULL REFERENCES public.events(id),
  token           text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  qr_url          text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','used','cancelled')),
  checked_in_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- payments
CREATE TABLE IF NOT EXISTS public.payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  amount          numeric(10,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'USD',
  method          text NOT NULL CHECK (method IN ('paypal','manual')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  external_ref    text,
  verified_by     uuid REFERENCES public.users(id),
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- scan_logs
CREATE TABLE IF NOT EXISTS public.scan_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       uuid NOT NULL REFERENCES public.tickets(id),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  event_id        uuid NOT NULL REFERENCES public.events(id),
  scanned_by      uuid NOT NULL REFERENCES public.users(id),
  result          text NOT NULL CHECK (result IN ('valid','already_used','pending_payment','cancelled','not_found')),
  scanned_at      timestamptz NOT NULL DEFAULT now()
);


-- =============================================================
-- ÍNDICES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_events_org         ON public.events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_status      ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event ON public.ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_org  ON public.registrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON public.registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_folio ON public.registrations(folio);
CREATE INDEX IF NOT EXISTS idx_attendees_reg      ON public.attendees(registration_id);
CREATE INDEX IF NOT EXISTS idx_attendees_email    ON public.attendees(email);
CREATE INDEX IF NOT EXISTS idx_tickets_token      ON public.tickets(token);
CREATE INDEX IF NOT EXISTS idx_tickets_event      ON public.tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_reg        ON public.tickets(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_reg       ON public.payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_event    ON public.scan_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket   ON public.scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_users_org          ON public.users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);


-- =============================================================
-- FUNCIONES HELPER PARA RLS
-- =============================================================

-- Retorna el rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Retorna el organization_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_user_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

-- Genera un folio único legible: REG-2027-A3F9
CREATE OR REPLACE FUNCTION public.generate_folio()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  folio text;
  exists bool;
BEGIN
  LOOP
    folio := 'REG-' || to_char(now(), 'YYYY') || '-' ||
             upper(substring(md5(random()::text) FROM 1 FOR 4));
    SELECT COUNT(*) > 0 INTO exists
    FROM public.registrations WHERE registrations.folio = folio;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN folio;
END;
$$;

-- Trigger: auto-crear usuario en public.users al registrarse en auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo inserta si el usuario viene con metadata de org
  -- El onboarding manual asigna org_id y role
  IF new.raw_user_meta_data->>'organization_id' IS NOT NULL THEN
    INSERT INTO public.users (id, organization_id, role, email, first_name, last_name)
    VALUES (
      new.id,
      (new.raw_user_meta_data->>'organization_id')::uuid,
      COALESCE(new.raw_user_meta_data->>'role', 'org_admin'),
      new.email,
      new.raw_user_meta_data->>'first_name',
      new.raw_user_meta_data->>'last_name'
    );
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Trigger: actualizar sold_count en ticket_types cuando cambia estado de ticket
CREATE OR REPLACE FUNCTION public.update_sold_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Al activar un ticket, incrementar sold_count
  IF (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') AND NEW.status = 'active' THEN
    UPDATE public.ticket_types
    SET sold_count = (
      SELECT COUNT(*) FROM public.tickets
      WHERE ticket_type_id = NEW.ticket_type_id AND status IN ('active','used')
    )
    WHERE id = NEW.ticket_type_id;
  END IF;
  -- Al cancelar un ticket, recalcular
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.ticket_types
    SET sold_count = (
      SELECT COUNT(*) FROM public.tickets
      WHERE ticket_type_id = NEW.ticket_type_id AND status IN ('active','used')
    )
    WHERE id = NEW.ticket_type_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ticket_status_change ON public.tickets;
CREATE TRIGGER on_ticket_status_change
  AFTER INSERT OR UPDATE OF status ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_sold_count();


-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_types  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs     ENABLE ROW LEVEL SECURITY;


-- =============================================================
-- POLÍTICAS — organizations
-- =============================================================

-- Público: leer orgs activas (para páginas públicas por slug)
CREATE POLICY "public_read_active_orgs"
  ON public.organizations FOR SELECT
  TO anon, authenticated
  USING (active = true);

-- super_admin: acceso total
CREATE POLICY "super_admin_all_orgs"
  ON public.organizations FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: leer y actualizar su propia organización
CREATE POLICY "org_admin_own_org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    id = public.get_user_org()
  );

CREATE POLICY "org_admin_update_own_org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — users
-- =============================================================

-- super_admin: acceso total
CREATE POLICY "super_admin_all_users"
  ON public.users FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: gestionar usuarios de su organización
CREATE POLICY "org_admin_manage_org_users"
  ON public.users FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- Cada usuario: leer y actualizar su propio perfil
CREATE POLICY "own_user_profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "own_user_update"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- =============================================================
-- POLÍTICAS — events
-- =============================================================

-- Público: leer eventos publicados
CREATE POLICY "public_read_published_events"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- super_admin: acceso total
CREATE POLICY "super_admin_all_events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: CRUD de eventos de su organización
CREATE POLICY "org_admin_manage_events"
  ON public.events FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- event_staff: leer eventos de su organización
CREATE POLICY "event_staff_read_events"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — ticket_types
-- =============================================================

-- Público: leer tipos activos de eventos publicados
CREATE POLICY "public_read_active_ticket_types"
  ON public.ticket_types FOR SELECT
  TO anon, authenticated
  USING (
    active = true AND
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = ticket_types.event_id
      AND events.status = 'published'
    )
  );

-- super_admin: acceso total
CREATE POLICY "super_admin_all_ticket_types"
  ON public.ticket_types FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: CRUD de su organización
CREATE POLICY "org_admin_manage_ticket_types"
  ON public.ticket_types FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- event_staff: leer ticket_types de su organización
CREATE POLICY "event_staff_read_ticket_types"
  ON public.ticket_types FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — registrations
-- =============================================================

-- Público: crear registrations (flujo de inscripción)
CREATE POLICY "public_insert_registrations"
  ON public.registrations FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Público: leer su propia registration por folio (para página de confirmación)
-- No se puede filtrar por identidad anon, así que la página de confirmación usa service_role
-- Esta política permite leer si conoces el folio exacto (security through obscurity + UUID folio)

-- super_admin: acceso total
CREATE POLICY "super_admin_all_registrations"
  ON public.registrations FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: CRUD de su organización
CREATE POLICY "org_admin_manage_registrations"
  ON public.registrations FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- event_staff: leer registrations de su organización
CREATE POLICY "event_staff_read_registrations"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — attendees
-- =============================================================

-- Público: crear attendees (flujo de inscripción)
CREATE POLICY "public_insert_attendees"
  ON public.attendees FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- super_admin: acceso total
CREATE POLICY "super_admin_all_attendees"
  ON public.attendees FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: CRUD de su organización
CREATE POLICY "org_admin_manage_attendees"
  ON public.attendees FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- event_staff: leer attendees de su organización
CREATE POLICY "event_staff_read_attendees"
  ON public.attendees FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — tickets
-- =============================================================

-- super_admin: acceso total
CREATE POLICY "super_admin_all_tickets"
  ON public.tickets FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: gestionar tickets de su organización
CREATE POLICY "org_admin_manage_tickets"
  ON public.tickets FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- event_staff: leer y actualizar tickets de su organización (para escaneo)
CREATE POLICY "event_staff_scan_tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );

CREATE POLICY "event_staff_update_tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — payments
-- =============================================================

-- Público: crear payments (flujo de inscripción)
CREATE POLICY "public_insert_payments"
  ON public.payments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- super_admin: acceso total
CREATE POLICY "super_admin_all_payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: gestionar pagos de su organización
CREATE POLICY "org_admin_manage_payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- POLÍTICAS — scan_logs
-- =============================================================

-- super_admin: acceso total
CREATE POLICY "super_admin_all_scan_logs"
  ON public.scan_logs FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

-- org_admin: leer scan_logs de su organización
CREATE POLICY "org_admin_read_scan_logs"
  ON public.scan_logs FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

-- event_staff: insertar y leer scan_logs de su organización
CREATE POLICY "event_staff_manage_scan_logs"
  ON public.scan_logs FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org()
  );


-- =============================================================
-- DATOS INICIALES — Organización piloto CEPROME
-- =============================================================

INSERT INTO public.organizations (name, slug, email, active)
VALUES (
  'CEPROME Latinoamérica',
  'ceprome',
  'congreso@cepromelat.com',
  true
)
ON CONFLICT (slug) DO NOTHING;
