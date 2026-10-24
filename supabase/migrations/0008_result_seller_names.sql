-- Keep every seller observed for each scraped product for recommendation exports.
alter table public.job_results
  add column if not exists seller_names text[] not null default '{}';
