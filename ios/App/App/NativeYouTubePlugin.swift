import Capacitor
import UIKit

struct NativeMemo {
    let id: String
    let time: Double
    var note: String
}

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
        let autoPlay = call.getBool("autoPlay") ?? false
        let memos = (call.getArray("memos", JSObject.self) ?? []).compactMap { item -> NativeMemo? in
            guard let note = item["note"] as? String else { return nil }
            let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedNote.isEmpty else { return nil }

            let id = (item["id"] as? String) ?? UUID().uuidString
            let time: Double
            if let numberTime = item["time"] as? NSNumber {
                time = numberTime.doubleValue
            } else if let doubleTime = item["time"] as? Double {
                time = doubleTime
            } else if let stringTime = item["time"] as? String, let parsedTime = Double(stringTime) {
                time = parsedTime
            } else {
                time = 0
            }

            return NativeMemo(id: id, time: max(0, time), note: trimmedNote)
        }

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
                autoPlay: autoPlay,
                memos: memos,
                onMemoAdded: { [weak self] memo in
                    print("[NativeYouTubePlugin] memo added: \(memo)")
                    self?.notifyListeners("youtubeMemoAdded", data: memo)
                },
                onMemoUpdated: { [weak self] memo in
                    print("[NativeYouTubePlugin] memo updated: \(memo)")
                    self?.notifyListeners("youtubeMemoUpdated", data: memo)
                },
                onMemoDeleted: { [weak self] memo in
                    print("[NativeYouTubePlugin] memo deleted: \(memo)")
                    self?.notifyListeners("youtubeMemoDeleted", data: memo)
                }
            )

            presenter.present(playerViewController, animated: true) {
                print("[NativeYouTubePlugin] presented")
                call.resolve()
            }
        }
    }
}
