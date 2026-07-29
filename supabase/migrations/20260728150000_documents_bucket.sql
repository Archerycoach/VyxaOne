-- ============================================================================
-- Bucket privado "documents" para documentos de leads/imóveis (cadernetas
-- prediais, certidões, contratos, plantas…).
--
-- É PRIVADO de propósito — tem dados pessoais/sensíveis (RGPD); o acesso é
-- sempre por URL assinada temporária (ver documentsService.getDocumentDownloadUrl),
-- nunca por link público. O bucket já existia criado à mão na instância
-- principal; esta migração garante que também existe (com as políticas certas)
-- em TODAS as bases, senão o upload falha com "Bucket not found".
--
-- Idempotente: pode ser aplicado a todas as bases sem risco.
--   .\scripts\apply-migration.ps1 supabase\migrations\20260728150000_documents_bucket.sql
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do update set public = false;

-- Cada utilizador só acede à SUA pasta ({user_id}/ficheiro). O documentsService
-- grava sempre em `${auth.uid()}/…`, por isso o 1.º segmento do caminho tem de
-- ser o id do utilizador.
drop policy if exists "documents_select_own" on storage.objects;
create policy "documents_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_insert_own" on storage.objects;
create policy "documents_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_update_own" on storage.objects;
create policy "documents_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_delete_own" on storage.objects;
create policy "documents_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
