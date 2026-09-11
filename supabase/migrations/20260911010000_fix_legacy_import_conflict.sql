-- Perbaiki index legacy import agar cocok dengan ON CONFLICT (legacy_source_key).
-- Migration 20260911000000 sebelumnya membuat partial unique index, yang tidak
-- dapat dipakai oleh PostgREST untuk spesifikasi ON CONFLICT sederhana.

drop index if exists public.cash_transactions_legacy_source_key_idx;

create unique index cash_transactions_legacy_source_key_idx
  on public.cash_transactions (legacy_source_key);