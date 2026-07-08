import Capacitor
import Foundation
import GoogleSignIn
import UIKit

@objc(NativeGoogleAuthPlugin)
public class NativeGoogleAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeGoogleAuthPlugin"
    public let jsName = "NativeGoogleAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise)
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Plugin instance was released", "google-login/native-failed")
                return
            }

            guard let clientID = self.googleClientID() else {
                call.reject("Google client ID is unavailable", "google-login/native-failed")
                return
            }

            guard let presenter = self.presenterViewController() else {
                call.reject("Root view controller is unavailable", "google-login/native-failed")
                return
            }

            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
                if let error = error {
                    let nsError = error as NSError
                    if nsError.domain == kGIDSignInErrorDomain && nsError.code == -5 {
                        call.reject("Google sign in was cancelled", "google-login/cancelled", error)
                        return
                    }
                    call.reject(error.localizedDescription, "google-login/native-failed", error)
                    return
                }

                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    call.reject("Google id token is unavailable", "google-login/native-failed")
                    return
                }

                var response: JSObject = [
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString
                ]

                if let email = user.profile?.email {
                    response["email"] = email
                }
                if let name = user.profile?.name {
                    response["name"] = name
                }

                call.resolve(response)
            }
        }
    }

    private func googleClientID() -> String? {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let plist = NSDictionary(contentsOfFile: path),
              let clientID = plist["CLIENT_ID"] as? String,
              !clientID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return clientID
    }

    private func presenterViewController() -> UIViewController? {
        if let bridgeViewController = bridge?.viewController {
            return topViewController(from: bridgeViewController)
        }

        let rootViewController = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .rootViewController

        return topViewController(from: rootViewController)
    }

    private func topViewController(from viewController: UIViewController?) -> UIViewController? {
        if let navigationController = viewController as? UINavigationController {
            return topViewController(from: navigationController.visibleViewController)
        }

        if let tabBarController = viewController as? UITabBarController {
            return topViewController(from: tabBarController.selectedViewController)
        }

        if let presentedViewController = viewController?.presentedViewController {
            return topViewController(from: presentedViewController)
        }

        return viewController
    }
}
