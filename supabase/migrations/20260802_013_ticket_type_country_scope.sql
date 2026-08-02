-- Restricción de país por tipo de acceso, para evitar que alguien de otro
-- país se inscriba con el precio nacional (o viceversa).
-- country_scope = 'any' (default)  -> sin restricción
-- country_scope = 'match'          -> solo permite el país en country_value
-- country_scope = 'exclude'        -> permite cualquier país EXCEPTO country_value

alter table ticket_types
  add column country_scope text not null default 'any' check (country_scope in ('any', 'match', 'exclude')),
  add column country_value text;
