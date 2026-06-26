import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    collection, doc, getDoc, getDocs, query, where,
} from 'firebase/firestore';
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
    const conceptCacheRef = useRef(new Map());
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
        const cachedConcepts = conceptCacheRef.current.get(String(selectedSubjectId));
        if (cachedConcepts) {
            setConcepts(cachedConcepts);
            setIsConceptLoading(false);
            return undefined;
        }
        let isMounted = true;
        const loadConcepts = async () => {
            setIsConceptLoading(true);
            try {
                const conceptSnapshot = await getDocs(query(
                    collection(db, 'formulaConcepts'),
                    where('subjectId', '==', selectedSubjectId),
                    where('active', '==', true),
                ));
                if (!isMounted) return;
                const loadedConcepts = conceptSnapshot.docs
                    .map((item) => ({ id: item.id, ...item.data() }))
                    .filter((item) => item.active !== false)
                    .sort(byOrderThenTitle);
                conceptCacheRef.current.set(String(selectedSubjectId), loadedConcepts);
                setConcepts(loadedConcepts);
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
                    const subjectId = String(concept.subjectId || '');
                    setSelectedSubjectId(subjectId);
                    setSelectedConcept(concept);
                    if (subjectId && !conceptCacheRef.current.has(subjectId)) {
                        conceptCacheRef.current.set(subjectId, [concept]);
                        setConcepts([concept]);
                    }
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
                                className={`block w-full border-b border-gray-100 px-4 py-3 text-left text-sm last:border-b-0 ${selectedSubjectId === subject.id ? 'bg-[#eef2ff] text-[#455fab]' : 'text-gray-800'}`}
                            >
                                <span className="font-bold">{subject.title}</span>
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
                        {selectedSubject?.title || '선택한 과목'} · {visibleConcepts.length}개
                    </h2>
                    {isConceptLoading ? (
                        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-8 text-center text-sm text-gray-500">개념을 불러오는 중입니다...</div>
                    ) : (
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                            {visibleConcepts.map((concept) => (
                                <button key={concept.id} type="button" onClick={() => setSelectedConcept(concept)} className="block w-full border-b border-gray-100 px-4 py-2.5 text-left last:border-b-0 hover:bg-gray-50">
                                    <h3 className="text-sm font-extrabold text-gray-900">{concept.title}</h3>
                                    {Array.isArray(concept.tags) && concept.tags.length > 0 && <p className="mt-1 truncate text-xs font-semibold text-[#455fab]">{concept.tags.map((tag) => `#${tag}`).join(' ')}</p>}
                                </button>
                            ))}
                            {visibleConcepts.length === 0 && <div className="px-4 py-10 text-center text-sm text-gray-500">조건에 맞는 개념이 없습니다.</div>}
                        </div>
                        )}
                </div>
            )}

            {!selectedSubjectId && !isSubjectLoading && !error && <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">과목을 선택하면 개념 목록을 불러옵니다.</div>}

            <FormulaConceptModal concept={selectedConcept} onClose={() => setSelectedConcept(null)} />
        </section>
    );
}
