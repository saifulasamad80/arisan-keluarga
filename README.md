# Arisan IKT

Aplikasi mobile-first untuk mengelola arisan, kas, anggota, agenda, buku doa, dan galeri foto IKT.

Anggota dapat membuka aplikasi dan membaca agenda, foto galeri terbit, riwayat
almarhum/pemenang, serta rekening transfer tanpa login. Data kas, iuran, daftar
anggota arisan, dan catatan doa hanya dapat dibaca setelah login. Login pengurus
diperlukan untuk Set Lunas / Batal Lunas, eksekusi acara, pengeluaran, pengingat
pembayaran, atau menambah foto galeri.

Spesifikasi terkunci ada di `docs/blueprint.md`. Roster operasional adalah
`arisan_members` (sheet `Status_Iuran`), bukan tabel akun Auth.

## Stack

- React + Vite + TypeScript
- Tailwind CSS v4
- Supabase PostgreSQL, Auth, Storage, dan Realtime-ready
- React Hook Form + Zod
- Lucide Icons
- Vite PWA + Workbox

## Menjalankan secara lokal

```bash
cd /home/saifulsamad/arisan_ikt
npm install
cp .env.example .env.local
npm run dev
```

Environment frontend hanya boleh berisi URL Supabase dan **anon/publishable key**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> Jangan pernah menaruh `service_role` key di `.env.local`, source code, atau bundle browser. Key tersebut hanya boleh digunakan di server/CI yang aman.

## Supabase database

Migration awal berada di:

```text
supabase/migrations/20260910000000_initial_schema.sql
```

Jika tabel sudah ada tetapi bucket Storage belum tersedia, jalankan migration koreksi:

```text
supabase/migrations/20260910010000_storage_bucket.sql
```

Setelah itu jalankan migration akses publik dan galeri, lalu migration hardening akses:

```text
supabase/migrations/20260910020000_public_access_and_gallery.sql
supabase/migrations/20260914010000_harden_public_data_access.sql
supabase/migrations/20260914020000_allow_gallery_public_filter.sql
```

Cara menjalankan melalui Supabase Dashboard:

1. Buat project Supabase baru.
2. Buka **SQL Editor**.
3. Jalankan migration awal, migration bucket bila diperlukan, lalu migration akses publik dan galeri.
4. Aktifkan provider Auth yang diperlukan di **Authentication > Providers**.
5. Nonaktifkan **Allow new users to sign up** di **Authentication > Settings > User Signups**. Pendaftaran publik tidak digunakan oleh aplikasi ini.
6. Tambahkan URL aplikasi lokal/deployment di **Authentication > URL Configuration**.
7. Isi `.env.local` dengan URL dan anon key dari **Project Settings > API**.

Jika menggunakan Supabase CLI, migration dapat dijalankan dari root proyek dengan workflow CLI yang sesuai:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### Role aplikasi

Tabel `profiles` memiliki role:

- `admin`: mengelola role anggota dan seluruh data operasional.
- `treasurer`: mengelola transaksi kas dan iuran.
- `member`: membaca data bersama dan mengelola data miliknya sesuai policy.

### Data publik dan galeri

Migration `20260910020000_public_access_and_gallery.sql` membuat view baca untuk
konten komunitas. Migration `20260914010000_harden_public_data_access.sql` dan
`20260914020000_allow_gallery_public_filter.sql` wajib dijalankan setelahnya untuk
mengaktifkan `security_invoker`, mencabut privilege DML yang berlebihan, dan
membatasi anonymous hanya pada konten berikut:

- agenda/event;
- foto galeri yang diterbitkan;
- riwayat almarhum dan pemenang.

Kas, iuran termasuk status/tunggakan, daftar anggota/role, dan buku doa **bukan data
publik**. View tersebut hanya tersedia untuk `authenticated`; nomor telepon hanya
tersedia melalui view `manager_members` untuk admin/bendahara.

Foto galeri diunggah pengurus ke bucket publik `ikt-gallery`. Jangan unggah foto yang
tidak mendapat izin untuk dibagikan kepada seluruh anggota.

User baru yang dibuat melalui Supabase Auth otomatis dibuatkan baris `profiles` melalui trigger `auth.users`. Pendaftaran pengurus dari aplikasi hanya tersedia pada sesi role `admin`, melalui Edge Function `supabase/functions/admin-create-user`. Deploy function tersebut setelah project ditautkan:

```bash
supabase functions deploy admin-create-user
```

Supabase menyediakan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` sebagai secret bawaan hosted Edge Function. Pastikan service-role key tetap hanya berada di environment server/function dan tidak pernah disalin ke environment Vite.

Setelah migration dan function aktif, admin web dapat memakai tombol **Daftarkan pengurus**. Function memverifikasi JWT dan role admin di server sebelum membuat akun Auth. Bendahara tidak dapat mendaftarkan akun, dan browser tidak pernah menerima service-role key.

Migration `20260913020000_admin_only_registration.sql` mencabut jalur insert profil dari
browser dan membatasi perubahan kolom profil. Migration koreksi
`20260914000000_admin_auth_trigger_compatibility.sql` memastikan trigger `auth.users`
tetap kompatibel dengan Admin Auth API. Jangan mengandalkan `app_metadata` pada trigger
database untuk membedakan signup publik: metadata kustom belum tersedia ketika trigger
`AFTER INSERT` berjalan. Karena itu, **Authentication > Settings > User Signups > Allow
new users to sign up** wajib tetap dinonaktifkan. Jalur pendaftaran aplikasi hanya melalui
Edge Function yang memverifikasi JWT dan role admin.

Migration `20260914050000_sync_member_names.sql` memperbaiki profil lama yang memakai
email sebagai nama dengan mengambil `user_metadata.full_name` atau nama spreadsheet
yang cocok berdasarkan nomor telepon unik. Jalankan migration ini setelah migration
legacy dan Auth sebelumnya.

Migration `20260914060000_blueprint_locked_operations.sql` wajib untuk operasi
blueprint: roster `arisan_members`, Set Lunas, Batal Lunas, eksekusi acara, dan
kolom tuan rumah/petugas doa. Tanpa file ini, halaman iuran dan kas pengurus
tidak punya jalur mutasi yang dikunci. Lihat `docs/blueprint.md`.

Jika profil lama tidak memiliki nama pada metadata Auth maupun pasangan nomor telepon
di data legacy, nama tidak dapat ditebak secara aman. Perbaiki satu kali melalui SQL
Editor dengan UUID dari **Authentication > Users**:

```sql
update public.profiles
set full_name = 'Nama Anggota'
where id = '<auth-user-uuid>';
```

Untuk bootstrap admin pertama pada project baru, buat user Auth pertama **sebelum** menerapkan migration `20260913020000_admin_only_registration.sql`, lalu admin project mempromosikannya melalui SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = '<auth-user-uuid>';
```

UUID dapat dilihat dari **Authentication > Users**. Query bootstrap ini dilakukan oleh pemilik project di SQL Editor; tidak boleh dibuat sebagai aksi bebas dari browser. Jika memakai workflow migration otomatis pada project baru, terapkan migration sampai `20260913010000_atomic_contribution_settlement.sql`, buat dan promosikan admin pertama, lalu terapkan migration `20260913020000_admin_only_registration.sql` dan `20260914000000_admin_auth_trigger_compatibility.sql`, kemudian deploy Edge Function. Setelah **Allow new users to sign up** dinonaktifkan, akun berikutnya harus didaftarkan dari tombol admin web.

## Keamanan database

Migration mengaktifkan Row Level Security pada seluruh tabel aplikasi:

- Anggota terautentikasi dapat membaca data bersama.
- Hanya admin/bendahara yang dapat menambah, mengubah, atau menghapus kas dan iuran.
- Perubahan role hanya dapat dilakukan admin.
- Agenda dan catatan doa hanya dapat diubah oleh pembuatnya atau role yang berwenang.
- Storage bucket `ikt-files` bersifat private dan file harus berada di folder UUID user.

Frontend menggunakan `src/lib/supabase.ts` yang akan bernilai `null` jika environment belum diisi. Ini memungkinkan UI demo tetap berjalan tanpa koneksi database. Setelah Auth dan repository data diaktifkan, semua query tetap harus mengandalkan RLS—bukan menyimpan rahasia di frontend.

## Pemeriksaan proyek

```bash
npm run lint
npm run build
```

Build produksi juga menghasilkan manifest PWA dan service worker di `dist/`.