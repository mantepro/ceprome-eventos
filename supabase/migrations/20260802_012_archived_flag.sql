ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
