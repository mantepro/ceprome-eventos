-- Interruptor por usuario para ocultar montos/precios en todo el panel,
-- sin importar el rol (org_admin o event_staff).
alter table users add column hide_financials boolean not null default false;
