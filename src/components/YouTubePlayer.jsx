// src/components/YouTubePlayer.jsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import YouTube from 'react-youtube';

const YouTubePlayer = forwardRef(({ videoId, initialSeconds, onWatchedTick }, ref) => {
    const playerRef = useRef(null);
    const timerRef = useRef(null);

    // ✅ [핵심] 최신 콜백 함수를 유지하기 위한 ref
    const onWatchedTickRef = useRef(onWatchedTick);

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
            loop: 1,
            playlist: videoId,
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
        timerRef.current = setInterval(() => {
            // ✅ [수정] ref.current를 통해 항상 '최신' 함수 호출
            if (playerRef.current && onWatchedTickRef.current) {
                const duration = playerRef.current.getDuration();
                const currentTime = playerRef.current.getCurrentTime();
                onWatchedTickRef.current(1, currentTime, duration); 
            }
        }, 1000);
    };
    
    const stopWatcher = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // ✅ onWatchedTick이 바뀔 때마다(부모 리렌더링 시) ref 업데이트
    useEffect(() => {
        onWatchedTickRef.current = onWatchedTick;
    }, [onWatchedTick]);

    useImperativeHandle(ref, () => ({
        getCurrentTime: () => playerRef.current ? playerRef.current.getCurrentTime() : 0,
        seekTo: (seconds) => { if (playerRef.current) playerRef.current.seekTo(seconds, true); },
        getDuration: () => playerRef.current ? playerRef.current.getDuration() : 0
    }), []);

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