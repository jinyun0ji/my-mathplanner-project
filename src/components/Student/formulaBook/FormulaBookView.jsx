import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    collection, doc, getDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../../../firebase/client';

const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('ko-KR');
const byOrderThenTitle = (a, b) => (
    (Number(a.order) || 0) - (Number(b.order) || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), 'ko')
);

const matchesSearch = (concept, normalizedQuery) => {
    if (!normalizedQuery) return true;
    const searchableValues = [
        concept.title,
        concept.summary,
        ...(Array.isArray(concept.tags) ? concept.tags : []),
        ...(Array.isArray(concept.keywords) ? concept.keywords : []),
    ];
    return searchableValues.some((value) => normalizeText(value).includes(normalizedQuery));
};

const buildNocookieEmbedUrl = (value) => {
    if (!value) return '';
    try {
        const url = new URL(value);
        const isYoutubeEmbed = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(url.hostname)
            && url.pathname.startsWith('/embed/');
        if (url.protocol !== 'https:' || !isYoutubeEmbed) return '';
        const videoId = url.pathname.split('/').filter(Boolean)[1] || '';
        if (!videoId) return '';
        const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
        embedUrl.searchParams.set('modestbranding', '1');
        embedUrl.searchParams.set('rel', '0');
        embedUrl.searchParams.set('playsinline', '1');
        return embedUrl.toString();
    } catch {
        return '';
    }
};

export default function FormulaBookView({ initialConceptId = '', onConceptHandled }) {
    const [subjects, setSubjects] = useState([]);
    const [concepts, setConcepts] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [selectedConcept, setSelectedConcept] = useState(null);
    const [search, setSearch] = useState('');
    const [isSubjectLoading, setIsSubjectLoading] = useState(true);
    const [isConceptLoading, setIsConceptLoading] = useState(false);
    const [error, setError] = useState('');
    const handledConceptIdRef = useRef('');

    useEffect(() => {
        let isMounted = true;
        const loadSubjects = async () => {
            try {
                const subjectSnapshot = await getDocs(collection(db, 'formulaSubjects'));
                if (!isMounted) return;
                setSubjects(subjectSnapshot.docs
                    .map((item) => ({ id: item.id, ...item.data() }))
                    .filter((item) => item.active !== false)
                    .sort(byOrderThenTitle));
            } catch (loadError) {
                console.error('[FormulaBookView] subject load failed', loadError);
                if (isMounted) setError('공식집 과목을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            } finally {
                if (isMounted) setIsSubjectLoading(false);
            }
        };
        loadSubjects();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!selectedSubjectId) {
            setConcepts([]);
            return undefined;
        }
        let isMounted = true;
        const loadConcepts = async () => {
            setIsConceptLoading(true);
            try {
                const conceptSnapshot = await getDocs(query(
                    collection(db, 'formulaConcepts'),
                    where('subjectId', '==', selectedSubjectId),
                ));
                if (!isMounted) return;
                setConcepts(conceptSnapshot.docs
                    .map((item) => ({ id: item.id, ...item.data() }))
                    .filter((item) => item.active !== false)
                    .sort(byOrderThenTitle));
            } catch (loadError) {
                console.error('[FormulaBookView] concept load failed', loadError);
                if (isMounted) setError('공식집 개념을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            } finally {
                if (isMounted) setIsConceptLoading(false);
            }
        };

        loadConcepts();
        return () => { isMounted = false; };
    }, [selectedSubjectId]);

    useEffect(() => {
        if (isSubjectLoading || !initialConceptId || handledConceptIdRef.current === initialConceptId) return;
        handledConceptIdRef.current = initialConceptId;
        const loadInitialConcept = async () => {
            try {
                const conceptSnapshot = await getDoc(doc(db, 'formulaConcepts', initialConceptId));
                const concept = conceptSnapshot.exists() ? { id: conceptSnapshot.id, ...conceptSnapshot.data() } : null;
                if (concept?.active !== false) {
                    setSelectedSubjectId(String(concept.subjectId || ''));
                    setSelectedConcept(concept);
                    onConceptHandled?.(true);
                    return;
                }
                onConceptHandled?.(false);
            } catch (loadError) {
                console.error('[FormulaBookView] initial concept load failed', loadError);
                onConceptHandled?.(false);
            }
        };
        loadInitialConcept();
    }, [initialConceptId, isSubjectLoading, onConceptHandled]);

    const normalizedQuery = normalizeText(search);
    const visibleConcepts = useMemo(() => concepts.filter((concept) => matchesSearch(concept, normalizedQuery)), [concepts, normalizedQuery]);
    const selectedSubject = subjects.find((item) => String(item.id) === String(selectedSubjectId));
    const embedUrl = useMemo(() => buildNocookieEmbedUrl(selectedConcept?.youtubeEmbedUrl), [selectedConcept?.youtubeEmbedUrl]);

    return (
        <section className="space-y-5">
            <div>
                <h2 className="mb-3 text-base font-extrabold text-gray-900">과목</h2>
                {isSubjectLoading && <div className="rounded-2xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-gray-500">공식집 과목을 불러오는 중입니다...</div>}
                {!isSubjectLoading && error && <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-8 text-center text-sm text-red-600">{error}</div>}
                {!isSubjectLoading && !error && (
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        {subjects.map((subject) => (
                            <button
                                key={subject.id}
                                type="button"
                                onClick={() => { setSelectedSubjectId(subject.id); setSelectedConcept(null); }}
                                className={`flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left text-sm last:border-b-0 ${selectedSubjectId === subject.id ? 'bg-[#eef2ff] text-[#455fab]' : 'text-gray-800'}`}
                            >
                                <span className="font-bold">{subject.title}</span>
                                <span className="text-xs text-gray-400">순서 {subject.order || 0}</span>
                            </button>
                        ))}
                        {subjects.length === 0 && <div className="px-4 py-8 text-center text-sm text-gray-500">등록된 과목이 없습니다.</div>}
                    </div>
                )}
            </div>

            {selectedSubjectId && (
                <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">⌕</span>
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="개념명, 태그, 요약 검색"
                        className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#455fab] focus:ring-2 focus:ring-[#455fab]/10"
                        aria-label="수학 공식 검색"
                    />
                </div>
            )}

            {selectedSubjectId && (
                <div>
                    <h2 className="mb-3 text-base font-extrabold text-gray-900">
                        {selectedSubject?.title || '선택한 과목'} 개념
                        <span className="ml-2 text-xs font-medium text-gray-400">{visibleConcepts.length}개</span>
                    </h2>
                    {isConceptLoading ? (
                        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-gray-500">개념을 불러오는 중입니다...</div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            {visibleConcepts.map((concept) => (
                                <button key={concept.id} type="button" onClick={() => setSelectedConcept(concept)} className="block w-full border-b border-gray-100 px-4 py-4 text-left last:border-b-0 hover:bg-gray-50">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="font-extrabold text-gray-900">{concept.title}</h3>
                                        <span className="text-xs text-gray-400">순서 {concept.order || 0}</span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{concept.summary || '요약 설명이 없습니다.'}</p>
                                    {Array.isArray(concept.tags) && concept.tags.length > 0 && <p className="mt-2 text-xs font-semibold text-[#455fab]">{concept.tags.map((tag) => `#${tag}`).join(' ')}</p>}
                                </button>
                            ))}
                            {visibleConcepts.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">조건에 맞는 개념이 없습니다.</div>}
                        </div>
                        )}
                </div>
            )}

            {!selectedSubjectId && !isSubjectLoading && !error && <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">과목을 선택하면 개념 목록을 불러옵니다.</div>}

            {selectedConcept && (
                <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="mb-1 text-xs font-bold text-[#455fab]">개념 상세</p>
                    <h2 className="text-xl font-extrabold text-gray-900">{selectedConcept.title}</h2>
                    {Array.isArray(selectedConcept.tags) && selectedConcept.tags.length > 0 && <p className="mt-2 text-xs font-semibold text-[#455fab]">{selectedConcept.tags.map((tag) => `#${tag}`).join(' ')}</p>}
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-700">{selectedConcept.summary || '등록된 설명이 없습니다.'}</p>
                    <div className="mt-5">
                        {embedUrl ? (
                            <div className="aspect-video overflow-hidden rounded-xl bg-black">
                                <iframe className="h-full w-full" src={embedUrl} title={`${selectedConcept.title} 설명 영상`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">재생 가능한 영상이 등록되지 않았습니다.</div>
                        )}
                    </div>
                </article>
            )}
        </section>
    );
}
