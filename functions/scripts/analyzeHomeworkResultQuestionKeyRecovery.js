/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

const HOMEWORK_ASSIGNMENTS = 'homeworkAssignments';
const HOMEWORK_RESULTS = 'homeworkResults';
const REPORT_FILE_NAME = 'homework-result-recovery-analysis.json';
const SAMPLE_SIZE_PER_CLASSIFICATION = 20;

const CLASSIFICATION = {
    RECOVERABLE_PARTIAL_SEQUENTIAL: 'recoverable_partial_sequential',
    RECOVERABLE_ACTUAL_QUESTION_NUMBERS: 'recoverable_actual_question_numbers',
    MIXED_OR_AMBIGUOUS: 'mixed_or_ambiguous',
    ASSIGNMENT_NOT_FOUND: 'assignment_not_found',
    INVALID_RESULT_SHAPE: 'invalid_result_shape',
};

const isNumericString = (value) => /^\d+$/.test(String(value));

const buildRange = (start, end) => {
    const startNumber = Number(start);
    const endNumber = Number(end);

    if (!Number.isInteger(startNumber) || !Number.isInteger(endNumber) || startNumber <= 0 || endNumber <= 0 || startNumber > endNumber) {
        return null;
    }

    return Array.from({ length: endNumber - startNumber + 1 }, (_, index) => startNumber + index);
};

const parseRangeString = (input) => {
    if (typeof input !== 'string') {
        return null;
    }

    const tokens = input
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean);

    if (tokens.length === 0) {
        return null;
    }

    const collected = [];

    for (const token of tokens) {
        const rangeMatch = token.match(/^(\d+)\s*[-~]\s*(\d+)$/);
        if (rangeMatch) {
            const expanded = buildRange(Number(rangeMatch[1]), Number(rangeMatch[2]));
            if (!expanded) {
                continue;
            }
            collected.push(...expanded);
            continue;
        }

        if (/^\d+$/.test(token)) {
            const numberValue = Number(token);
            if (numberValue > 0) {
                collected.push(numberValue);
            }
        }
    }

    const normalized = [...new Set(collected.filter((num) => Number.isInteger(num) && num > 0))].sort((a, b) => a - b);

    return normalized.length > 0 ? normalized : null;
};

const normalizeQuestionNumberArray = (questionNumbers) => {
    if (!Array.isArray(questionNumbers) || questionNumbers.length === 0) {
        return null;
    }

    const normalized = [];

    for (const value of questionNumbers) {
        const numberValue = Number(value);
        if (!Number.isInteger(numberValue) || numberValue <= 0) {
            return null;
        }
        normalized.push(numberValue);
    }

    return normalized;
};

const resolveAssignmentQuestionNumbers = (data) => {
    const questionNumbers = normalizeQuestionNumberArray(data?.questionNumbers);
    if (questionNumbers) {
        return questionNumbers;
    }

    const rangeFields = ['rangeString', 'questionRange', 'problemRange', 'range', 'problemNumbers', 'questions'];
    for (const fieldName of rangeFields) {
        const rangeValue = data?.[fieldName];
        const normalized = normalizeQuestionNumberArray(rangeValue);
        if (normalized) {
            return normalized;
        }

        const parsed = parseRangeString(rangeValue);
        if (parsed) {
            return parsed;
        }
    }

    const startCandidate = data?.startNumber ?? data?.start;
    const endCandidate = data?.endNumber ?? data?.end;
    const startEndRange = buildRange(startCandidate, endCandidate);
    if (startEndRange) {
        return startEndRange;
    }

    const startNumber = Number(startCandidate);
    const totalQuestions = Number(data?.totalQuestions);
    if (Number.isInteger(startNumber) && startNumber > 0 && Number.isInteger(totalQuestions) && totalQuestions > 0) {
        return Array.from({ length: totalQuestions }, (_, index) => startNumber + index);
    }

    return null;
};

const getKeyRangeLabel = (keys) => {
    if (!Array.isArray(keys) || keys.length === 0) {
        return 'n/a';
    }

    const numbers = keys.map((key) => Number(key)).filter((num) => Number.isInteger(num));
    if (numbers.length === 0) {
        return 'n/a';
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    return `${sorted[0]}..${sorted[sorted.length - 1]}`;
};

const isSequentialFromOneToK = (numericKeys) => {
    if (!Array.isArray(numericKeys) || numericKeys.length === 0) {
        return false;
    }

    const sorted = [...numericKeys].sort((a, b) => a - b);
    if (new Set(sorted).size !== sorted.length) {
        return false;
    }

    for (let i = 0; i < sorted.length; i += 1) {
        if (sorted[i] !== i + 1) {
            return false;
        }
    }

    return true;
};

const classifyResultDocument = ({ assignment, assignmentId, docId, results }) => {
    if (!assignment) {
        return {
            docId,
            assignmentId,
            classification: CLASSIFICATION.ASSIGNMENT_NOT_FOUND,
            oldKeyRange: 'n/a',
            expectedKeyRange: 'n/a',
            keyCount: 0,
            expectedCount: 0,
        };
    }

    const questionNumbers = assignment.questionNumbers;
    if (!Array.isArray(questionNumbers) || questionNumbers.length === 0) {
        return {
            docId,
            assignmentId,
            classification: CLASSIFICATION.MIXED_OR_AMBIGUOUS,
            oldKeyRange: 'n/a',
            expectedKeyRange: 'n/a',
            keyCount: 0,
            expectedCount: 0,
            reason: 'invalid-assignment-question-numbers',
        };
    }

    if (!results || typeof results !== 'object' || Array.isArray(results)) {
        return {
            docId,
            assignmentId,
            classification: CLASSIFICATION.INVALID_RESULT_SHAPE,
            oldKeyRange: 'n/a',
            expectedKeyRange: getKeyRangeLabel(questionNumbers),
            keyCount: 0,
            expectedCount: questionNumbers.length,
            reason: 'results-not-object',
        };
    }

    const resultKeys = Object.keys(results);
    if (resultKeys.length === 0 || resultKeys.some((key) => !isNumericString(key))) {
        return {
            docId,
            assignmentId,
            classification: CLASSIFICATION.INVALID_RESULT_SHAPE,
            oldKeyRange: getKeyRangeLabel(resultKeys),
            expectedKeyRange: getKeyRangeLabel(questionNumbers),
            keyCount: resultKeys.length,
            expectedCount: questionNumbers.length,
            reason: resultKeys.length === 0 ? 'empty-result-keys' : 'non-numeric-result-key',
        };
    }

    const numericKeys = resultKeys.map((key) => Number(key));
    const questionNumberSet = new Set(questionNumbers);

    const isSubsetOfQuestionNumbers = numericKeys.every((key) => questionNumberSet.has(key));
    const isSequential = isSequentialFromOneToK(numericKeys);

    let classification = CLASSIFICATION.MIXED_OR_AMBIGUOUS;

    if (isSequential && numericKeys.length < questionNumbers.length) {
        classification = CLASSIFICATION.RECOVERABLE_PARTIAL_SEQUENTIAL;
    } else if (isSubsetOfQuestionNumbers) {
        classification = CLASSIFICATION.RECOVERABLE_ACTUAL_QUESTION_NUMBERS;
    }

    return {
        docId,
        assignmentId,
        classification,
        oldKeyRange: getKeyRangeLabel(resultKeys),
        expectedKeyRange: getKeyRangeLabel(questionNumbers),
        keyCount: resultKeys.length,
        expectedCount: questionNumbers.length,
    };
};

const run = async () => {
    console.log('[analysis] start analyzeHomeworkResultQuestionKeyRecovery (dry-run only)');

    const assignmentsSnapshot = await db.collection(HOMEWORK_ASSIGNMENTS).get();
    const assignmentMap = new Map();

    assignmentsSnapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        assignmentMap.set(docSnap.id, {
            id: docSnap.id,
            ...data,
            questionNumbers: resolveAssignmentQuestionNumbers(data),
        });
    });

    const resultsSnapshot = await db.collection(HOMEWORK_RESULTS).get();

    const analysisRows = [];
    const samples = {
        [CLASSIFICATION.RECOVERABLE_PARTIAL_SEQUENTIAL]: [],
        [CLASSIFICATION.RECOVERABLE_ACTUAL_QUESTION_NUMBERS]: [],
        [CLASSIFICATION.MIXED_OR_AMBIGUOUS]: [],
        [CLASSIFICATION.ASSIGNMENT_NOT_FOUND]: [],
        [CLASSIFICATION.INVALID_RESULT_SHAPE]: [],
    };

    const summary = {
        total: resultsSnapshot.size,
        recoverable_partial_sequential: 0,
        recoverable_actual_question_numbers: 0,
        mixed_or_ambiguous: 0,
        assignment_not_found: 0,
        invalid_result_shape: 0,
    };

    for (const docSnap of resultsSnapshot.docs) {
        const data = docSnap.data() || {};
        const assignmentId = data.assignmentId || data.homeworkAssignmentId;
        const normalizedAssignmentId = assignmentId ? String(assignmentId) : null;
        const assignment = normalizedAssignmentId ? assignmentMap.get(normalizedAssignmentId) : null;

        const row = classifyResultDocument({
            assignment,
            assignmentId: normalizedAssignmentId,
            docId: docSnap.id,
            results: data.results,
        });

        analysisRows.push(row);
        summary[row.classification] += 1;

        if (samples[row.classification].length < SAMPLE_SIZE_PER_CLASSIFICATION) {
            samples[row.classification].push(row);
        }

        console.log(JSON.stringify(row));
    }

    const report = {
        mode: 'dry-run',
        generatedAt: new Date().toISOString(),
        summary,
        sampleSizePerClassification: SAMPLE_SIZE_PER_CLASSIFICATION,
        samples,
        rows: analysisRows,
    };

    const reportFilePath = path.resolve(process.cwd(), REPORT_FILE_NAME);
    fs.writeFileSync(reportFilePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log('--- HOMEWORK RESULT RECOVERY ANALYSIS SUMMARY ---');
    console.log(`total: ${summary.total}`);
    console.log(`recoverable_partial_sequential: ${summary.recoverable_partial_sequential}`);
    console.log(`recoverable_actual_question_numbers: ${summary.recoverable_actual_question_numbers}`);
    console.log(`mixed_or_ambiguous: ${summary.mixed_or_ambiguous}`);
    console.log(`assignment_not_found: ${summary.assignment_not_found}`);
    console.log(`invalid_result_shape: ${summary.invalid_result_shape}`);

    Object.keys(samples).forEach((classification) => {
        console.log(`sample ${Math.min(samples[classification].length, SAMPLE_SIZE_PER_CLASSIFICATION)}건 - ${classification}`);
        console.table(samples[classification]);
    });

    console.log(`[analysis] report written: ${reportFilePath}`);
    console.log('[analysis] done');
};

if (require.main === module) {
    run().catch((error) => {
        console.error('[analysis] failed', error);
        process.exitCode = 1;
    });
}

module.exports = {
    buildRange,
    parseRangeString,
    normalizeQuestionNumberArray,
    resolveAssignmentQuestionNumbers,
    classifyResultDocument,
    isSequentialFromOneToK,
    getKeyRangeLabel,
};