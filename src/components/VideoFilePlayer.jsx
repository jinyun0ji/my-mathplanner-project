// src/components/VideoFilePlayer.jsx
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

const VideoFilePlayer = forwardRef(({ src, initialSeconds = 0, onWatchedTick, onEnded }, ref) => {
    const videoRef = useRef(null);
    const timerRef = useRef(null);
    const hasAppliedInitialSeekRef = useRef(false);
    const onWatchedTickRef = useRef(onWatchedTick);
    const onEndedRef = useRef(onEnded);

    useImperativeHandle(ref, () => ({
        getCurrentTime: () => videoRef.current?.currentTime || 0,
        seekTo: (seconds) => {
            if (!videoRef.current) return;
            videoRef.current.currentTime = Math.max(0, Number(seconds) || 0);
        },
        getDuration: () => videoRef.current?.duration || 0,
    }), []);

    const stopWatcher = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const emitWatchedTick = useCallback((addedSeconds = 1) => {
        const video = videoRef.current;
        if (!video || !onWatchedTickRef.current) return;

        onWatchedTickRef.current(
            addedSeconds,
            video.currentTime || 0,
            Number.isFinite(video.duration) ? video.duration : 0,
        );
    }, []);

    const startWatcher = useCallback(() => {
        stopWatcher();
        timerRef.current = setInterval(() => emitWatchedTick(1), 1000);
    }, [emitWatchedTick, stopWatcher]);

    const handleLoadedMetadata = useCallback(() => {
        if (hasAppliedInitialSeekRef.current || !videoRef.current) return;

        const seekSeconds = Number(initialSeconds) || 0;
        if (seekSeconds > 0) {
            videoRef.current.currentTime = Math.max(0, seekSeconds);
        }
        hasAppliedInitialSeekRef.current = true;
    }, [initialSeconds]);

    const handleEnded = useCallback(() => {
        stopWatcher();
        emitWatchedTick(0);

        const video = videoRef.current;
        onEndedRef.current?.(
            video?.currentTime || 0,
            video && Number.isFinite(video.duration) ? video.duration : 0,
        );
    }, [emitWatchedTick, stopWatcher]);

    useEffect(() => {
        onWatchedTickRef.current = onWatchedTick;
    }, [onWatchedTick]);

    useEffect(() => {
        onEndedRef.current = onEnded;
    }, [onEnded]);

    useEffect(() => {
        hasAppliedInitialSeekRef.current = false;
        stopWatcher();
    }, [src, stopWatcher]);

    useEffect(() => stopWatcher, [stopWatcher]);

    return (
        <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full bg-black"
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={startWatcher}
            onPause={stopWatcher}
            onEnded={handleEnded}
        />
    );
});

export default VideoFilePlayer;
