alter table public.payments
  drop constraint if exists payments_status_check;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending','approved','rejected','refunded','cancelled','refund_requested'));
