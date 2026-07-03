// src/components/YouTubePlayer.jsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useMemo, useCallback, useState } from 'react';
import YouTube from 'react-youtube';
import { isCapacitorNativeEnvironment } from '../utils/capacitorEnvironment';

const CAPACITOR_YOUTUBE_ORIGIN = 'https://localhost';

const resolveYouTubeOrigin = () => {
    if (typeof window === 'undefined') return CAPACITOR_YOUTUBE_ORIGIN;

    const origin = window.location?.origin || '';
    if (origin === CAPACITOR_YOUTUBE_ORIGIN) return origin;

    const protocol = String(window.location?.protocol || '');
    if (protocol === 'capacitor:' || protocol === 'ionic:') return CAPACITOR_YOUTUBE_ORIGIN;

    return origin || CAPACITOR_YOUTUBE_ORIGIN;
};

const getIframeOriginParam = (iframeSrc) => {
    if (!iframeSrc) return '';

    try {
        return new URL(iframeSrc).searchParams.get('origin') || '';
    } catch (error) {
        return '';
    }
};

const YouTubePlayer = forwardRef(({ videoId, initialSeconds, onWatchedTick, onEnded }, ref) => {
    const playerRef = useRef(null);
    const timerRef = useRef(null);
    const [hasPlayerError, setHasPlayerError] = useState(false);
    const onWatchedTickRef = useRef(onWatchedTick);
    const onEndedRef = useRef(onEnded);

    useImperativeHandle(ref, () => ({
        getCurrentTime: () => playerRef.current?.getCurrentTime ? playerRef.current.getCurrentTime() : 0,
        seekTo: (seconds) => {
            if (playerRef.current?.seekTo) {
                playerRef.current.seekTo(seconds, true);
            }
        },
        getDuration: () => playerRef.current?.getDuration ? playerRef.current.getDuration() : 0,
    }), []);

    const youtubeOrigin = useMemo(() => resolveYouTubeOrigin(), []);
    const youtubeUrl = useMemo(() => `https://www.youtube.com/watch?v=${videoId}`, [videoId]);

    const opts = useMemo(() => {
        const playerVars = {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            controls: 1,
            playsinline: 1,
            enablejsapi: 1,
            origin: youtubeOrigin,
            loop: 1,
        };

        if (videoId) {
            playerVars.playlist = videoId;
        }

        return {
            height: '100%',
            width: '100%',
            playerVars,
        };
    }, [videoId, youtubeOrigin]);

    const stopWatcher = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startWatcher = useCallback(() => {
        stopWatcher();
        timerRef.current = setInterval(() => {
            if (playerRef.current?.getDuration && playerRef.current?.getCurrentTime && onWatchedTickRef.current) {
                const duration = playerRef.current.getDuration();
                const currentTime = playerRef.current.getCurrentTime();
                onWatchedTickRef.current(1, currentTime, duration);
            }
        }, 1000);
    }, [stopWatcher]);

    const onReady = useCallback((event) => {
        setHasPlayerError(false);
        playerRef.current = event.target;
        const iframeSrc = event.target?.getIframe?.()?.src || '';
        console.info('[YouTubePlayer] YouTube player ready', {
            videoId,
            origin: youtubeOrigin,
            iframeSrc,
            iframeOriginParam: getIframeOriginParam(iframeSrc),
            appOrigin: typeof window !== 'undefined' ? window.location.origin : '',
        });
        if (initialSeconds > 0) {
            event.target.seekTo(initialSeconds);
        }
    }, [initialSeconds, videoId, youtubeOrigin]);

    const onStateChange = useCallback((event) => {
        if (event.data === 1) {
            startWatcher();
            return;
        }

        stopWatcher();
        if (event.data === 0 && playerRef.current) {
            onEndedRef.current?.(
                playerRef.current.getCurrentTime?.() || 0,
                playerRef.current.getDuration?.() || 0,
            );
        }
    }, [startWatcher, stopWatcher]);

    useEffect(() => {
        onWatchedTickRef.current = onWatchedTick;
    }, [onWatchedTick]);

    useEffect(() => {
        onEndedRef.current = onEnded;
    }, [onEnded]);

    useEffect(() => {
        setHasPlayerError(false);
        playerRef.current = null;
        stopWatcher();
    }, [videoId, stopWatcher]);

    useEffect(() => stopWatcher, [stopWatcher]);

    const openInYouTube = useCallback(() => {
        const isNativeApp = isCapacitorNativeEnvironment();
        const openedWindow = window.open(
            youtubeUrl,
            '_blank',
            isNativeApp ? undefined : 'noopener,noreferrer'
        );

        if (!isNativeApp && openedWindow) {
            openedWindow.opener = null;
        }
    }, [youtubeUrl]);

    const onError = useCallback((event) => {
        console.warn('[YouTubePlayer] YouTube player error', {
            errorCode: event?.data,
            videoId,
            origin: youtubeOrigin,
            iframeSrc: event?.target?.getIframe?.()?.src || '',
            iframeOriginParam: getIframeOriginParam(event?.target?.getIframe?.()?.src || ''),
            appOrigin: typeof window !== 'undefined' ? window.location.origin : '',
        });

        stopWatcher();
        playerRef.current = null;
        setHasPlayerError(true);
    }, [videoId, youtubeOrigin, stopWatcher]);

    return (
        <div className="w-full h-full">
            {hasPlayerError ? (
                <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-gray-950 text-white text-center px-6 py-8">
                    <div className="max-w-sm space-y-4">
                        <p className="text-sm sm:text-base font-semibold leading-relaxed">
                            앱 내 재생이 제한된 영상입니다. YouTube에서 영상을 열어주세요.
                        </p>
                        <button
                            type="button"
                            onClick={openInYouTube}
                            className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-95"
                        >
                            YouTube에서 보기
                        </button>
                    </div>
                </div>
            ) : (
                <YouTube
                    videoId={videoId}
                    opts={opts}
                    onReady={onReady}
                    onStateChange={onStateChange}
                    onError={onError}
                    className="w-full h-full"
                    iframeClassName="w-full h-full"
                />
            )}
        </div>
    );
});

export default YouTubePlayer;
