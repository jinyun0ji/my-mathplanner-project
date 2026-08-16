import React from 'react';
import { render, screen, within } from '@testing-library/react';
import StudentDetailPrint from './StudentDetailPrint';

const printData = (clinics) => ({
    student: { name: '테스트 학생' },
    infoRows: [], classes: [], attendances: [], homework: [], tests: [], grades: [],
    clinics, timeline: [], paymentMaterials: [],
    className: () => '-', formatScore: () => '-',
});

describe('StudentDetailPrint clinics', () => {
    test.each([4, 8])('prints exactly the %i clinic rows currently supplied by screen state', (count) => {
        const clinics = Array.from({ length: count }, (_, index) => ({
            id: `clinic-${index + 1}`,
            sourceType: index === count - 1 ? 'clinicReservation' : 'clinicLog',
            effectiveComment: `클리닉 ${index + 1}`,
        }));
        render(<StudentDetailPrint data={printData(clinics)} />);

        const clinicTable = screen.getByRole('heading', { name: '클리닉' }).closest('section').querySelector('table');
        expect(within(clinicTable).getAllByRole('row')).toHaveLength(count + 1);
        expect(screen.getByText(`클리닉 ${count}`)).toBeInTheDocument();
    });

    test('prefers every normalized clinic field over legacy fields', () => {
        render(<StudentDetailPrint data={printData([{
            id: 'reservation-1', sourceType: 'clinicReservation',
            effectiveDate: '2026-08-15', date: '2020-01-01',
            effectiveTime: '17:30', plannedTime: '09:00',
            effectiveStaffName: '정규화 담당자', tutorName: '기존 담당자',
            effectiveStatus: '예약 완료', status: '기존 상태',
            effectiveComment: '정규화 코멘트', clinicComment: '기존 코멘트',
        }])} />);

        const clinicSection = screen.getByRole('heading', { name: '클리닉' }).closest('section');
        expect(clinicSection).toHaveTextContent('2026. 8. 15.');
        expect(clinicSection).toHaveTextContent('17:30');
        expect(clinicSection).toHaveTextContent('정규화 담당자');
        expect(clinicSection).toHaveTextContent('예약 완료');
        expect(clinicSection).toHaveTextContent('정규화 코멘트');
        expect(clinicSection).not.toHaveTextContent('기존 담당자');
    });
});
