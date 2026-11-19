alter table public.karyawan
add column if not exists foto text;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'karyawan'
      and policyname = 'Anon can update karyawan'
  ) then
    create policy "Anon can update karyawan"
    on public.karyawan for update
    to anon
    using (true)
    with check (true);
  end if;
end
$$;
