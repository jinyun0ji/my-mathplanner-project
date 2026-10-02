import Capacitor
import CapacitorPushNotifications
import UIKit

class NativeYouTubeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        if bridge?.plugin(withName: "PushNotifications") == nil {
            bridge?.registerPluginInstance(PushNotificationsPlugin())
        }
#if DEBUG
        if #available(iOS 16.4, *) {
            webView?.isInspectable = true
        }
#endif
        bridge?.registerPluginInstance(NativeYouTubePlugin())
        bridge?.registerPluginInstance(NativeGoogleAuthPlugin())
        bridge?.registerPluginInstance(NativeFcmTokenPlugin())
        print("[NativeYouTubePlugin] registered")
        print("[NativeGoogleAuthPlugin] registered")
        print("[NativeFcmTokenPlugin] registered")
    }
}
