-- =============================================================
-- Migration 002 — Kit Delivery Stations
-- Aplicar sobre schema 001 ya existente en Supabase
-- =============================================================

-- Nueva tabla: mesas de entrega de kit por evento
CREATE TABLE IF NOT EXISTS public.kit_delivery_stations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name            text NOT NULL,
  description     text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Nuevas columnas en tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS kit_station_id   uuid REFERENCES public.kit_delivery_stations(id),
  ADD COLUMN IF NOT EXISTS kit_delivered    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS kit_delivered_at timestamptz;

-- Índices
CREATE INDEX IF NOT EXISTS idx_kit_stations_event   ON public.kit_delivery_stations(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_kit_station  ON public.tickets(kit_station_id) WHERE kit_station_id IS NOT NULL;

-- RLS
ALTER TABLE public.kit_delivery_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_kit_stations"
  ON public.kit_delivery_stations FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'super_admin')
  WITH CHECK (public.get_user_role() = 'super_admin');

CREATE POLICY "org_admin_manage_kit_stations"
  ON public.kit_delivery_stations FOR ALL
  TO authenticated
  USING (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  )
  WITH CHECK (
    public.get_user_role() = 'org_admin' AND
    organization_id = public.get_user_org()
  );

CREATE POLICY "event_staff_read_kit_stations"
  ON public.kit_delivery_stations FOR SELECT
  TO authenticated
  USING (
    public.get_user_role() = 'event_staff' AND
    organization_id = public.get_user_org() AND
    active = true
  );
