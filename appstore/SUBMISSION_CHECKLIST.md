# SmartFinance Max：App Store 上架檢查清單

這份資料可用嚟準備上架，**但未上架，隨附的 unsigned IPA 亦不能直接上傳 App Store**。App Store 或 TestFlight 需要有效付費 Apple Developer Program 會籍和正式簽署。

## 1. 帳戶、識別碼與簽署

- [ ] 以發佈者的 Apple Developer Program 帳戶接受最新協議，確認 App Store Connect 角色有權建立 App 記錄和上傳。
- [ ] 在 Certificates, Identifiers & Profiles 登記明確 App ID。現時原始碼的 Bundle ID 為 `com.appbuilderlee2.smartfinancemax`；先確認發佈團隊有權使用，若改用 `<YOUR_BUNDLE_ID>`，同步更新 Xcode **App** target、Capacitor `appId`，並為 UI 測試 target 使用相應的測試識別碼。
- [ ] 在 Xcode **Signing & Capabilities** 選正確的 Team（`<APPLE_TEAM>`），啟用自動簽署或選用 Apple Distribution 憑證與 App Store provisioning profile。不需要新增 iCloud 或推播 entitlement。
- [ ] 確認版本和 build number。專案目前是 `2.22.2 (1)`；與 App Store Connect 的版本一致，每次重複上傳前調高 build number。

## 2. 建置、封存與上傳

- [ ] 用 Node 22 在原始碼根目錄執行 `npm ci`、`npm run typecheck`、`npm test`、`npm run test:e2e`、`npm run build`、`npx cap sync ios`，再用符合 Apple 當期上傳要求的 Xcode 開啟 `ios/App/App.xcodeproj`（Swift Package Manager）。用真機檢查 iPhone／iPad 介面、通知權限與交付、PIN 和備份流程。
- [ ] 選 App scheme 及一般 iOS 裝置目的地，執行 **Product → Archive**。在 Organizer 檢查合併私隱報告、簽署、版本和裝置支援，按 **Distribute App → App Store Connect → Upload**。亦可先依 App Store Connect 方式匯出正式簽署 IPA，再用 Apple Transporter 上傳；不要使用隨附的未簽署 IPA。
- [ ] 完成出口合規、使用 Apple 當期 SDK 要求、內容版權及地區設定；參考 [申報草稿](app-privacy-answers.md)。請確認 Google 目錄端點實際資料處理情況及任何新加入服務，而非照抄暫定答案。

## 3. App Store Connect

- [ ] 建立 iOS App 記錄，填名稱、主要語言、Bundle ID、內部 SKU（`<APP_SKU>`）及適用使用權限。按 [繁中資料](metadata/zh-Hant.md) 及 [英文資料](metadata/en-US.md) 填副標題、推廣文字、描述、關鍵字、最新功能、分類及版權。
- [ ] 填 `<SUPPORT_URL>`（公開可用）、`<MARKETING_URL>`（選填，沒有可留空）、`<RELEASE_YEAR>` 及 `<COPYRIGHT_HOLDER>`。如在相關地區發佈，填寫平台要求的交易者身分及聯絡資料。
- [ ] 在[私隱政策](privacy-policy.md)填 `<POLICY_EFFECTIVE_DATE>`、`<OPERATOR_LEGAL_NAME>`、`<PRIVACY_CONTACT_EMAIL>`，託管成公開 HTTPS 網頁，再填 `<PRIVACY_POLICY_URL>`。上架前確保 App 內亦有易於找到的私隱政策連結（現版本尚無該連結，政策網址確定後須加入並重新封存）。核對 App Privacy、年齡分級及出口合規。
- [ ] 上傳 [繁體中文截圖](screenshots/README.md) 並在預覽中核對順序和手機／平板尺寸。提供的圖片是實際模擬器畫面；如果簽署版本的介面改動則重新截圖。英文區可選擇適用的繁中截圖或另外上傳相應版本的截圖，本包沒有英文介面截圖。
- [ ] 選價錢、地區和發佈方式，選擇已處理的 build；貼上[審核備註](review-notes.md)，填 `<APP_REVIEW_CONTACT_NAME>`、`<APP_REVIEW_CONTACT_EMAIL>`、`<APP_REVIEW_CONTACT_PHONE>`。不用填登入帳號密碼。
- [ ] 先邀請內部 TestFlight 測試員；外部測試視乎 Apple 是否要求 Beta App Review。測試後在 App Store Connect **Add for Review / Submit for Review**，按選定方式發佈。

Apple 指引：[提交審核](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app-for-review/) · [截圖規格](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/) · [審核指引](https://developer.apple.com/app-store/review/guidelines/)
