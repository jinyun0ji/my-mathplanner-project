// src/components/YouTubePlayer.jsx
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const YouTubePlayer = forwardRef(({ videoId, initialProgress, initialSeconds, onProgressUpdate }, ref) => {
    const playerRef = useRef(null);
    const containerRef = useRef(null);
    const intervalRef = useRef(null);
    const watchedSet = useRef(new Set()); 

    useImperativeHandle(ref, () => ({
        getCurrentTime: () => playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0,
        seekTo: (seconds) => playerRef.current?.seekTo ? playerRef.current.seekTo(seconds, true) : null
    }));

    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }

        const initPlayer = () => {
            if (!window.YT || !window.YT.Player) return;
            if (playerRef.current) return;

            playerRef.current = new window.YT.Player(containerRef.current, {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    playsinline: 1, modestbranding: 1, rel: 0, controls: 1, fs: 1, iv_load_policy: 3,
                },
                events: {
                    onReady: (event) => {
                        const duration = event.target.getDuration();
                        if (initialProgress > 0 && duration > 0) {
                            const watchedSeconds = Math.floor(duration * (initialProgress / 100));
                            for (let i = 0; i <= watchedSeconds; i++) watchedSet.current.add(i);
                        }
                        if (initialSeconds > 0 && initialSeconds < duration - 5) {
                            event.target.seekTo(initialSeconds, true);
                        }
                    },
                    onStateChange: (event) => {
                        if (event.data === window.YT.PlayerState.PLAYING) startTracking();
                        else stopTracking();
                    }
                }
            });
        };

        if (window.YT && window.YT.Player) initPlayer();
        else window.onYouTubeIframeAPIReady = initPlayer;

        return () => stopTracking();
    }, [videoId]); // videoId 변경 시 재초기화

    const startTracking = () => {
        stopTracking();
        intervalRef.current = setInterval(() => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                const current = Math.floor(playerRef.current.getCurrentTime()); 
                const total = Math.floor(playerRef.current.getDuration());      
                if (total > 0) {
                    watchedSet.current.add(current);
                    const percent = Math.min(100, Math.floor((watchedSet.current.size / total) * 100));
                    onProgressUpdate(percent, current);
                }
            }
        }, 1000); 
    };

    const stopTracking = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    return <div ref={containerRef} className="w-full h-full rounded-xl" />;
});

export default YouTubePlayer;