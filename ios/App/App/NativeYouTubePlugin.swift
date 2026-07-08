import Capacitor
import UIKit

struct NativeMemo {
    let id: String
    let time: Double
    var note: String
}

struct NativeLessonVideo {
    let id: String
    let title: String
    let videoId: String
}

struct NativeLessonItem {
    let id: String
    let date: String
    let title: String
    let videosCount: Int
    let firstVideoId: String
    let canAccess: Bool
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

        let lessonVideos = (call.getArray("lessonVideos", JSObject.self) ?? []).compactMap { item -> NativeLessonVideo? in
            let id = (item["id"] as? String) ?? UUID().uuidString
            let title = (item["title"] as? String) ?? "영상"
            let rawVideoId = ((item["youtubeVideoId"] as? String) ?? (item["videoId"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !rawVideoId.isEmpty else { return nil }
            return NativeLessonVideo(id: id, title: title, videoId: rawVideoId)
        }
        let lessonList = (call.getArray("lessonList", JSObject.self) ?? []).compactMap { item -> NativeLessonItem? in
            guard let id = item["id"] as? String else { return nil }
            let title = (item["title"] as? String) ?? (item["progress"] as? String) ?? "강의"
            let date = (item["date"] as? String) ?? ""
            let count = (item["videosCount"] as? NSNumber)?.intValue ?? (item["videosCount"] as? Int) ?? 0
            let firstVideoId = ((item["firstVideoId"] as? String) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let locked = (item["locked"] as? Bool) ?? false
            let canAccess = (item["canAccess"] as? Bool) ?? !locked
            return NativeLessonItem(id: id, date: date, title: title, videosCount: count, firstVideoId: firstVideoId, canAccess: canAccess)
        }
        let currentLessonId = call.getString("currentLessonId") ?? ""

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
                currentLessonId: currentLessonId,
                lessonVideos: lessonVideos,
                lessonList: lessonList,
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
                },
                onVideoSelected: { [weak self] payload in
                    self?.notifyListeners("youtubeVideoSelected", data: payload)
                },
                onLessonSelected: { [weak self] payload in
                    self?.notifyListeners("youtubeLessonSelected", data: payload)
                }
            )

            presenter.present(playerViewController, animated: true) {
                print("[NativeYouTubePlugin] presented")
                call.resolve()
            }
        }
    }
}
