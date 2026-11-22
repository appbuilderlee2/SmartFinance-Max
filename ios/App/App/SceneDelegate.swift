import Capacitor
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var privacyCover: UIView?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard !connectionOptions.urlContexts.isEmpty || !connectionOptions.userActivities.isEmpty else { return }
        window?.rootViewController?.loadViewIfNeeded()
        self.scene(scene, openURLContexts: connectionOptions.urlContexts)
        for activity in connectionOptions.userActivities {
            self.scene(scene, continue: activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            var options: [UIApplication.OpenURLOptionsKey: Any] = [.openInPlace: context.options.openInPlace]
            options[.sourceApplication] = context.options.sourceApplication
            options[.annotation] = context.options.annotation
            _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: options)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
    }

    func sceneWillResignActive(_ scene: UIScene) {
        showPrivacyCover()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        showPrivacyCover()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        privacyCover?.removeFromSuperview()
        privacyCover = nil
    }

    private func showPrivacyCover() {
        guard let window, privacyCover == nil,
              UserDefaults.standard.object(forKey: AppSwitcherPrivacyPlugin.preferenceKey) as? Bool ?? true else { return }
        let cover = UIView(frame: window.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = UIColor(red: 15.0 / 255, green: 23.0 / 255, blue: 42.0 / 255, alpha: 1)
        cover.isOpaque = true

        if let path = Bundle.main.path(forResource: "icon-192", ofType: "png", inDirectory: "public") {
            let icon = UIImageView(image: UIImage(contentsOfFile: path))
            icon.contentMode = .scaleAspectFit
            icon.translatesAutoresizingMaskIntoConstraints = false
            cover.addSubview(icon)
            NSLayoutConstraint.activate([
                icon.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                icon.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
                icon.widthAnchor.constraint(equalToConstant: 88),
                icon.heightAnchor.constraint(equalTo: icon.widthAnchor)
            ])
        }
        window.addSubview(cover)
        privacyCover = cover
    }
}
