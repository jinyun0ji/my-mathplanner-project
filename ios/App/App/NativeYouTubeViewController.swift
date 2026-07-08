import Capacitor
import UIKit

class NativeYouTubeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeYouTubePlugin())
        bridge?.registerPluginInstance(NativeGoogleAuthPlugin())
        print("[NativeYouTubePlugin] registered")
        print("[NativeGoogleAuthPlugin] registered")
    }
}
