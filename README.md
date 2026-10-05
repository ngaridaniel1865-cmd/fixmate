# FixMate MVP

A lightweight, no-build prototype for the FixMate home-maintenance marketplace.

## Included
- Landing page
- Service categories
- Service request form
- Simulated technician matching
- Request confirmation
- My Requests dashboard
- Browser local storage

## Run
Open `index.html` in a modern browser.

## Database / Job Lifecycle

Job status lifecycle:

`requested → matched → confirmed → in_progress → technician_completed → completed`

- Technicians can update only jobs assigned to them. The `technician_update_assigned_jobs`
  row-level security policy on `public.jobs` (`FOR UPDATE`, `TO authenticated`) matches rows
  with `EXISTS (SELECT 1 FROM public.technicians t WHERE t.id = jobs.technician_id AND t.user_id = auth.uid())`
  in both `USING` and `WITH CHECK`, so a technician can neither update nor reassign another
  technician's job.
- A job becomes `completed` only after the customer confirms the technician's
  `technician_completed` mark; the technician cannot close a job alone.
- `public.jobs.status` is limited by the `jobs_status_check` constraint to: requested, matched,
  accepted, in_progress, technician_completed, completed, confirmed, cancelled.
- Applied database changes are recorded under `supabase/migrations/` for reproducibility.
- No service-role key or other secret is stored in this repository. The app ships only the
  publishable (anon) key; privileged database changes are applied from the Supabase dashboard
  SQL editor, never from the browser.

## Important
This is an MVP/prototype, not a production marketplace. Real deployment will require:
- user accounts/authentication
- backend/database
- real technician onboarding and verification
- real location handling
- notifications
- payments
- admin dashboard
- privacy/terms and operational policies
- production hosting/domain
