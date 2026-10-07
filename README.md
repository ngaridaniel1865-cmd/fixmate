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

## Database / Reviews & Technician Statistics

Recorded in `supabase/migrations/20261006_reviews_and_canonical_technician_stats.sql`, which has
already been applied to the live Supabase database and verified there.

- One review per completed job. `public.reviews.job_id` carries a `UNIQUE` constraint
  (`reviews_job_id_key`), so a job cannot be reviewed twice.
- Reviews are read-and-create only. Row-level security is enabled on `public.reviews` and
  `authenticated` is granted `SELECT, INSERT` — no `UPDATE` or `DELETE`. A `FOR SELECT` policy
  lets any signed-in user read reviews; a `FOR INSERT` policy allows a row only when
  `customer_id = auth.uid()` and the referenced job belongs to that user, is `completed`, has a
  technician, and names that same technician. No `FOR UPDATE` or `FOR DELETE` policy exists, so
  a submitted review cannot be edited or removed through the API.
- `technicians.rating` is canonical: it is `ROUND(AVG(reviews.rating), 2)` for that technician,
  never a stored guess. A technician with no reviews keeps `rating` NULL, which the UI renders
  as "no reviews yet" and orders last.
- `technicians.jobs_completed` is canonical: it is `COUNT(*)` of that technician's jobs with
  `status = 'completed'`.
- Both columns are maintained by `AFTER INSERT OR UPDATE OR DELETE` triggers calling the
  `SECURITY DEFINER` functions `public.maintain_technician_rating()` and
  `public.maintain_technician_jobs_completed()`. `SECURITY DEFINER` is required because the
  triggers run inside a customer's or technician's own statement, and `authenticated` holds no
  `UPDATE` right on `technicians`. Each function is fixed, fully qualified SQL that recomputes
  a whole column from source rows (no increments, so it self-heals), pins
  `search_path = public, pg_temp`, and has `EXECUTE` revoked from `PUBLIC`; it can be reached
  only as a trigger body.
- The browser never writes `technicians.rating` or `technicians.jobs_completed`.

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
