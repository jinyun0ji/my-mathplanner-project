// src/components/YouTubePlayer.jsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import YouTube from 'react-youtube';

const YouTubePlayer = forwardRef(({ videoId, initialSeconds, onWatchedTick }, ref) => {
    const playerRef = useRef(null);
    const timerRef = useRef(null);

    // 상위 컴포넌트에서 제어할 수 있는 함수 노출
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
    }), []);

    const opts = {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            controls: 1,
        },
    };

    const onReady = (event) => {
        playerRef.current = event.target;
        if (initialSeconds > 0) {
            event.target.seekTo(initialSeconds);
        }
    };

    const onStateChange = (event) => {
        // 재생 중(1)일 때 타이머 시작
        if (event.data === 1) {
            startWatcher();
        } else {
            stopWatcher();
        }
    };

    const startWatcher = () => {
        stopWatcher();
        // 1초마다 시청 시간 누적 이벤트 발생
        timerRef.current = setInterval(() => {
            if (playerRef.current && onWatchedTick) {
                const duration = playerRef.current.getDuration();
                const currentTime = playerRef.current.getCurrentTime();
                // 1초 단위로 부모에게 알림 (현재위치, 전체길이 전달)
                onWatchedTick(1, currentTime, duration); 
            }
        }, 1000);
    };

    const stopWatcher = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        return () => stopWatcher();
    }, []);

    return (
        <div className="w-full h-full">
            <YouTube
                videoId={videoId}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
                className="w-full h-full"
                iframeClassName="w-full h-full"
            />
        </div>
    );
});

export default YouTubePlayer;