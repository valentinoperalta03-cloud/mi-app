import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let bridge = CAPBridgeViewController()
        let window = UIWindow(windowScene: windowScene)
        window.backgroundColor = UIColor(red: 5 / 255, green: 133 / 255, blue: 252 / 255, alpha: 1)
        window.rootViewController = bridge
        window.makeKeyAndVisible()
        self.window = window

        if let urlContext = connectionOptions.urlContexts.first {
            let url = urlContext.url
            storePendingOAuthCallbackIfNeeded(url)
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: url,
                options: openURLOptions(from: urlContext.options)
            )
        }

        for userActivity in connectionOptions.userActivities {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                continue: userActivity,
                restorationHandler: { _ in }
            )
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
    }

    func sceneWillResignActive(_ scene: UIScene) {
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let urlContext = URLContexts.first else { return }
        let url = urlContext.url
        storePendingOAuthCallbackIfNeeded(url)
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: url,
            options: openURLOptions(from: urlContext.options)
        )
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }

    private func storePendingOAuthCallbackIfNeeded(_ url: URL) {
        guard url.absoluteString.hasPrefix("com.padelibre.app://auth-callback") else { return }
        // @capacitor/preferences stores keys as CapacitorStorage.<key> in UserDefaults.
        UserDefaults.standard.set(url.absoluteString, forKey: "CapacitorStorage.pendingOAuthCallback")
    }

    private func openURLOptions(from options: UIScene.OpenURLOptions) -> [UIApplication.OpenURLOptionsKey: Any] {
        var result: [UIApplication.OpenURLOptionsKey: Any] = [:]
        if let sourceApplication = options.sourceApplication {
            result[.sourceApplication] = sourceApplication
        }
        if let annotation = options.annotation {
            result[.annotation] = annotation
        }
        result[.openInPlace] = options.openInPlace
        return result
    }
}
