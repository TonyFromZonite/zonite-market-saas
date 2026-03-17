
ALTER TABLE public.sellers ADD COLUMN username text;
ALTER TABLE public.sous_admins ADD COLUMN username text;

CREATE UNIQUE INDEX sellers_username_unique ON public.sellers (username) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX sous_admins_username_unique ON public.sous_admins (username) WHERE username IS NOT NULL;
