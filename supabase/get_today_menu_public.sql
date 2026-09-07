-- Migration: get_today_menu_public
-- Purpose: Expose today's menu (meals + items) via a SECURITY DEFINER RPC
-- so it is accessible to both authenticated users AND synthetic-session
-- students whose auth.uid() is NULL (bypassing the org_id RLS wall).
--
-- The function is intentionally read-only and returns only public-facing
-- dining schedule data — no PII or sensitive records.

CREATE OR REPLACE FUNCTION public.get_today_menu(p_day_of_week TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_day TEXT;
  v_result JSONB;
BEGIN
  -- Use provided day or calculate today (JS getDay() mapped to 0=Mon..6=Sun)
  IF p_day_of_week IS NOT NULL THEN
    v_day := p_day_of_week;
  ELSE
    -- PostgreSQL DOW: 0=Sun,1=Mon,...,6=Sat
    -- App convention:  0=Mon,1=Tue,...,6=Sun  (same as (jsDay+6)%7)
    v_day := CASE EXTRACT(DOW FROM NOW())
      WHEN 1 THEN '0'  -- Mon
      WHEN 2 THEN '1'  -- Tue
      WHEN 3 THEN '2'  -- Wed
      WHEN 4 THEN '3'  -- Thu
      WHEN 5 THEN '4'  -- Fri
      WHEN 6 THEN '5'  -- Sat
      WHEN 0 THEN '6'  -- Sun
    END;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id',           m.id,
      'hostel_id',    m.hostel_id,
      'day_of_week',  m.day_of_week,
      'meal_type_id', m.meal_type_id,
      'is_recurring', m.is_recurring,
      'org_id',       m.org_id,
      'meal_type',    jsonb_build_object(
        'id',          mt.id,
        'name',        mt.name,
        'description', mt.description,
        'time_from',   mt.time_from::TEXT,
        'time_to',     mt.time_to::TEXT
      ),
      'items', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',          mi.id,
            'name',        mi.name,
            'description', mi.description,
            'vegetarian',  mi.vegetarian,
            'is_veg',      mi.vegetarian,
            'category',    mi.category
          )
        )
        FROM public.menu_item_links mil
        JOIN public.menu_items mi ON mi.id = mil.item_id
        WHERE mil.menu_id = m.id
      ), '[]'::jsonb)
    )
  )
  INTO v_result
  FROM public.menus m
  JOIN public.meal_types mt ON mt.id = m.meal_type_id
  WHERE m.day_of_week = v_day;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Allow any authenticated OR anonymous caller to invoke this function.
GRANT EXECUTE ON FUNCTION public.get_today_menu(TEXT) TO anon, authenticated;
