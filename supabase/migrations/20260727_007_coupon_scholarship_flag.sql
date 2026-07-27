-- Marca si el descuento de un cupón debe contarse en el reporte de "Becas otorgadas"
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS count_as_scholarship boolean NOT NULL DEFAULT true;
