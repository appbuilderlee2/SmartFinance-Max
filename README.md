# SmartFinance-Max (PWA)

目前版本：**v2.1.0**

Pages：https://appbuilderlee2.github.io/SmartFinance-Max/

SmartFinance-Max 以 SmartFinance v1.1.25 為基線，係一個 local-first 記帳 PWA，包含記帳、訂閱自動入帳、預算、報表、信用卡及信用卡週期管理。v2.0 起主要資料儲存於瀏覽器 IndexedDB。

## v2.4.0 更新

- 新增獨立「Apple Fluid」主題，保留全部原有主題並可隨時切換
- 採用 Apple system font stack、optical sizing、標題負 tracking 及較清晰文字層級
- 加入藍紫環境光、分層半透明材質、亮邊、深度陰影及較厚大型玻璃面板
- 底部導覽改為 Apple Fluid 專用浮動 tab bar，保留 iPhone safe area 及 44px 觸控範圍
- 按鈕在 pointer-down／touch-down 即時縮放及降低透明度，減少操作延遲感
- 支援 `prefers-reduced-motion`、`prefers-reduced-transparency` 及 `prefers-contrast: more`
- Apple Fluid 選擇會保存到 IndexedDB，重新載入及離線啟動後繼續使用
- 手機／桌面 E2E 加入主題選擇、套用及重新載入持久化驗證
- Service Worker 升級至 v15；版本號及文件同步更新至 v2.4.0

## v2.3.0 更新

- 新增 4 至 8 位 App PIN 鎖，PIN 以隨機 salt + PBKDF2-SHA-256 120,000 次衍生後保存，不儲存明文
- 支援離開 App 後立即、1、5、15 或 30 分鐘自動鎖定
- 錯誤 PIN 會拒絕解鎖；正確 PIN 先重新顯示本機財務資料
- 新增金額私隱模式，全 App 統一金額 formatter 顯示為 `••••`
- 切換 App／鎖機時可顯示全畫面私隱遮罩，降低 App switcher 預覽洩露資料風險
- 顯示 Face ID／Touch ID 平台認證支援狀態；目前 PWA 以本機 PIN 作實際解鎖方式
- 新增清除 Safari／瀏覽器網站資料會刪除 IndexedDB 嘅明確警告
- 安全設定包含於現有 IndexedDB 及備份，舊資料自動使用關閉 PIN 嘅安全相容預設
- 單元測試增至 39 個，手機／桌面 E2E 增至 14 個 case
- Service Worker 升級至 v14；版本號及文件同步更新至 v2.3.0

## v2.2.0 更新

- 新增常用貨幣管理，新增訂閱時只顯示已啟用貨幣，主貨幣會自動保留
- 新增日期格式、星期一／星期日起始、貨幣符號位置及負數格式偏好
- 月曆依每週開始日重新排列；提醒中心日期跟隨所選格式
- 全 App `formatMoney` 支援符號前後位置及括號負數格式
- 提醒中心新增預算接近上限／超支提醒，門檻可選 70%、80% 或 90%
- 新偏好儲存在 IndexedDB 並包含於備份；舊資料自動使用安全預設值
- 單元測試增至 38 個，手機／桌面維持 12 個完整 E2E
- Service Worker 升級至 v13；版本號及文件同步更新至 v2.2.0

## v2.1.0 更新

- 設定頁升級為可搜尋嘅「設定與資料管理中心」，重新分類帳務、個人化、資料、離線更新及危險操作
- 顯示 IndexedDB 狀態、交易／預算／訂閱／信用卡數量、資料項目及估算空間
- 新增資料完整性檢查；JSON／CSV 還原會先顯示摘要，可選合併或取代
- 還原前自動下載現況 JSON 復原備份，降低誤覆蓋風險
- 新增檢查更新、固定重新載入、清快取但保留 IndexedDB 財務資料
- 刪除所有資料改為獨立危險操作視窗，必須輸入「刪除」先可執行
- 新增設定資料中心 E2E，手機／桌面合共 12 個瀏覽器 case
- Service Worker 升級至 v12；版本號及文件同步更新至 v2.1.0

## v2.0.3 更新

- 導航改為 cache-first + 背景更新；已有快取時立即顯示 App，離線啟動毋須等待網絡 timeout
- 網絡恢復時自動刷新 App shell 快取及檢查 Service Worker 新版
- 新 Service Worker 已在等待時顯示「有新版本可用／重新載入」，包括重新打開已安裝 PWA 嘅情況
- 加入安全區內「離線模式」及短暫「網絡已恢復」提示，避免被 iPhone 狀態列遮住
- Playwright 改用 production preview，新增完整離線重新載入及恢復網絡 E2E；手機／桌面合共 10 個 case
- Service Worker 升級至 v11；版本號及文件同步更新至 v2.0.3

## v2.0.2 更新

- 舊資料遷移 E2E 改為進入記錄頁後驗證交易內容，同時直接核對 IndexedDB 及保留嘅 localStorage 副本
- Service Worker 升級至 v10；版本號及文件同步更新至 v2.0.2

## v2.0.1 更新

- 修正多貨幣訂閱 E2E 對重複金額文字使用不明確 selector，避免 Playwright strict mode 誤報
- 修正舊資料遷移 E2E fixture 使用錯誤交易類型大小寫，正式 IndexedDB 遷移邏輯不受影響
- Service Worker 升級至 v9；版本號及文件同步更新至 v2.0.1

## v2.0.0 更新

- 主要資料庫由 localStorage 升級至 IndexedDB，較適合日後增加大量交易及功能資料
- 首次開啟會先執行舊 schema migration，再以單一 IndexedDB transaction 複製全部 SmartFinance 資料
- 複製後會讀回核對，成功先記錄 migration；舊 localStorage 資料不會刪除，作為安全副本
- IndexedDB 已有資料或 migration 已完成時不會重複覆蓋，避免舊副本蓋過新資料
- 若瀏覽器無法使用 IndexedDB，會自動退回 localStorage，設定頁會顯示實際儲存模式
- JSON／CSV 備份格式保持不變，舊備份可直接匯入，新備份亦包含 IndexedDB 內全部 App 資料
- 重置、示範資料、提醒、信用卡配對及備份匯入／匯出已統一使用新資料層
- 新增 IndexedDB migration 單元測試及舊資料瀏覽器 E2E，單元測試總數增至 35 個
- Service Worker 升級至 v8；版本號及文件同步更新至 v2.0.0

## v1.9.0 更新

- 每個訂閱可獨立選擇 TWD、HKD、USD、AUD、CNY、JPY、EUR 或 GBP
- 訂閱自動入帳會沿用訂閱本身幣別，改變 App 主貨幣不會改變舊訂閱金額意義
- 訂閱頁加入幣別篩選，各幣別分開計算月費，避免把 AUD、HKD 等直接混加
- 每週月費估算改為 `×52÷12`，每兩週改為 `×26÷12`，比原本 `×4／×2` 準確
- 新增扣款日錨點，1 月 31 日訂閱經過 2 月後會回復 3 月 31 日
- 每年 2 月 29 日訂閱在非閏年用 2 月 28 日，下一個閏年會回復 2 月 29 日
- 舊訂閱會以目前主貨幣作相容預設，處理後自動保存幣別及日期錨點
- 新增 3 個訂閱貨幣／日期測試，單元測試總數增至 33 個
- Playwright 增加多貨幣訂閱流程，手機／桌面 E2E case 增至 6 個
- Service Worker 升級至 v7；版本號及文件同步更新至 v1.9.0

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
- E2E 實際測試首次使用流程、Dashboard 顯示、記帳、頁面跳轉、重新載入及本機資料持久化
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
