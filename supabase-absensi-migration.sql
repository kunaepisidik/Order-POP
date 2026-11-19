-- Jalankan sekali di Supabase SQL Editor sebelum memakai alur absen masuk/pulang.
-- Data absensi lama tetap tersimpan; catatan lama belum memiliki user_id sehingga
-- tidak dapat otomatis dipasangkan ke akun karyawan tertentu.

alter table public.absensi
  add column if not exists user_id bigint references public.karyawan(id) on delete set null,
  add column if not exists jam_masuk text,
  add column if not exists foto_masuk_url text,
  add column if not exists jam_pulang text,
  add column if not exists foto_pulang_url text,
  add column if not exists keterangan text;

-- Baris OFF hanya berisi tanggal dan keterangan, tanpa jam atau foto.
alter table public.absensi
  alter column jam drop not null,
  alter column foto_url drop not null;

-- Pertahankan catatan lama sebagai data absen masuk.
update public.absensi
set jam_masuk = coalesce(jam_masuk, jam::text),
    foto_masuk_url = coalesce(foto_masuk_url, foto_url)
where jam_masuk is null or foto_masuk_url is null;

update public.absensi
set keterangan = 'Hadir'
where jam_masuk is not null
  and jam_pulang is not null
  and coalesce(nullif(trim(keterangan), ''), '') = '';

create index if not exists absensi_user_tanggal_idx
  on public.absensi (user_id, tahun, bulan, tanggal);

create unique index if not exists absensi_user_harian_unique_idx
  on public.absensi (user_id, tahun, bulan, tanggal)
  where user_id is not null;

-- Aplikasi saat ini menggunakan Supabase anon key untuk alur CRUD, seperti tabel lain.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'absensi'
      and policyname = 'Anon can update absensi'
  ) then
    create policy "Anon can update absensi"
      on public.absensi for update
      to anon
      using (true)
      with check (true);
  end if;
end $$;
