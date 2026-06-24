
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sellers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sellers';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='demandes_paiement_vendeur'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.demandes_paiement_vendeur';
  END IF;
END $$;

ALTER TABLE public.sellers REPLICA IDENTITY FULL;
ALTER TABLE public.demandes_paiement_vendeur REPLICA IDENTITY FULL;
