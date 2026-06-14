import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/client';
import FormulaConceptModal from './FormulaConceptModal';

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

export default function FormulaBookView({ initialConceptId = '', onConceptHandled }) {
    const [subjects, setSubjects] = useState([]);
    const [concepts, setConcepts] = useState([]);
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [selectedConcept, setSelectedConcept] = useState(null);
    const [search, setSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const handledConceptIdRef = useRef('');

    useEffect(() => {
        let isMounted = true;

        const loadFormulaBook = async () => {
            try {
                const [subjectSnapshot, conceptSnapshot] = await Promise.all([
                    getDocs(query(collection(db, 'formulaBookSubjects'), where('active', '==', true))),
                    getDocs(query(collection(db, 'formulaBookConcepts'), where('active', '==', true))),
                ]);
                if (!isMounted) return;

                setSubjects(subjectSnapshot.docs
                    .map((item) => ({ id: item.id, ...item.data() }))
                    .filter((item) => item.active !== false)
                    .sort(byOrderThenTitle));
                setConcepts(conceptSnapshot.docs
                    .map((item) => ({ id: item.id, ...item.data() }))
                    .filter((item) => item.active !== false)
                    .sort(byOrderThenTitle));
            } catch (loadError) {
                console.error('[FormulaBookView] load failed', loadError);
                if (isMounted) setError('공식집을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadFormulaBook();
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (isLoading || !initialConceptId || handledConceptIdRef.current === initialConceptId) return;

        const concept = concepts.find((item) => String(item.id) === String(initialConceptId));
        handledConceptIdRef.current = initialConceptId;
        if (concept) {
            setSelectedSubjectId(String(concept.subjectId || ''));
            setSelectedConcept(concept);
        }
        onConceptHandled?.(Boolean(concept));
    }, [concepts, initialConceptId, isLoading, onConceptHandled]);

    const normalizedQuery = normalizeText(search);
    const visibleConcepts = useMemo(() => concepts.filter((concept) => {
        const isInSubject = !selectedSubjectId || String(concept.subjectId) === String(selectedSubjectId);
        return isInSubject && matchesSearch(concept, normalizedQuery);
    }), [concepts, normalizedQuery, selectedSubjectId]);

    return (
        <section className="space-y-5">
            {/* TODO: QR 링크로 로그인 전 진입한 경우 conceptId를 저장하고 로그인 완료 후 복원 처리 */}
            <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-400">⌕</span>
                <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="개념명, 태그, 키워드, 요약 검색"
                    className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#455fab] focus:ring-2 focus:ring-[#455fab]/10"
                    aria-label="수학 공식 검색"
                />
            </div>

            {isLoading && (
                <div className="rounded-2xl border border-gray-100 bg-white px-4 py-12 text-center text-sm text-gray-500">
                    공식집을 불러오는 중입니다...
                </div>
            )}

            {!isLoading && error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-8 text-center text-sm text-red-600">
                    {error}
                </div>
            )}

            {!isLoading && !error && (
                <>
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-base font-extrabold text-gray-900">과목</h2>
                            {selectedSubjectId && (
                                <button type="button" onClick={() => setSelectedSubjectId('')} className="text-xs font-semibold text-[#455fab]">
                                    전체 보기
                                </button>
                            )}
                        </div>
                        {subjects.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {subjects.map((subject) => {
                                    const isSelected = String(selectedSubjectId) === String(subject.id);
                                    return (
                                        <button
                                            key={subject.id}
                                            type="button"
                                            onClick={() => setSelectedSubjectId(isSelected ? '' : subject.id)}
                                            className={`rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.98] ${
                                                isSelected
                                                    ? 'border-[#455fab] bg-[#455fab] text-white'
                                                    : 'border-gray-200 bg-white text-gray-900 hover:border-[#455fab]/40'
                                            }`}
                                        >
                                            <span className="block text-sm font-bold">{subject.title}</span>
                                            <span className={`mt-1 block text-xs ${isSelected ? 'text-white/75' : 'text-gray-400'}`}>
                                                개념 {concepts.filter((item) => String(item.subjectId) === String(subject.id)).length}개
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
                                등록된 과목이 없습니다.
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="mb-3 text-base font-extrabold text-gray-900">
                            {selectedSubjectId ? subjects.find((item) => String(item.id) === String(selectedSubjectId))?.title : '전체 개념'}
                            <span className="ml-2 text-xs font-medium text-gray-400">{visibleConcepts.length}개</span>
                        </h2>
                        {visibleConcepts.length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {visibleConcepts.map((concept) => (
                                    <article key={concept.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                        <h3 className="text-base font-extrabold text-gray-900">{concept.title}</h3>
                                        {Array.isArray(concept.tags) && concept.tags.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {concept.tags.map((tag) => (
                                                    <span key={tag} className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#455fab]">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="mt-3 flex-1 text-sm leading-6 text-gray-600">
                                            {concept.summary || '요약 설명이 없습니다.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedConcept(concept)}
                                            className="mt-4 w-full rounded-xl bg-[#455fab] px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
                                        >
                                            영상 보기
                                        </button>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
                                조건에 맞는 개념이 없습니다.
                            </div>
                        )}
                    </div>
                </>
            )}

            <FormulaConceptModal concept={selectedConcept} onClose={() => setSelectedConcept(null)} />
        </section>
    );
}
