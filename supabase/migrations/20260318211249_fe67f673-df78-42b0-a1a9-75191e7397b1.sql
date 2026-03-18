CREATE TABLE IF NOT EXISTS public.formation_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_formation_videos" ON public.formation_videos
FOR ALL USING (is_admin_or_sous_admin(auth.uid()));

CREATE POLICY "authenticated_read_active_videos" ON public.formation_videos
FOR SELECT TO authenticated USING (actif = true);