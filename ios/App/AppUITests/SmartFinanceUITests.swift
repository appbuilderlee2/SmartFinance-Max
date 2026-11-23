import XCTest

final class SmartFinanceUITests: XCTestCase {
    private let app = XCUIApplication()
    private var web: XCUIElement { app.webViews.firstMatch }

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
        XCTAssertTrue(web.waitForExistence(timeout: 15))
        let start = web.buttons["開始使用"]
        let loaded = web.buttons.containing(NSPredicate(format: "label IN %@", ["開始使用", "總覽"])).firstMatch
        XCTAssertTrue(loaded.waitForExistence(timeout: 10))
        if start.exists { start.tap() }
        XCTAssertTrue(web.buttons["總覽"].waitForExistence(timeout: 10))
    }

    func testLedgerPersistsAndBackupCanBeShared() {
        tap("記帳")
        tap("輸入金額")
        tap("AC")
        let amount = Int.random(in: 1_000...9_999)
        for digit in String(amount) { tap(String(digit)) }
        tap("完成輸入")
        let category = web.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "餐飲")).firstMatch
        XCTAssertTrue(category.waitForExistence(timeout: 10), web.debugDescription)
        category.tap()
        tap("儲存")
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .decimal
        let formattedAmount = formatter.string(from: NSNumber(value: amount))!
        let savedAmount = web.buttons.matching(NSPredicate(
            format: "label BEGINSWITH %@ AND label ENDSWITH %@", "餐飲 ", " \(formattedAmount)"
        )).firstMatch
        XCTAssertTrue(savedAmount.waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        tap("總覽")
        tap("明細")
        XCTAssertTrue(savedAmount.waitForExistence(timeout: 10))
        tap("統計")
        XCTAssertTrue(web.buttons["匯出報告 CSV"].waitForExistence(timeout: 10))

        tap("設定")
        tap("資料與備份", prefix: true)
        tap("匯出 JSON")
        let sharedFile = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "smartfinance_backup_")).firstMatch
        XCTAssertTrue(sharedFile.waitForExistence(timeout: 10))
        let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Cancel"])).firstMatch
        let dismissRegion = app.otherElements["PopoverDismissRegion"].firstMatch
        if close.exists {
            close.tap()
        } else if dismissRegion.exists {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)).tap()
        }
        let sheet = app.navigationBars["UIActivityContentView"].firstMatch
        if !sheet.waitForNonExistence(timeout: 3) {
            let grabber = sheet.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.05))
            let bottom = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.95))
            grabber.press(forDuration: 0.05, thenDragTo: bottom)
        }
        XCTAssertTrue(sharedFile.waitForNonExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(web.staticTexts["已取消匯出，現有資料沒有改動。"].waitForExistence(timeout: 10), app.debugDescription)
    }

    func testNotificationPermissionAndScheduling() {
        tap("設定")
        tap("通知")
        XCTAssertTrue(web.staticTexts["通知"].waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts["系統通知權限"].waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts["即將發送的通知"].waitForExistence(timeout: 10))

        let enable = web.buttons["啟用 iPhone 通知"].firstMatch
        let test = web.buttons["發送測試通知"].firstMatch
        let loaded = NSPredicate { _, _ in (enable.exists && enable.isEnabled) || test.exists }
        expectation(for: loaded, evaluatedWith: nil)
        waitForExpectations(timeout: 15)
        if enable.exists {
            enable.tap()
            let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            let allow = springboard.alerts.buttons["Allow"].firstMatch
            if allow.waitForExistence(timeout: 5) { allow.tap() }

            let scheduled = web.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "已更新 iPhone 提醒（")).firstMatch
            XCTAssertTrue(scheduled.waitForExistence(timeout: 15), web.debugDescription)
            XCTAssertNotEqual(scheduled.label, "已更新 iPhone 提醒（0 項）。")
            tap("好")
        }
        XCTAssertTrue(web.staticTexts["已允許"].waitForExistence(timeout: 10))
        XCTAssertTrue(web.staticTexts["SmartFinance 記帳提醒"].waitForExistence(timeout: 10), web.debugDescription)
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "SmartFinance 通知"
        screenshot.lifetime = .keepAlways
        add(screenshot)
        tap("發送測試通知")
        XCTAssertTrue(web.staticTexts["測試通知已排程，約 5 秒後送達。"].waitForExistence(timeout: 10))
        tap("好")
        tap("關閉 iPhone 通知")
        XCTAssertTrue(web.staticTexts["已取消 iPhone 提醒。"].waitForExistence(timeout: 10))
        tap("好")
        XCTAssertTrue(web.staticTexts["暫無已排程通知"].waitForExistence(timeout: 10))
    }

    func testSubscriptionWebsiteOpensAndCanBeReopened() {
        tap("錢包")
        tap("新增錢包項目")
        tap("訂閱／定期項目")
        tap("自訂服務", prefix: true)
        tap("詳細資訊")
        let url = web.textFields["管理訂閱連結"].firstMatch
        XCTAssertTrue(url.waitForExistence(timeout: 10))
        url.tap()
        url.typeText("https://example.com\n")
        for _ in 0..<2 {
            let link = web.links["前往服務網站 ↗"].firstMatch
            XCTAssertTrue(link.waitForExistence(timeout: 10), app.debugDescription)
            link.tap()
            let address = app.buttons.matching(NSPredicate(format: "identifier == %@ AND value CONTAINS %@", "URL", "example.com")).firstMatch
            XCTAssertTrue(address.waitForExistence(timeout: 15), app.debugDescription)
            let close = app.buttons["Close"].firstMatch
            let done = close.exists ? close : app.buttons["Done"].firstMatch
            XCTAssertTrue(done.waitForExistence(timeout: 10), app.debugDescription)
            done.tap()
            if !address.waitForNonExistence(timeout: 3) {
                let frame = done.frame
                let origin = app.frame.origin
                app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(
                    dx: frame.midX - origin.x, dy: frame.midY - origin.y
                )).tap()
            }
            XCTAssertTrue(address.waitForNonExistence(timeout: 10), app.debugDescription)
            XCTAssertTrue(web.textFields["管理訂閱連結"].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
            XCTAssertTrue(web.links["前往服務網站 ↗"].firstMatch.isHittable, app.debugDescription)
        }
    }

    func testAppSwitcherPrivacySnapshots() {
        tap("設定")
        tap("安全與私隱", prefix: true)
        let setting = web.switches["App 切換器私隱遮罩"].firstMatch
        XCTAssertTrue(setting.waitForExistence(timeout: 10))
        for enabled in [false, true] {
            let expected = enabled ? "1" : "0"
            if setting.value as? String != expected { setting.tap() }
            XCTAssertEqual(setting.value as? String, expected)

            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.995)).press(
                forDuration: 0.02,
                thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55)),
                withVelocity: .slow,
                thenHoldForDuration: 0.7
            )
            let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            screenshot.name = enabled ? "Privacy on – App Switcher" : "Privacy off – App Switcher"
            screenshot.lifetime = .keepAlways
            add(screenshot)

            app.activate()
            XCTAssertTrue(setting.waitForExistence(timeout: 10))
            XCTAssertTrue(setting.isHittable)
        }
    }

    func testPinLocksOnRelaunchAndUnlocks() {
        tap("設定")
        tap("安全與私隱", prefix: true)
        tap("設定 PIN")
        enterPin("設定 App PIN")
        tap("下一步")
        enterPin("確認 PIN")
        tap("開啟 PIN 鎖")
        XCTAssertTrue(web.buttons["已開啟"].waitForExistence(timeout: 10))

        app.terminate()
        app.launch()
        let lock = web.staticTexts["SmartFinance 已鎖定"]
        XCTAssertTrue(lock.waitForExistence(timeout: 10))
        enterPin("解鎖 PIN")
        tap("解鎖")
        let unlocked = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: lock)
        XCTAssertEqual(XCTWaiter.wait(for: [unlocked], timeout: 10), .completed)

        tap("設定")
        tap("安全與私隱", prefix: true)
        tap("已開啟")
        enterPin("關閉 PIN 鎖")
        tap("驗證並關閉")
        XCTAssertTrue(web.buttons["設定 PIN"].waitForExistence(timeout: 10))
    }

    private func tap(_ label: String, prefix: Bool = false, file: StaticString = #filePath, line: UInt = #line) {
        let button = prefix
            ? web.buttons.containing(NSPredicate(format: "label BEGINSWITH %@", label)).firstMatch
            : web.buttons[label].firstMatch
        XCTAssertTrue(button.waitForExistence(timeout: 10), "Missing button: \(label)", file: file, line: line)
        button.tap()
    }

    private func enterPin(_ label: String, file: StaticString = #filePath, line: UInt = #line) {
        let field = web.secureTextFields[label].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), "Missing PIN field: \(label)", file: file, line: line)
        field.tap()
        if let value = field.value as? String, !value.isEmpty {
            field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: value.count))
        }
        if app.keys["2"].isHittable {
            for digit in "2468" { app.keys[String(digit)].tap() }
        } else {
            field.typeText("2468")
        }
    }
}
