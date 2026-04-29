import React, { useState } from 'react';
import { resolveAssignmentType, resolveAssignmentTypeLabel } from '../../../domain/homework/homework.service';

export default function HomeworkTab({ myHomeworkStats }) {
    const [selectedHwId, setSelectedHwId] = useState(null);
    const toggleDetails = (id) => setSelectedHwId(selectedHwId === id ? null : id);

    return (
        <div className="space-y-4">
            {myHomeworkStats.length === 0 && <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">등록된 과제가 없습니다.</div>}
            {myHomeworkStats.map(hw => {
                const assignmentType = resolveAssignmentType(hw);
                const typeLabel = resolveAssignmentTypeLabel(hw);
                const issuedDate =
                    typeof hw.date === 'string'
                        ? hw.date
                        : hw.date?.toDate?.()
                            ? hw.date.toDate().toISOString().slice(0, 10)
                            : hw.date
                                ? new Date(hw.date).toISOString().slice(0, 10)
                                : '';

                return (
                    <div key={hw.id} onClick={() => toggleDetails(hw.id)} className={`bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all cursor-pointer ${selectedHwId === hw.id ? 'ring-2 ring-indigo-500' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${hw.status === '완료' ? 'bg-green-100 text-green-700' : hw.status === '미시작' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{hw.status}</span>
                            <span className="text-xs text-gray-500 font-semibold">출제일: {issuedDate || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-900">{hw.content || hw.title || '과제'}</h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                                {typeLabel}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            {assignmentType === 'video_makeup'
                                ? (hw.book || '동영상 과제')
                                : `${hw.book || '교재 미정'} (총 ${hw.totalQuestions}문제)`}
                        </p>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden flex">
                            <div className="bg-green-500 h-2" style={{ width: `${((hw.correctCount || 0) / Math.max(hw.totalQuestions || 0, 1)) * 100}%` }} />
                            <div className="bg-red-500 h-2" style={{ width: `${((hw.incorrectCount || 0) / Math.max(hw.totalQuestions || 0, 1)) * 100}%` }} />
                            <div className="bg-blue-500 h-2" style={{ width: `${((hw.fixedCount || 0) / Math.max(hw.totalQuestions || 0, 1)) * 100}%` }} />
                            <div className="bg-gray-300 h-2" style={{ width: `${((hw.uncheckedCount || 0) / Math.max(hw.totalQuestions || 0, 1)) * 100}%` }} />
                        </div>
                        <p className="text-xs text-gray-500 mb-2">맞음 {hw.correctCount || 0} / 틀림 {hw.incorrectCount || 0} / 고침 {hw.fixedCount || 0} / 남음 {hw.uncheckedCount || 0}</p>
                        {selectedHwId === hw.id && (
                            <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down">
                                <div className="flex justify-around mb-4 text-center">
                                    <div>
                                        <p className="text-xs text-gray-500">맞음</p>
                                        <p className="font-bold text-green-600">{hw.correctCount || 0}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">틀림</p>
                                        <p className="font-bold text-red-500">{hw.incorrectCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">남음</p>
                                        <p className="font-bold text-gray-800">{hw.uncheckedCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">고침</p>
                                        <p className="font-bold text-blue-600">{hw.fixedCount || 0}</p>
                                    </div>
                                </div>
                                {[
                                    { label: '맞은 문항 번호', items: hw.correctQuestionNumbers, tone: 'green' },
                                    { label: '틀린 문항 번호', items: hw.wrongQuestionNumbers, tone: 'red' },
                                    { label: '고친 문항 번호', items: hw.fixedQuestionNumbers, tone: 'blue' },
                                    { label: '남은 문항 번호', items: hw.remainingQuestionNumbers, tone: 'gray' },
                                ].map((section) => (
                                    <div key={section.label} className="rounded-xl border border-gray-100 p-3">
                                        <p className="text-xs font-bold text-gray-700 mb-2">{section.label}</p>
                                        <p className="text-xs text-gray-600">
                                            {Array.isArray(section.items) && section.items.length > 0 ? section.items.join(', ') : '없음'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};