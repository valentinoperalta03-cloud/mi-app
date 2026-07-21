-- Guarda el email de la cuenta de Mercado Pago conectada para mostrarlo en
-- /admin/config/pagos ("Conectado como tu@email.com"). Se completa en el
-- callback OAuth (app/api/mp/callback/route.ts) vía GET /users/me de MP.
alter table public.clubs add column if not exists mp_email text;

-- Mismo patron que mp_access_token/mp_user_id/finance_pin: solo service_role
-- puede leerla, el resto de la app la consulta con el service client.
revoke select (mp_email) on public.clubs from anon, authenticated;
revoke update (mp_email) on public.clubs from anon, authenticated;
