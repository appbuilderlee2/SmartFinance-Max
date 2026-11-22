import Capacitor
import UIKit

final class FinanceBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RecoveryExportPlugin())
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
