# Blueprint Sistem: PWA Arisan & Buku Doa IKT

Dokumen ini mengunci perilaku aplikasi pada stack baru. Developer dilarang mengubah angka, pos dana, atau alur mutasi tanpa persetujuan pengurus.

Teknologi lama (HTML vanilla + Google Apps Script + Google Sheets) **diganti**. Logika bisnis lama **tetap**.

## 1. Arsitektur (stack baru)

| Lapisan | Teknologi | Catatan terkunci |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript | Client-side rendering, mobile-first |
| Styling | Tailwind CSS v4 + Lucide | Bukan Tailwind CDN / FontAwesome |
| PWA | `vite-plugin-pwa` + Workbox | `orientation` bebas, cache aset statis termasuk bacaan doa |
| Backend | Supabase PostgreSQL + Auth + Storage + RPC | Bukan Google Apps Script |
| Mutasi keuangan | Fungsi SQL `security definer` | Browser tidak boleh INSERT langsung ke kas/iuran |
| PIN bendahara | Hash bcrypt di `app_settings.treasurer_pin_hash` | **Bukan** PIN `1234` di source code |

Environment frontend hanya boleh berisi URL dan anon/publishable key.

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
```

`service_role` dilarang masuk `.env.local`, source, atau bundle.

## 2. Pemetaan sheet lama → tabel baru

| Sheet lama | Tabel / view baru | Sifat |
| --- | --- | --- |
| `Acara_Aktif` | `events` + `public_events` | Publik. Kolom wajib: `starts_at`, `host_name` (Tuan_Rumah), `prayer_officer` (Petugas_Doa), `location` (Alamat), `map_url` (Link_Maps). `Total_Kas` / `Pengeluaran` / `Sisa_Saldo` **tidak diimpor**. |
| `Daftar_Almarhum` | `legacy_deceased_people` + `public_legacy_deceased_people` | Publik. `full_name`, `lineage_label` (Bin_Binti), `father_name` (Ayah_Kandung). |
| `Status_Iuran` | `arisan_members` + `public_arisan_members` | **Roster operasional.** Bukan akun Auth. Kolom: `full_name`, `member_type` (`Arisan` / `Non-Arisan`), `period_status` (`LUNAS` / `BELUM`), `arrears_periods`, `phone` (hanya view pengurus). |
| `Riwayat_Pemenang` | `legacy_arisan_winners` + `public_legacy_arisan_winners` | Publik. `period_label`, `winner_name`, `description`. |
| `Detail_Kas` | `cash_transactions` + `public_cash_transactions` | Login. `type` income/expense, `category` = Pos_Dana, `description` = Keterangan, `amount` = Nominal, `occurred_on` = Tanggal. |
| `Audit_Log` | `audit_log` | Hanya pengurus. `occurred_at` timestamptz (presisi detik, zona `Asia/Jakarta` saat ditampilkan). |

Akun Auth (`profiles`) hanya untuk login pengurus/anggota aplikasi. **Jangan** memakai `profiles` sebagai daftar peserta arisan.

## 3. Aturan bisnis terkunci

### 3.1 Gatekeeper

Setiap mutasi (`settle_member_iuran`, `reverse_member_iuran`, `execute_arisan_event`, `create_expense`) wajib:

1. Sesi login role `admin` atau `treasurer` yang aktif.
2. PIN 4 digit yang cocok dengan hash di `app_settings`.
3. Jika PIN salah: tolak, kembalikan pesan `PIN Bendahara Salah!`, catat `audit_log` dengan `success = false` dan `pin_valid = false`.

PIN default **tidak** dipasang oleh migration. Set satu kali di SQL Editor:

```sql
insert into public.app_settings (setting_key, setting_value)
values ('treasurer_pin_hash', crypt('<PIN-4-DIGIT>', gen_salt('bf')))
on conflict (setting_key) do update
set setting_value = excluded.setting_value,
    updated_at = timezone('utc', now());
```

### 3.2 Auto-split pelunasan (`settle_member_iuran`)

Input: `p_member_id` (id `arisan_members`), `p_period_count` (`n`, default 1), `p_pin`.

| Tipe | Total / periode | Pecahan pos |
| --- | ---: | --- |
| Arisan | Rp 240.000 | Iuran Arisan 140.000, Iuran Wajib 20.000, Dana Sosial 20.000, Konsumsi 30.000, Tabungan Kaos 30.000 |
| Non-Arisan | Rp 100.000 | Iuran Wajib 20.000, Dana Sosial 20.000, Konsumsi 30.000, Tabungan Kaos 30.000 |

Keterangan kas wajib memakai pola lama: `{Pos} {Nama} ({n}x)`.

Efek status:

- `period_status = 'LUNAS'`
- `arrears_periods = max(0, tunggakan_lama - n)`
- Tolak jika anggota sudah `LUNAS` (cegah double input periode yang sama)

### 3.3 Undo (`reverse_member_iuran`)

Input: `p_member_id`, `p_pin`. Membatalkan settlement aktif terbaru anggota itu.

Wajib:

- `period_status = 'BELUM'`
- `arrears_periods` kembali ke `arrears_before`
- Satu baris pengeluaran pos `Koreksi/Pembatalan`, keterangan `Batal Lunas {Nama} ({n}x)`, nominal = total settlement

### 3.4 Eksekusi acara (`execute_arisan_event`)

Input: `p_mode` (`all` / `arisan` / `konsumsi`), `p_pin`.

| Mode | Transaksi |
| --- | --- |
| `all` | Pengeluaran Iuran Arisan Rp 3.220.000 `Penyerahan Arisan (2 Pemenang)` **dan** Pengeluaran Konsumsi Rp 900.000 `Konsumsi Tuan Rumah` |
| `arisan` | Hanya Rp 3.220.000 |
| `konsumsi` | Hanya Rp 900.000 |

Angka ini hardcoded. Jangan membaca dari UI.

### 3.5 Pengeluaran manual (`create_expense`)

Pos dana yang diizinkan: `Iuran Arisan`, `Iuran Wajib`, `Dana Sosial`, `Konsumsi`, `Tabungan Kaos`. Pos `Koreksi/Pembatalan` hanya dari `reverse_member_iuran`.

### 3.6 Saldo

Saldo = jumlah pemasukan − jumlah pengeluaran. Dilarang menyimpan atau menampilkan `Total_Kas` / `Sisa_Saldo` dari sheet sebagai sumber kebenaran.

### 3.7 Rekening transfer (publik)

Terkunci ke data aplikasi lama:

- Bank Mandiri `1210007759008`
- A/N Suwandi
- Konfirmasi WA ke nomor Suwandi di roster (`089682964275`)

Sumber: UI lama di `tmp/Arisan & Buku Doa Digital.pdf` dan `tmp/Status_Iuran.csv`.

## 4. Akses data

| Konten | Anon | Anggota login | Admin / bendahara |
| --- | --- | --- | --- |
| Agenda, galeri terbit, almarhum, pemenang, rekening | Baca | Baca | Baca |
| Kas, iuran, roster, buku doa catatan | Tidak | Baca | Baca + mutasi ber-PIN |
| Nomor HP anggota | Tidak | Tidak | Baca lewat `manager_arisan_members` |
| Audit log | Tidak | Tidak | Baca |

## 5. RPC yang boleh dipanggil frontend

```
settle_member_iuran(p_member_id uuid, p_period_count integer, p_pin text)
reverse_member_iuran(p_member_id uuid, p_pin text)
execute_arisan_event(p_mode text, p_pin text)
create_expense(p_description text, p_amount numeric, p_category text, p_pin text)
```

Dilarang menambah policy INSERT/UPDATE/DELETE pada `cash_transactions`, `arisan_members`, atau `iuran_settlements` untuk role `anon` / `authenticated`.

## 6. File frontend yang mengunci angka

- `src/features/finance/contributionRules.ts` — pecahan iuran dan nominal eksekusi acara
- `src/data/organization.ts` — rekening dan WA konfirmasi
- `src/data/prayers.ts` — bacaan Yasin / tahlil / doa (cache PWA)

## 7. Migration yang wajib berurutan

Jalankan seluruh file di `supabase/migrations/` sampai:

```text
20260914060000_blueprint_locked_operations.sql
```

Tanpa migration terakhir, roster operasional, Set Lunas, Batal Lunas, dan Eksekusi Acara tidak ada.

## 8. Yang dilarang diubah tanpa persetujuan pengurus

- Nominal pecahan iuran dan nominal eksekusi acara
- Nama pos dana
- Syarat PIN pada setiap mutasi
- Status hanya `LUNAS` / `BELUM`
- Rumus tunggakan `max(0, lama - n)`
- Koreksi batal lunas sebagai **satu** pengeluaran `Koreksi/Pembatalan`
- Memakai akun Auth sebagai pengganti roster `Status_Iuran`
