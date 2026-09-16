-- Limpieza de reglas de turno fijo duplicadas (sanandres, CANCHA 02).
--
-- Preview 2026-09-16 (SELECT): dos pares activos con misma cancha + día + hora,
-- mismo título y mismo creador, creados con 3-5 s de diferencia (doble envío).
-- En cada par la regla más nueva es "sombra": el generador deduplicaba por
-- cancha/fecha/hora y nunca le creó ocurrencias.
--
--   Martes 09:00  "valenmtino"
--     conserva  b05fe1d0-de72-4e8c-9aa0-b16a1db315a4  5 históricos, 2 futuros vivos
--     desactiva bc58b1e9-036e-405d-9eed-5f7ef6569345  0 matches, 0 jugadores, sin excepciones
--   Viernes 09:00 "reservado para marcos."
--     conserva  b969dd97-e36a-415a-830a-4de91c88caf0  6 históricos, 2 futuros vivos
--     desactiva 2b696012-5e51-48c1-ad37-8e3e60c349e5  0 matches, 0 jugadores, excepción 28/08 (pasada)
--
-- Desactiva (no borra): la excepción histórica queda. Guardas: solo si la regla
-- sigue activa, sigue sin matches ni jugadores y su gemela conservada sigue
-- activa. Si algo cambió desde el preview, no toca nada.
-- Debe correr ANTES de 20260916170000_fixed_slots_active_unique.

update public.fixed_slots s
   set is_active = false
 where s.id in ('bc58b1e9-036e-405d-9eed-5f7ef6569345', '2b696012-5e51-48c1-ad37-8e3e60c349e5')
   and s.is_active = true
   and not exists (select 1 from public.matches m where m.fixed_slot_id = s.id)
   and not exists (select 1 from public.fixed_slot_players p where p.fixed_slot_id = s.id)
   and exists (
     select 1 from public.fixed_slots k
      where k.id in ('b05fe1d0-de72-4e8c-9aa0-b16a1db315a4', 'b969dd97-e36a-415a-830a-4de91c88caf0')
        and k.is_active = true
        and k.court_id = s.court_id
        and k.day_of_week = s.day_of_week
        and k.start_time = s.start_time
   );
