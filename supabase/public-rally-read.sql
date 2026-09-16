-- 公開唯讀的開門紅戰況入口。
-- 不授予 anon 對 performance_records 的 SELECT 權限，避免改變 Q4monitor 的原始資料表存取規則。
-- 僅公開卡通競賽頁面實際使用的欄位；寫入仍須走原本的管理帳號與 RLS 規則。

create or replace function public.get_public_rally_performance()
returns table (
  branch text,
  advisor_name text,
  quarter_target text,
  quarter_progress text,
  monthly_progress text,
  quarter_rate text,
  fund_progress text,
  insurance_progress text,
  source_date text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.branch::text,
    p.advisor_name::text,
    p.quarter_target::text,
    p.quarter_progress::text,
    p.monthly_progress::text,
    p.quarter_rate::text,
    p.fund_progress::text,
    p.insurance_progress::text,
    p.source_date::text
  from public.performance_records as p
  where p.advisor_name <> '__分行季目標__'
  order by p.branch, p.advisor_name;
$$;

revoke all on function public.get_public_rally_performance() from public;
grant execute on function public.get_public_rally_performance() to anon, authenticated;
