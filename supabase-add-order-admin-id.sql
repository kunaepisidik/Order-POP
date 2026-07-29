alter table public."order"
add column if not exists admin_id bigint references public.karyawan(id) on delete set null;
