-- Private storage buckets + storage RLS.
-- What: six private buckets with size/MIME limits, and least-privilege policies
--       on storage.objects.
-- Why: privacy is enforced by which file the server hands you. Identity docs and
--      chat media are server-only (delivered via short-lived signed URLs after a
--      permission/moderation check); photos and receipts allow owner-folder
--      management. No bucket is public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('identity-documents', 'identity-documents', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('payment-receipts', 'payment-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('chat-voice', 'chat-voice', false, 10485760, array['audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav']),
  ('chat-images', 'chat-images', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('chat-videos', 'chat-videos', false, 52428800, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- Files are namespaced by owner: "<user_id>/<filename>".
-- profile-photos: owner manages own folder. Reads of OTHER users' photos happen
-- only through server-issued signed URLs (paid tier AND her privacy mode), so no
-- cross-user select policy exists here.
create policy profile_photos_owner_all on storage.objects
  for all to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- payment-receipts: owner may upload/read own folder; admin review via signed URLs.
create policy payment_receipts_owner_all on storage.objects
  for all to authenticated
  using (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- identity-documents, chat-voice, chat-images, chat-videos: NO client policies.
-- Uploads use server-issued signed upload URLs and downloads use server-issued
-- signed URLs (service_role bypasses RLS) — deny-by-default for clients.
