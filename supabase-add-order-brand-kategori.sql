alter table public."order"
add column if not exists brand text not null default '',
add column if not exists kategori text not null default 'Order POP';
