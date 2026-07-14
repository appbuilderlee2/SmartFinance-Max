# Project Work Log

## 2025-12-09: Currency & Budget Fixes
- **Location**: Moved to project root `/Users/alpha/Desktop/App Google ai studio/smartfinance-ios/work_log.md`
- **Status**: Completed
- **Completed Items**:
  - [x] **修復新增帳目頁面**: `AddTransaction.tsx` updated to use dynamic currency symbol (Left) and Code (Right).
  - [x] **修復新增訂閱頁面**: `AddSubscription.tsx` updated to use dynamic currency symbol.
  - [x] **全域檢查**: Verified Dashboard, Records, Details, and Budget pages for currency consistency.
  - [x] **預算同步機制**: Confirmed `DataContext` syncs budgets with categories.
  - [x] **建立工作記錄檔**: Created this log file for tracking.
  - [x] **遷移記錄檔**: Log file moved to `smartfinance-ios` folder.
- **Changes**:
  - `pages/AddTransaction.tsx`: Imported `getCurrencySymbol` helper; Replaced static text.
  - `pages/AddSubscription.tsx`: Imported `getCurrencySymbol` helper; Replaced static text.
  - `contexts/DataContext.tsx`: Verified categorization sync logic.
  - `walkthrough.md`: Updated verification steps to reflect fixes.
  - `task.md`: Marked all currency-related tasks as completed.

## 2025-12-09: iOS Experience Optimization
- **Status**: Completed
- **Completed Items**:
  - [x] **Native Feel**: Added `-webkit-tap-highlight-color: transparent` to remove gray tap box.
  - [x] **Haptic Feedback**: Created `haptics.ts` and integrated into Navigation bar buttons.
  - [x] **Input Zoom Fix**: Enforced base `16px` font size for inputs to prevent iOS auto-zoom.
  - [x] **Safe Area**: Verified `pt-safe-top` and `pb-safe-bottom` usage in layouts.
- **Changes**:
  - `index.css`: Added iOS specific styles.
  - `components/Layout.tsx`: Added haptic feedback to navigation.
  - `utils/haptics.ts`: Created new utility.

## 2025-12-10: Phase 2 Major Features
- **Status**: In Progress
- **Completed Items**:
  - [x] **Bi-weekly Recurrence**: Added "每2週" option to AddTransaction.
  - [x] **Calendar Page**: Created `/calendar` with monthly view and daily totals.
  - [x] **Navigation Update**: Replaced "清單" with "月曆", moved "分類" to Settings.
  - [x] **Income Support**: Added Expense/Income toggle in AddTransaction.
  - [x] **Credit Card Manager**: Created `/settings/creditcards` page.
  - [x] **Theme Colors**: Added color picker in Settings.
- **Changes**:
  - `pages/AddTransaction.tsx`: Added bi-weekly, income toggle, dynamic categories.
  - `pages/Calendar.tsx`: New page.
  - `pages/CreditCardManager.tsx`: New page.
  - `pages/Settings.tsx`: Added links to Categories, Credit Cards, Theme Color picker.
  - `components/Layout.tsx`: Updated navigation.
  - `contexts/DataContext.tsx`: Added creditCards and themeColor state.
  - `App.tsx`: Added routes for Calendar and CreditCardManager.

## 2025-12-10: Phase 2 Part 2 - Bug Fixes & Improvements
- **Status**: Completed
- **Fixed Items**:
  - [x] **Calendar Full Month**: Now shows all transactions for month by default.
  - [x] **Calendar Category Name**: Displays category name instead of "無備注".
  - [x] **Category Manager Tabs**: Added 支出/收入 tabs at top.
  - [x] **Category Edit**: Added full edit modal with icon and color picker.
  - [x] **Theme Color Global**: Now applies to entire app via CSS variable.
  - [x] **Credit Card Multi-line Rewards**: Textarea for multiple reward lines.
- **Changes**:
  - `pages/Calendar.tsx`: Full month display, category name, clear selection.
  - `pages/CategoryManager.tsx`: Tabs, edit modal, icon/color picker.
  - `pages/CreditCardManager.tsx`: Textarea for rewards, multiline display.
  - `contexts/DataContext.tsx`: Added updateCategory, CSS variable for theme.
  - `tailwind.config.js`: Primary color uses CSS variable.
  - `index.css`: Added :root CSS variable for primary color.

## 2025-12-10: Phase 2 Part 3 - Additional Enhancements
- **Status**: In Progress
- **Completed Items**:
  - [x] **Calendar Category Icons**: Now displays category icon (Lucide or emoji) alongside name.
  - [x] **Emoji Support for Categories**: Added emoji picker tab in CategoryManager.
  - [x] **Theme Presets**: Added iOS26 (glassmorphism), Black-Gold, and Light themes.
  - [x] **Full Theme System**: CSS variables for primary, bg, surface, text colors.
- **Changes**:
  - `pages/Calendar.tsx`: Added Icon import and category icon display.
  - `pages/CategoryManager.tsx`: Added iconTab state, emoji picker, emoji display.
  - `pages/Settings.tsx`: Added theme style buttons (科技透明, 黑金, 淺色).
  - `contexts/DataContext.tsx`: Added ios26, blackgold, light themes.
  - `index.css`: Added theme CSS classes for glassmorphism and light mode.

## 2025-12-10: Reports & Subscription Sync
- **Status**: Completed
- **Completed Items**:
  - [x] **多維度報告中心**：新增 `Reports.tsx`，支援年度報告、分類年度、全時段、全時段分類與自訂期間搜尋，並在設定頁提供入口。
  - [x] **訂閱自動入帳**：DataContext 會檢查到期訂閱並自動在交易紀錄新增支出，同步滾動下一次扣款日，避免重複入帳。
  - [x] **訂閱分類綁定**：新增訂閱時可挑選支出分類，並持久化於資料模型。
- **Changes**:
  - `pages/Reports.tsx`: 新增報告中心頁面與多篩選模式。
  - `pages/Settings.tsx`: 加入「報告統計」入口。
  - `pages/AddSubscription.tsx`: 加入分類選擇、接收貨幣符號；資料模型含分類。
  - `contexts/DataContext.tsx`: 訂閱到期自動生成支出交易並滾動扣款日；使用 `lastProcessedDate` 防重複。
  - `types.ts`: Subscription 模型新增 `categoryId`、`lastProcessedDate`。

## 2025-12-10: Subscriptions UX & Reports Export
- **Status**: Completed
- **Completed Items**:
  - [x] **訂閱可編輯**：在列表中提供「編輯」按鈕，並重用 `AddSubscription` 作為編輯頁，預填資料與保存更新。
  - [x] **訂閱分類管理**：新增分類篩選、清楚顯示每筆訂閱的分類名稱，分類可在建立/編輯時選擇。
  - [x] **返回行為修正**：新增/編輯訂閱左上返回按鈕會優先返回上一頁，若無歷史則回到訂閱列表。
  - [x] **報告匯出/簡易圖表**：報告頁新增 CSV 匯出目前篩選結果，並以條形圖顯示分類彙總（免第三方圖表套件）。
- **Changes**:
  - `pages/Subscriptions.tsx`: 分類篩選、分類顯示、編輯入口。
  - `pages/AddSubscription.tsx`: 支援編輯模式（路由 `subscriptions/:id/edit`）、預填與更新邏輯、返回行為優化。
  - `App.tsx`: 新增訂閱編輯路由。
  - `pages/Reports.tsx`: 加入 CSV 匯出、分類條形視覺化。

## 2025-12-10: Subscriptions UX v2 & Reports Charts
- **Status**: Completed
- **Completed Items**:
  - [x] **新增訂閱預設今日**：首次訂閱日期預設為當日。
  - [x] **訂閱刪除**：編輯模式下提供刪除按鈕。
  - [x] **返回體驗**：帶入 `state.from`，若無歷史或來源則直接返回訂閱列表（或設定），避免多層退出。
  - [x] **報告強化**：新增餅圖/長條切換、月份/季度/年度快速範圍、CSV 匯出保持。
- **Changes**:
  - `pages/AddSubscription.tsx`: 預設日期今日、編輯刪除按鈕、返回路徑優化（尊重來源頁）。
  - `pages/Subscriptions.tsx`: 編輯/新增入口附帶 `state.from` 以改善返回行為。
  - `pages/Reports.tsx`: 餅圖/長條切換、快速時間範圍 preset、CSV 匯出保留；餅圖使用 conic-gradient。
  - `pages/Settings.tsx`: 導航到訂閱時帶入來源 `/settings`。

## 2025-12-10: Subscriptions Exit Fix
- **Status**: Completed
- **Completed Items**:
  - [x] **列表返回行為**：訂閱列表左上返回按鈕若有來源則直接 replace 返回來源（預設設定頁），避免需按兩次。
- **Changes**:
  - `pages/Subscriptions.tsx`: header 返回使用 `location.state.from`（預設 `/settings`）並以 replace 導航。

## 2025-12-10: Budget Input & Subscription Cycle
- **Status**: Completed
- **Completed Items**:
  - [x] **月預算輸入**：在 slider 旁新增數字輸入框，支援直接輸入金額。
  - [x] **訂閱周期**：新增「每2週」扣款週期，總額估算支援。
  - [x] **設定分組**：設定頁依需求分為「帳務管理 / 主要設定 / 進階功能」並重排項目。
- **Changes**:
  - `pages/BudgetSettings.tsx`: slider + 數字輸入同步更新預算。
  - `types.ts`: Subscription `billingCycle` 增加 `BiWeekly`。
  - `contexts/DataContext.tsx`: 自動入帳日期計算支援雙週。
  - `pages/AddSubscription.tsx`: 扣款週期選單加入「每2週」。
  - `pages/Subscriptions.tsx`: 月估算計算支援雙週。
  - `pages/Settings.tsx`: 設定頁重組為帳務管理/主要設定/進階功能，條目重排。

## 2025-12-10: Subscriptions Sorting
- **Status**: Completed
- **Completed Items**:
  - [x] **扣款日排序**：訂閱列表依「最接近的扣款日期」優先顯示，無日期者置底。
- **Changes**:
  - `pages/Subscriptions.tsx`: 篩選結果按扣款日與當日的距離排序，相同距離時日期較早者在前。

## 2025-12-10: Subscriptions Countdown & Add Transaction UX
- **Status**: Completed
- **Completed Items**:
  - [x] **扣款倒數**：訂閱列表顯示「距扣款還有 X 天 / 已逾期 X 天」提示。
  - [x] **新增帳目保存 UX**：儲存按鈕改為底部固定大按鈕，方便一鍵保存。
- **Changes**:
  - `pages/Subscriptions.tsx`: 顯示扣款剩餘天數或逾期天數。
  - `pages/AddTransaction.tsx`: Header 去除右側小按鈕，底部新增固定大按鈕；增加底部間距以避免遮擋。

## 2025-12-10: Settings Preview & Credit Limit
- **Status**: Completed
- **Completed Items**:
  - [x] **設定重排**：信用卡管理置於訂閱服務之上。
  - [x] **訂閱預覽**：設定頁顯示最近 3 筆扣款的訂閱倒數。
  - [x] **信用卡額度**：信用卡管理新增信用額度欄位（表單與展示）。
  - [x] **訂閱圖示**：常見訂閱服務顯示對應 emoji 圖示。
- **Changes**:
  - `pages/Settings.tsx`: 重排帳務管理順序並加入最近扣款預覽。
  - `pages/CreditCardManager.tsx`: 新增信用額度欄位、顯示額度。
  - `contexts/DataContext.tsx`: CreditCard 型別新增 creditLimit。
  - `pages/Subscriptions.tsx`: 常見服務 icon、扣款剩餘天數顯示。

## 2025-12-10: Calendar UX Tweaks
- **Status**: Completed
- **Completed Items**:
  - [x] **空白返回全月**：點擊月曆空白區即可清除日期選取、回到全月明細。
  - [x] **年月選擇**：頂部加入年份與月份下拉（平排），預設當月。
- **Changes**:
  - `pages/Calendar.tsx`: 年份/月份雙下拉平排（年份延伸近 20 年）；月曆格子容器點擊可清除選取。

## 2025-12-10: Records Search & Filters
- **Status**: Completed
- **Completed Items**:
  - [x] **搜尋/篩選功能**：帳目明細頁右上按鈕啟用，支援關鍵字（備註/標籤）、分類多選、金額區間。
- **Changes**:
  - `pages/Records.tsx`: 新增搜尋/篩選面板與篩選邏輯，金額顯示使用當前貨幣符號。

## 2025-12-10: Reports Advanced
- **Status**: Completed
- **Completed Items**:
  - [x] **高級篩選**：分類多選、標籤多選、金額區間、關鍵字。
  - [x] **圖表強化**：分類長條/餅圖、趨勢（月/季/年折線/條狀）、支出 Top 5。
  - [x] **快速維度**：淨額、月平均、MoM / YoY。
  - [x] **預算對比**：本月支出 vs 預算總額，超標提示。
- **Changes**:
  - `pages/Reports.tsx`: 新增篩選面板、期間視圖切換、趨勢與 Top 5、快速維度與預算完成度；重排結構（KPI 置頂、趨勢/Top5/分類後置，篩選置底）。

## 2025-12-10: Calendar Daily Totals
- **Status**: Completed
- **Completed Items**:
  - [x] **日級收支顯示**：月曆每日格內直接顯示支出(-紅)與收入(+綠)數字。
- **Changes**:
  - `pages/Calendar.tsx`: 在日格顯示當日支出/收入數字。

## 2025-12-10: Dashboard Layout & Reports Adjust
- **Status**: Completed
- **Completed Items**:
  - [x] **底部統計 (/)**：新增年/月選擇器，寬度限制為 max-w-5xl；調整圓餅/趨勢區塊間距與 Legend 位置，避免重疊。
  - [x] **TypeScript Build**：修正 tsconfig lib、移除未用 import，修正 DataContext 型別與 provider 值，build 通過。
  - [x] **報告統計 (/reports)**：保留 KPI→圖表→篩選順序（篩選已移至底部）；稍後若需再上移可再調。
- **Changes**:
  - `pages/Dashboard.tsx`: max width、年/月選擇器、圖表間距與 legend。
  - `tsconfig.json`: lib 調整為 `es2021`/`dom`/`dom.iterable`。
  - `contexts/DataContext.tsx`: 型別補齊 addBudget/updateSubscription 等；移除未用 setter 包裝。
  - `pages/AddTransaction.tsx`, `pages/Welcome.tsx`: 移除未用 import。

## 2025-12-10: Reports Filters Reordered
- **Status**: Completed
- **Completed Items**:
  - [x] **篩選移到總覽之上**：/reports 頁面將篩選區塊上移到總覽 (KPI) 前。
- **Changes**:
  - `pages/Reports.tsx`: 篩選區塊移至頁面上方，仍保留原有功能。

## 2025-12-10: Import CSV & Calendar Years
- **Status**: Completed
- **Completed Items**:
  - [x] **匯入 CSV/JSON**：設定頁資料管理加入 CSV 匯入（對應匯出欄位），保留 JSON 匯入與 CSV 匯出。
  - [x] **年份範圍**：月曆年份下拉延伸，包含未來年份（覆蓋到未來 2 年）。
- **Changes**:
  - `pages/Settings.tsx`: 新增 CSV 匯入按鈕與處理；保留 CSV 匯出與 JSON 匯入。
  - `pages/Calendar.tsx`: 年份下拉改為 base-19~base+2 覆蓋未來年份。

## 2025-12-10: Full Backup CSV/JSON & Calendar Range
- **Status**: Completed
- **Completed Items**:
  - [x] **完整匯出/匯入 JSON**：包含交易、分類、預算、訂閱、貨幣、信用卡、主題色。
  - [x] **完整匯出/匯入 CSV**：單一 CSV 內含交易、預算、分類、訂閱、信用卡、設定（貨幣/主題），支援匯入還原。
  - [x] **年份範圍擴大**：月曆年份下拉涵蓋未來約 30 年（base-19~base+30）。
- **Changes**:
  - `pages/Settings.tsx`: CSV 匯出欄位擴充（recordType/ID/.../BudgetLimit/.../ThemeColor），匯入時寫回 transactions/budgets/categories/subscriptions/creditcards/currency/themeColor；JSON 匯出含全部主要資料。
  - `pages/Calendar.tsx`: 年份下拉長度改 50 年。

## 2025-12-10: Firebase Backup & Auth Verify
- **Status**: Completed
- **Completed Items**:
  - [x] **Firebase 雲端備份/還原**：設定頁新增雲端備份/還原按鈕，使用 Firestore 儲存/讀取完整資料集。
  - [x] **Email 驗證與重設密碼**：註冊後寄送驗證信；未驗證登入會阻擋；登入頁可發送重設密碼郵件。
- **Changes**:
  - `services/firebaseBackup.ts`: 新增 backup/restore to Firestore。
  - `pages/Settings.tsx`: 雲端備份/還原按鈕；JSON/CSV 完整備份維持。
  - `services/authService.tsx`: sendEmailVerification、resetPassword、未驗證阻擋登入。
  - `pages/Login.tsx`, `pages/Signup.tsx`: 加入重設密碼、註冊後驗證提示。

## 2025-12-10: React Security Upgrade
- **Status**: Completed
- **Completed Items**:
  - [x] 將 `react`/`react-dom` 升級至 19.2.1，`react-router-dom` 至 6.30.2，`lucide-react` 至 0.447.0，`@types/react`/`@types/react-dom` 至 19.x。
  - [x] `npm run build` 通過（Vite/tsc OK）。
- **Changes**:
  - `package.json`: 升級依賴以因應安全提示。
