# App Store Connect disclosure worksheet

Review the exact signed archive and production services with the publisher before submitting. These are proposed answers for the included source, not a completed Apple declaration.

## App Privacy (nutrition label)

| App Store Connect prompt | Proposed answer and basis |
| --- | --- |
| Do you or your third-party partners collect data from this app? | **No, if verified by the publisher.** The app has no developer backend, account, analytics, or advertising SDK. The financial information, purchases entered as ledger records, receipt images, notes, and settings stay on-device unless users choose to share an export. The catalog requests a public CSV from Google; no ledger content or app-supplied identifiers are sent. |
| Data linked to the user | **None**, if no data is collected under Apple's definition. |
| Data used to track users | **None.** There is no tracking across apps or websites and no ATT request. |
| Other partner processing | A Google request discloses ordinary connection metadata such as IP address. **Before selecting “No,” document whether Google or any added partner retains data from the app beyond servicing the request and whether the publisher or partner can access or use it in a way Apple's current rules require disclosing.** If so, select “Yes” and declare the applicable types, purposes, and linkage. Do not assume the absence of analytics settles this. User-chosen external websites and destinations handle data under their own terms. |

**Manifest consistency:** `ios/App/App/PrivacyInfo.xcprivacy` declares tracking false, no collected data types, and required-reason usage for app-container file timestamps (`C617.1`) and app-only UserDefaults (`CA92.1`). The proposed label matches that app manifest subject to the service verification above. In Xcode Organizer, generate the privacy report for the distribution archive and review the combined app and Swift package manifests; reconcile manifest and nutrition label if the production services or SDKs differ.

- Apple [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- Apple [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)

## Export compliance

- The app uses OS-provided HTTPS/TLS for catalog access and external sites where they use HTTPS. The PIN verifier also uses Web Crypto PBKDF2 with SHA-256 and a random salt. These are standard primitives; the PIN does not provide ledger encryption. There is no custom encryption algorithm, encrypted messaging, VPN, or bank connection.
- **Proposed, not legal advice:** the code does not appear to use non-exempt encryption (standard, OS-provided transport and local PIN verification only). Review the jurisdiction and distribution territories via Apple's [export compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/) before asserting an exemption. Do not describe the app as using no cryptography.
- For the archive currently represented by this source, `ITSAppUsesNonExemptEncryption` is not set in the app's Info.plist. After verifying the exemption, the publisher can add the key with boolean `NO` in the signed release configuration or answer the submission questions in App Store Connect. If the portal requests documentation (including any territory-specific declaration), supply it before release.

## Age rating questionnaire

Use the current App Store Connect form; Apple assigns the final rating based on the answers and storefront.

| Prompt group | Suggested answer for this build |
| --- | --- |
| Unrestricted web access | **Yes (conservative)**: there is no general browser tab, but users can supply arbitrary HTTP(S) subscription-management URLs and follow links in the system browser view. Disclose that capability rather than claiming pre-screened destinations. |
| User-generated content / messaging and chat / advertising | **No**. Notes and images are stored for personal use, not published in an app community. iOS sharing is initiated by the user. No chat or ads are built in. |
| Parental controls / age assurance | **No**. The optional user PIN is a privacy lock, not parental controls or age verification. |
| Profanity or crude humor; horror/fear; alcohol, tobacco or drugs; sexual content or nudity | **None** in app-provided content. |
| Violence or weapons; simulated gambling; gambling; contests or loot boxes | **None / No**. The finance features are record-keeping and do not offer wagering, investment trading, or contests. |
| Medical, treatment, health or wellness information | **None / No**. An expense category does not provide medical advice. |

Confirm answers against [Apple's age rating values](https://developer.apple.com/help/app-store-connect/reference/age-ratings-values-and-definitions/) and the final signed build.
