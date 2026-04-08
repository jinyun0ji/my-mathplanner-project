import React, { useMemo } from 'react';
import { Icon } from '../../utils/helpers';
import { getAssignmentQuestionNumbers, normalizeHomeworkResultMapForDisplay } from '../../domain/homework/homework.service';

export default function HomeworkStatisticsPanel({ summary, assignment, completionRateByStudentId = {} }) {
    const stats = useMemo(() => {
        if (!summary || summary.length === 0) return null;
        const assignmentQuestionNumbers = getAssignmentQuestionNumbers(assignment);

        const totalStudents = summary.length;
        const completionValues = summary.map((student) => completionRateByStudentId[student.studentId]?.display ?? 0);
        const averageCompletionRate = totalStudents > 0
            ? Math.round(completionValues.reduce((acc, value) => acc + value, 0) / totalStudents)
            : 0;

        const completedCount = summary.filter((student) => completionRateByStudentId[student.studentId]?.completed).length;
        const wrongProgressCount = summary.filter((student) => completionRateByStudentId[student.studentId]?.wrongProgress).length;
        const incompleteCount = summary.filter((student) => (completionRateByStudentId[student.studentId]?.raw ?? 0) < 100).length;

        const questionStats = {};
        summary.forEach((student) => {
            const normalizedResultMap = normalizeHomeworkResultMapForDisplay(student.resultMap || {}, assignmentQuestionNumbers, {
                assignmentId: assignment?.id,
                studentId: student.studentId,
            });
            Object.entries(normalizedResultMap).forEach(([qNum, status]) => {
                if (!status) return;
                if (!questionStats[qNum]) questionStats[qNum] = { correct: 0, incorrect: 0, corrected: 0 };
                if (status === '맞음') questionStats[qNum].correct += 1;
                else if (status === '틀림') questionStats[qNum].incorrect += 1;
                else if (status === '고침') questionStats[qNum].corrected += 1;
            });
        });

        const allQuestionsSorted = Object.entries(questionStats)
            .map(([qNum, data]) => {
                const totalAttempts = data.correct + data.incorrect + data.corrected;
                const totalCorrect = data.correct + data.corrected;
                const correctRate = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
                return { qNum: Number(qNum), originalQNum: qNum, totalCorrect, totalAttempts, rate: correctRate };
            })
            .filter((item) => item.totalAttempts > 0)
            .sort((a, b) => a.rate - b.rate || a.qNum - b.qNum);

        return {
            averageCompletionRate,
            completedCount,
            wrongProgressCount,
            incompleteCount,
            allQuestionsSorted,
            totalStudents,
            sortedStudents: [...summary].sort((a, b) => (completionRateByStudentId[a.studentId]?.display ?? 0) - (completionRateByStudentId[b.studentId]?.display ?? 0)),
        };
    }, [summary, assignment, completionRateByStudentId]);

    if (!stats) return null;

    const summaryItems = [
        { label: '평균 수행률', value: `${stats.averageCompletionRate}%`, color: 'text-blue-600' },
        { label: '완료 학생', value: `${stats.completedCount}명`, color: 'text-green-600' },
        { label: '오답 진행', value: `${stats.wrongProgressCount}명`, color: 'text-yellow-600' },
        { label: '미완료 학생', value: `${stats.incompleteCount}명`, color: 'text-red-600' },
        { label: '총원', value: `${stats.totalStudents}명`, color: 'text-gray-700' },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
            <h2 className="text-xl font-bold text-gray-800 border-b pb-2 flex items-center">
                <Icon name="clipboardCheck" className="w-5 h-5 mr-2 text-blue-600" />
                과제 결과 통계
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-center border p-3 rounded-lg bg-gray-50">
                {summaryItems.map((item) => (
                    <div key={item.label} className="p-2 bg-white rounded-md shadow-sm">
                        <p className="text-xs text-gray-500 font-medium">{item.label}</p>
                        <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                        <Icon name="barChart" className="w-4 h-4 mr-2 text-blue-500" />
                        문항별 정답률 (전체, 낮은 순)
                    </h3>
                    <div className="overflow-y-auto max-h-96 border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600 w-16">순위</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">문항 번호</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">정답률 (인원)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.allQuestionsSorted.length > 0 ? stats.allQuestionsSorted.map((q, idx) => (
                                    <tr key={q.originalQNum} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-center font-bold text-gray-500">{idx + 1}</td>
                                        <td className="px-3 py-2 text-center font-medium text-gray-900">{q.originalQNum}번</td>
                                        <td className="px-3 py-2 text-center font-bold">
                                            <span className={`${q.rate < 50 ? 'text-red-600' : q.rate < 80 ? 'text-yellow-600' : 'text-green-600'}`}>{q.rate}%</span>
                                            <span className="text-gray-500 ml-1 font-normal">({q.totalCorrect}명/{q.totalAttempts}명)</span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan="3" className="text-center py-4 text-gray-500">채점된 데이터가 부족합니다.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-700 flex items-center">
                        <Icon name="users" className="w-4 h-4 mr-2 text-indigo-500" />
                        학생별 수행 현황
                    </h3>
                    <div className="overflow-y-auto max-h-96 border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left font-bold text-gray-600">학생명</th>
                                    <th className="px-3 py-2 text-center font-bold text-gray-600">수행률</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.sortedStudents.map((student) => {
                                    const completion = completionRateByStudentId[student.studentId];
                                    return (
                                        <tr key={student.studentId} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 font-medium text-gray-900">{student.studentName}</td>
                                            <td className={`px-3 py-2 text-center font-bold ${(completion?.display ?? 0) === 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                                {completion?.total > 0
                                                    ? `${completion.display}% (${completion.done}/${completion.total})`
                                                    : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}