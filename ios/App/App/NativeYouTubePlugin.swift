import Capacitor
import UIKit

@objc(NativeYouTubePlugin)
public class NativeYouTubePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeYouTubePlugin"
    public let jsName = "NativeYouTube"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        print("[NativeYouTubePlugin] open requested")

        guard let videoId = call.getString("videoId"), !videoId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            let message = "videoId is required"
            print("[NativeYouTubePlugin] failed: \(message)")
            call.reject(message)
            return
        }

        let startSeconds = call.getDouble("startSeconds") ?? 0

        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                let message = "Plugin instance was released"
                print("[NativeYouTubePlugin] failed: \(message)")
                call.reject(message)
                return
            }

            guard let presenter = self.bridge?.viewController else {
                let message = "Root view controller is unavailable"
                print("[NativeYouTubePlugin] failed: \(message)")
                call.reject(message)
                return
            }

            let playerViewController = NativeYouTubePlayerViewController(
                videoId: videoId,
                startSeconds: startSeconds,
                onMemoAdded: { [weak self] memo in
                    print("[NativeYouTubePlugin] memo added: \(memo)")
                    self?.notifyListeners("youtubeMemoAdded", data: memo)
                }
            )

            presenter.present(playerViewController, animated: true) {
                print("[NativeYouTubePlugin] presented")
                call.resolve()
            }
        }
    }
}
