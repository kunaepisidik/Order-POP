alter table public."order"
drop constraint if exists order_status_check;

alter table public."order"
add constraint order_status_check
check (status in ('belum diproses', 'sedang diproses', 'selesai', 'ditolak'));
