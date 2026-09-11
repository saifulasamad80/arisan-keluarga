# Arisan IKT

Aplikasi mobile-first untuk mengelola arisan, kas, anggota, agenda, buku doa, dan galeri foto IKT.

Anggota dapat membuka aplikasi dan membaca informasi bersama tanpa login. Login hanya
diperlukan pengurus saat mencatat kas, iuran, mengirim pengingat pembayaran, atau
menambah foto galeri.

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

Setelah itu jalankan migration akses publik dan galeri:

```text
supabase/migrations/20260910020000_public_access_and_gallery.sql
```

Cara menjalankan melalui Supabase Dashboard:

1. Buat project Supabase baru.
2. Buka **SQL Editor**.
3. Jalankan migration awal, migration bucket bila diperlukan, lalu migration akses publik dan galeri.
4. Aktifkan provider Auth yang diperlukan di **Authentication > Providers**.
5. Tambahkan URL aplikasi lokal/deployment di **Authentication > URL Configuration**.
6. Isi `.env.local` dengan URL dan anon key dari **Project Settings > API**.

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

Migration `20260910020000_public_access_and_gallery.sql` membuat view baca publik
untuk kas, iuran, agenda, anggota, buku doa, dan foto yang telah diterbitkan. View
tersebut hanya menampilkan kolom aman; nomor telepon hanya tersedia melalui view
`manager_members` untuk admin/bendahara. Jalankan migration ini setelah migration awal
sebelum menguji aplikasi tanpa login.

Foto galeri diunggah pengurus ke bucket publik `ikt-gallery`. Jangan unggah foto yang
tidak mendapat izin untuk dibagikan kepada seluruh anggota.

User baru otomatis dibuatkan baris `profiles` melalui trigger `auth.users`. Role default adalah `member`. Setelah membuat akun pengurus pertama, admin project dapat mempromosikannya melalui SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = '<auth-user-uuid>';
```

UUID dapat dilihat dari **Authentication > Users**. Query bootstrap ini dilakukan oleh pemilik project di SQL Editor; tidak boleh dibuat sebagai aksi bebas dari browser.

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