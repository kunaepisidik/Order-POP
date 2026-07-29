drop policy if exists "Anon can delete expired orders" on public."order";

create policy "Anon can delete expired orders"
on public."order" for delete
to anon
using (created_at < now() - interval '31 days');

create extension if not exists pg_cron with schema extensions;

create or replace function public.delete_expired_order_pop_orders()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public."order"
  where created_at < now() - interval '31 days';
$$;

do $$
begin
  perform cron.unschedule('order-pop-cleanup-31-days');
exception
  when others then null;
end
$$;

select cron.schedule(
  'order-pop-cleanup-31-days',
  '0 0 * * *',
  $$select public.delete_expired_order_pop_orders();$$
);
