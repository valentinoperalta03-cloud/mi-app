-- Escala histórica profiles.level ~1–5 → 0–8 (ejecutar una sola vez por entorno).
-- Condición: evita re-mapear filas ya en la nueva escala (>5.5).

update public.profiles
set
  level = round((((level - 1.0) / 4.0) * 8.0)::numeric, 3)::double precision,
  level_of_play = case
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 7.0 then '1ra · Elite'
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 6.0 then '2da · Elite'
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 5.0 then '3ra · Avanzado+'
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 4.0 then '4ta · Avanzado'
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 3.0 then '5ta · Intermedio+'
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 2.0 then '6ta · Intermedio'
    when round((((level - 1.0) / 4.0) * 8.0)::numeric, 3) >= 1.0 then '7ma · Iniciación'
    else '8va · Principiante'
  end
where level is not null
  and level >= 1.0
  and level <= 5.0001;
