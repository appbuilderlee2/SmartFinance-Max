import Capacitor
import SafariServices
import UIKit

final class FinanceBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RecoveryExportPlugin())
        bridge?.registerPluginInstance(ServiceWebsitePlugin())
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
