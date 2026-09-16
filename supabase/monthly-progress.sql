-- 在 Supabase SQL Editor 執行一次，加入季職達原始檔 AP 欄的個人月進度。
alter table public.performance_records
  add column if not exists monthly_progress text;

comment on column public.performance_records.monthly_progress is
  '個人每月進度；來源為季職達原始檔 AP 欄，自 AP11 起依姓名列讀取。';
