import Capacitor
import UIKit

class NativeYouTubeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeYouTubePlugin())
        bridge?.registerPluginInstance(NativeGoogleAuthPlugin())
        bridge?.registerPluginInstance(NativeFcmTokenPlugin())
        print("[NativeYouTubePlugin] registered")
        print("[NativeGoogleAuthPlugin] registered")
        print("[NativeFcmTokenPlugin] registered")
    }
}
