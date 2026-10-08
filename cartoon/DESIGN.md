# 卡通賽跑版設計規格

## 視覺概念

將 A／B／C 三組轉換成運動會賽跑遊戲：紅、黃、綠三條跑道上各有一位卡通跑者，跑者位置依團隊達成率前進。第一名顯示「領先中」，不使用皇冠；未同步時三位跑者停在起跑線。

```text
┌─────────────────────────────────────────────────┐
│ LOGO      原版｜隊伍｜獎勵       雲端狀態／登入 │
├─────────────────────────────────────────────────┤
│ 衝呀！2027 開門紅大賽                           │
│ [總進度] [總達成率] [倒數]                      │
│                                                 │
│ A ═══ 🏃━━━━━━━━━━━━━━━━━━━━━━━ 🏁  00.0%      │
│ B ═══════ 🏃━━━━━━━━━━━━━━━━━━━ 🏁  00.0%      │
│ C ═══════════ 🏃━━━━━━━━━━━━━━━ 🏁  00.0%      │
├─────────────────────────────────────────────────┤
│ [A 組隊員卡] [B 組隊員卡] [C 組隊員卡]          │
├──────────────────────────┬──────────────────────┤
│ HRM BONUS STAGE          │ 獎勵補給站           │
└──────────────────────────┴──────────────────────┘
```

## 遊戲狀態

- 未同步：跑者位於起點，名次顯示「待同步」；公開讀取不需要登入。
- 已同步：跑者位置為 `clamp(0, 達成率 / 100, 1) × (跑道可用寬度 - 角色寬度 - 6px)`，所有裝置使用同一比例。
- 第一名：跑道標示「領先中」，角色不附加皇冠。
- 100% 達標：跑者抵達終點，卡片顯示「完賽！」並啟用紙花動畫。
- 超過 100%：數值保留實際百分比，角色停在終點。
- HRM：獨立紫色 Bonus Stage，不參與 A／B／C 排名。

## 色彩與元件

- 天空：`#BFE8FF`；深藍文字：`#183153`。
- A 組：`#F05B61`；B 組：`#F6B83F`；C 組：`#35B98B`。
- HRM：`#8267D9`；草地：`#5BCB75`；紙張：`#FFFDF5`。
- 外框 2px 深藍、圓角 20～30px、偏移式卡通陰影。
- 跑者 700ms 彈性位移；按鈕 150ms；支援 reduced motion。

## 資料與權限

沿用根目錄 `config.js`、Supabase `performance_records` 與 `my_performance_role()`。跑道進度仍只取 `quarter_progress`；Editor／Admin 可使用相同季職達原始檔與 Excel／CSV 更新。

獎勵補給站另讀取 `monthly_progress`：季職達原始檔自 AP11 起，以 AP 欄作為個人月進度，組內加總後顯示每月團隊排名。開門紅總冠軍與個人 3K／4K／5K 仍使用 `quarter_progress`（季進度含在途）。資料庫欄位升級腳本位於 `supabase/monthly-progress.sql`。

### 每日火焰應援

- 點擊 A／B／C 隊名會直接送出應援，不顯示姓名選單或確認彈窗。
- 以台北時間日期為每日邊界；同一瀏覽器同一天送出後不可改隊，隔日自動重新開放。
- 每隊火焰共有 1～26 級，0 表示未點燃；大小、長度、光暈、火星與速度線逐級增加，色溫在 7／14／20／26 級進階。超過 26 次應援仍計次，火焰保持最高 26 級。
- 火焰置於跑者身後，送出成功時觸發短暫加速與爆發動畫，不改變實績決定的跑者位置。
- 設定雲端時，`team_cheers` 每 30 秒同步一次；斷線保留上次雲端計數，送出前會先重試讀取，失敗時明確提示尚未送出。本機模式只適用於沒有雲端設定的開發頁面。
- 雲端保存匿名 `visitor_id`、隊伍、日期及建立時間；唯一鍵為 `(cheer_date, visitor_id)`。送出前確認台北日期；舊日期或舊請求的回應不覆蓋新資料。背景頁面暫停輪詢，回到頁面時同步。

## 2026-10-08 可用性調整

```text
桌機：[隊伍／加油] [狀態                 達成率／金額]
                   [獨立跑道：完整跑者 → 終點        ]
手機：[隊伍／加油                                  ]
      [達成率                             進度／目標]
      [狀態                                       ]
      [獨立跑道：完整跑者 → 終點                   ]
底部：[即時賽況] [選手村] [補給站] [精品版]
```

- 沿用紅黃綠隊色、深藍輪廓及卡通角色，將成績和動畫分區。
- 文字使用 rem；小／標準／大由根字級控制，資料重繪與篩選不會重置字級。
- 主要姓名與獎項標題 15～16px、輔助文字 12～14px；保留低彩度說明文字並提高按鈕對比。
- 手機增加固定底部導覽與安全區間，按鈕至少 44px；隊伍篩選使用可按下狀態，對話框具可辨識名稱。
- 月排名以完整 25 位組員的 AP 加總除以各組開門紅責任目標；季資料必須齊全 26 人才更新畫面。
- 空資料、缺漏或讀取失敗保留上次完整季戰況，首次讀取失敗顯示破折號與可重試訊息。

## 原創角色素材

- `assets/team-a-runner.png`：紅色 A 隊右向衝刺角色。
- `assets/team-b-runner.png`：黃色 B 隊右向衝刺角色。
- `assets/team-c-runner.png`：綠色 C 隊右向衝刺角色。
- `assets/hrm-leader.png`：紫色 HRM 女隊長勝利姿勢。

產圖方向：透明背景、大頭短身、粗深藍輪廓、誇張熱血表情、復古 16-bit 日本運動街機氛圍。角色均為原創設計，不使用既有遊戲角色、制服、標誌或場景。

## 隊員介紹動畫規格

入口：賽道下方 A／B／C「隊員介紹」、各隊選手卡「播放隊員介紹」，以及 HRM「獨立挑戰介紹」。只有按下入口才開啟並播放；不因載入、捲動或資料同步而自動播放。

```text
┌──────────────────────────────────────────────┐
│ MEET THE TEAM    A 隊・火焰衝鋒隊         [×] │
├──────────────────────────────────────────────┤
│                                              │
│  既有隊伍角色       PLAYER 01                 │
│  ＋隊色背景          隊員姓名                  │
│                     分行・職級                │
│                     開門紅責任目標            │
│                                              │
├──────────────────────────────────────────────┤
│ 第 1 位／9 位      [1][2][3][4][5][6][7][8][9] │
│ 進度 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│ [上一位]      [暫停／繼續]      [下一位] [重播] │
└──────────────────────────────────────────────┘
```

- 視覺：沿用深藍輪廓、紙白底、紅／黃／綠隊色；HRM 紫色。沿用站內字體及 4px 間距系統，不引入新字體或圖片；卡通圖僅為隊伍代表，不當作個人肖像。
- 播放：隊伍開場 2.2 秒 → 每位隊員 4 秒 → 全隊名單收尾並停止。只讀固定名單的姓名、分行、職級與開門紅責任目標，不依績效替人員排序。
- 動效：人物短距離進場、文字 350ms 淡入、隊色聚光背景；不閃白、不晃動整頁、不自動播放聲音。
- 控制：暫停／繼續、上一位／下一位、指定隊員及重播；手動選擇後暫停便於閱讀。關閉、切到背景時清除或暫停計時，返回後不自行續播。
- 可及性：原生 dialog、清楚標題、Esc 關閉、焦點留在視窗內並在關閉後返回入口；按鈕至少 44px，手機內容可捲動。減少動畫模式預設手動切換，不啟動自動播映。
- 空名單：清楚顯示待補齊、不啟動播放；既有角色載入失敗時仍可閱讀所有文字。介紹動畫不呼叫應援或資料上傳。
- 檔案：新增 `team-intro.js`、`team-intro.css`，HTML 加入播放器與入口；`app.js` 增加選手卡入口並修正對話框鍵盤操作的背景點擊判斷。

## 2026-10-08 動畫升級

- A／B／C 使用同一張透明六格跑步影格表（6 欄 × 3 列，1774 × 887px），每 640ms 完成一次跑步循環，各隊錯開相位。原圖保留作為載入失敗及減少動畫模式的備援。
- 人物位置只跟隨實際達成率，以 850ms 平滑移動；應援不影響成績或名次。
- 保留 26 個獨立火焰尺寸，升級以 560ms 平滑放大；長度沿用 26 級比例，厚度隨級數增加並限制於跑道高度。外層處理大小、內層處理閃動，避免動畫互相覆蓋。7／14／20／26 級保留不同色溫。
- 僅在應援寫入成功後，播放約 1.1 秒的「火力 +1」、短促光圈及人物彈跳；26 級後顯示「滿級應援！」。重複點擊、讀取失敗及寫入失敗皆不播放成功特效。
- 每次雲端同步只更新賽道數字、狀態及樣式，不重建角色和火焰節點，保留動畫相位與鍵盤焦點。
- 「動畫：標準／減少」按鈕保存本機偏好；裝置的減少動態效果設定優先。減少模式仍顯示靜態火焰、級數與成功提示。
- 賽道離開可視區、分頁隱藏時暫停賽道動畫；手機減少火星與煙塵數量、停用火焰外層陰影。特效裁切範圍與成績區分離，底部預留 8px 避免角色脚部裁切。
- 本輪沒有修改排名、上傳或資料庫權限。

### 新增素材與產圖紀錄

- 正式素材：`cartoon/assets/runner-sprites.png`（透明 PNG，約 2.1 MB）；保留原有三張單格角色圖。
- 工具：內建 imagegen（非 CLI）；以現有 A／B／C 圖片作為造型參考，生成後檢視透明度、18 格排列及完整身體，再接入網站。
- 最終提示詞：

```text
Use case: identity-preserve. Asset type: production transparent running animation sprite atlas for a website, exactly SIX columns and THREE rows, eighteen isolated full-body sprites. Input image 1: identity/style reference A male runner red A jersey brown spiky hair. Input image 2: identity/style reference B female runner yellow B jersey black ponytail. Input image 3: identity/style reference C male runner green C jersey black spiky hair green headband. Preserve their exact faces, hair, costumes, colors, chunky chibi sports-anime drawing style and three-quarter right-facing view. Primary request: six consecutive frames of a continuous RUNNING IN PLACE gait for EACH character. Row1 all A; row2 all B; row3 all C. Columns are ordered phases: left leg forward contact, left foot under body passing, airborne left leg back, right leg forward contact, right foot under body passing, airborne right leg back. Arms alternate opposite legs, two hands and two feet in every frame. Heads/torso nearly stationary horizontally; ONLY small natural vertical bounce. Fixed character scale across all eighteen cells, same foot baseline and centered torso in each equal square cell. Requested canvas 1536x768, 6x3 square256cells, absolutely regular equal cell grid edge-to-edge; each full-body character occupies about80% cell height with generous transparent padding, no touching adjacent cells. Genuine alpha transparent background, no floor or ground shadow, no scene, no lines or grid, no labels, no extra text except exact jersey letters A/B/C. No flames, crowns, equipment or motion streaks. Critical: ALL eighteen sprites fully visible including feet and hair; no cropped bodyparts. Preserve original character appearance. This is an animation atlas, not a poster or collection of inconsistent poses.
```
