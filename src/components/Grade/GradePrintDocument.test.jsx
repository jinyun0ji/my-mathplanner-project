import React from 'react';
import { render, screen } from '@testing-library/react';
import GradePrintDocument from './GradePrintDocument';

const report = {
    classNameText: '중등 A반',
    testTitle: '8월 정기 테스트',
    testDateText: '2026-08-16',
    stats: { submittedCount: 3, average: 90, maxScore: 100, minScore: 80 },
    scores: [100, 90, 80],
    rankings: [
        { studentId: '1', studentName: '김학생', score: 100, rank: 1 },
        { studentId: '2', studentName: '이학생', score: 90, rank: 2 },
        { studentId: '3', studentName: '박학생', score: 80, rank: 3 },
    ],
    questionStats: [{ question: 1, pointValue: 10, correctCount: 2, submittedCount: 3, correctRate: 66.666 }],
};

describe('GradePrintDocument', () => {
    test('renders the complete ranking and actual-score distribution without top/bottom lists', () => {
        const { container } = render(<GradePrintDocument {...report} />);

        expect(screen.getByText('응시자 성적 순위')).toBeInTheDocument();
        expect(screen.getAllByRole('row')).toHaveLength(6); // ranking + question headers and rows
        expect(screen.getByLabelText('전체 응시자의 실제 점수와 평균 위치').querySelectorAll('.student-marker')).toHaveLength(3);
        expect(screen.getByText('평균 90')).toBeInTheDocument();
        expect(container).not.toHaveTextContent('최고점 Top 5');
        expect(container).not.toHaveTextContent('최저점 Bottom 5');
    });

    test('renders question point value and accuracy from the resolver', () => {
        render(<GradePrintDocument {...report} />);
        expect(screen.getByText('문항별 분석')).toBeInTheDocument();
        expect(screen.getByText('66.7%')).toBeInTheDocument();
    });
});
