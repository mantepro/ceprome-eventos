-- Los cupones de tipo "fixed" son un monto en una moneda específica.
-- Sin este campo, un cupón de $50 creado pensando en USD se aplicaba
-- igual a un boleto en MXN, restando el monto equivocado.
-- NULL significa "aplica sin importar la moneda del boleto" (comportamiento
-- previo, y el único caso relevante para cupones de porcentaje).

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS currency text;
