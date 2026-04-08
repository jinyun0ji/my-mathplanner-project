const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseRangeString,
    resolveAssignmentQuestionNumbers,
    shouldMigrateResultKeys,
    remapSequentialResultKeysToQuestionNumbers,
} = require('../migrateHomeworkResultQuestionNumbers');

const buildSequentialKeys = (count) => Array.from({ length: count }, (_, i) => String(i + 1));

test('parseRangeString supports mixed formats and deduplicates/sorts', () => {
    assert.deepEqual(parseRangeString('1-10, 15-20'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20]);
    assert.deepEqual(parseRangeString('1~3,2,5'), [1, 2, 3, 5]);
    assert.equal(parseRangeString('a,b,c'), null);
});

test('case 1: rangeString 281-380 + results 1..100 -> migrate candidate', () => {
    const questionNumbers = resolveAssignmentQuestionNumbers({ rangeString: '281-380' });
    const decision = shouldMigrateResultKeys(buildSequentialKeys(100), questionNumbers);

    assert.equal(decision.shouldMigrate, true);
    assert.equal(decision.reason, 'sequential-needs-remap');
});

test('case 2: rangeString 1-28 + results 1..28 -> already valid', () => {
    const questionNumbers = resolveAssignmentQuestionNumbers({ rangeString: '1-28' });
    const decision = shouldMigrateResultKeys(buildSequentialKeys(28), questionNumbers);

    assert.equal(decision.shouldMigrate, false);
    assert.equal(decision.reason, 'already-valid');
});

test('case 3: rangeString 1-10,15-20 + results 1..16 -> migrate and remap', () => {
    const questionNumbers = resolveAssignmentQuestionNumbers({ rangeString: '1-10, 15-20' });
    const oldResults = Object.fromEntries(buildSequentialKeys(16).map((key) => [key, { value: key }]));

    const decision = shouldMigrateResultKeys(Object.keys(oldResults), questionNumbers);
    assert.equal(decision.shouldMigrate, true);

    const remapped = remapSequentialResultKeysToQuestionNumbers(oldResults, questionNumbers);
    assert.deepEqual(Object.keys(remapped).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20]);
    assert.deepEqual(remapped['15'], { value: '11' });
});

test('case 4: rangeString 1-10,15-20 + non-sequential result keys -> manual review reason', () => {
    const questionNumbers = resolveAssignmentQuestionNumbers({ rangeString: '1-10, 15-20' });
    const resultKeys = ['1', '2', '3', '5'];

    const decision = shouldMigrateResultKeys(resultKeys, questionNumbers);
    assert.equal(decision.shouldMigrate, false);
    assert.equal(decision.reason, 'result-keys-not-sequential-from-one');
});