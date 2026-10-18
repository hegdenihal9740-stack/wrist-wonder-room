CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.app_role NOT NULL, UNIQUE(user_id, role));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- first signed-in user to call this becomes the store owner (only while no admin exists)
CREATE OR REPLACE FUNCTION public.claim_store_owner() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN public.has_role(auth.uid(), 'admin'); END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin');
  RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.store_has_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') $$;

ALTER TABLE public.orders ADD COLUMN courier text, ADD COLUMN awb text, ADD COLUMN tracking_url text, ADD COLUMN cod_confirmed boolean NOT NULL DEFAULT false, ADD COLUMN seller_note text, ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
CREATE POLICY "Admins read all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.inventory (watch_id text PRIMARY KEY, stock integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.inventory TO anon, authenticated;
GRANT UPDATE ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads stock" ON public.inventory FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins update stock" ON public.inventory FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.inventory (watch_id, stock) VALUES ('steel',10),('black',10),('gold',10),('rosegold',10);

-- reserve stock when an order is placed; reject if not enough
CREATE OR REPLACE FUNCTION public.reserve_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l jsonb; left_qty int;
BEGIN
  NEW.status := 'confirmed'; NEW.courier := NULL; NEW.awb := NULL; NEW.tracking_url := NULL; NEW.cod_confirmed := false;
  FOR l IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    UPDATE public.inventory SET stock = stock - (l->>'qty')::int, updated_at = now()
      WHERE watch_id = l->>'id' AND stock >= (l->>'qty')::int RETURNING stock INTO left_qty;
    IF NOT FOUND THEN RAISE EXCEPTION 'OUT_OF_STOCK:%', l->>'id'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_reserve_stock BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.reserve_stock();
CREATE OR REPLACE FUNCTION public.touch_order() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER orders_touch BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_order();
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;