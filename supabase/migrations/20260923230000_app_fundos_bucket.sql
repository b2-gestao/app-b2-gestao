-- Fundo da tela inicial escolhido por cada usuário.
--
-- Bucket privado "app-fundos": cada usuário só lê e grava dentro da própria pasta
-- (<auth.uid()>/fundo). O limite de 5 MB e os tipos aceitos são impostos pelo Storage,
-- então valem mesmo para quem chamar a API sem passar pelo app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('app-fundos', 'app-fundos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists app_fundos_select on storage.objects;
drop policy if exists app_fundos_insert on storage.objects;
drop policy if exists app_fundos_update on storage.objects;
drop policy if exists app_fundos_delete on storage.objects;

create policy app_fundos_select on storage.objects for select to authenticated
  using (bucket_id = 'app-fundos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy app_fundos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'app-fundos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy app_fundos_update on storage.objects for update to authenticated
  using (bucket_id = 'app-fundos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'app-fundos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy app_fundos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'app-fundos' and (storage.foldername(name))[1] = (select auth.uid())::text);
