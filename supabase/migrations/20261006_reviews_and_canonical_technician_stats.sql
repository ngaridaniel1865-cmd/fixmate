-- FixMate Phase 2: reviews RLS and canonical technician statistics.
-- Applied to the live Supabase project on 2026-10-06 and verified there.
-- This migration records what is ALREADY live; it is documentation for
-- reproducibility and must not be re-applied blindly.
-- Pre-flight already confirmed: zero duplicate reviews.job_id values.

-- 1. Reviews table security baseline. ENABLE is idempotent; the GRANT gives
--    authenticated roles exactly read and create rights, never modify/delete.
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.reviews TO authenticated;

-- 2. Any signed-in user may read reviews for display.
CREATE POLICY reviews_select_authenticated
ON public.reviews
FOR SELECT
TO authenticated
USING (true);

-- 3. A customer may insert only their own review of their own completed,
--    assigned job, naming that job's technician. WITH CHECK carries every
--    condition because an INSERT has no prior row for USING to test.
CREATE POLICY reviews_insert_own_completed_job
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  customer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = reviews.job_id
      AND j.customer_id = auth.uid()
      AND j.status = 'completed'
      AND j.technician_id IS NOT NULL
      AND j.technician_id = reviews.technician_id
  )
);

-- No FOR UPDATE or FOR DELETE policy is created: with RLS enabled,
-- authenticated roles cannot modify or remove reviews at all.

-- 4. One review per job.
ALTER TABLE public.reviews
ADD CONSTRAINT reviews_job_id_key UNIQUE (job_id);

-- 5. Canonical rating: full recompute of AVG(reviews.rating) per technician.
--    A technician with no reviews keeps rating NULL; the frontend displays
--    "No reviews yet" and orders with NULLS LAST.
--    SECURITY DEFINER is required because the trigger fires inside the
--    customer's INSERT, and authenticated roles hold no UPDATE right on
--    technicians. The body is fixed, fully qualified SQL with aggregate
--    subqueries: no parameters, no dynamic SQL, pinned search_path, and
--    EXECUTE revoked from PUBLIC below.
CREATE OR REPLACE FUNCTION public.maintain_technician_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.technicians t
    SET rating = (
      SELECT ROUND(AVG(r.rating), 2)
      FROM public.reviews r
      WHERE r.technician_id = OLD.technician_id
    )
    WHERE t.id = OLD.technician_id;
    RETURN OLD;
  END IF;

  UPDATE public.technicians t
  SET rating = (
    SELECT ROUND(AVG(r.rating), 2)
    FROM public.reviews r
    WHERE r.technician_id = NEW.technician_id
  )
  WHERE t.id = NEW.technician_id;

  IF TG_OP = 'UPDATE' AND OLD.technician_id IS DISTINCT FROM NEW.technician_id THEN
    UPDATE public.technicians t
    SET rating = (
      SELECT ROUND(AVG(r.rating), 2)
      FROM public.reviews r
      WHERE r.technician_id = OLD.technician_id
    )
    WHERE t.id = OLD.technician_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_technician_rating() FROM PUBLIC;

-- 6. Canonical jobs_completed: full recompute of COUNT(*) over completed jobs.
--    On UPDATE it does nothing unless status or technician_id changed.
CREATE OR REPLACE FUNCTION public.maintain_technician_jobs_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.technicians t
    SET jobs_completed = (
      SELECT COUNT(*)
      FROM public.jobs j
      WHERE j.technician_id = OLD.technician_id
        AND j.status = 'completed'
    )
    WHERE t.id = OLD.technician_id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status IS NOT DISTINCT FROM NEW.status
     AND OLD.technician_id IS NOT DISTINCT FROM NEW.technician_id THEN
    RETURN NEW;
  END IF;

  UPDATE public.technicians t
  SET jobs_completed = (
    SELECT COUNT(*)
    FROM public.jobs j
    WHERE j.technician_id = NEW.technician_id
      AND j.status = 'completed'
  )
  WHERE t.id = NEW.technician_id;

  IF TG_OP = 'UPDATE' AND OLD.technician_id IS DISTINCT FROM NEW.technician_id THEN
    UPDATE public.technicians t
    SET jobs_completed = (
      SELECT COUNT(*)
      FROM public.jobs j
      WHERE j.technician_id = OLD.technician_id
        AND j.status = 'completed'
    )
    WHERE t.id = OLD.technician_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maintain_technician_jobs_completed() FROM PUBLIC;

-- 7. Attach the maintenance triggers.
CREATE TRIGGER reviews_maintain_technician_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.maintain_technician_rating();

CREATE TRIGGER jobs_maintain_technician_jobs_completed
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.maintain_technician_jobs_completed();

-- 8. Establish canonical values for existing rows, replacing seeded
--    rating/jobs_completed with values derived from reviews and jobs.
UPDATE public.technicians t
SET rating = (
  SELECT ROUND(AVG(r.rating), 2)
  FROM public.reviews r
  WHERE r.technician_id = t.id
),
jobs_completed = (
  SELECT COUNT(*)
  FROM public.jobs j
  WHERE j.technician_id = t.id
    AND j.status = 'completed'
);
