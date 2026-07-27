-- Catch-up: la tabla coupons y las columnas relacionadas de registrations
-- se crearon directamente en producción y nunca quedaron documentadas en
-- una migración. Este archivo las refleja en el repo (todo con IF NOT
-- EXISTS, seguro de re-correr). RLS ya estaba activo en producción y la
-- política org_admin_manage_coupons ya existía; solo faltaba la de
-- super_admin, que sí tienen las demás tablas del proyecto.

CREATE TABLE IF NOT EXISTS public.coupons (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id              uuid REFERENCES public.events(id),
  code                  text NOT NULL,
  type                  text NOT NULL CHECK (type IN ('percentage','fixed')),
  value                 numeric(10,2) NOT NULL,
  max_uses              integer,
  used_count            integer NOT NULL DEFAULT 0,
  active                boolean NOT NULL DEFAULT true,
  count_as_scholarship  boolean NOT NULL DEFAULT true,
  approved_by           text,
  description           text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'org_admin_manage_coupons'
  ) THEN
    CREATE POLICY "org_admin_manage_coupons"
      ON public.coupons FOR ALL
      TO authenticated
      USING (public.get_user_role() = 'org_admin' AND organization_id = public.get_user_org())
      WITH CHECK (public.get_user_role() = 'org_admin' AND organization_id = public.get_user_org());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'coupons' AND policyname = 'super_admin_all_coupons'
  ) THEN
    CREATE POLICY "super_admin_all_coupons"
      ON public.coupons FOR ALL
      TO authenticated
      USING (public.get_user_role() = 'super_admin')
      WITH CHECK (public.get_user_role() = 'super_admin');
  END IF;
END $$;