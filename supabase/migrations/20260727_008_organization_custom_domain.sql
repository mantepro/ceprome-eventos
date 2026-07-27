-- Dominio propio dedicado — permite omitir el slug de la organización en URLs públicas
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE;
