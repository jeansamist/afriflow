-- Allow authenticated users to insert their own call log entries
grant insert on public.call_logs to authenticated;

create policy "call_logs_insert_own"
  on public.call_logs for insert
  to authenticated
  with check (user_id = auth.uid());
