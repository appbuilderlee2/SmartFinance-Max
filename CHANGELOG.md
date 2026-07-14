# 更新日誌（Changelog）

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
