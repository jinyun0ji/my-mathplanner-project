import UIKit
import YouTubeiOSPlayerHelper

final class NativeYouTubePlayerViewController: UIViewController, YTPlayerViewDelegate {
    private let videoId: String
    private let startSeconds: Double
    private let playerView = YTPlayerView()

    init(videoId: String, startSeconds: Double = 0) {
        self.videoId = videoId
        self.startSeconds = max(0, startSeconds)
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

    func playerViewDidBecomeReady(_ playerView: YTPlayerView) {
        print("[NativeYouTubePlayerViewController] ready")
        if startSeconds > 0 {
            playerView.seek(toSeconds: Float(startSeconds), allowSeekAhead: true)
        }
    }

    func playerView(_ playerView: YTPlayerView, didChangeTo state: YTPlayerState) {
        print("[NativeYouTubePlayerViewController] state changed: \(state.rawValue)")
    }

    func playerView(_ playerView: YTPlayerView, receivedError error: YTPlayerError) {
        print("[NativeYouTubePlayerViewController] error: \(error.rawValue)")
    }

    func playerView(_ playerView: YTPlayerView, didPlayTime playTime: Float) {
        print("[NativeYouTubePlayerViewController] play time: \(playTime)")
    }
}
