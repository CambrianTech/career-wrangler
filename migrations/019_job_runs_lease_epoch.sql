-- 019_job_runs_lease_epoch — fencing token for job_runs lease acquisitions (invariant 5).
-- Expiry does not prove death: a slow or paused holder whose body is still in flight past its
-- TTL can be taken over, and if it later completes it must not write an authoritative
-- done/failed over the replacement's row. Each acquisition carries a strictly increasing epoch
-- (1 on claim, +1 per takeover); terminal state writes compare-and-set against owner AND epoch
-- while status is still 'running', so only the current lease holder can move a row out of
-- 'running' — a stale holder's late outcome is refused and reported back as 'superseded', never
-- recorded.
ALTER TABLE job_runs ADD COLUMN lease_epoch INTEGER NOT NULL DEFAULT 1;
