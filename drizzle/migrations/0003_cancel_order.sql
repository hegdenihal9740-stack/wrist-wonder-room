CREATE OR REPLACE FUNCTION public.cancel_order(_order_id text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.orders; l jsonb; is_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR o.status = 'cancelled' THEN RETURN false; END IF;
  is_admin := public.has_role(auth.uid(), 'admin');
  IF NOT is_admin AND (o.user_id <> auth.uid() OR o.status NOT IN ('confirmed','packed')) THEN RETURN false; END IF;
  IF o.status <> 'delivered' THEN
    FOR l IN SELECT * FROM jsonb_array_elements(o.items) LOOP
      UPDATE public.inventory SET stock = stock + (l->>'qty')::int, updated_at = now() WHERE watch_id = l->>'id';
    END LOOP;
  END IF;
  UPDATE public.orders SET status = 'cancelled' WHERE id = _order_id;
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.cancel_order(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cancel_order(text) TO authenticated;