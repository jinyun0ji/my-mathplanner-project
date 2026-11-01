const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

// Evaluate the actual handler with no Admin app, credentials, network or FCM.
// Any new notification/identity dependency fails this allowlist immediately.
const loadGradeTrigger = ({ exam = { classId: 'class-one', totalQuestions: 4, questionScores: [10, 20, 30, 40] },
    grades = [], failWrite = false } = {}) => {
    const state = { exam: structuredClone(exam), grades: structuredClone(grades), writes: [], reads: [] };
    const db = {
        collection(name) {
            assert.ok(['tests', 'grades', 'classTestStats'].includes(name), `Unexpected collection: ${name}`);
            if (name === 'grades') return {
                where(field, operator, testId) {
                    assert.equal(field, 'testId');
                    assert.equal(operator, '==');
                    return { get: async () => {
                        state.reads.push(`grades:${testId}`);
                        return { docs: state.grades.filter((grade) => grade.testId === testId).map((grade) => ({ data: () => grade })) };
                    } };
                },
            };
            return { doc(id) {
                const ref = { set: async (payload, options) => {
                    if (failWrite) throw new Error('mock-statistics-write-failed');
                    assert.deepEqual(structuredClone(options), { merge: true });
                    state.writes.push({ collection: name, id, payload: structuredClone(payload) });
                } };
                return { ...ref, get: async () => {
                    assert.equal(name, 'tests');
                    state.reads.push(`tests:${id}`);
                    return { exists: state.exam !== null, data: () => state.exam, ref };
                } };
            } };
        },
    };
    const module = { exports: {} };
    const filename = path.resolve(__dirname, '../grades.js');
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        module, exports: module.exports,
        require(name) {
            if (name === 'firebase-admin/firestore') return {
                getFirestore: () => db, FieldValue: { serverTimestamp: () => 'server-timestamp' },
            };
            if (name === 'firebase-functions') return {
                firestore: { document: (documentPath) => ({ onWrite: (run) => ({ documentPath, run }) }) },
            };
            throw new Error(`Statistics handler must not load notification dependencies: ${name}`);
        },
    }, { filename });
    const snapshot = (data) => ({ exists: data !== null, data: () => data });
    const run = (before, after) => module.exports.onGradeWritten.run({ before: snapshot(before), after: snapshot(after) });
    return { state, run, trigger: module.exports.onGradeWritten };
};

test('grade creation preserves numeric, zero, answer-map scoring and absentee filtering in both statistics documents', async () => {
    const f = loadGradeTrigger({ grades: [
        { testId: 'exam-one', score: 90 },
        { testId: 'exam-one', totalScore: '70' },
        { testId: 'exam-one', correctCount: { 1: true, 2: false, 3: 'O', 4: 2 } },
        { testId: 'exam-one', score: 0 },
        { testId: 'exam-one', score: 100, attempted: false },
        { testId: 'exam-one', score: 100, isAbsent: true },
        { testId: 'exam-one', status: '미응시' },
        { testId: 'exam-one', score: '미입력' },
        { testId: 'other-exam', score: 100 },
    ] });
    assert.equal(f.trigger.documentPath, 'grades/{id}');
    assert.equal(await f.run(null, { testId: 'exam-one', score: 90 }), null);
    assert.deepEqual(f.state.writes, [
        { collection: 'tests', id: 'exam-one', payload: {
            classAverage: 50, average: 50, highestScore: 90, classHighestScore: 90,
            submittedCount: 4, statsUpdatedAt: 'server-timestamp',
        } },
        { collection: 'classTestStats', id: 'class-one_exam-one', payload: {
            classId: 'class-one', testId: 'exam-one', average: 50, maxScore: 90, highestScore: 90,
            submittedCount: 4, attemptedCount: 4, count: 4, updatedAt: 'server-timestamp',
        } },
    ]);
});

test('grade updates including staff notifyMode still recalculate statistics without loading a notification gate', async () => {
    const f = loadGradeTrigger({ grades: [{ testId: 'exam-one', score: 80 }, { testId: 'exam-one', score: 100 }] });
    await f.run({ testId: 'exam-one', score: 10 }, { testId: 'exam-one', score: 100, notifyMode: 'staff' });
    assert.equal(f.state.writes[0].payload.average, 90);
    assert.equal(f.state.writes[1].payload.maxScore, 100);
    assert.equal(f.state.writes[1].payload.submittedCount, 2);
});

test('grade deletion uses the before testId and clears empty statistics in tests and classTestStats', async () => {
    const f = loadGradeTrigger();
    await f.run({ testId: 'exam-one', score: 80 }, null);
    assert.deepEqual(f.state.reads, ['tests:exam-one', 'grades:exam-one']);
    for (const { payload } of f.state.writes) {
        assert.equal(payload.average, null);
        assert.equal(payload.highestScore, null);
        assert.equal(payload.submittedCount, 0);
    }
    assert.equal(f.state.writes.length, 2);
});

test('equal question weighting and one-decimal average remain unchanged', async () => {
    const f = loadGradeTrigger({ exam: { classId: 'class-one', totalQuestions: 3, maxScore: 100 }, grades: [
        { testId: 'exam-one', correctCount: { 1: 'correct', 2: false, 3: false } },
    ] });
    await f.run(null, { testId: 'exam-one' });
    assert.equal(f.state.writes[0].payload.average, 33.3);
    assert.equal(f.state.writes[1].payload.highestScore, 33.3);
});

test('test metadata without classId still updates tests and does not invent a class statistics document', async () => {
    const f = loadGradeTrigger({ exam: { totalQuestions: 1, maxScore: 10 }, grades: [{ testId: 'exam-one', score: 10 }] });
    await f.run(null, { testId: 'exam-one' });
    assert.equal(f.state.writes.length, 1);
    assert.equal(f.state.writes[0].collection, 'tests');
    assert.equal(f.state.writes[0].payload.average, 10);
});

test('missing testId or missing test document produces no statistics or notification writes', async () => {
    const missingId = loadGradeTrigger();
    await missingId.run(null, { score: 80 });
    assert.deepEqual(missingId.state.reads, []);
    assert.deepEqual(missingId.state.writes, []);
    const missingTest = loadGradeTrigger({ exam: null });
    await missingTest.run(null, { testId: 'missing-exam' });
    assert.deepEqual(missingTest.state.reads, ['tests:missing-exam']);
    assert.deepEqual(missingTest.state.writes, []);
});

test('statistics write failures still propagate for Cloud Functions retry/diagnosis', async () => {
    const f = loadGradeTrigger({ failWrite: true });
    await assert.rejects(f.run(null, { testId: 'exam-one' }), /mock-statistics-write-failed/);
});
