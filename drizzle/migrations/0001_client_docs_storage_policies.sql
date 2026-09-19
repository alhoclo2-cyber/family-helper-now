CREATE POLICY "Clients and mandataire read client docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-docs' AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.has_role(auth.uid(), 'mandataire')));

CREATE POLICY "Clients upload own client docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-docs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Clients update own client docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-docs' AND (storage.foldername(name))[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'client-docs' AND (storage.foldername(name))[1] = (auth.uid())::text);
