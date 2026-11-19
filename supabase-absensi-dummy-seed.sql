-- Mengganti seluruh isi public.absensi dengan 21 baris data dummy untuk user_id 11.
-- Jalankan supabase-absensi-migration.sql terlebih dahulu agar kolom baru tersedia.
-- Seluruh perubahan berada dalam satu transaksi: jika pemeriksaan atau INSERT gagal,
-- penghapusan data sebelumnya ikut dibatalkan.

begin;

do $$
begin
  if not exists (select 1 from public.karyawan where id = 11) then
    raise exception 'Karyawan dengan id 11 tidak ditemukan. Data absensi tidak dihapus.';
  end if;
end $$;

delete from public.absensi;

with dummy_data (tahun, bulan, tanggal, jam_masuk, jam_pulang, keterangan) as (
  values
    (2025, 1,  2, '08:02:00', '17:06:00', null::text),
    (2025, 1,  6, '08:11:00', '17:14:00', 'Briefing pagi'),
    (2025, 1, 17, '07:58:00', '17:01:00', null::text),
    (2025, 3,  4, '08:05:00', '17:08:00', null::text),
    (2025, 3, 11, '08:17:00', '17:20:00', 'Terlambat karena hujan'),
    (2025, 5,  1, '08:00:00', '17:03:00', null::text),
    (2025, 5,  9, '08:07:00', '17:12:00', null::text),
    (2025, 5, 23, '08:03:00', '16:30:00', 'Pulang lebih awal'),
    (2025, 8,  4, '08:09:00', '17:11:00', null::text),
    (2025, 8,  5, '08:01:00', '17:05:00', null::text),
    (2025, 12, 3, '08:04:00', '17:07:00', null::text),
    (2025, 12,15, '08:13:00', '17:17:00', 'Kunjungan toko'),
    (2026, 2,  3, '08:00:00', '17:02:00', null::text),
    (2026, 2, 16, '08:06:00', '17:09:00', null::text),
    (2026, 4,  1, '08:12:00', '17:16:00', null::text),
    (2026, 4,  8, '07:55:00', '17:00:00', 'Persiapan display'),
    (2026, 4, 20, '08:08:00', '16:45:00', 'Pulang lebih awal'),
    (2026, 7,  4, '08:03:00', '17:06:00', null::text),
    (2026, 7,  9, '08:10:00', '17:13:00', null::text),
    (2026, 11, 2, '08:05:00', '17:08:00', null::text),
    (2026, 11,18, '08:00:00', '17:04:00', 'Data contoh dengan foto yang diberikan')
), foto (url) as (
  values ('https://zwrwyfmkfxnqdcgklrrs.supabase.co/storage/v1/object/public/foto-absensi/absen_2026-11-18_1794994275026.jpg')
)
insert into public.absensi (
  user_id,
  tanggal,
  bulan,
  tahun,
  jam,
  foto_url,
  jam_masuk,
  foto_masuk_url,
  jam_pulang,
  foto_pulang_url,
  keterangan
)
select
  11,
  dummy_data.tanggal,
  dummy_data.bulan,
  dummy_data.tahun,
  dummy_data.jam_masuk,
  foto.url,
  dummy_data.jam_masuk,
  foto.url,
  dummy_data.jam_pulang,
  foto.url,
  coalesce(nullif(trim(dummy_data.keterangan), ''), 'Hadir')
from dummy_data
cross join foto;

do $$
begin
  if (select count(*) from public.absensi where user_id = 11) < 15 then
    raise exception 'Data dummy kurang dari 15 baris; transaksi dibatalkan.';
  end if;
end $$;

commit;
