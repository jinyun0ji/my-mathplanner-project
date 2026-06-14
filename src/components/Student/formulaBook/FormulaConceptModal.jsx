import React, { useEffect, useMemo } from 'react';
import ModalPortal from '../../common/ModalPortal';

const buildEmbedUrl = (value) => {
    if (!value) return '';

    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || !url.pathname.startsWith('/embed/')) {
            return '';
        }
        url.searchParams.set('rel', '0');
        url.searchParams.set('playsinline', '1');
        return url.toString();
    } catch {
        return '';
    }
};

export default function FormulaConceptModal({ concept, onClose }) {
    const embedUrl = useMemo(() => buildEmbedUrl(concept?.youtubeEmbedUrl), [concept?.youtubeEmbedUrl]);

    useEffect(() => {
        if (!concept) return undefined;

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [concept, onClose]);

    if (!concept) return null;

    return (
        <ModalPortal>
            <div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
                onClick={onClose}
                role="presentation"
            >
                <section
                    className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="formula-concept-title"
                >
                    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4">
                        <div>
                            <p className="mb-1 text-xs font-bold text-[#455fab]">수학 공식집</p>
                            <h2 id="formula-concept-title" className="text-xl font-extrabold text-gray-900">
                                {concept.title}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                            aria-label="개념 상세 닫기"
                        >
                            ×
                        </button>
                    </header>

                    <div className="space-y-5 p-5">
                        {Array.isArray(concept.tags) && concept.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {concept.tags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold text-[#455fab]">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div>
                            <h3 className="mb-2 text-sm font-bold text-gray-900">개념 설명</h3>
                            <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">
                                {concept.description || concept.summary || '등록된 설명이 없습니다.'}
                            </p>
                        </div>

                        <div>
                            <h3 className="mb-2 text-sm font-bold text-gray-900">영상</h3>
                            {embedUrl ? (
                                <div className="aspect-video overflow-hidden rounded-xl bg-black">
                                    <iframe
                                        className="h-full w-full"
                                        src={embedUrl}
                                        title={`${concept.title} 설명 영상`}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                                    재생 가능한 영상이 등록되지 않았습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </ModalPortal>
    );
}
