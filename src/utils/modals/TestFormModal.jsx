// src/utils/modals/TestFormModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal } from '../../components/common/Modal';
import { Icon } from '../../utils/helpers';
import StaffNotificationFields from '../../components/Shared/StaffNotificationFields';

const DIFFICULTY_OPTIONS = ['하', '중', '상', '최상'];
const TYPE_OPTIONS = ['개념', '계산', '응용', '심화', '서술형'];

export const TestFormModal = ({
  isOpen,
  onClose,
  onSave,
  onReset,
  classId,
  test = null,
  classes,
  calculateClassSessions,
}) => {
  const selectedClass = classes.find((c) => String(c.id) === String(classId));
  const sessions = useMemo(
    () => (selectedClass ? calculateClassSessions(selectedClass) : []),
    [selectedClass, calculateClassSessions]
  );

  const [editingTestId, setEditingTestId] = useState(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [totalQuestions, setTotalQuestions] = useState(20);
  const [questionScores, setQuestionScores] = useState([]); // 문항별 배점
  const [questionAnalysis, setQuestionAnalysis] = useState([]); // 문항 분석

  const [staffNotifyMode, setStaffNotifyMode] = useState('none');
  const [staffNotifyTitle, setStaffNotifyTitle] = useState('');
  const [staffNotifyBody, setStaffNotifyBody] = useState('');
  const [staffNotifyScheduledAt, setStaffNotifyScheduledAt] = useState('');

  const toDatetimeLocal = (value) => {
    if (!value) return '';
    const d =
      value instanceof Date
        ? value
        : typeof value?.toDate === 'function'
          ? value.toDate()
          : new Date(value);

    if (Number.isNaN(d.getTime())) return '';
    const offset = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return offset.toISOString().slice(0, 16);
  };

  // ✅ Hook은 컴포넌트 최상위에서만 선언
  const getDefaultDate = useCallback(() => {
    if (sessions.length === 0) return new Date().toISOString().slice(0, 10);
    const lastSessionDate = sessions[sessions.length - 1]?.date;
    const parsed = lastSessionDate instanceof Date ? lastSessionDate : new Date(lastSessionDate);
    return Number.isNaN(parsed.getTime())
      ? new Date().toISOString().slice(0, 10)
      : parsed.toISOString().slice(0, 10);
  }, [sessions]);

  const resetForm = useCallback(() => {
    setEditingTestId(null);
    setName('');
    setDate(getDefaultDate());

    const defaultQuestions = 20;
    const defaultMaxScore = 100;
    setMaxScore(defaultMaxScore);
    setTotalQuestions(defaultQuestions);
    setQuestionScores(Array(defaultQuestions).fill(defaultMaxScore / defaultQuestions));
    setQuestionAnalysis(Array(defaultQuestions).fill({ difficulty: '중', type: '개념' }));

    setStaffNotifyMode('none');
    setStaffNotifyTitle('');
    setStaffNotifyBody('');
    setStaffNotifyScheduledAt('');
  }, [getDefaultDate]);

  // ✅ test가 들어오면 "수정 모드" + 폼 프리필
  useEffect(() => {
    if (!isOpen) return;

    if (test) {
      setEditingTestId(test.id || null);
      setName(test.name || '');
      setDate(test.date || getDefaultDate());

      const tq = Number(test.totalQuestions) || 20;
      const ms = Number(test.maxScore) || 100;

      setTotalQuestions(tq);
      setMaxScore(ms);

      const qs = Array.isArray(test.questionScores) ? test.questionScores : [];
      const filledScores =
        qs.length === tq
          ? qs.map((n) => Number(n) || 0)
          : Array.from({ length: tq }, (_, i) => Number(qs[i]) || 0);

      setQuestionScores(filledScores);

      const qa = Array.isArray(test.questionAnalysis) ? test.questionAnalysis : [];
      const filledAnalysis =
        qa.length === tq
          ? qa.map((x) => ({
              difficulty: x?.difficulty || '중',
              type: x?.type || '개념',
            }))
          : Array.from({ length: tq }, (_, i) => ({
              difficulty: qa[i]?.difficulty || '중',
              type: qa[i]?.type || '개념',
            }));

      setQuestionAnalysis(filledAnalysis);

      if (test.notifyMode === 'staff' && test.staffNotification) {
        setStaffNotifyMode(test.staffNotification.mode || 'immediate');
        setStaffNotifyTitle(test.staffNotification.title || '');
        setStaffNotifyBody(test.staffNotification.body || '');
        setStaffNotifyScheduledAt(
          test.staffNotification.mode === 'scheduled'
            ? toDatetimeLocal(test.staffNotification.scheduledAt)
            : ''
        );
      } else {
        setStaffNotifyMode('none');
        setStaffNotifyTitle('');
        setStaffNotifyBody('');
        setStaffNotifyScheduledAt('');
      }
    } else {
      // 신규 등록 모드
      resetForm();
    }
  }, [isOpen, test, resetForm, getDefaultDate]);

  // ✅ 문항 수 변경 시 배열 길이 자동 조정
  useEffect(() => {
    const newCount = Math.max(1, Number(totalQuestions) || 1);

    setQuestionScores((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      while (next.length < newCount) next.push(0);
      next.length = newCount;
      return next.map((n) => Number(n) || 0);
    });

    setQuestionAnalysis((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      while (next.length < newCount) next.push({ difficulty: '중', type: '개념' });
      next.length = newCount;
      return next.map((x) => ({
        difficulty: x?.difficulty || '중',
        type: x?.type || '개념',
      }));
    });
  }, [totalQuestions]);

  const questionScoreSum = useMemo(
    () => (questionScores || []).reduce((sum, score) => sum + (Number(score) || 0), 0),
    [questionScores]
  );

  const handleTotalQuestionsChange = (value) => {
    const parsed = Math.max(1, Number(value) || 1);
    setTotalQuestions(parsed);
  };

  const handleMaxScoreChange = (value) => {
    const parsed = value === '' ? 0 : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setMaxScore(parsed);
  };

  const handleScoreChange = (index, value) => {
    const newScore = value === '' ? 0 : Number(value);
    if (!Number.isFinite(newScore) || newScore < 0) return;

    setQuestionScores((prev) => {
      const updated = [...prev];
      updated[index] = newScore;
      return updated;
    });
  };

  const handleAnalysisChange = (index, field, value) => {
    setQuestionAnalysis((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleStaffNotifyModeChange = (value) => {
    setStaffNotifyMode(value);
    if (value !== 'scheduled') setStaffNotifyScheduledAt('');
  };

  const handleResetToNew = () => {
    resetForm();
    if (typeof onReset === 'function') onReset();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !date || Number(maxScore) < 0 || Number(totalQuestions) <= 0) return;

    if (staffNotifyMode !== 'none') {
      if (!staffNotifyTitle.trim() || !staffNotifyBody.trim()) {
        alert('직원 알림 제목과 내용을 입력해주세요.');
        return;
      }
      if (staffNotifyMode === 'scheduled' && !staffNotifyScheduledAt) {
        alert('직원 알림 예약 시간을 선택해주세요.');
        return;
      }
    }

    const staffNotification =
      staffNotifyMode === 'none'
        ? null
        : {
            mode: staffNotifyMode,
            title: staffNotifyTitle.trim(),
            body: staffNotifyBody.trim(),
            ...(staffNotifyMode === 'scheduled'
              ? { scheduledAt: new Date(staffNotifyScheduledAt) }
              : {}),
          };

    const testData = {
      id: editingTestId, // ✅ 있으면 update 대상
      classId,
      name,
      date,
      maxScore: Number(maxScore),
      totalQuestions: Number(totalQuestions),
      questionScores: (questionScores || []).map((s) => Number(s) || 0),
      questionAnalysis: questionAnalysis || [],
      notifyMode: staffNotifyMode === 'none' ? 'system' : 'staff',
      staffNotification,
    };

    try {
      await onSave(testData, !!editingTestId);
      resetForm();
      onClose();
    } catch (error) {
      console.error('[TestFormModal] save failed', error);
      alert('시험 저장에 실패했습니다. 권한 또는 네트워크를 확인하세요.');
    }
  };

  if (!selectedClass) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTestId ? '시험 정보 수정' : `${selectedClass.name} 새 시험 등록`}
      maxWidth="max-w-5xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {editingTestId && (
          <div className="flex items-center text-xs font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded px-3 py-2">
            <Icon name="edit" className="w-4 h-4 mr-2" />
            시험 수정 중 (저장 시 기존 시험 정보가 업데이트됩니다)
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">시험명*</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">시험일*</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">총 문항 수*</label>
            <input
              type="number"
              value={totalQuestions}
              onChange={(e) => handleTotalQuestionsChange(e.target.value)}
              required
              min="1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">총점*</label>
            <input
              type="number"
              value={maxScore}
              onChange={(e) => handleMaxScoreChange(e.target.value)}
              required
              min="0"
              step="0.1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
        </div>

        <div className="border p-3 rounded-lg bg-yellow-50">
          <h4 className="text-base font-bold text-gray-800 border-b pb-2">
            문항별 배점 및 분석 설정 ({totalQuestions} 문항)
          </h4>
          <p className="text-sm text-gray-600 mb-2">
            총점: <span className="font-bold text-red-600">{Number(maxScore || 0).toFixed(1)}</span>점
          </p>

          {questionScoreSum !== Number(maxScore) && (
            <p className="text-xs text-orange-600 mb-2 flex items-center">
              <Icon name="alert" className="w-4 h-4 mr-1" />
              문항별 배점 합({questionScoreSum})이 총점과 다릅니다. 그래도 저장할 수 있습니다.
            </p>
          )}

          <div className="overflow-y-auto max-h-80">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 bg-yellow-100">
                <tr className="text-xs font-medium text-gray-700 uppercase">
                  <th className="w-10 px-1 py-2 text-center">문항</th>
                  <th className="w-16 px-1 py-2 text-center">배점*</th>
                  <th className="w-20 px-1 py-2 text-center">난이도</th>
                  <th className="w-20 px-1 py-2 text-center">유형</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Number(totalQuestions) || 1 }).map((_, index) => (
                  <tr key={index} className="text-sm border-b">
                    <td className="w-10 px-1 py-1 text-center font-semibold">{index + 1}</td>
                    <td className="w-16 px-1 py-1">
                      <input
                        type="number"
                        value={questionScores[index] ?? 0}
                        onChange={(e) => handleScoreChange(index, e.target.value)}
                        step="0.1"
                        min="0"
                        className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-xs"
                        placeholder="점수"
                      />
                    </td>
                    <td className="w-20 px-1 py-1">
                      <select
                        value={questionAnalysis[index]?.difficulty || '중'}
                        onChange={(e) => handleAnalysisChange(index, 'difficulty', e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-xs"
                      >
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="w-20 px-1 py-1">
                      <select
                        value={questionAnalysis[index]?.type || '개념'}
                        onChange={(e) => handleAnalysisChange(index, 'type', e.target.value)}
                        className="w-full rounded-md border-gray-300 shadow-sm p-1 border text-center text-xs"
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Number(totalQuestions) > 0 && Number(maxScore) === 0 && (
            <p className="text-sm text-red-500 mt-2 flex items-center">
              <Icon name="alert" className="w-4 h-4 mr-1" /> 배점의 총합이 0점입니다. 점수를 입력해주세요.
            </p>
          )}
        </div>

        <StaffNotificationFields
          mode={staffNotifyMode}
          onModeChange={handleStaffNotifyModeChange}
          title={staffNotifyTitle}
          onTitleChange={setStaffNotifyTitle}
          body={staffNotifyBody}
          onBodyChange={setStaffNotifyBody}
          scheduledAt={staffNotifyScheduledAt}
          onScheduledAtChange={setStaffNotifyScheduledAt}
        />

        <div className="pt-4 border-t flex justify-end space-x-3">
          {editingTestId && (
            <button
              type="button"
              onClick={handleResetToNew}
              className="px-4 py-2 text-sm font-medium rounded-lg text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition duration-150"
            >
              수정 취소
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition duration-150"
          >
            취소
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 transition duration-150 shadow-md disabled:bg-red-300"
          >
            {editingTestId ? '수정 저장' : '등록하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};