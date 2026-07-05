
-- KYC documents : path = <user_id>/<filename>
create policy "KYC — lecture par propriétaire"
  on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "KYC — upload par propriétaire"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "KYC — update par propriétaire"
  on storage.objects for update to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "KYC — suppression par propriétaire"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Call recordings : path = <user_id>/<call_sid>.<ext>
create policy "Enregistrements — lecture par propriétaire"
  on storage.objects for select to authenticated
  using (bucket_id = 'call-recordings' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Enregistrements — suppression par propriétaire"
  on storage.objects for delete to authenticated
  using (bucket_id = 'call-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
