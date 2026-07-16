-- Backfill clubs con city NULL derivando de location (Gorostiaga y La Catedral
-- del Padel nunca volvieron a guardarse desde app/admin/club/club-form.tsx
-- despues de que se agregaron las columnas city/province estructuradas).
UPDATE clubs SET
  city = 'rosario',
  province = 'Santa Fe',
  location = 'Rosario, Santa Fe'
WHERE name = 'Gorostiaga Padel'
AND city IS NULL;

UPDATE clubs SET
  city = 'rosario',
  province = 'Santa Fe',
  location = 'Rosario, Santa Fe'
WHERE name = 'La Catedral del Padel'
AND city IS NULL;
