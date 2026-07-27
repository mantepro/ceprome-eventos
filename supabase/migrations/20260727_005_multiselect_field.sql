-- Tipo de campo "selección múltiple" (checkboxes) + opción "Otro" reutilizable
ALTER TABLE public.event_fields DROP CONSTRAINT event_fields_field_type_check;

ALTER TABLE public.event_fields
  ADD CONSTRAINT event_fields_field_type_check
  CHECK (field_type IN ('text','textarea','number','select','radio','checkbox','date','country','multiselect'));

ALTER TABLE public.event_fields ADD COLUMN IF NOT EXISTS allow_other boolean NOT NULL DEFAULT false;
