# SmartFinance-Max (PWA)

目前版本：**v1.3.0**

Pages（啟用 GitHub Pages 後）：https://appbuilderlee2.github.io/SmartFinance-Max/

SmartFinance-Max 以 SmartFinance v1.1.25 為基線，係一個 local-first 記帳 PWA，包含記帳、訂閱自動入帳、預算、報表、信用卡及信用卡週期管理。

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
npm run build
```

## 資料模式

資料只儲存於目前瀏覽器。建議定期匯出 JSON 或 CSV 備份；清除網站資料或更換裝置前，必須先匯出備份。
