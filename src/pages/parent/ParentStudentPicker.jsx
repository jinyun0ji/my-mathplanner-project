import React, { useMemo, useState } from 'react';
import { useParentContext } from '../../parent';

export default function ParentStudentPicker({ students }) {
    const { activeStudentId, studentIds, setActiveStudentId } = useParentContext();
    const [selectedStudentId, setSelectedStudentId] = useState(activeStudentId || studentIds?.[0] || null);
    const [isSaving, setIsSaving] = useState(false);

    const studentCards = useMemo(() => {
        if (!Array.isArray(studentIds)) return [];
        return studentIds.map((studentId) => {
            const student = students?.find((item) => item.id === studentId);
            return {
                id: studentId,
                name: student?.name || '학생 이름 없음',
                grade: student?.grade || '학년 정보 없음',
                school: student?.school || '학교 정보 없음',
            };
        });
    }, [studentIds, students]);

    const handleConfirm = async () => {
        if (!selectedStudentId) return;
        setIsSaving(true);
        try {
            await setActiveStudentId(selectedStudentId);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">자녀를 선택해주세요</h1>
                    <p className="text-sm text-gray-600">학습 현황을 확인할 학생을 선택해 주세요.</p>
                </div>

                <div className="space-y-3">
                    {studentCards.map((student) => {
                        const isSelected = selectedStudentId === student.id;
                        return (
                            <button
                                key={student.id}
                                type="button"
                                onClick={() => setSelectedStudentId(student.id)}
                                className={`w-full text-left rounded-2xl border px-4 py-4 shadow-sm transition-all ${
                                    isSelected
                                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                        : 'border-gray-200 bg-white hover:border-indigo-200'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-base font-bold text-gray-900">{student.name}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {student.school} · {student.grade}
                                        </div>
                                    </div>
                                    <div className={`w-4 h-4 rounded-full border-2 ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`} />
                                </div>
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!selectedStudentId || isSaving}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold shadow-lg disabled:opacity-60 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                >
                    {isSaving ? '저장 중...' : '선택 완료'}
                </button>
            </div>
        </div>
    );
}