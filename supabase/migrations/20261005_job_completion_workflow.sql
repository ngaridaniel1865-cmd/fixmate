-- FixMate job-completion workflow: database changes applied to the live
-- Supabase project on 2026-10-05. This migration records what is ALREADY live;
-- it is documentation for reproducibility and must not be re-applied blindly.

-- 1. Technician UPDATE policy.
--    An authenticated technician may update a job only when the job's
--    technician_id resolves, through public.technicians, to auth.uid().
--    USING gates which rows the UPDATE can see; WITH CHECK re-validates the
--    post-update row so technician_id cannot be pointed at another technician
--    (or cleared) to steal or reassign a job. FOR UPDATE only: no SELECT,
--    INSERT, or DELETE rights are granted, and customer policies are untouched.
CREATE POLICY technician_update_assigned_jobs
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.technicians t
    WHERE t.id = jobs.technician_id
      AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.technicians t
    WHERE t.id = jobs.technician_id
      AND t.user_id = auth.uid()
  )
);

-- 2. jobs_status_check widened for the completion workflow.
--    The pre-existing allowed statuses are preserved unchanged; the only
--    addition is technician_completed, the state a job enters when the
--    technician marks the work finished and before the customer confirms it.
ALTER TABLE public.jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check CHECK (
  status IN (
    'requested',
    'matched',
    'accepted',
    'in_progress',
    'technician_completed',
    'completed',
    'confirmed',
    'cancelled'
  )
);
