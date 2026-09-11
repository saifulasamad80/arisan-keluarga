-- Dukungan impor data lama dari Google Sheets.
-- Kolom ini sengaja nullable agar transaksi baru tetap berjalan seperti biasa.

alter table public.cash_transactions
  add column if not exists legacy_source_key text;

alter table public.cash_transactions
  add column if not exists legacy_source_timestamp timestamptz;

-- Unique index biasa diperlukan agar PostgREST/PostgreSQL dapat mencocokkan
-- `onConflict: legacy_source_key` dari importer. Kolom nullable tetap aman:
-- PostgreSQL mengizinkan beberapa nilai NULL pada unique index.
create unique index if not exists cash_transactions_legacy_source_key_idx
  on public.cash_transactions (legacy_source_key);