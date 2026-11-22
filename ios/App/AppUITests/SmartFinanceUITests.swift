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
        let savedAmount = web.staticTexts.containing(NSPredicate(format: "label CONTAINS %@", formattedAmount)).firstMatch
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
        let sharedFile = app.staticTexts.containing(NSPredicate(format: "label BEGINSWITH %@", "smartfinance_backup_")).firstMatch
        XCTAssertTrue(sharedFile.waitForExistence(timeout: 10))
        let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Cancel"])).firstMatch
        if close.exists { close.tap() } else { app.swipeDown() }
        XCTAssertTrue(web.staticTexts["已取消匯出，現有資料沒有改動。"].waitForExistence(timeout: 10))
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
        XCTAssertTrue(web.staticTexts["SmartFinance 已鎖定"].waitForExistence(timeout: 10))
        enterPin("解鎖 PIN")
        tap("解鎖")

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
        field.typeText("2468")
    }
}
