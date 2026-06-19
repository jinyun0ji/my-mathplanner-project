import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, doc, getDocs, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import useAuth from '../auth/useAuth';
import { db } from '../firebase/client';

const SUBJECTS_COLLECTION = 'formulaSubjects';
const CONCEPTS_COLLECTION = 'formulaConcepts';
const emptySubject = { title: '', order: 0, active: true };
const emptyConcept = {
  subjectId: '', title: '', summary: '', tags: '', youtubeEmbedUrl: '', order: 0, active: true,
};
const sortItems = (items) => [...items].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

export const buildFormulaConceptQrPath = (conceptId) => `/classroom?mode=book&conceptId=${encodeURIComponent(conceptId)}`;
export const buildFormulaConceptQrUrl = (conceptId) => `${window.location.origin}${buildFormulaConceptQrPath(conceptId)}`;
export const buildQrImageUrl = (conceptId) => `https://api.qrserver.com/v1/create-qr-code/?size=640x640&format=png&data=${encodeURIComponent(buildFormulaConceptQrUrl(conceptId))}`;

const normalizeYoutubeEmbedUrl = (value) => {
  const raw = String(value || '').trim();
  const iframeSrc = raw.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  const input = iframeSrc || raw;
  try {
    const url = new URL(input);
    let videoId = '';
    if (url.hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    if (url.hostname.endsWith('youtube.com') || url.hostname.endsWith('youtube-nocookie.com')) {
      if (url.pathname.startsWith('/embed/')) videoId = url.pathname.split('/').filter(Boolean)[1] || '';
      if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
      if (url.pathname.startsWith('/shorts/')) videoId = url.pathname.split('/').filter(Boolean)[1] || '';
    }
    if (!/^[\w-]{6,}$/.test(videoId)) return '';
    return `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&playsinline=1`;
  } catch { return ''; }
};

export default function FormulaBookManagement() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [conceptForm, setConceptForm] = useState(emptyConcept);
  const [editingSubjectId, setEditingSubjectId] = useState('');
  const [editingConceptId, setEditingConceptId] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('');
  const [message, setMessage] = useState('');
  const [qrConcept, setQrConcept] = useState(null);

  const loadData = async () => {
    const [subjectSnapshot, conceptSnapshot] = await Promise.all([
      getDocs(collection(db, SUBJECTS_COLLECTION)),
      getDocs(collection(db, CONCEPTS_COLLECTION)),
    ]);
    setSubjects(sortItems(subjectSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
    setConcepts(sortItems(conceptSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
  };

  useEffect(() => { loadData().catch(() => setMessage('공식집 데이터를 불러오지 못했습니다.')); }, []);
  const subjectTitleMap = useMemo(() => Object.fromEntries(subjects.map((item) => [item.id, item.title])), [subjects]);
  const visibleConcepts = useMemo(() => concepts.filter((concept) => !selectedSubjectFilter || concept.subjectId === selectedSubjectFilter), [concepts, selectedSubjectFilter]);

  const saveSubject = async (event) => {
    event.preventDefault();
    const payload = { ...subjectForm, order: Number(subjectForm.order) || 0, updatedAt: serverTimestamp(), updatedBy: user?.uid || '' };
    if (editingSubjectId) await updateDoc(doc(db, SUBJECTS_COLLECTION, editingSubjectId), payload);
    else await addDoc(collection(db, SUBJECTS_COLLECTION), { ...payload, createdAt: serverTimestamp(), createdBy: user?.uid || '' });
    setSubjectForm(emptySubject); setEditingSubjectId(''); setMessage('과목을 저장했습니다.'); await loadData();
  };

  const saveConcept = async (event) => {
    event.preventDefault();
    const tags = String(conceptForm.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
    const youtubeEmbedUrl = normalizeYoutubeEmbedUrl(conceptForm.youtubeEmbedUrl);
    if (!youtubeEmbedUrl) { setMessage('올바른 YouTube URL 또는 iframe 코드를 입력해주세요.'); return; }
    const basePayload = {
      ...conceptForm, tags, youtubeEmbedUrl, order: Number(conceptForm.order) || 0, updatedAt: serverTimestamp(), updatedBy: user?.uid || '',
    };
    if (editingConceptId) {
      await updateDoc(doc(db, CONCEPTS_COLLECTION, editingConceptId), {
        ...basePayload, qrPath: buildFormulaConceptQrPath(editingConceptId),
      });
    } else {
      const created = await addDoc(collection(db, CONCEPTS_COLLECTION), {
        ...basePayload, qrPath: '', createdAt: serverTimestamp(), createdBy: user?.uid || '',
      });
      await updateDoc(created, { qrPath: buildFormulaConceptQrPath(created.id) });
    }
    setConceptForm(emptyConcept); setEditingConceptId(''); setMessage('개념을 저장했습니다.'); await loadData();
  };

  const deactivateSubject = async (subjectId) => { await updateDoc(doc(db, SUBJECTS_COLLECTION, subjectId), { active: false, updatedAt: serverTimestamp(), updatedBy: user?.uid || '' }); setMessage('과목을 비활성화했습니다.'); await loadData(); };
  const deactivateConcept = async (conceptId) => { await updateDoc(doc(db, CONCEPTS_COLLECTION, conceptId), { active: false, updatedAt: serverTimestamp(), updatedBy: user?.uid || '' }); setMessage('개념을 비활성화했습니다.'); await loadData(); };

  const downloadQrImage = async (concept) => {
    try {
      const response = await fetch(buildQrImageUrl(concept.id));
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `formula-${concept.id}-qr.png`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setMessage('QR 이미지를 다운로드했습니다.');
    } catch {
      window.open(buildQrImageUrl(concept.id), '_blank', 'noopener,noreferrer');
      setMessage('QR 이미지를 새 창으로 열었습니다. 이미지를 저장해주세요.');
    }
  };

  const fieldClass = 'mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm';
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-bold text-gray-900">공식집 관리</h1><p className="mt-1 text-sm text-gray-500">과목과 개념을 등록하고 QR 이미지를 생성/다운로드합니다.</p></div><div className="flex gap-2"><button type="button" onClick={() => { setEditingSubjectId(''); setSubjectForm(emptySubject); }} className="rounded-lg bg-[#455fab] px-4 py-2 text-sm font-bold text-white">과목 추가</button><button type="button" onClick={() => { setEditingConceptId(''); setConceptForm(emptyConcept); }} className="rounded-lg bg-[#455fab] px-4 py-2 text-sm font-bold text-white">개념 추가</button></div></div>
      {message && <p className="rounded-lg bg-[#f1f4ff] p-3 text-sm text-[#334a91]">{message}</p>}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-bold">과목</h2>
          <form onSubmit={saveSubject} className="mt-4 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm">과목명<input className={fieldClass} required value={subjectForm.title} onChange={(e) => setSubjectForm({ ...subjectForm, title: e.target.value })} /></label>
            <label className="text-sm">표시 순서<input className={fieldClass} type="number" value={subjectForm.order} onChange={(e) => setSubjectForm({ ...subjectForm, order: e.target.value })} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={subjectForm.active} onChange={(e) => setSubjectForm({ ...subjectForm, active: e.target.checked })} /> 활성</label>
            <button className="col-span-2 rounded-lg bg-[#455fab] p-2 text-sm font-bold text-white">{editingSubjectId ? '과목 수정' : '과목 추가'}</button>
          </form>
          <div className="mt-4 divide-y">{subjects.map((subject) => <div key={subject.id} className="flex items-center gap-2 py-3 text-sm"><button type="button" onClick={() => { setEditingSubjectId(subject.id); setSubjectForm({ title: subject.title || '', order: subject.order || 0, active: subject.active !== false }); }} className="min-w-0 flex-1 text-left"><span className="font-semibold">{subject.title}</span><span className="ml-2 text-gray-400">{subject.active === false ? '비활성' : '활성'} · {subject.order || 0}</span></button><button type="button" onClick={() => deactivateSubject(subject.id)} className="rounded-lg border px-2 py-1 text-xs font-semibold text-red-600">비활성화</button></div>)}</div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-bold">개념</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs"><button type="button" onClick={() => setSelectedSubjectFilter('')} className={`rounded-full border px-3 py-1 font-semibold ${!selectedSubjectFilter ? 'bg-[#455fab] text-white' : 'text-gray-600'}`}>전체 보기</button>{subjects.map((subject) => <button key={subject.id} type="button" onClick={() => setSelectedSubjectFilter(subject.id)} className={`rounded-full border px-3 py-1 font-semibold ${selectedSubjectFilter === subject.id ? 'bg-[#455fab] text-white' : 'text-gray-600'}`}>{subject.title}</button>)}</div>
          <form onSubmit={saveConcept} className="mt-4 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm">과목<select required className={fieldClass} value={conceptForm.subjectId} onChange={(e) => setConceptForm({ ...conceptForm, subjectId: e.target.value })}><option value="">선택</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}</select></label>
            <label className="col-span-2 text-sm">개념명<input required className={fieldClass} value={conceptForm.title} onChange={(e) => setConceptForm({ ...conceptForm, title: e.target.value })} /></label>
            <label className="col-span-2 text-sm">요약<textarea className={fieldClass} value={conceptForm.summary} onChange={(e) => setConceptForm({ ...conceptForm, summary: e.target.value })} /></label>
            <label className="col-span-2 text-sm">태그 (쉼표 구분)<input className={fieldClass} value={conceptForm.tags} onChange={(e) => setConceptForm({ ...conceptForm, tags: e.target.value })} /></label>
            <label className="col-span-2 text-sm">YouTube embed URL<input className={fieldClass} value={conceptForm.youtubeEmbedUrl} onChange={(e) => setConceptForm({ ...conceptForm, youtubeEmbedUrl: e.target.value })} /></label>
            <label className="text-sm">표시 순서<input type="number" className={fieldClass} value={conceptForm.order} onChange={(e) => setConceptForm({ ...conceptForm, order: e.target.value })} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={conceptForm.active} onChange={(e) => setConceptForm({ ...conceptForm, active: e.target.checked })} /> 활성</label>
            <button className="col-span-2 rounded-lg bg-[#455fab] p-2 text-sm font-bold text-white">{editingConceptId ? '개념 수정' : '개념 추가'}</button>
          </form>
          <div className="mt-4 divide-y">{visibleConcepts.map((concept) => <div key={concept.id} className="flex items-center gap-2 py-3 text-sm"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setEditingConceptId(concept.id); setConceptForm({ ...emptyConcept, ...concept, tags: Array.isArray(concept.tags) ? concept.tags.join(', ') : '' }); }}><b>{concept.title}</b><span className="ml-2 text-gray-400">{subjectTitleMap[concept.subjectId] || '과목 없음'} · {concept.active === false ? '비활성' : '활성'} · {concept.order || 0}</span><p className="mt-1 truncate text-xs text-gray-500">{concept.summary}</p><p className="mt-1 truncate text-xs text-gray-400">{concept.youtubeEmbedUrl}</p></button><button type="button" onClick={() => setQrConcept(concept)} className="rounded-lg border px-2 py-1 text-xs font-semibold text-[#455fab]">QR 생성</button><button type="button" onClick={() => deactivateConcept(concept.id)} className="rounded-lg border px-2 py-1 text-xs font-semibold text-red-600">비활성화</button></div>)}</div>
        </section>
      </div>
      {qrConcept && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setQrConcept(null)}>
          <section className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="formula-qr-title" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#455fab]">공식집 QR</p>
                <h2 id="formula-qr-title" className="mt-1 text-lg font-extrabold text-gray-900">{qrConcept.title}</h2>
              </div>
              <button type="button" onClick={() => setQrConcept(null)} className="rounded-full bg-gray-100 px-3 py-1 text-lg text-gray-500" aria-label="QR 닫기">×</button>
            </div>
            <img src={buildQrImageUrl(qrConcept.id)} alt={`${qrConcept.title} QR`} className="mx-auto mt-5 h-64 w-64 rounded-xl border border-gray-200" />
            <p className="mt-3 break-all rounded-lg bg-gray-50 p-3 text-xs text-gray-500">{buildFormulaConceptQrUrl(qrConcept.id)}</p>
            <button type="button" onClick={() => downloadQrImage(qrConcept)} className="mt-4 w-full rounded-lg bg-[#455fab] px-4 py-3 text-sm font-bold text-white">QR 다운로드</button>
          </section>
        </div>
      )}
    </div>
  );
}
