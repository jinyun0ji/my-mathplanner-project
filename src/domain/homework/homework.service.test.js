import {
    classifyHomeworkResultKeyMode,
    getAssignmentQuestionNumbers,
    normalizeHomeworkResultMapForDisplay,
    computeHomeworkProgress,
} from './homework.service';

describe('homework.service legacy result map normalization', () => {
    const assignment = {
        questionNumbers: [281, 282, 283, 284, 285],
    };

    test('classifies actual question number keys', () => {
        const mode = classifyHomeworkResultKeyMode(
            { 281: '맞음', 282: '틀림' },
            getAssignmentQuestionNumbers(assignment),
        );
        expect(mode).toBe('actual_question_numbers');
    });

    test('classifies and normalizes partial sequential keys', () => {
        const questions = getAssignmentQuestionNumbers(assignment);
        const raw = { 1: '맞음', 2: '틀림', 3: '고침' };
        expect(classifyHomeworkResultKeyMode(raw, questions)).toBe('partial_sequential');
        expect(normalizeHomeworkResultMapForDisplay(raw, questions)).toEqual({
            281: '맞음',
            282: '틀림',
            283: '고침',
        });
    });

    test('classifies sparse sequential keys as partial sequential', () => {
        const questions = getAssignmentQuestionNumbers(assignment);
        const raw = { 1: '맞음', 3: '틀림' };
        expect(classifyHomeworkResultKeyMode(raw, questions)).toBe('partial_sequential');
        expect(normalizeHomeworkResultMapForDisplay(raw, questions)).toEqual({
            281: '맞음',
            283: '틀림',
        });
    });

    test('computeHomeworkProgress uses normalized sequential fallback', () => {
        const questions = getAssignmentQuestionNumbers(assignment);
        const progress = computeHomeworkProgress({ 1: '맞음', 2: '틀림' }, questions);
        expect(progress.checkedCount).toBe(2);
        expect(progress.completionRate).toBe(40);
        expect(progress.incorrectCount).toBe(1);
    });
});