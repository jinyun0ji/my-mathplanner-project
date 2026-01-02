import React, { useState } from 'react';

export default function HomeworkTab({ myHomeworkStats }) {
    const [selectedHwId, setSelectedHwId] = useState(null);
    const toggleDetails = (id) => setSelectedHwId(selectedHwId === id ? null : id);

    return (
        <div className="space-y-4">
            {myHomeworkStats.length === 0 && <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">등록된 과제가 없습니다.</div>}
            {myHomeworkStats.map(hw => {
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
                        <h4 className="font-bold text-gray-900 mb-1">{hw.content}</h4>
                        <p className="text-xs text-gray-500 mb-4">{hw.book} (총 {hw.totalQuestions}문제)</p>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                            <div className="bg-brand-main h-1.5 rounded-full transition-all" style={{ width: `${hw.completionRate}%` }}></div>
                        </div>
                        {selectedHwId === hw.id && (
                            <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in-down">
                                <div className="flex justify-around mb-4 text-center">
                                    <div>
                                        <p className="text-xs text-gray-500">맞음</p>
                                        <p className="font-bold text-green-600">{hw.completedCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">틀림</p>
                                        <p className="font-bold text-red-500">{hw.incorrectCount}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">남음</p>
                                        <p className="font-bold text-gray-800">{hw.uncheckedCount}</p>
                                    </div>
                                </div>
                                {hw.incorrectQuestionList && hw.incorrectQuestionList.length > 0 ? (
                                    <div className="bg-red-50 p-3 rounded-xl">
                                        <p className="text-xs font-bold text-red-600 mb-2">오답 노트</p>
                                        <div className="flex flex-wrap gap-2">
                                            {hw.incorrectQuestionList.map(q => (
                                                <span key={q} className="bg-white text-red-600 text-xs font-bold px-2 py-1 rounded border border-red-100">{q}번</span>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-xs text-gray-400 mt-2">오답이 없습니다. 훌륭해요! 🎉</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};