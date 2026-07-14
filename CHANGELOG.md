# 更新日誌（Changelog）

## v2.0.0 (2026-07-14)

- 以 IndexedDB `smartfinance-max`／`app-data` 作主要持久資料庫，並保留同步記憶體快取供現有功能使用。
- 首次啟動先執行既有 localStorage schema migration，再以單一 transaction 複製及讀回核對所有 SmartFinance 鍵。
- migration marker、非覆寫重跑及保留原 localStorage 安全副本，降低轉換期間遺失或倒退資料風險。
- IndexedDB 開啟失敗時自動退回 localStorage，設定頁顯示目前使用嘅儲存後端。
- 備份匯出改讀取新資料層；JSON／CSV 格式及舊版備份匯入維持相容。
- 重置、示範資料、提醒及信用卡配對資料全部接駁新儲存 facade。
- 新增 2 個 IndexedDB migration 單元測試，合共 35 個單元測試；E2E 新增舊資料遷移流程。
- Service Worker 升級至 v8。

## v1.9.0 (2026-07-14)

- 訂閱新增獨立幣別欄位，支援全部現有 App 貨幣。
- 自動產生嘅訂閱交易會保存正確訂閱幣別。
- 訂閱列表按幣別篩選及分開計算月費，避免混合貨幣加總。
- 每週／每兩週月費估算改用 52／26 期年化換算。
- 新增 `billingAnchorDay`，修正月底短月份及閏年日期漂移。
- 舊訂閱以主貨幣及目前扣款日自動補齊新欄位，備份格式維持相容。
- 新增 3 個訂閱引擎測試，合共 33 個單元測試。
- 新增多貨幣訂閱 E2E 流程，手機／桌面合共 6 個 case。
- Service Worker 升級至 v7。

## v1.8.0 (2026-07-14)

- 實作真正嘅每週、每兩週及每月自動週期帳目引擎。
- 新增 `recurrence` 與 `recurrenceSourceId`，保留頻率並以來源／日期防止重複補帳。
- 月週期使用原始日子作錨點，正確處理月底及短月份。
- 編輯頁可修改／停止週期，列表及明細顯示週期狀態。
- 修正 `parseDate` 對無效純日期作瀏覽器 rollover 嘅漏洞。
- Service Worker 升級至 v6，刷新離線 code-split cache。
- 新增 5 個週期處理測試；合共 30 個單元測試。
- 既有 localStorage 及 JSON／CSV 備份保持相容。

## v1.7.0 (2026-07-14)

- 全部頁面改用 route-level lazy loading，按需要下載功能程式。
- Lucide 圖示由全庫 wildcard import 改成明確 registry，主 entry 約由 851KB 降至 33KB。
- Recharts 不再出現在初始 HTML preload，Dashboard／報表載入時先下載。
- 底部導覽加入 pointer、focus 及 touch route preload。
- Service Worker v5 配合 build-time precache manifest，離線保留所有 lazy routes。
- 新增 2 個圖示 registry 測試，合共 25 個單元測試。

## v1.6.0 (2026-07-14)

- 新增以最小貨幣單位運算嘅統一金額模組，消除常見浮點累加誤差。
- JPY 使用 0 位小數，其他現有貨幣使用 2 位小數；輸入、運算及顯示規則一致。
- Dashboard、預算、月曆、報表、訂閱及交易明細改用精確金額加總／格式化。
- 分類重新指派時，預算合併改用幣別精度安全運算。
- 月曆統計排除非主貨幣交易並顯示提示，避免混合幣別誤算。
- 新增 5 個金額測試，合共 23 個單元測試。
- 保持既有 localStorage 及 JSON／CSV 備份格式相容，毋須 migration。

## v1.5.0 (2026-07-14)

- 新增 Playwright 手機／桌面 E2E 測試及設定。
- CI 與 Pages deploy 加入 Chromium E2E gate。
- Service Worker v4 安裝時預快取 Vite hashed entry assets。
- PWA manifest 補充 id、scope、描述、語言及分類。
- 移除禁止縮放 viewport 設定，改善無障礙。
- 金額輸入及 NumPad icon buttons 加入 accessible names。
- 新增交易日期使用嚴格日期轉換。

## v1.4.0 (2026-07-14)

- 分類刪除加入資料使用檢查及重新指派流程。
- 搬移相關交易、訂閱並合併預算，避免孤兒資料。
- 將訂閱到期處理抽成獨立 `subscriptionProcessing` 模組。
- 修正 ISO 日期交易嘅訂閱重複判斷。
- 本地日期解析加入真實日曆有效性檢查。
- 新增分類完整性、訂閱處理及日期測試；總數提升至 18 個。
- Pages 已成功部署並確認 HTTP 200。

## v1.3.0 (2026-07-14)

- 實作逐版本 localStorage migration framework，schema 升級至 v2。
- 備份還原失敗時自動 rollback，避免只還原一半資料。
- localStorage 寫入失敗會向使用者顯示資料安全提示。
- Dashboard 改為真正計算上期比較數據。
- 移除 Settings 舊版 CSV／JSON 匯入匯出死碼。
- 加入 migration、還原 rollback 自動測試。
- 補充 GitHub Pages 正式網址及啟用方式。

## v1.2.0 (2026-07-14)

- 將 SmartFinance v1.1.25 完整帶入 SmartFinance-Max。
- 新增 versioned JSON／CSV 完整備份格式。
- 備份加入信用卡週期及所有 SmartFinance 專用 localStorage 資料。
- 修正 CSV 逗號、引號、換行及自行匯出後無法可靠還原問題。
- 加入匯入驗證、10MB 限制及覆蓋前確認。
- 重置功能改為完整清除所有 SmartFinance 專用資料。
- 加入 Vitest 測試及 CI test gate。
- 改善 Vite vendor chunk 分拆。

## v1.0.1 (2026-04-01)

- 信用卡：支援「繳費日屬於下一個月」（例如 3/19 截數、4/14 繳費）。
- 信用卡：年費為 0 時，收費月份可留空（UI 顯示為不適用）。
- 信用卡：新增週期/提醒（截數後 +1 提醒輸入應繳；繳費後一鍵跳下一期；年費提醒）。

## v1.0.0 (2026-04-01)

### ✅ 穩定性 / 資料安全
- 交易 / 訂閱 / 分類 / 信用卡改用穩定 ID（`crypto.randomUUID()`，並提供 fallback）。
- 訂閱到期自動入帳加入保護（降低重複處理／重複入帳風險）。
- 「重置所有資料」更安全：避免誤解除同一網域下其他應用的 Service Worker。
- 移除重複載入 CSS，減少「白畫面 / 資源快取不一致」問題。

### 📊 效能
- 改善每月預算 spent 計算：先按分類預計支出總和，避免重複掃描交易與昂貴的全物件比較。

### 🗓️ 日期 / 時區正確性
- 日期（date-only）統一使用本地 `YYYY-MM-DD`（減少 UTC offset 造成日期偏移）。
- 改善 CSV 匯入日期解析方式，減少匯入後日期漂移。

### 🧭 使用體驗（UX）
- Welcome 畫面只在首次使用出現；之後預設直接進入 Dashboard。
- 設定頁新增版本號顯示。

### 🧰 工程 / 維護
- 加入 GitHub Actions CI：自動跑 `npm ci` + `npm run build`。
- 加入 localStorage schema version 記號：`smartfinance_schema_version`（v1）。
