import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, doc, getDocs, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import useAuth from '../auth/useAuth';
import { db } from '../firebase/client';

const SUBJECTS_COLLECTION = 'formulaBookSubjects';
const CONCEPTS_COLLECTION = 'formulaBookConcepts';
const emptySubject = { title: '', order: 0, active: true };
const emptyConcept = {
  subjectId: '', title: '', summary: '', description: '', tags: '', youtubeEmbedUrl: '', order: 0, active: true,
};
const sortItems = (items) => [...items].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

export const buildFormulaConceptQrPath = (conceptId) => `/classroom?mode=formula&conceptId=${encodeURIComponent(conceptId)}`;
export const buildFormulaConceptQrUrl = (conceptId) => `${window.location.origin}${buildFormulaConceptQrPath(conceptId)}`;

export default function FormulaBookManagement() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [conceptForm, setConceptForm] = useState(emptyConcept);
  const [editingSubjectId, setEditingSubjectId] = useState('');
  const [editingConceptId, setEditingConceptId] = useState('');
  const [message, setMessage] = useState('');

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
    const basePayload = {
      ...conceptForm, tags, order: Number(conceptForm.order) || 0, updatedAt: serverTimestamp(), updatedBy: user?.uid || '',
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

  const fieldClass = 'mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm';
  return (
    <div className="space-y-6 p-4 md:p-8">
      <div><h1 className="text-2xl font-bold text-gray-900">공식집 관리</h1><p className="mt-1 text-sm text-gray-500">과목과 개념을 등록하고 QR 진입 링크를 관리합니다.</p></div>
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
          <div className="mt-4 divide-y">{subjects.map((subject) => <button type="button" key={subject.id} onClick={() => { setEditingSubjectId(subject.id); setSubjectForm({ title: subject.title || '', order: subject.order || 0, active: subject.active !== false }); }} className="flex w-full justify-between py-3 text-left text-sm"><span>{subject.title}</span><span className="text-gray-400">{subject.active === false ? '비활성' : '활성'} · {subject.order || 0}</span></button>)}</div>
        </section>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-bold">개념</h2>
          <form onSubmit={saveConcept} className="mt-4 grid grid-cols-2 gap-3">
            <label className="col-span-2 text-sm">과목<select required className={fieldClass} value={conceptForm.subjectId} onChange={(e) => setConceptForm({ ...conceptForm, subjectId: e.target.value })}><option value="">선택</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.title}</option>)}</select></label>
            <label className="col-span-2 text-sm">개념명<input required className={fieldClass} value={conceptForm.title} onChange={(e) => setConceptForm({ ...conceptForm, title: e.target.value })} /></label>
            <label className="col-span-2 text-sm">요약<textarea className={fieldClass} value={conceptForm.summary} onChange={(e) => setConceptForm({ ...conceptForm, summary: e.target.value })} /></label>
            <label className="col-span-2 text-sm">상세 설명<textarea rows="4" className={fieldClass} value={conceptForm.description} onChange={(e) => setConceptForm({ ...conceptForm, description: e.target.value })} /></label>
            <label className="col-span-2 text-sm">태그 (쉼표 구분)<input className={fieldClass} value={conceptForm.tags} onChange={(e) => setConceptForm({ ...conceptForm, tags: e.target.value })} /></label>
            <label className="col-span-2 text-sm">YouTube embed URL<input className={fieldClass} value={conceptForm.youtubeEmbedUrl} onChange={(e) => setConceptForm({ ...conceptForm, youtubeEmbedUrl: e.target.value })} /></label>
            <label className="text-sm">표시 순서<input type="number" className={fieldClass} value={conceptForm.order} onChange={(e) => setConceptForm({ ...conceptForm, order: e.target.value })} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={conceptForm.active} onChange={(e) => setConceptForm({ ...conceptForm, active: e.target.checked })} /> 활성</label>
            <button className="col-span-2 rounded-lg bg-[#455fab] p-2 text-sm font-bold text-white">{editingConceptId ? '개념 수정' : '개념 추가'}</button>
          </form>
          <div className="mt-4 divide-y">{concepts.map((concept) => <div key={concept.id} className="flex items-center gap-2 py-3 text-sm"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setEditingConceptId(concept.id); setConceptForm({ ...emptyConcept, ...concept, tags: Array.isArray(concept.tags) ? concept.tags.join(', ') : '' }); }}><b>{concept.title}</b><span className="ml-2 text-gray-400">{subjectTitleMap[concept.subjectId] || '과목 없음'}</span></button><button type="button" onClick={() => navigator.clipboard.writeText(buildFormulaConceptQrUrl(concept.id)).then(() => setMessage('QR 링크를 복사했습니다.'))} className="rounded-lg border px-2 py-1 text-xs font-semibold text-[#455fab]">QR 링크 복사</button></div>)}</div>
        </section>
      </div>
    </div>
  );
}
