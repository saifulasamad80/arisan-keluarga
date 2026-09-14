# Migrasi data arisan lama

Data lama dari Google Sheets sudah tersedia di folder sementara `tmp/`. Sebelumnya
importer cuma menangani transaksi, jadi sheet lain memang tidak pernah masuk ke
aplikasi. Sekarang seluruh sheet punya jalur migrasi idempotent. Skrip ini
**tidak mengubah database secara default**.

## Status data dari spreadsheet

Workbook sumber berisi:

- `Form Responses 1`: 3 transaksi.
- `Acara_Aktif`: 1 agenda.
- `Status_Iuran`: 30 anggota; semua berstatus `BELUM`, kolom tunggakan kosong.
- `Daftar_Almarhum`: 76 baris.
- `Riwayat_Pemenang`: 1 riwayat.
- `Detail_Kas`: tidak punya transaksi berisi data.
- `Audit_Log`: hanya header.

Baris kosong hasil formatting Google Sheets tidak dianggap sebagai data.

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

Untuk seluruh sheet, jalankan juga migration berikut:

```text
supabase/migrations/20260913000000_legacy_sheets_support.sql
```

Migration ini menambah tabel data lama untuk status iuran, daftar almarhum, dan
riwayat pemenang. Nomor HP status iuran disimpan di tabel privat dan tidak
dikeluarkan oleh view publik.

Jika fitur pencatatan iuran dan pengeluaran akan dipakai, jalankan juga:

```text
supabase/migrations/20260913010000_atomic_contribution_settlement.sql
```

Migration tersebut sengaja tidak memasang PIN bawaan. Setelah migration selesai,
atur PIN bendahara empat digit melalui SQL Editor Supabase. Ganti nilai contoh
sebelum menjalankan perintah ini dan jangan simpan PIN asli di repository:

```sql
insert into public.app_settings (setting_key, setting_value)
values ('treasurer_pin_hash', crypt('<PIN-4-DIGIT>', gen_salt('bf')))
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = timezone('utc', now());
```

## 4. Dry-run wajib

Gunakan UUID profile pengurus yang akan tercatat sebagai `created_by`:

```bash
node scripts/import-legacy-sheets.mjs \
  --dir /home/saifulsamad/arisan_ikt/tmp \
  --created-by <uuid-profile-pengurus> \
  --period-label "Agustus 2026" \
  --report /tmp/legacy-import-report.json
```

Periksa jumlah `valid` dan `invalid` per sheet. Baris invalid harus diperbaiki di
CSV dan dry-run diulang sebelum data diterapkan. `--created-by` harus UUID yang
sudah ada di `public.profiles` dan berasal dari user Auth pengurus.

## 5. Terapkan data

Hanya jalankan dari server atau terminal admin yang aman. `SUPABASE_SERVICE_ROLE_KEY`
memiliki hak penuh dan **tidak boleh** dimasukkan ke `.env.local` frontend,
source code, atau repository.

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
node scripts/import-legacy-sheets.mjs \
  --dir /home/saifulsamad/arisan_ikt/tmp \
  --created-by <uuid-profile-pengurus> \
  --period-label "Agustus 2026" \
  --apply
```

Importer akan:

- memasukkan transaksi ke `cash_transactions`;
- memasukkan `Acara_Aktif` ke `events` tanpa mengimpor saldo manual;
- memasukkan status iuran ke tabel legacy privat;
- mencocokkan nama status iuran ke `profiles.full_name` hanya jika hasilnya tepat
  satu. Nama tanpa match tidak dibuang dan tidak dibuatkan akun Auth palsu;
- memasukkan daftar almarhum dan riwayat pemenang ke tabel legacy masing-masing;
- aman dijalankan ulang karena setiap baris punya `legacy_source_key` unik.

## Sheet yang tidak menjadi transaksi

- `Status_Iuran` menyimpan snapshot status lama, bukan otomatis membuat baris
  `contributions`, karena sheet tidak punya tanggal periode dan nominal pembayaran.
- `Acara_Aktif` memakai jam default 09:00 UTC karena sheet hanya punya tanggal.
  Sesuaikan jam di database jika agenda membutuhkan waktu presisi.
- `Total_Kas`, `Pengeluaran`, dan `Sisa_Saldo` sengaja diabaikan; saldo harus
  dihitung dari transaksi, bukan dari angka manual yang bisa basi.
- `Detail_Kas` kosong dan `Audit_Log` hanya header, jadi tidak ada baris yang
  diimpor dari keduanya.
- `Audit_Log` tidak boleh dipindahkan sebagai transaksi; gunakan tabel audit
  terpisah jika riwayat perubahan lama perlu dipertahankan.
