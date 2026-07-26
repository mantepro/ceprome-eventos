-- Slug amigable para eventos, único por organización (multi-tenant)
CREATE EXTENSION IF NOT EXISTS "unaccent";

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: genera slug desde name (minúsculas, sin acentos, no alfanumérico -> guion)
UPDATE public.events
SET slug = COALESCE(
  NULLIF(trim(both '-' from regexp_replace(lower(unaccent(name)), '[^a-z0-9]+', '-', 'g')), ''),
  'evento'
)
WHERE slug IS NULL;

-- Desambigua colisiones dentro de la misma organización agregando sufijo -2, -3...
WITH numbered AS (
  SELECT id, slug,
         row_number() OVER (PARTITION BY organization_id, slug ORDER BY created_at) AS rn
  FROM public.events
)
UPDATE public.events e
SET slug = e.slug || '-' || numbered.rn
FROM numbered
WHERE e.id = numbered.id AND numbered.rn > 1;

ALTER TABLE public.events ALTER COLUMN slug SET NOT NULL;

ALTER TABLE public.events
  ADD CONSTRAINT events_org_slug_unique UNIQUE (organization_id, slug);

CREATE INDEX IF NOT EXISTS idx_events_org_slug ON public.events(organization_id, slug);
