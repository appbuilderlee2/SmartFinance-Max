import Capacitor
import SafariServices
import UIKit

final class FinanceBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RecoveryExportPlugin())
        bridge?.registerPluginInstance(ServiceWebsitePlugin())
        bridge?.registerPluginInstance(AppSwitcherPrivacyPlugin())
        bridge?.registerPluginInstance(NotificationSettingsPlugin())
    }
}

final class NotificationSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NotificationSettingsPlugin"
    let jsName = "NotificationSettings"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let path: String
            if #available(iOS 16.0, *) {
                path = UIApplication.openNotificationSettingsURLString
            } else {
                path = UIApplication.openSettingsURLString
            }
            guard let url = URL(string: path) else {
                call.reject("Unable to open iOS Settings")
                return
            }
            UIApplication.shared.open(url) { opened in
                if opened { call.resolve() } else { call.reject("Unable to open iOS Settings") }
            }
        }
    }
}

final class AppSwitcherPrivacyPlugin: CAPPlugin, CAPBridgedPlugin {
    static let preferenceKey = "hideInAppSwitcher"
    let identifier = "AppSwitcherPrivacyPlugin"
    let jsName = "AppSwitcherPrivacy"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "setEnabled", returnType: CAPPluginReturnPromise)]

    @objc func setEnabled(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing app switcher privacy preference")
            return
        }
        UserDefaults.standard.set(enabled, forKey: Self.preferenceKey)
        call.resolve()
    }
}

final class ServiceWebsitePlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "ServiceWebsitePlugin"
    let jsName = "ServiceWebsite"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]

    @objc func open(_ call: CAPPluginCall) {
        guard let value = call.getString("url"), let url = URL(string: value),
              let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme),
              let host = url.host, !host.isEmpty else {
            call.reject("Invalid website URL")
            return
        }
        DispatchQueue.main.async {
            if let presenter = self.bridge?.viewController,
               presenter.viewIfLoaded?.window?.windowScene?.activationState == .foregroundActive {
                if presenter.presentedViewController is SFSafariViewController {
                    call.resolve()
                    return
                }
                if presenter.presentedViewController == nil {
                    let browser = SFSafariViewController(url: url)
                    browser.modalPresentationStyle = .fullScreen
                    presenter.present(browser, animated: true) { call.resolve() }
                    return
                }
            }
            UIApplication.shared.open(url) { opened in
                if opened { call.resolve() } else { call.reject("Unable to open website URL") }
            }
        }
    }
}

final class RecoveryExportPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    let identifier = "RecoveryExportPlugin"
    let jsName = "RecoveryExport"
    let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)]
    private var pending: CAPPluginCall?

    @objc func save(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri"), let url = URL(string: uri), url.isFileURL,
              let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            call.reject("Missing backup file")
            return
        }
        let exports = cache.appendingPathComponent("smartfinance-exports").resolvingSymlinksInPath()
        let file = url.resolvingSymlinksInPath()
        guard file.path.hasPrefix(exports.path + "/"), file.pathExtension == "json" else {
            call.reject("Invalid backup file")
            return
        }
        DispatchQueue.main.async {
            guard self.pending == nil, let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("Another dialog is open")
                return
            }
            self.pending = call
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            picker.delegate = self
            presenter.present(picker, animated: true)
        }
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        complete(saved: !urls.isEmpty)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        complete(saved: false)
    }

    private func complete(saved: Bool) {
        let call = pending
        pending = nil
        call?.resolve(["saved": saved])
    }
}
