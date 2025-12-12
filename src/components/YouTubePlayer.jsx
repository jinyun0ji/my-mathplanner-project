// src/components/YouTubePlayer.jsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import YouTube from 'react-youtube';

const YouTubePlayer = forwardRef(({ videoId, initialProgress, initialSeconds, onProgressUpdate }, ref) => {
    const playerRef = useRef(null);
    const timerRef = useRef(null);

    // 상위 컴포넌트(ClassroomView)에서 사용할 수 있도록 함수 노출
    useImperativeHandle(ref, () => ({
        getCurrentTime: () => {
            return playerRef.current ? playerRef.current.getCurrentTime() : 0;
        },
        seekTo: (seconds) => {
            if (playerRef.current) {
                playerRef.current.seekTo(seconds, true);
            }
        },
        getDuration: () => {
            return playerRef.current ? playerRef.current.getDuration() : 0;
        }
    }));

    // 플레이어 옵션 설정
    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,        // 자동 재생
            rel: 0,             // ✅ 관련 동영상 표시 제한 (내 채널 영상만 표시)
            modestbranding: 1,  // ✅ 유튜브 로고 최소화
            controls: 1,        // 컨트롤러 표시
            disablekb: 1,       // 키보드 컨트롤 비활성화 (선택)
            fs: 1,              // 전체화면 버튼 표시
        },
    };

    const onReady = (event) => {
        playerRef.current = event.target;
        
        // 이어보기 시간 설정 (초 단위)
        if (initialSeconds > 0) {
            event.target.seekTo(initialSeconds);
        }
    };

    const onStateChange = (event) => {
        // 재생 중(1)일 때만 진도율 체크 타이머 시작
        if (event.data === 1) {
            startProgressTimer();
        } else {
            stopProgressTimer();
        }
    };

    const startProgressTimer = () => {
        stopProgressTimer(); // 중복 방지
        timerRef.current = setInterval(() => {
            if (playerRef.current && onProgressUpdate) {
                const currentTime = playerRef.current.getCurrentTime();
                const duration = playerRef.current.getDuration();
                
                if (duration > 0) {
                    const percent = Math.floor((currentTime / duration) * 100);
                    onProgressUpdate(percent, currentTime);
                }
            }
        }, 5000); // 5초마다 진도율 저장
    };

    const stopProgressTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // 컴포넌트 언마운트 시 타이머 정리
    useEffect(() => {
        return () => stopProgressTimer();
    }, []);

    return (
        <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
            <YouTube
                videoId={videoId}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
                className="absolute top-0 left-0 w-full h-full"
                iframeClassName="w-full h-full"
            />
        </div>
    );
});

export default YouTubePlayer;