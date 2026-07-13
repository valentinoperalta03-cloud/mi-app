-- Fix: el REVOKE SELECT (columna) de la migracion anterior no tuvo efecto
-- real porque anon/authenticated ya tenian GRANT ALL a nivel de tabla
-- completa en public.clubs (default de Supabase) y ese grant amplio sigue
-- permitiendo el acceso aunque se revoque a nivel de columna.
--
-- Fix correcto: revocar el privilegio a nivel de TABLA completa para
-- SELECT/INSERT/UPDATE y volver a otorgarlo solo sobre las columnas que no
-- son de facturacion. DELETE/TRUNCATE/TRIGGER/REFERENCES no se tocan (ya
-- estan controlados por las RLS policies de owner existentes).
revoke select, insert, update on public.clubs from anon, authenticated;

grant select (
  id, name, location, created_at, owner_id, mp_access_token, mp_user_id,
  description, image_url, address, contact_phone, business_hours, logo_url,
  cover_image_url, gallery_image_1, gallery_image_2, gallery_image_3,
  whatsapp, instagram, cancellation_policy, gallery_image_4, finance_pin,
  bank_alias, bank_cbu, accepts_cash, accepts_transfer, onboarding_completed,
  open_time, close_time, is_active, city, province, country,
  fixed_slot_confirmation_hours
) on public.clubs to anon, authenticated;

grant insert (
  id, name, location, created_at, owner_id, mp_access_token, mp_user_id,
  description, image_url, address, contact_phone, business_hours, logo_url,
  cover_image_url, gallery_image_1, gallery_image_2, gallery_image_3,
  whatsapp, instagram, cancellation_policy, gallery_image_4, finance_pin,
  bank_alias, bank_cbu, accepts_cash, accepts_transfer, onboarding_completed,
  open_time, close_time, is_active, city, province, country,
  fixed_slot_confirmation_hours
) on public.clubs to anon, authenticated;

grant update (
  id, name, location, created_at, owner_id, mp_access_token, mp_user_id,
  description, image_url, address, contact_phone, business_hours, logo_url,
  cover_image_url, gallery_image_1, gallery_image_2, gallery_image_3,
  whatsapp, instagram, cancellation_policy, gallery_image_4, finance_pin,
  bank_alias, bank_cbu, accepts_cash, accepts_transfer, onboarding_completed,
  open_time, close_time, is_active, city, province, country,
  fixed_slot_confirmation_hours
) on public.clubs to anon, authenticated;
