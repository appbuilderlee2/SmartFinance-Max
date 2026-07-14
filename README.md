# SmartFinance-Max (PWA)

目前版本：**v1.8.0**

Pages：https://appbuilderlee2.github.io/SmartFinance-Max/

SmartFinance-Max 以 SmartFinance v1.1.25 為基線，係一個 local-first 記帳 PWA，包含記帳、訂閱自動入帳、預算、報表、信用卡及信用卡週期管理。

## v1.8.0 更新

- 「每週／每2週／每月」設定會正式保存頻率，不再只儲存一個無法執行嘅布林值
- App 開啟時會自動補回所有已到期週期帳目
- 每個自動帳目以來源交易及到期日識別，重新載入或 React StrictMode 都不會重複入帳
- 每月週期保留原始日期錨點，例如 1 月 31 日會依序落在 2 月 28 日、3 月 31 日、4 月 30 日
- 編輯帳目頁可修改或停止週期；自動帳目可獨立修改而不影響之後排程
- 帳目列表及明細加入週期／自動建立標示
- 修正通用日期解析再次接受 `2026-02-31` 等無效日期嘅漏洞
- Service Worker 升級至 v6，確保新版 code-split assets 重新離線快取
- 新增 5 個週期引擎測試，測試總數增至 30 個
- 備份格式保持相容，版本號及文件同步更新至 v1.8.0

## v1.7.0 更新

- 所有功能頁改為 route-level lazy loading，首次開啟只下載目前路由所需程式
- 移除 `lucide-react` 全庫動態匯入，改用明確圖示 registry，保留所有可選分類圖示及安全 fallback
- 主 entry bundle 由約 851KB 降至約 33KB，縮減約 96%
- Recharts 圖表庫不再由首頁 HTML 預載，只有進入 Dashboard／報表相關功能時先下載
- 底部導覽支援 hover、鍵盤 focus 及 touch 預載，減少切頁等待
- Service Worker 升級至 v5，build 會自動產生 precache manifest，背景快取所有 lazy chunks
- 新增圖示 registry 完整性測試，測試總數增至 25 個
- 設定頁版本號、README、CHANGELOG 同步更新至 v1.7.0

## v1.6.0 更新

- 新增統一金額計算層，所有加總先轉成最小貨幣單位，避免 `0.1 + 0.2` 浮點誤差
- 港元、美元等貨幣以「分」計算；日圓以整數計算及顯示
- 新增及編輯交易、訂閱會按幣別限制小數位，拒絕超出精度或無效金額
- Dashboard、預算、月曆、報表及訂閱月費統一使用精確加總及貨幣格式
- 分類合併時預算上限改用精確金額相加
- 月曆只加總主貨幣交易，並清楚提示已排除其他幣別
- 新增 5 個金額精度測試，測試總數增至 23 個
- 儲存及備份格式維持相容，毋須資料遷移
- 設定頁版本號、README、CHANGELOG 同步更新至 v1.6.0

## v1.5.0 更新

- 加入 Playwright 瀏覽器 E2E 測試，覆蓋手機及桌面 Chromium
- E2E 實際測試首次使用流程、Dashboard 顯示、記帳、頁面跳轉、重新載入及 localStorage 持久化
- GitHub CI／Pages 部署會安裝 Chromium並先跑 E2E；測試失敗不會部署壞版本
- Service Worker 升級至 v4，安裝時會由 Vite `index.html` 自動發現並預快取 hashed JS／CSS 核心資源
- 保留 network-first HTML 更新策略，同時改善首次安裝後核心 App 離線啟動能力
- PWA manifest 加入 id、scope、語言、描述及分類資料
- 允許瀏覽器縮放，移除 `user-scalable=no` 無障礙限制
- 金額輸入區支援鍵盤／讀屏操作，數字鍵盤圖示按鈕加入可讀標籤
- 新增交易日期改用嚴格本地日期轉換，拒絕無效日期
- 設定頁版本號、README、CHANGELOG 同步更新至 v1.5.0

## v1.4.0 更新

- 刪除仍被使用嘅分類時，必須先選擇同類型接收分類
- 自動搬移相關交易及訂閱，避免產生 `Unknown` 孤兒資料
- 合併原分類與接收分類嘅預算上限，避免刪分類時遺失預算
- 將訂閱自動入帳由 React Context 抽成獨立純函式，方便測試及維護
- 修正訂閱防重複邏輯，不再使用容易受時區影響嘅 `split('T')[0]`
- 過期多期訂閱會依序補帳，單次訂閱入帳後會正式關閉排程
- 嚴格驗證日曆日期，例如拒絕 `2026-02-31`，不再自動滾動到三月
- 測試增加至 18 個，覆蓋分類關聯、預算合併、訂閱補帳、防重複及日期驗證
- 設定頁版本號、README、CHANGELOG 同步更新至 v1.4.0

## v1.3.0 更新

- 加入真正逐版本 localStorage migration；只有成功遷移後先更新 schema version
- schema 升級至 v2，信用卡週期成為正式、必定存在嘅資料集合
- 備份還原加入 transaction rollback；寫入中途失敗會自動恢復還原前資料
- localStorage 寫入失敗不再靜默忽略，App 會顯示紅色資料安全提示
- 統計首頁「較上期」改為真正比較上月／上年數據，移除示意文字
- Settings 移除超過 300 行舊 CSV／JSON 死碼，備份 UI 只使用新版服務
- 新增 migration 及 rollback 測試
- 版本號及文件同步更新為 v1.3.0

## v1.2.0 更新

- 完整帶入 SmartFinance v1.1.25 功能
- 完整 JSON／CSV v2 備份，包含交易、分類、預算、訂閱、信用卡、信用卡週期、提醒及標籤歷史等 App 資料
- CSV 正確處理逗號、雙引號及多行文字，可可靠匯出後再匯入
- 匯入前驗證格式、貨幣及主要資料類型，錯誤檔案不會覆蓋現有資料
- 匯入前要求確認，並限制備份檔案為 10MB 或以下
- 支援讀取舊版 JSON 備份
- 「重置所有資料」會清除信用卡週期、提醒、標籤歷史及其他 SmartFinance 專用資料
- 新增 Vitest 備份 round-trip 測試；GitHub Actions 會先測試再 build
- 修正 Vite vendor chunk 判斷次序
- 設定頁版本號同步更新為 v1.2.0

## 開發

```bash
npm install
npm run dev
```

驗證：

```bash
npm test
npm run test:e2e
npm run build
```

## 資料模式

資料只儲存於目前瀏覽器。建議定期匯出 JSON 或 CSV 備份；清除網站資料或更換裝置前，必須先匯出備份。
