-- Torneos V2 · Fase B (cierre) · Proteger ediciones de categoría con inscriptos
--
-- Antes, una categoría se podía editar libremente aunque ya tuviera
-- inscripciones vivas — incluidos los campos que definen QUIÉN puede
-- inscribirse (modalidad, tipo, niveles, suma). Cambiar eso con inscriptos ya
-- adentro podía dejar inscripciones que ya no cumplen la regla nueva.
--
-- Regla (decisión de producto explícita, preferencia por bloquear):
--   A) Estructura competitiva (modality, category_kind, levels, suma_target):
--      si hay al menos una inscripción viva (pending_payment, pending o
--      approved), no se puede tocar. Se bloquea con mensaje claro.
--   B) Config comercial (precio, seña, métodos de pago): se puede cambiar
--      siempre. NUNCA recalcula filas existentes — tournament_registrations
--      ya guarda su propio total_price/requires_deposit-en-el-momento (vía lo
--      que devolvió tournament_register_entry), así que el valor nuevo solo
--      aplica a inscripciones FUTURAS. No hay nada que "recalcular": la
--      categoría no es la fuente de precio para una fila ya creada.
--   max_pairs: se puede subir siempre; bajarlo está limitado a no dejar menos
--      cupo que inscripciones vivas actuales.
--
-- Esto se refuerza a nivel trigger (no solo en el server action) para que
-- ninguna otra vía de escritura pueda saltear la regla.
--
-- No se aplicó en ningún ambiente remoto. Forward-only.

create or replace function public.tournament_categories_guard_structural_edit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_live_count int;
begin
  select count(*)::int into v_live_count
  from public.tournament_registrations r
  where r.category_id = old.id
    and r.payment_status in ('pending_payment', 'pending', 'approved');

  if v_live_count > 0 then
    if new.modality is distinct from old.modality
       or new.category_kind is distinct from old.category_kind
       or new.levels is distinct from old.levels
       or new.suma_target is distinct from old.suma_target then
      raise exception 'Esta categoría ya tiene % inscripción(es): no se puede cambiar modalidad, tipo, niveles ni suma', v_live_count
        using errcode = 'check_violation';
    end if;
  end if;

  if new.max_pairs < v_live_count then
    raise exception 'No se puede bajar el cupo a %: ya hay % inscripción(es) viva(s)', new.max_pairs, v_live_count
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists tournament_categories_guard_structural_edit on public.tournament_categories;
create trigger tournament_categories_guard_structural_edit
  before update of modality, category_kind, levels, suma_target, max_pairs on public.tournament_categories
  for each row execute function public.tournament_categories_guard_structural_edit();
