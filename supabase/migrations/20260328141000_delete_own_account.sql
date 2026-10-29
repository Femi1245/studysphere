-- Placeholder: hosted projects rarely allow deleting auth.users from SQL.
-- The app clears public user data client-side; this RPC returns a clear error
-- so the UI can fall back gracefully.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RAISE EXCEPTION 'delete_own_account_unavailable'
    USING HINT = 'Clear public data from the client, then remove the Auth user in the dashboard if needed.';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
