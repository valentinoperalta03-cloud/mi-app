-- Clases: pago en efectivo/transferencia y cobro en panel admin.

alter table public.practice_registrations
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('mercadopago', 'cash', 'transfer')),
  add column if not exists confirmed_at timestamptz;

alter table public.practice_registrations drop constraint if exists practice_registrations_payment_status_check;

alter table public.practice_registrations
  add constraint practice_registrations_payment_status_check check (
    payment_status in (
      'pending',
      'approved',
      'cancelled',
      'refunded',
      'cash_pending',
      'transfer_pending'
    )
  );

-- Deuda PadeLibre por cobros offline de clases (match_id sigue siendo para turnos).
alter table public.club_debts
  alter column match_id drop not null;

alter table public.club_debts
  add column if not exists practice_registration_id uuid
    references public.practice_registrations (id) on delete set null;

create index if not exists club_debts_practice_registration_idx
  on public.club_debts (practice_registration_id)
  where practice_registration_id is not null;
