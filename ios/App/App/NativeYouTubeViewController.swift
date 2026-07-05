import Capacitor
import UIKit

class NativeYouTubeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeYouTubePlugin())
        print("[NativeYouTubePlugin] registered")
    }
}
