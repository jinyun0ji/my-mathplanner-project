import React from 'react';
import { getStudentGradeLabel } from '../../utils/gradeUtils';

const value = (record, keys, fallback = '-') => {
    for (const key of keys) {
        if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
    }
    return fallback;
};

const asDate = (input) => {
    if (!input) return null;
    if (typeof input?.toDate === 'function') return input.toDate();
    const parsed = input instanceof Date ? input : new Date(input);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const date = (input) => asDate(input)?.toLocaleDateString('ko-KR') || (input ? String(input) : '-');

const PrintSection = ({ title, children }) => (
    <section className="student-detail-print-section">
        <h2>{title}</h2>
        {children}
    </section>
);

const PrintTable = ({ columns, rows, emptyText = '기록이 없습니다.' }) => {
    if (!rows.length) return <p className="student-detail-print-empty">{emptyText}</p>;
    return (
        <table>
            <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}</tr></thead>
            <tbody>{rows.map((row, index) => (
                <tr key={row.id || index}>{columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}</tr>
            ))}</tbody>
        </table>
    );
};

export default function StudentDetailPrint({ data }) {
    if (!data) return null;
    const { student } = data;
    const consultationRows = Array.isArray(student.consultationHistory)
        ? student.consultationHistory
        : (Array.isArray(student.consultations) ? student.consultations : []);

    return (
        <article className="print-only print-root student-detail-print-document" aria-label="학생 상세 인쇄 문서">
            <header>
                <h1>{student.name || '이름 미상'} 학생 상세</h1>
                <p>{student.school || '학교 정보 없음'} · {getStudentGradeLabel(student)}</p>
            </header>
            <PrintSection title="기본정보">
                <dl className="student-detail-print-info">
                    {data.infoRows.map(([label, itemValue]) => <div key={label}><dt>{label}</dt><dd>{itemValue}</dd></div>)}
                </dl>
                <p className="student-detail-print-memo"><strong>메모</strong><br />{value(student, ['memo', 'note', 'notes'], '메모가 없습니다.')}</p>
            </PrintSection>
            <PrintSection title="수강반"><PrintTable rows={data.classes} columns={[
                { label: '클래스명', render: (row) => value(row, ['name', 'className', 'title']) },
                { label: '담당 강사', render: (row) => value(row, ['teacherName', 'teacher']) },
                { label: '요일/시간', render: (row) => [value(row, ['day', 'days', 'weekday'], ''), value(row, ['time', 'classTime'], '')].filter(Boolean).join(' ') || '-' },
                { label: '상태', render: (row) => value(row, ['status', 'classStatus']) },
            ]} /></PrintSection>
            <PrintSection title="출결"><PrintTable rows={data.attendances} columns={[
                { label: '날짜', render: (row) => date(value(row, ['date', 'lessonDate', 'createdAt'], '')) },
                { label: '클래스', render: data.className },
                { label: '상태', render: (row) => value(row, ['status', 'attendanceStatus']) },
                { label: '메모/사유', render: (row) => value(row, ['memo', 'reason', 'note']) },
            ]} /></PrintSection>
            <PrintSection title="숙제"><PrintTable rows={data.homework} columns={[
                { label: '과제명', render: (row) => row.assignmentTitle || '-' },
                { label: '클래스', render: data.className },
                { label: '출제일', render: (row) => date(value(row, ['assignedDate', 'date', 'createdAt'], '')) },
                { label: '제출/완료', render: (row) => value(row, ['status', 'submissionStatus']) },
                { label: '문항 요약', render: (row) => row.questionSummary || '-' },
            ]} /></PrintSection>
            <PrintSection title="시험"><PrintTable rows={data.tests} columns={[
                { label: '시험명', render: (row) => value(row, ['name', 'title', 'testName']) },
                { label: '클래스', render: data.className },
                { label: '시험일', render: (row) => date(value(row, ['testDate', 'date', 'createdAt'], '')) },
            ]} /></PrintSection>
            <PrintSection title="성적"><PrintTable rows={data.grades} columns={[
                { label: '시험명', render: (row) => value(row.test, ['name', 'title', 'testName'], value(row, ['testName', 'name'])) },
                { label: '클래스', render: data.className },
                { label: '날짜', render: (row) => date(row.testDate) },
                { label: '학생 점수', render: (row) => data.formatScore(row) },
                { label: '평균', render: (row) => row.classAverage ?? '-' },
                { label: '최고점', render: (row) => row.highestScore ?? '-' },
            ]} /></PrintSection>
            <PrintSection title="클리닉"><PrintTable rows={data.clinics} columns={[
                { label: '날짜', render: (row) => date(value(row, ['effectiveDate', 'date', 'clinicDate', 'reservationDate', 'scheduledAt', 'startAt', 'createdAt'], '')) },
                { label: '시간', render: (row) => value(row, ['effectiveTime', 'plannedTime', 'time', 'checkIn', 'startAt']) },
                { label: '담당자', render: (row) => value(row, ['effectiveStaffName', 'tutorName', 'tutor', 'assistantName', 'assistant', 'teacherName', 'teacher', 'createdByName'], '담당자 미지정') },
                { label: '상태', render: (row) => value(row, ['effectiveStatus', 'status', 'clinicStatus']) },
                { label: '코멘트', render: (row) => value(row, ['effectiveComment', 'clinicComment', 'comment', 'content']) },
            ]} /></PrintSection>
            <PrintSection title="상담"><PrintTable rows={consultationRows} columns={[
                { label: '날짜', render: (row) => date(value(row, ['date', 'consultedAt', 'createdAt'], '')) },
                { label: '담당자', render: (row) => value(row, ['staffName', 'teacherName', 'createdByName']) },
                { label: '내용', render: (row) => value(row, ['content', 'memo', 'note', 'summary']) },
            ]} /></PrintSection>
            <PrintSection title="교직원 타임라인"><PrintTable rows={data.timeline} columns={[
                { label: '날짜', render: (row) => date(value(row, ['createdAt', 'date'], '')) },
                { label: '제목', render: (row) => value(row, ['title'], '교직원 메모') },
                { label: '작성자', render: (row) => value(row, ['createdByName', 'staffName']) },
                { label: '내용', render: (row) => value(row, ['content']) },
                { label: '상태', render: (row) => row.status === 'completed' ? '완료' : '진행 중' },
            ]} /></PrintSection>
            <PrintSection title="결제/교재"><PrintTable rows={data.paymentMaterials} columns={[
                { label: '구분', render: (row) => row.recordType },
                { label: '날짜', render: (row) => date(value(row, ['date', 'paidAt', 'receivedAt', 'createdAt'], '')) },
                { label: '항목', render: (row) => value(row, ['title', 'itemName', 'bookName', 'description']) },
                { label: '금액', render: (row) => value(row, ['amount', 'price']) },
                { label: '상태', render: (row) => value(row, ['status', 'paymentStatus', 'receiveStatus']) },
            ]} /></PrintSection>
        </article>
    );
}
