import UIKit
import YouTubeiOSPlayerHelper

final class NativeYouTubePlayerViewController: UIViewController, YTPlayerViewDelegate, UIGestureRecognizerDelegate {
    private var videoId: String
    private var startSeconds: Double
    private let autoPlay: Bool
    private let playerView = YTPlayerView()
    private var latestPlayTime: Double
    private var memos: [NativeMemo]
    private var currentLessonId: String
    private let lessonVideos: [NativeLessonVideo]
    private let lessonList: [NativeLessonItem]
    private let onVideoSelected: (([String: Any]) -> Void)?
    private let onLessonSelected: (([String: Any]) -> Void)?
    private let onMemoAdded: (([String: Any]) -> Void)?
    private let onMemoUpdated: (([String: Any]) -> Void)?
    private let onMemoDeleted: (([String: Any]) -> Void)?
    private weak var activeOverlayView: UIView?
    private weak var activeEditPanelBottomConstraint: NSLayoutConstraint?

    init(videoId: String, startSeconds: Double = 0, autoPlay: Bool = false, memos: [NativeMemo] = [], currentLessonId: String = "", lessonVideos: [NativeLessonVideo] = [], lessonList: [NativeLessonItem] = [], onMemoAdded: (([String: Any]) -> Void)? = nil, onMemoUpdated: (([String: Any]) -> Void)? = nil, onMemoDeleted: (([String: Any]) -> Void)? = nil, onVideoSelected: (([String: Any]) -> Void)? = nil, onLessonSelected: (([String: Any]) -> Void)? = nil) {
        self.videoId = videoId
        self.startSeconds = max(0, startSeconds)
        self.autoPlay = autoPlay
        self.latestPlayTime = max(0, startSeconds)
        self.memos = memos.sorted { $0.time < $1.time }
        self.currentLessonId = currentLessonId
        self.lessonVideos = lessonVideos
        self.lessonList = lessonList
        self.onVideoSelected = onVideoSelected
        self.onLessonSelected = onLessonSelected
        self.onMemoAdded = onMemoAdded
        self.onMemoUpdated = onMemoUpdated
        self.onMemoDeleted = onMemoDeleted
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureTopControlsStack()
        configurePlayerView()
        configureMemoButton()
        loadVideo()
    }

    private func configureTopControlsStack() {
        let closeButton = makeOverlayPillButton(title: "닫기")
        closeButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)

        let memoListButton = makeOverlayPillButton(title: "메모 목록")
        memoListButton.addTarget(self, action: #selector(memoListTapped), for: .touchUpInside)

        let videoListButton = makeOverlayPillButton(title: "영상 목록")
        videoListButton.addTarget(self, action: #selector(videoListTapped), for: .touchUpInside)

        let lessonListButton = makeOverlayPillButton(title: "강의 목록")
        lessonListButton.addTarget(self, action: #selector(lessonListTapped), for: .touchUpInside)

        let topControlsStack = UIStackView(arrangedSubviews: [closeButton, videoListButton, lessonListButton, memoListButton])
        topControlsStack.translatesAutoresizingMaskIntoConstraints = false
        topControlsStack.axis = .horizontal
        topControlsStack.alignment = .center
        topControlsStack.distribution = .equalSpacing
        view.addSubview(topControlsStack)

        NSLayoutConstraint.activate([
            topControlsStack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 18),
            topControlsStack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            topControlsStack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            closeButton.heightAnchor.constraint(equalToConstant: 40),
            memoListButton.heightAnchor.constraint(equalTo: closeButton.heightAnchor)
        ])
    }

    private func makeOverlayPillButton(title: String, backgroundColor: UIColor = UIColor.black.withAlphaComponent(0.55)) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle(title, for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.titleLabel?.font = .boldSystemFont(ofSize: 13)
        button.backgroundColor = backgroundColor
        button.layer.cornerRadius = 20
        button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 14, bottom: 8, right: 14)
        return button
    }

    private func configureMemoButton() {
        let memoButton = UIButton(type: .system)
        memoButton.translatesAutoresizingMaskIntoConstraints = false
        memoButton.setTitle("메모", for: .normal)
        memoButton.setTitleColor(.white, for: .normal)
        memoButton.titleLabel?.font = .boldSystemFont(ofSize: 16)
        memoButton.backgroundColor = UIColor.systemBlue
        memoButton.layer.cornerRadius = 22
        memoButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 18, bottom: 10, right: 18)
        memoButton.addTarget(self, action: #selector(memoTapped), for: .touchUpInside)
        view.addSubview(memoButton)

        NSLayoutConstraint.activate([
            memoButton.topAnchor.constraint(equalTo: playerView.bottomAnchor, constant: 24),
            memoButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            memoButton.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            memoButton.heightAnchor.constraint(equalToConstant: 44)
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
        showMemoListOverlay()
    }

    @objc private func videoListTapped() {
        dismissActiveOverlay(animated: false)
        let overlay = makeDimmingOverlay()
        let panel = makeRoundedPanel()
        let contentStack = makeScrollableListSheet(title: "영상 목록", in: panel)
        if lessonVideos.isEmpty {
            contentStack.addArrangedSubview(makeInfoLabel("영상 목록이 없습니다."))
        } else {
            lessonVideos.forEach { item in
                let isCurrent = item.videoId == videoId
                let subtitle = isCurrent ? "현재 재생 중" : "탭하여 영상 재생"
                let row = makeListCard(title: item.title, subtitle: subtitle, isCurrent: isCurrent, isEnabled: true)
                row.addAction(UIAction { [weak self] _ in
                    self?.selectVideo(item)
                }, for: .touchUpInside)
                contentStack.addArrangedSubview(row)
            }
        }
        presentListSheet(overlay: overlay, panel: panel)
    }

    @objc private func lessonListTapped() {
        dismissActiveOverlay(animated: false)
        let overlay = makeDimmingOverlay()
        let panel = makeRoundedPanel()
        let contentStack = makeScrollableListSheet(title: "강의 목록", in: panel)
        if lessonList.isEmpty {
            contentStack.addArrangedSubview(makeInfoLabel("강의 목록이 없습니다."))
        } else {
            lessonList.forEach { item in
                let isCurrent = item.id == currentLessonId
                let subtitle = item.canAccess
                    ? "\(item.date) · 영상 \(item.videosCount)개"
                    : "\(item.date) · 출결 확인 후 시청 가능"
                let row = makeListCard(title: item.title, subtitle: subtitle, isCurrent: isCurrent, isEnabled: item.canAccess && !item.firstVideoId.isEmpty)
                row.addAction(UIAction { [weak self] _ in
                    self?.selectLesson(item)
                }, for: .touchUpInside)
                contentStack.addArrangedSubview(row)
            }
        }
        presentListSheet(overlay: overlay, panel: panel)
    }

    private func makeScrollableListSheet(title: String, in panel: UIView) -> UIStackView {
        let titleLabel = makePanelTitle(title)
        let closeButton = makeTextButton(title: "닫기", titleColor: .secondaryLabel)
        closeButton.addTarget(self, action: #selector(dismissOverlayTapped), for: .touchUpInside)

        let headerStack = UIStackView(arrangedSubviews: [titleLabel, closeButton])
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        headerStack.axis = .horizontal
        headerStack.alignment = .center
        headerStack.distribution = .equalSpacing

        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = true
        scrollView.contentInset = UIEdgeInsets(top: 0, left: 0, bottom: 8, right: 0)

        let contentStack = UIStackView()
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 10
        scrollView.addSubview(contentStack)

        panel.addSubview(headerStack)
        panel.addSubview(scrollView)

        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 18),
            headerStack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 20),
            headerStack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -20),

            scrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 14),
            scrollView.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 14),
            scrollView.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -14),
            scrollView.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -16),

            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor)
        ])

        return contentStack
    }

    private func makeListCard(title: String, subtitle: String, isCurrent: Bool, isEnabled: Bool) -> UIControl {
        let row = UIControl()
        row.translatesAutoresizingMaskIntoConstraints = false
        row.backgroundColor = isCurrent ? UIColor.systemBlue.withAlphaComponent(0.10) : UIColor.systemBackground
        row.layer.cornerRadius = 16
        row.layer.cornerCurve = .continuous
        row.layer.borderWidth = isCurrent ? 1.5 : 1
        row.layer.borderColor = (isCurrent ? UIColor.systemBlue : UIColor.separator).cgColor
        row.clipsToBounds = true
        row.isEnabled = isEnabled
        row.alpha = isEnabled ? 1 : 0.45
        row.accessibilityTraits = isEnabled ? [.button] : [.button, .notEnabled]
        row.accessibilityLabel = "\(title), \(subtitle)\(isCurrent ? ", 현재 재생 중" : "")"

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.textColor = isCurrent ? .systemBlue : .label
        titleLabel.font = .systemFont(ofSize: 16, weight: .semibold)
        titleLabel.numberOfLines = 2
        titleLabel.lineBreakMode = .byTruncatingTail

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.text = subtitle
        subtitleLabel.textColor = .secondaryLabel
        subtitleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        subtitleLabel.numberOfLines = 1

        let checkLabel = UILabel()
        checkLabel.translatesAutoresizingMaskIntoConstraints = false
        checkLabel.text = isCurrent ? "✓" : ""
        checkLabel.textColor = .white
        checkLabel.font = .boldSystemFont(ofSize: 14)
        checkLabel.textAlignment = .center
        checkLabel.backgroundColor = isCurrent ? .systemBlue : .clear
        checkLabel.layer.cornerRadius = 11
        checkLabel.clipsToBounds = true

        row.addSubview(titleLabel)
        row.addSubview(subtitleLabel)
        row.addSubview(checkLabel)

        NSLayoutConstraint.activate([
            row.heightAnchor.constraint(greaterThanOrEqualToConstant: 74),
            titleLabel.topAnchor.constraint(equalTo: row.topAnchor, constant: 14),
            titleLabel.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: checkLabel.leadingAnchor, constant: -12),
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 5),
            subtitleLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            subtitleLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            subtitleLabel.bottomAnchor.constraint(lessThanOrEqualTo: row.bottomAnchor, constant: -14),
            checkLabel.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -16),
            checkLabel.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            checkLabel.widthAnchor.constraint(equalToConstant: 22),
            checkLabel.heightAnchor.constraint(equalToConstant: 22)
        ])

        return row
    }

    private func presentListSheet(overlay: UIView, panel: UIView) {
        view.addSubview(overlay)
        overlay.addSubview(panel)
        activeOverlayView = overlay
        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            panel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 12),
            panel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            panel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            panel.heightAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.heightAnchor, multiplier: 0.78),
            panel.heightAnchor.constraint(greaterThanOrEqualToConstant: 180)
        ])
        animateOverlayIn(overlay: overlay, panel: panel)
    }

    private func selectVideo(_ item: NativeLessonVideo) {
        videoId = item.videoId
        startSeconds = 0
        latestPlayTime = 0
        memos = []
        onVideoSelected?(["id": item.id, "videoId": item.videoId, "youtubeVideoId": item.videoId])
        dismissActiveOverlay(animated: true)
        loadVideo()
    }

    private func selectLesson(_ item: NativeLessonItem) {
        guard item.canAccess, !item.firstVideoId.isEmpty else { return }
        currentLessonId = item.id
        videoId = item.firstVideoId
        startSeconds = 0
        latestPlayTime = 0
        memos = []
        onLessonSelected?(["lessonId": item.id, "videoId": item.firstVideoId])
        dismissActiveOverlay(animated: true)
        loadVideo()
    }

    private func makeSimpleSheet(title: String, in panel: UIView) -> UIStackView {
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 10
        panel.addSubview(stack)
        let header = makePanelTitle(title)
        stack.addArrangedSubview(header)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: panel.bottomAnchor, constant: -24)
        ])
        return stack
    }

    private func makeInfoLabel(_ text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textColor = .secondaryLabel
        return label
    }

    private func presentSheet(overlay: UIView, panel: UIView) {
        view.addSubview(overlay)
        overlay.addSubview(panel)
        activeOverlayView = overlay
        NSLayoutConstraint.activate([
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            panel.leadingAnchor.constraint(equalTo: overlay.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: overlay.trailingAnchor),
            panel.bottomAnchor.constraint(equalTo: overlay.bottomAnchor),
            panel.heightAnchor.constraint(lessThanOrEqualTo: overlay.heightAnchor, multiplier: 0.55)
        ])
        animateOverlayIn(overlay: overlay, panel: panel)
    }


    private func showMemoListOverlay() {
        dismissActiveOverlay(animated: false)

        let overlay = makeDimmingOverlay()
        let panel = makeRoundedPanel()
        let titleLabel = makePanelTitle("메모 목록")
        let closeButton = makeTextButton(title: "닫기", titleColor: .secondaryLabel)
        closeButton.addTarget(self, action: #selector(dismissOverlayTapped), for: .touchUpInside)

        let headerStack = UIStackView(arrangedSubviews: [titleLabel, closeButton])
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        headerStack.axis = .horizontal
        headerStack.alignment = .center
        headerStack.distribution = .equalSpacing

        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = true

        let contentStack = UIStackView()
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.spacing = 8
        scrollView.addSubview(contentStack)

        let sortedMemos = memos.sorted(by: { $0.time < $1.time })
        if sortedMemos.isEmpty {
            let emptyLabel = UILabel()
            emptyLabel.text = "저장된 메모가 없습니다."
            emptyLabel.textColor = .secondaryLabel
            emptyLabel.font = .systemFont(ofSize: 15, weight: .medium)
            emptyLabel.textAlignment = .center
            contentStack.addArrangedSubview(emptyLabel)
        } else {
            sortedMemos.forEach { memo in
                contentStack.addArrangedSubview(makeMemoRow(for: memo))
            }
        }

        view.addSubview(overlay)
        overlay.addSubview(panel)
        panel.addSubview(headerStack)
        panel.addSubview(scrollView)
        activeOverlayView = overlay

        let scrollHeightConstraint: NSLayoutConstraint
        if sortedMemos.isEmpty {
            scrollHeightConstraint = scrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: 72)
        } else {
            scrollHeightConstraint = scrollView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.38)
        }

        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 14),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -14),
            panel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10),
            panel.heightAnchor.constraint(lessThanOrEqualTo: view.heightAnchor, multiplier: 0.52),

            headerStack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 18),
            headerStack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 18),
            headerStack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -18),

            scrollView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 14),
            scrollView.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 14),
            scrollView.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -14),
            scrollView.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -16),
            scrollHeightConstraint,

            contentStack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            contentStack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            contentStack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            contentStack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            contentStack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor)
        ])

        animateOverlayIn(overlay: overlay, panel: panel)
    }

    private func makeMemoRow(for memo: NativeMemo) -> UIControl {
        let row = UIControl()
        row.translatesAutoresizingMaskIntoConstraints = false
        row.backgroundColor = UIColor.secondarySystemBackground.withAlphaComponent(0.95)
        row.layer.cornerRadius = 14
        row.clipsToBounds = true
        row.accessibilityLabel = "\(formatTime(memo.time)) 메모 \(memo.note)"

        let badgeLabel = UILabel()
        badgeLabel.translatesAutoresizingMaskIntoConstraints = false
        badgeLabel.text = formatTime(memo.time)
        badgeLabel.textColor = .white
        badgeLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .bold)
        badgeLabel.textAlignment = .center
        badgeLabel.backgroundColor = UIColor.systemBlue.withAlphaComponent(0.9)
        badgeLabel.layer.cornerRadius = 10
        badgeLabel.clipsToBounds = true

        let noteLabel = UILabel()
        noteLabel.translatesAutoresizingMaskIntoConstraints = false
        noteLabel.text = memo.note
        noteLabel.textColor = .label
        noteLabel.font = .systemFont(ofSize: 14, weight: .medium)
        noteLabel.numberOfLines = 2
        noteLabel.lineBreakMode = .byTruncatingTail

        row.addSubview(badgeLabel)
        row.addSubview(noteLabel)
        row.addAction(UIAction { [weak self] _ in
            self?.showMemoActions(for: memo)
        }, for: .touchUpInside)

        NSLayoutConstraint.activate([
            row.heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
            badgeLabel.leadingAnchor.constraint(equalTo: row.leadingAnchor, constant: 12),
            badgeLabel.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            badgeLabel.widthAnchor.constraint(greaterThanOrEqualToConstant: 56),
            badgeLabel.heightAnchor.constraint(equalToConstant: 24),

            noteLabel.leadingAnchor.constraint(equalTo: badgeLabel.trailingAnchor, constant: 12),
            noteLabel.trailingAnchor.constraint(equalTo: row.trailingAnchor, constant: -12),
            noteLabel.topAnchor.constraint(equalTo: row.topAnchor, constant: 8),
            noteLabel.bottomAnchor.constraint(equalTo: row.bottomAnchor, constant: -8)
        ])

        return row
    }

    private func showMemoActions(for memo: NativeMemo) {
        let alert = UIAlertController(title: formatTime(memo.time), message: memo.note, preferredStyle: .actionSheet)
        alert.addAction(UIAlertAction(title: "해당 시간으로 이동", style: .default) { [weak self] _ in
            self?.dismissActiveOverlay(animated: true)
            self?.seekToMemo(memo)
        })
        alert.addAction(UIAlertAction(title: "수정", style: .default) { [weak self] _ in
            self?.showEditMemoOverlay(for: memo)
        })
        alert.addAction(UIAlertAction(title: "삭제", style: .destructive) { [weak self] _ in
            self?.showDeleteMemoConfirmation(for: memo)
        })
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        if let popover = alert.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        present(alert, animated: true)
    }

    private func showEditMemoOverlay(for memo: NativeMemo) {
        showMemoInputOverlay(title: "메모 수정", time: memo.time, initialNote: memo.note) { [weak self] note in
            guard let self = self else { return }
            guard let index = self.memos.firstIndex(where: { $0.id == memo.id }) else { return }
            self.memos[index].note = note
            self.memos.sort { $0.time < $1.time }
            self.onMemoUpdated?([
                "id": memo.id,
                "videoId": self.videoId,
                "time": memo.time,
                "note": note
            ])
        }
    }

    private func showMemoInputOverlay(title: String, time: Double, initialNote: String = "", onSave: @escaping (String) -> Void) {
        dismissActiveOverlay(animated: false)

        let overlay = makeDimmingOverlay()
        let panel = makeRoundedPanel()
        let titleLabel = makePanelTitle(title)
        let timeLabel = UILabel()
        timeLabel.translatesAutoresizingMaskIntoConstraints = false
        timeLabel.text = "재생시간: \(formatTime(time))"
        timeLabel.textColor = .secondaryLabel
        timeLabel.font = .systemFont(ofSize: 14, weight: .medium)

        let textView = UITextView()
        textView.translatesAutoresizingMaskIntoConstraints = false
        textView.text = initialNote
        textView.font = .systemFont(ofSize: 16)
        textView.textColor = .label
        textView.backgroundColor = .secondarySystemBackground
        textView.layer.cornerRadius = 14
        textView.textContainerInset = UIEdgeInsets(top: 12, left: 10, bottom: 12, right: 10)

        let cancelButton = makeTextButton(title: "취소", titleColor: .secondaryLabel)
        cancelButton.addTarget(self, action: #selector(dismissOverlayTapped), for: .touchUpInside)

        let saveButton = makeTextButton(title: "저장", titleColor: .systemBlue)
        saveButton.addAction(UIAction { [weak self, weak textView] _ in
            guard let self = self else { return }
            let note = textView?.text.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !note.isEmpty else { return }
            onSave(note)
            self.dismissActiveOverlay(animated: true)
        }, for: .touchUpInside)

        let buttonStack = UIStackView(arrangedSubviews: [cancelButton, saveButton])
        buttonStack.translatesAutoresizingMaskIntoConstraints = false
        buttonStack.axis = .horizontal
        buttonStack.alignment = .center
        buttonStack.distribution = .equalSpacing

        view.addSubview(overlay)
        overlay.addSubview(panel)
        [titleLabel, timeLabel, textView, buttonStack].forEach(panel.addSubview)
        activeOverlayView = overlay

        let bottomConstraint = panel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -10)
        activeEditPanelBottomConstraint = bottomConstraint
        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 18),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -18),
            bottomConstraint,
            titleLabel.topAnchor.constraint(equalTo: panel.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -20),
            timeLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            timeLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            timeLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            textView.topAnchor.constraint(equalTo: timeLabel.bottomAnchor, constant: 16),
            textView.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            textView.heightAnchor.constraint(equalToConstant: 112),
            buttonStack.topAnchor.constraint(equalTo: textView.bottomAnchor, constant: 16),
            buttonStack.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            buttonStack.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            buttonStack.bottomAnchor.constraint(equalTo: panel.bottomAnchor, constant: -18)
        ])

        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillChangeFrame(_:)), name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
        animateOverlayIn(overlay: overlay, panel: panel)
        textView.becomeFirstResponder()
    }

    private func showDeleteMemoConfirmation(for memo: NativeMemo) {
        let alert = UIAlertController(title: "메모 삭제", message: "이 메모를 삭제하시겠어요?", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "취소", style: .cancel))
        alert.addAction(UIAlertAction(title: "삭제", style: .destructive) { [weak self] _ in
            guard let self = self else { return }
            self.memos.removeAll { $0.id == memo.id }
            self.dismissActiveOverlay(animated: true)
            self.onMemoDeleted?([
                "id": memo.id,
                "videoId": self.videoId,
                "time": memo.time,
                "note": memo.note
            ])
        })
        present(alert, animated: true)
    }

    private func seekToMemo(_ memo: NativeMemo) {
        latestPlayTime = max(0, memo.time)
        playerView.seek(toSeconds: Float(memo.time), allowSeekAhead: true)
    }

    @objc private func memoTapped() {
        let currentTime = max(0, latestPlayTime)
        showMemoInputOverlay(title: "학습 메모", time: currentTime) { [weak self] note in
            guard let self = self else { return }
            let newMemo = NativeMemo(id: UUID().uuidString, time: currentTime, note: note)
            self.memos.append(newMemo)
            self.memos.sort { $0.time < $1.time }
            self.onMemoAdded?([
                "videoId": self.videoId,
                "currentTime": currentTime,
                "note": note
            ])
        }
    }

    private func makeDimmingOverlay() -> UIView {
        let overlay = UIView()
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = UIColor.black.withAlphaComponent(0.42)
        overlay.alpha = 0
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(dismissOverlayTapped))
        tapGesture.delegate = self
        overlay.addGestureRecognizer(tapGesture)
        return overlay
    }

    private func makeRoundedPanel() -> UIView {
        let panel = UIView()
        panel.translatesAutoresizingMaskIntoConstraints = false
        panel.backgroundColor = .systemBackground
        panel.layer.cornerRadius = 24
        panel.layer.cornerCurve = .continuous
        panel.layer.shadowColor = UIColor.black.cgColor
        panel.layer.shadowOpacity = 0.22
        panel.layer.shadowRadius = 18
        panel.layer.shadowOffset = CGSize(width: 0, height: -4)
        return panel
    }

    private func makePanelTitle(_ title: String) -> UILabel {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = title
        label.textColor = .label
        label.font = .boldSystemFont(ofSize: 18)
        return label
    }

    private func makeTextButton(title: String, titleColor: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle(title, for: .normal)
        button.setTitleColor(titleColor, for: .normal)
        button.titleLabel?.font = .boldSystemFont(ofSize: 16)
        button.contentEdgeInsets = UIEdgeInsets(top: 8, left: 10, bottom: 8, right: 10)
        return button
    }

    private func animateOverlayIn(overlay: UIView, panel: UIView) {
        panel.transform = CGAffineTransform(translationX: 0, y: 32)
        UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseOut]) {
            overlay.alpha = 1
            panel.transform = .identity
        }
    }

    @objc private func dismissOverlayTapped() {
        dismissActiveOverlay(animated: true)
    }

    private func dismissActiveOverlay(animated: Bool) {
        NotificationCenter.default.removeObserver(self, name: UIResponder.keyboardWillChangeFrameNotification, object: nil)
        NotificationCenter.default.removeObserver(self, name: UIResponder.keyboardWillHideNotification, object: nil)
        activeEditPanelBottomConstraint = nil
        guard let overlay = activeOverlayView else { return }
        activeOverlayView = nil
        view.endEditing(true)

        let animations = {
            overlay.alpha = 0
            overlay.subviews.first?.transform = CGAffineTransform(translationX: 0, y: 24)
        }

        let completion: (Bool) -> Void = { _ in
            overlay.removeFromSuperview()
        }

        if animated {
            UIView.animate(withDuration: 0.18, delay: 0, options: [.curveEaseIn], animations: animations, completion: completion)
        } else {
            animations()
            completion(true)
        }
    }

    @objc private func keyboardWillChangeFrame(_ notification: Notification) {
        guard let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        let convertedFrame = view.convert(keyboardFrame, from: nil)
        let overlap = max(0, view.bounds.maxY - convertedFrame.minY - view.safeAreaInsets.bottom)
        activeEditPanelBottomConstraint?.constant = -(overlap + 10)
        animateKeyboardChange(notification)
    }

    @objc private func keyboardWillHide(_ notification: Notification) {
        activeEditPanelBottomConstraint?.constant = -10
        animateKeyboardChange(notification)
    }

    private func animateKeyboardChange(_ notification: Notification) {
        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval ?? 0.25
        let curveRaw = notification.userInfo?[UIResponder.keyboardAnimationCurveUserInfoKey] as? UInt ?? UIView.AnimationOptions.curveEaseInOut.rawValue
        UIView.animate(withDuration: duration, delay: 0, options: UIView.AnimationOptions(rawValue: curveRaw << 16)) {
            self.view.layoutIfNeeded()
        }
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

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        guard let overlay = activeOverlayView else { return true }
        let location = touch.location(in: overlay)
        return !overlay.subviews.contains { subview in
            subview.frame.contains(location)
        }
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
