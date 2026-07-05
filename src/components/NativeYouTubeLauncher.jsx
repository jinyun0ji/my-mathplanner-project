import React, { useCallback, useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';

const NativeYouTube = registerPlugin('NativeYouTube');
console.log("NativeYouTube =", NativeYouTube);

export default function NativeYouTubeLauncher({ videoId, initialSeconds = 0 }) {
    const [failed, setFailed] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const [debugLines, setDebugLines] = useState([]);

    const addDebug = useCallback((message, data) => {
        const formattedData = data === undefined
            ? ''
            : ` ${typeof data === 'string' ? data : JSON.stringify(data)}`;
        const line = `${new Date().toLocaleTimeString()} ${message}${formattedData}`;
        setDebugLines((lines) => [...lines, line]);
        console.log(`[NativeYouTubeLauncher] ${message}`, data ?? '');
    }, []);

    useEffect(() => {
        addDebug('videoId', videoId || '(empty)');
        addDebug('initialSeconds', initialSeconds || 0);
        addDebug('typeof NativeYouTube.open', typeof NativeYouTube.open);
        addDebug('window.location.href', window.location.href);
        addDebug('window.Capacitor exists', Boolean(window.Capacitor));
    }, [addDebug, initialSeconds, videoId]);

    const openNativePlayer = async () => {
        console.log("button clicked");
        addDebug('button clicked');

        if (!videoId || isOpening) return;
        setIsOpening(true);
        setFailed(false);

        try {
            console.log("calling plugin");
            addDebug('calling NativeYouTube.open', {
                videoId,
                startSeconds: initialSeconds || 0,
            });
            await NativeYouTube.open({
                videoId,
                startSeconds: initialSeconds || 0,
            });
            addDebug('open resolved');
            console.info('[NativeYouTubeLauncher] native player opened', { videoId });
        } catch (error) {
            const errorMessage = error?.message || String(error);
            addDebug(`open failed: ${errorMessage}`);
            console.error('[NativeYouTubeLauncher] native player failed', error);
            setFailed(true);
        } finally {
            setIsOpening(false);
        }
    };

    const openInYouTube = () => {
        if (!videoId) return;
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    };

    return (
        <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center bg-black text-white text-center px-6 py-8">
            <div className="max-w-sm space-y-4">
                <p className="text-sm sm:text-base font-semibold leading-relaxed">
                    iOS 앱 내 YouTube 플레이어 실험을 실행합니다.
                </p>
                <button
                    type="button"
                    onClick={openNativePlayer}
                    disabled={isOpening || !videoId}
                    className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-600"
                >
                    {isOpening ? '여는 중...' : '앱 내 플레이어로 재생'}
                </button>
                {failed && (
                    <button
                        type="button"
                        onClick={openInYouTube}
                        className="block mx-auto rounded-full border border-white/70 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white hover:text-black"
                    >
                        YouTube에서 보기
                    </button>
                )}
            </div>
            {debugLines.length > 0 && (
                <div className="mt-6 w-full max-w-sm rounded-lg bg-white/10 p-3 text-left font-mono text-[10px] leading-relaxed text-white/80">
                    {debugLines.map((line, index) => (
                        <div key={`${line}-${index}`}>{line}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
