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
        window.backgroundColor = UIColor(red: 26 / 255, green: 107 / 255, blue: 196 / 255, alpha: 1)
        window.rootViewController = bridge
        window.makeKeyAndVisible()
        self.window = window

        if let urlContext = connectionOptions.urlContexts.first {
            _ = ApplicationDelegateProxy.shared.application(
                UIApplication.shared,
                open: urlContext.url,
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
        _ = ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            open: urlContext.url,
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
