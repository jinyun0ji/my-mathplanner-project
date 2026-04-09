import {
    isWrongOrCorrectedAnswer,
    extractWrongQuestionNumbers,
    buildHomeworkWrongNoteText,
    normalizeHomeworkTitleForWrongNote,
} from './homeworkWrongNote.service';

describe('homeworkWrongNote.service', () => {
  test('normalizeHomeworkTitleForWrongNote removes whitespace only from homework titles', () => {
        expect(normalizeHomeworkTitleForWrongNote('(대수) 워크북')).toBe('(대수)워크북');
        expect(normalizeHomeworkTitleForWrongNote('리파인 (미적분) 1강')).toBe('리파인(미적분)1강');
        expect(normalizeHomeworkTitleForWrongNote(null)).toBe('');
        expect(normalizeHomeworkTitleForWrongNote(123)).toBe('');
    });

    test('isWrongOrCorrectedAnswer identifies supported wrong statuses', () => {
        expect(isWrongOrCorrectedAnswer('틀림')).toBe(true);
        expect(isWrongOrCorrectedAnswer('고침')).toBe(true);
        expect(isWrongOrCorrectedAnswer(2)).toBe(true);
        expect(isWrongOrCorrectedAnswer('3')).toBe(true);
        expect(isWrongOrCorrectedAnswer(false)).toBe(true);
        expect(isWrongOrCorrectedAnswer('맞음')).toBe(false);
        expect(isWrongOrCorrectedAnswer(1)).toBe(false);
        expect(isWrongOrCorrectedAnswer(true)).toBe(false);
        expect(isWrongOrCorrectedAnswer(null)).toBe(false);
    });

    test('extractWrongQuestionNumbers filters numeric keys and sorts ascending', () => {
        expect(extractWrongQuestionNumbers({
            10: '틀림',
            7: '고침',
            9: '3',
            note: '틀림',
            1: '맞음',
            4: null,
            2: false,
        })).toEqual([2, 7, 9, 10]);
    });

    test('buildHomeworkWrongNoteText builds text from nested homework results', () => {
        const text = buildHomeworkWrongNoteText({
            assignment: {
                id: 'assignment-1',
                title: '리파인 (미적분) 1강',
            },
            students: [
                { id: 'student-1', name: '김현준' },
                { id: 'student-2', studentName: '박민지' },
            ],
            homeworkResults: {
                'student-1': {
                    'assignment-1': {
                        results: {
                            1: '맞음',
                            7: '틀림',
                            9: '고침',
                            10: '틀림',
                        },
                    },
                },
                'student-2': {
                    assignmentId: 'assignment-1',
                    results: {
                        1: true,
                        2: '완료',
                    },
                },
            },
        });

        expect(text).toBe('김현준_리파인(미적분)1강,7,9,10');
    });

    test('buildHomeworkWrongNoteText normalizes legacy partial sequential keys', () => {
        const text = buildHomeworkWrongNoteText({
            assignment: {
                id: 'assignment-2',
                title: '워크북',
                questionNumbers: [281, 282, 283, 284],
            },
            students: [
                { id: 'student-1', name: '김현준' },
            ],
            homeworkResults: {
                'student-1': {
                    'assignment-2': {
                        results: {
                            1: '틀림',
                            2: '고침',
                        },
                    },
                },
            },
        });

        expect(text).toBe('김현준_워크북,281,282');
    });

    test('buildHomeworkWrongNoteText supports sparse legacy sequential keys', () => {
        const text = buildHomeworkWrongNoteText({
            assignment: {
                id: 'assignment-3',
                title: '워크북2',
                questionNumbers: [10, 11, 12, 13],
            },
            students: [
                { id: 'student-1', name: '김현준' },
            ],
            homeworkResults: {
                'student-1': {
                    'assignment-3': {
                        results: {
                            1: '틀림',
                            3: '고침',
                        },
                    },
                },
            },
        });

        expect(text).toBe('김현준_워크북2,10,12');
    });
});