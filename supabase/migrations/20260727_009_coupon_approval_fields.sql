-- Quién autorizó el cupón y el motivo, para el desglose de becas otorgadas
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS description text;
