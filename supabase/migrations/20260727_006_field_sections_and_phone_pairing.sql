-- Secciones para agrupar preguntas personalizadas + elegir qué campo acompaña a Teléfono
ALTER TABLE public.event_fields ADD COLUMN IF NOT EXISTS section text;
ALTER TABLE public.event_fields ADD COLUMN IF NOT EXISTS pair_with_phone boolean NOT NULL DEFAULT false;
