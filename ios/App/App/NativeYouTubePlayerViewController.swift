import UIKit
import YouTubeiOSPlayerHelper

final class NativeYouTubePlayerViewController: UIViewController, YTPlayerViewDelegate {
    private let videoId: String
    private let startSeconds: Double
    private let autoPlay: Bool
    private let playerView = YTPlayerView()
    private var latestPlayTime: Double
    private var memos: [NativeMemo]
    private let onMemoAdded: (([String: Any]) -> Void)?

    init(videoId: String, startSeconds: Double = 0, autoPlay: Bool = false, memos: [NativeMemo] = [], onMemoAdded: (([String: Any]) -> Void)? = nil) {
        self.videoId = videoId
        self.startSeconds = max(0, startSeconds)
        self.autoPlay = autoPlay
        self.latestPlayTime = max(0, startSeconds)
        self.memos = memos.sorted { $0.time < $1.time }
        self.onMemoAdded = onMemoAdded
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureCloseButton()
        configureMemoListButton()
        configureMemoButton()
        configurePlayerView()
        loadVideo()
    }

    private func configureCloseButton() {
        let closeButton = UIButton(type: .system)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setTitle("닫기", for: .normal)
        closeButton.setTitleColor(.white, for: .normal)
        closeButton.titleLabel?.font = .boldSystemFont(ofSize: 17)
        closeButton.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        closeButton.layer.cornerRadius = 18
        closeButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        view.addSubview(closeButton)

        NSLayoutConstraint.activate([
            closeButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            closeButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 16)
        ])
    }

    private func configureMemoListButton() {
        let memoListButton = UIButton(type: .system)
        memoListButton.translatesAutoresizingMaskIntoConstraints = false
        memoListButton.setTitle("메모 목록", for: .normal)
        memoListButton.setTitleColor(.white, for: .normal)
        memoListButton.titleLabel?.font = .boldSystemFont(ofSize: 17)
        memoListButton.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        memoListButton.layer.cornerRadius = 18
        memoListButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        memoListButton.addTarget(self, action: #selector(memoListTapped), for: .touchUpInside)
        view.addSubview(memoListButton)

        NSLayoutConstraint.activate([
            memoListButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 12),
            memoListButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16)
        ])
    }

    private func configureMemoButton() {
        let memoButton = UIButton(type: .system)
        memoButton.translatesAutoresizingMaskIntoConstraints = false
        memoButton.setTitle("메모", for: .normal)
        memoButton.setTitleColor(.white, for: .normal)
        memoButton.titleLabel?.font = .boldSystemFont(ofSize: 17)
        memoButton.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.85)
        memoButton.layer.cornerRadius = 18
        memoButton.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        memoButton.addTarget(self, action: #selector(memoTapped), for: .touchUpInside)
        view.addSubview(memoButton)

        NSLayoutConstraint.activate([
            memoButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            memoButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16)
        ])
    }

    private func configurePlayerView() {
        playerView.translatesAutoresizingMaskIntoConstraints = false
        playerView.delegate = self
        view.insertSubview(playerView, at: 0)

        NSLayoutConstraint.activate([
            playerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            playerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            playerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            playerView.heightAnchor.constraint(equalTo: playerView.widthAnchor, multiplier: 9.0 / 16.0)
        ])
    }

    private func loadVideo() {
        var playerVars: [String: Any] = [
            "playsinline": 1,
            "controls": 1,
            "rel": 0,
            "modestbranding": 1
        ]

        if startSeconds > 0 {
            playerVars["start"] = Int(startSeconds)
        }

        print("[NativeYouTubePlayerViewController] loading videoId=\(videoId), startSeconds=\(startSeconds)")
        playerView.load(withVideoId: videoId, playerVars: playerVars)
    }

    @objc private func closeTapped() {
        print("[NativeYouTubePlayerViewController] close tapped")
        dismiss(animated: true)
    }

    @objc private func memoListTapped() {
        let alert = UIAlertController(title: "메모 목록", message: memos.isEmpty ? "저장된 메모가 없습니다." : nil, preferredStyle: .actionSheet)

        for memo in memos.sorted(by: { $0.time < $1.time }) {
            let title = "\(formatTime(memo.time))   \(memo.note)"
            alert.addAction(UIAlertAction(title: title, style: .default) { [weak self] _ in
                self?.seekToMemo(memo)
            })
        }

        alert.addAction(UIAlertAction(title: "닫기", style: .cancel))
        if let popover = alert.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        present(alert, animated: true)
    }

    private func seekToMemo(_ memo: NativeMemo) {
        latestPlayTime = max(0, memo.time)
        playerView.seek(toSeconds: Float(memo.time), allowSeekAhead: true)
    }

    @objc private func memoTapped() {
        let currentTime = max(0, latestPlayTime)
        let alert = UIAlertController(title: "학습 메모", message: "현재 재생시간: \(formatTime(currentTime))", preferredStyle: .alert)
        alert.addTextField { textField in
            textField.placeholder = "메모를 입력하세요"
            textField.clearButtonMode = .whileEditing
        }
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        alert.addAction(UIAlertAction(title: "저장", style: .default) { [weak self, weak alert] _ in
            guard let self = self else { return }
            let note = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !note.isEmpty else { return }
            let newMemo = NativeMemo(id: UUID().uuidString, time: currentTime, note: note)
            self.memos.append(newMemo)
            self.memos.sort { $0.time < $1.time }
            self.onMemoAdded?([
                "videoId": self.videoId,
                "currentTime": currentTime,
                "note": note
            ])
        })
        present(alert, animated: true)
    }

    private func formatTime(_ seconds: Double) -> String {
        let totalSeconds = Int(seconds.rounded(.down))
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let secs = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }

        return String(format: "%d:%02d", minutes, secs)
    }

    func playerViewDidBecomeReady(_ playerView: YTPlayerView) {
        print("[NativeYouTubePlayerViewController] ready")
        if startSeconds > 0 {
            playerView.seek(toSeconds: Float(startSeconds), allowSeekAhead: true)
        }
        if autoPlay {
            playerView.playVideo()
        }
    }

    func playerView(_ playerView: YTPlayerView, didChangeTo state: YTPlayerState) {
        print("[NativeYouTubePlayerViewController] state changed: \(state.rawValue)")
    }

    func playerView(_ playerView: YTPlayerView, receivedError error: YTPlayerError) {
        print("[NativeYouTubePlayerViewController] error: \(error.rawValue)")
    }

    func playerView(_ playerView: YTPlayerView, didPlayTime playTime: Float) {
        latestPlayTime = Double(playTime)
        print("[NativeYouTubePlayerViewController] play time: \(playTime)")
    }
}
