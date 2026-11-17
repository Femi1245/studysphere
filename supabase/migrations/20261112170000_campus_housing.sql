CREATE TABLE IF NOT EXISTS public.housing_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 5000),
  institution_name text NOT NULL CHECK (char_length(institution_name) BETWEEN 2 AND 160),
  area text NOT NULL CHECK (char_length(area) BETWEEN 2 AND 160),
  property_type text NOT NULL CHECK (property_type IN ('room', 'self_contained', 'shared_apartment', 'hostel_bed_space')),
  rent_amount numeric(12, 2) NOT NULL CHECK (rent_amount >= 0),
  rent_period text NOT NULL CHECK (rent_period IN ('year', 'semester', 'month')),
  agent_fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (agent_fee >= 0),
  agreement_fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (agreement_fee >= 0),
  caution_fee numeric(12, 2) NOT NULL DEFAULT 0 CHECK (caution_fee >= 0),
  service_charge numeric(12, 2) NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  amenities text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'published', 'paused', 'occupied', 'rejected')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'identity_checked', 'provider_checked', 'property_inspected')),
  availability_checked_at timestamptz NOT NULL DEFAULT now(),
  verification_checked_at timestamptz,
  review_notes text,
  reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS housing_listings_public_search_idx
  ON public.housing_listings (institution_name, area, property_type, rent_amount)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS housing_listings_provider_idx
  ON public.housing_listings (provider_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.housing_inspection_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.housing_listings (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  preferred_at timestamptz NOT NULL,
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS housing_inspection_requests_listing_idx
  ON public.housing_inspection_requests (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS housing_inspection_requests_student_idx
  ON public.housing_inspection_requests (student_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS housing_inspection_requests_one_pending_per_student_idx
  ON public.housing_inspection_requests (student_id, listing_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.housing_favorites (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.housing_listings (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE OR REPLACE FUNCTION public.guard_housing_listing_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.provider_id <> auth.uid()
      OR NEW.status NOT IN ('draft', 'submitted')
      OR NEW.verification_status <> 'unverified'
      OR NEW.verification_checked_at IS NOT NULL
      OR NEW.review_notes IS NOT NULL
      OR NEW.reviewed_by IS NOT NULL THEN
      RAISE EXCEPTION 'New housing listings must be submitted for review by their provider';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.provider_id IS DISTINCT FROM OLD.provider_id
    OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.verification_checked_at IS DISTINCT FROM OLD.verification_checked_at
    OR NEW.review_notes IS DISTINCT FROM OLD.review_notes
    OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    RAISE EXCEPTION 'Only an admin can change housing listing verification details';
  END IF;

  IF NEW.availability_checked_at IS DISTINCT FROM OLD.availability_checked_at
    AND (
      OLD.status <> 'published'
      OR NEW.availability_checked_at < now() - interval '5 minutes'
      OR NEW.availability_checked_at > now() + interval '5 minutes'
    ) THEN
    RAISE EXCEPTION 'Availability can only be reconfirmed for a published listing using the current time';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status NOT IN ('draft', 'submitted', 'paused', 'occupied') THEN
    RAISE EXCEPTION 'Providers cannot publish or approve their own housing listings';
  END IF;

  IF ROW(
    NEW.title,
    NEW.description,
    NEW.institution_name,
    NEW.area,
    NEW.property_type,
    NEW.rent_amount,
    NEW.rent_period,
    NEW.agent_fee,
    NEW.agreement_fee,
    NEW.caution_fee,
    NEW.service_charge,
    NEW.amenities
  ) IS DISTINCT FROM ROW(
    OLD.title,
    OLD.description,
    OLD.institution_name,
    OLD.area,
    OLD.property_type,
    OLD.rent_amount,
    OLD.rent_period,
    OLD.agent_fee,
    OLD.agreement_fee,
    OLD.caution_fee,
    OLD.service_charge,
    OLD.amenities
  ) THEN
    NEW.status := 'submitted';
    NEW.verification_status := 'unverified';
    NEW.verification_checked_at := NULL;
    NEW.review_notes := NULL;
    NEW.reviewed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS housing_listings_guard_changes ON public.housing_listings;
CREATE TRIGGER housing_listings_guard_changes
  BEFORE INSERT OR UPDATE ON public.housing_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_housing_listing_changes();

DROP TRIGGER IF EXISTS housing_listings_set_updated_at ON public.housing_listings;
CREATE TRIGGER housing_listings_set_updated_at
  BEFORE UPDATE ON public.housing_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.guard_housing_inspection_request_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  listing_provider uuid;
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  SELECT provider_id INTO listing_provider
  FROM public.housing_listings
  WHERE id = NEW.listing_id;

  IF TG_OP = 'INSERT' THEN
    IF NEW.student_id <> auth.uid() OR NEW.status <> 'pending' OR NEW.preferred_at <= now()
      OR listing_provider IS NULL OR listing_provider = auth.uid() THEN
      RAISE EXCEPTION 'Invalid housing inspection request';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
    OR NEW.student_id IS DISTINCT FROM OLD.student_id
    OR NEW.preferred_at IS DISTINCT FROM OLD.preferred_at
    OR NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'Inspection request details cannot be changed';
  END IF;

  IF auth.uid() = OLD.student_id THEN
    IF OLD.status <> 'pending' OR NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Students can only cancel pending inspection requests';
    END IF;
  ELSIF listing_provider = auth.uid() THEN
    IF NEW.status NOT IN ('accepted', 'declined', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Invalid provider inspection request status';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized to update this inspection request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS housing_inspection_requests_guard_changes ON public.housing_inspection_requests;
CREATE TRIGGER housing_inspection_requests_guard_changes
  BEFORE INSERT OR UPDATE ON public.housing_inspection_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_housing_inspection_request_changes();

DROP TRIGGER IF EXISTS housing_inspection_requests_set_updated_at ON public.housing_inspection_requests;
CREATE TRIGGER housing_inspection_requests_set_updated_at
  BEFORE UPDATE ON public.housing_inspection_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.notify_housing_inspection_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  listing_title text;
BEGIN
  SELECT provider_id, title INTO recipient_id, listing_title
  FROM public.housing_listings
  WHERE id = NEW.listing_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      recipient_id,
      'New housing inspection request',
      'A student requested an inspection for ' || listing_title || '.',
      'housing',
      '/app/housing'
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.student_id,
      'Inspection request updated',
      'Your inspection request for ' || listing_title || ' is ' || replace(NEW.status, '_', ' ') || '.',
      'housing',
      '/app/housing'
    );
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_housing_inspection_request() FROM PUBLIC;

DROP TRIGGER IF EXISTS housing_inspection_requests_notify ON public.housing_inspection_requests;
CREATE TRIGGER housing_inspection_requests_notify
  AFTER INSERT OR UPDATE OF status ON public.housing_inspection_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_housing_inspection_request();

ALTER TABLE public.housing_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housing_inspection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housing_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS housing_listings_select_public_or_owner ON public.housing_listings;
CREATE POLICY housing_listings_select_public_or_owner
  ON public.housing_listings FOR SELECT TO authenticated
  USING (
    (status = 'published' AND availability_checked_at >= now() - interval '14 days')
    OR provider_id = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS housing_listings_insert_provider ON public.housing_listings;
CREATE POLICY housing_listings_insert_provider
  ON public.housing_listings FOR INSERT TO authenticated
  WITH CHECK (provider_id = auth.uid());

DROP POLICY IF EXISTS housing_listings_update_provider_or_admin ON public.housing_listings;
CREATE POLICY housing_listings_update_provider_or_admin
  ON public.housing_listings FOR UPDATE TO authenticated
  USING (provider_id = auth.uid() OR public.is_admin())
  WITH CHECK (provider_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS housing_listings_delete_provider_or_admin ON public.housing_listings;
CREATE POLICY housing_listings_delete_provider_or_admin
  ON public.housing_listings FOR DELETE TO authenticated
  USING (provider_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS housing_inspection_requests_select_participant ON public.housing_inspection_requests;
CREATE POLICY housing_inspection_requests_select_participant
  ON public.housing_inspection_requests FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.housing_listings l
      WHERE l.id = listing_id AND l.provider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS housing_inspection_requests_insert_student ON public.housing_inspection_requests;
CREATE POLICY housing_inspection_requests_insert_student
  ON public.housing_inspection_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.housing_listings l
      WHERE l.id = listing_id
        AND l.status = 'published'
        AND l.availability_checked_at >= now() - interval '14 days'
        AND l.provider_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS housing_inspection_requests_update_participant ON public.housing_inspection_requests;
CREATE POLICY housing_inspection_requests_update_participant
  ON public.housing_inspection_requests FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.housing_listings l
      WHERE l.id = listing_id AND l.provider_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.housing_listings l
      WHERE l.id = listing_id AND l.provider_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS housing_favorites_select_own ON public.housing_favorites;
CREATE POLICY housing_favorites_select_own
  ON public.housing_favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS housing_favorites_insert_own ON public.housing_favorites;
CREATE POLICY housing_favorites_insert_own
  ON public.housing_favorites FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.housing_listings l
      WHERE l.id = listing_id
        AND l.status = 'published'
        AND l.availability_checked_at >= now() - interval '14 days'
    )
  );

DROP POLICY IF EXISTS housing_favorites_delete_own ON public.housing_favorites;
CREATE POLICY housing_favorites_delete_own
  ON public.housing_favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid());
