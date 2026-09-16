# 2027 大板橋聯營開門紅競賽

三家分行的開門紅競賽即時看板。A／B／C 三組以目標總額平衡分配，HRM 楊璧菁獨立計算；進度直接取自 Q4monitor 共用資料的「季進度（含在途）」。專案包含兩種視覺版本：

- 根目錄：海軍藍、香檳金與勝利紅的精品賽事版。
- `cartoon/`：三組跑者依達成率移動的卡通賽跑版。

## 本機預覽

專案為純靜態網站，不需建置：

```bash
python3 -m http.server 4173
```

開啟 `http://localhost:4173`。

卡通賽跑版位於 `http://localhost:4173/cartoon/`，頁首可在兩個版本間切換。

## 資料同步

網站沿用 Q4monitor 的：

- Supabase 專案與登入帳號。
- `performance_records` 資料表。
- `my_performance_role()` 權限判斷。
- 管理快速登入帳號。
- 季職達原始檔與標準 Excel／CSV 上傳格式。

卡通版訪客開啟頁面後，即會透過公開唯讀資料入口同步最新戰況；不需要登入。只有按下「更新戰況」並上傳資料時，才需使用 Editor／Admin 管理驗證。Q4monitor 原有的 `performance_records` 存取規則不會被放寬。

首次啟用公開卡通版，請依序在 Supabase SQL Editor 執行 `supabase/monthly-progress.sql` 與 `supabase/public-rally-read.sql`。季職達原始檔會自 AP11 起讀取 AP 欄月進度；總冠軍與個人里程碑仍使用季進度（含在途）。每日應援的雲端共用功能則使用 `supabase/team-cheers.sql`。

## 專案檔案

- `index.html`：頁面結構、登入與更新 dialog。
- `styles.css`：響應式賽事主題與元件樣式。
- `app.js`：名單、分組、計算、Supabase 同步及檔案解析。
- `config.js`：Supabase 公開連線設定，不得放置 `service_role` 金鑰。
- `docs/DEVELOPMENT.md`：需求解讀、分組、資料流程、視覺系統與驗收標準。
- `cartoon/`：卡通賽跑版的 HTML、CSS、JavaScript 與設計規格。
- `supabase/`：AP 月進度、公開唯讀戰況與每日應援所需的資料庫升級腳本。

## 部署

所有檔案都可直接部署到 GitHub Pages。若改用子路徑，本站使用相對路徑，不需修改資源網址。
