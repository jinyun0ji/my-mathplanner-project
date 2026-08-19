import Capacitor
import FirebaseMessaging
import Foundation

/// Converts the APNs registration completed by CapacitorPushNotifications into
/// the FCM registration token used by the server-side token registry.
@objc(NativeFcmTokenPlugin)
public class NativeFcmTokenPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeFcmTokenPlugin"
    public let jsName = "NativeFcmToken"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]

    @objc func getToken(_ call: CAPPluginCall) {
        Messaging.messaging().token { token, error in
            if let error = error {
                call.reject("FCM registration token is unavailable", "push/fcm-token-unavailable", error)
                return
            }
            guard let token = token, !token.isEmpty else {
                call.reject("FCM registration token is empty", "push/fcm-token-empty")
                return
            }
            call.resolve(["token": token])
        }
    }
}
