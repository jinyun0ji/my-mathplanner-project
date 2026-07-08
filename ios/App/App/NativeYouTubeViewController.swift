import Capacitor
import CodetrixStudioCapacitorGoogleAuth
import UIKit

class NativeYouTubeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeYouTubePlugin())
        bridge?.registerPluginInstance(GoogleAuth())
        print("[NativeYouTubePlugin] registered")
        print("[GoogleAuth] registered")
    }
}
