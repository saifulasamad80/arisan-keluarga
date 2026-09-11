# Migrasi data arisan lama

Dokumen lama dapat diekspor dari Google Sheets sebagai CSV lalu divalidasi dengan
skrip impor transaksi. Skrip ini **tidak mengubah database secara default**.

## 1. Ekspor transaksi

Di Google Sheets, buka sheet `Form Responses 1`, lalu pilih **File > Download >
Comma-separated values (.csv)**. Simpan file sebagai `form-responses-1.csv` di
luar repository atau pada folder sementara.

Kolom yang didukung:

| Google Sheets | Supabase |
| --- | --- |
| `Tipe Transaksi` (`Kas Masuk`/`Pemasukan`) | `cash_transactions.type = income` |
| `Tipe Transaksi` (`Kas Keluar`/`Pengeluaran`) | `cash_transactions.type = expense` |
| `Keterangan Transaksi` | `description` |
| `Nominal (Rp)` | `amount` |
| `Tanggal Transaksi` | `occurred_on` |
| `Pos Dana` | `category` |
| `Timestamp` | `legacy_source_timestamp` |

Tanggal `dd/mm/yyyy` dan nominal Rupiah tanpa desimal maupun dengan pemisah
desimal didukung. Pos dana kosong diubah menjadi `Lainnya`.

## 2. Jalankan migration schema

Jalankan file berikut setelah migration utama:

```text
supabase/migrations/20260911000000_legacy_import_support.sql
```

Migration menambahkan `legacy_source_key` dan unique index biasa. Kunci ini
membuat impor yang sama aman untuk dijalankan ulang tanpa membuat transaksi
duplikat. Index biasa (bukan partial index) diperlukan agar `upsert` dengan
`onConflict: legacy_source_key` dapat dikenali PostgreSQL/PostgREST.

## 3. Dry-run wajib

Gunakan UUID profile pengurus yang akan tercatat sebagai `created_by`:

```bash
node scripts/import-legacy-transactions.mjs \
  --file /path/ke/form-responses-1.csv \
  --created-by <uuid-profile-pengurus> \
  --report /tmp/legacy-import-report.json
```

Periksa jumlah `valid` dan `invalid`. Baris invalid harus diperbaiki di CSV dan
dry-run diulang sebelum data diterapkan.

## 4. Terapkan data

Hanya jalankan dari server atau terminal admin yang aman. `SUPABASE_SERVICE_ROLE_KEY`
memiliki hak penuh dan **tidak boleh** dimasukkan ke `.env.local` frontend,
source code, atau repository.

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
node scripts/import-legacy-transactions.mjs \
  --file /path/ke/form-responses-1.csv \
  --created-by <uuid-profile-pengurus> \
  --apply
```

## Sheet lain

- `Status_Iuran` membutuhkan pencocokan `Nama_Anggota` ke UUID `profiles.id`.
  Jangan mengimpor nomor telepon secara otomatis sebelum identitas diverifikasi.
- `Acara_Aktif` dapat dipetakan ke `events`, tetapi `starts_at` dan `created_by`
  wajib ditentukan; kolom `Total_Kas`, `Pengeluaran`, dan `Sisa_Saldo` sebaiknya
  dihitung dari transaksi, bukan diimpor sebagai saldo manual.
- `Daftar_Almarhum`, `Riwayat_Pemenang`, dan `Detail_Kas` belum memiliki tabel
  tujuan pada schema aplikasi saat ini. Data tersebut harus didesain dan
  dikonfirmasi terlebih dahulu sebelum migration tambahan dibuat.
- `Audit_Log` tidak boleh dipindahkan sebagai transaksi; gunakan tabel audit
  terpisah jika riwayat perubahan lama perlu dipertahankan.