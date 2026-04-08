/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const HOMEWORK_ASSIGNMENTS = 'homeworkAssignments';
const HOMEWORK_RESULTS = 'homeworkResults';
const BATCH_SIZE = 200;
const MIGRATION_BY = 'script:migrateHomeworkResultQuestionNumbers';
const MIGRATION_VERSION = 1;
const isWriteMode = process.argv.includes('--write');

const isNumericString = (value) => /^\d+$/.test(String(value));

const isSequentialFromOne = (keys) => {
    if (!Array.isArray(keys) || keys.length === 0) {
        return false;
    }

    const numbers = keys.map((key) => Number(key));

    if (numbers.some((num) => !Number.isInteger(num) || num <= 0)) {
        return false;
    }

    const sorted = [...numbers].sort((a, b) => a - b);
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

const shouldMigrateResultKeys = (resultsKeys, questionNumbers) => {
    if (!Array.isArray(resultsKeys) || resultsKeys.length === 0) {
        return { shouldMigrate: false, reason: 'missing-or-empty-result-keys' };
    }

    if (resultsKeys.some((key) => !isNumericString(key))) {
        return { shouldMigrate: false, reason: 'non-numeric-result-key' };
    }

    if (!isSequentialFromOne(resultsKeys)) {
        return { shouldMigrate: false, reason: 'result-keys-not-sequential-from-one' };
    }

    if (!Array.isArray(questionNumbers) || questionNumbers.length === 0) {
        return { shouldMigrate: false, reason: 'invalid-question-numbers' };
    }

    if (resultsKeys.length !== questionNumbers.length) {
        return { shouldMigrate: false, reason: 'length-mismatch' };
    }

    const normalizedResultKeys = [...resultsKeys].map((key) => Number(key)).sort((a, b) => a - b);
    const normalizedQuestionKeys = [...questionNumbers].map((num) => Number(num)).sort((a, b) => a - b);

    const sameAsQuestionNumbers =
        normalizedResultKeys.length === normalizedQuestionKeys.length &&
        normalizedResultKeys.every((value, index) => value === normalizedQuestionKeys[index]);

    if (sameAsQuestionNumbers) {
        return { shouldMigrate: false, reason: 'already-valid' };
    }

    return { shouldMigrate: true, reason: 'sequential-needs-remap' };
};

const remapSequentialResultKeysToQuestionNumbers = (results, questionNumbers) => {
    const orderedOldKeys = Object.keys(results)
        .map((key) => Number(key))
        .sort((a, b) => a - b);

    const remapped = {};
    orderedOldKeys.forEach((oldKey, index) => {
        const newKey = String(questionNumbers[index]);
        remapped[newKey] = results[String(oldKey)];
    });

    return remapped;
};

const getKeyRangeLabel = (keys) => {
    if (!Array.isArray(keys) || keys.length === 0) {
        return 'n/a';
    }

    const numbers = keys.map((key) => Number(key)).filter((num) => Number.isInteger(num));
    if (numbers.length === 0) {
        return 'n/a';
    }

    const sorted = numbers.sort((a, b) => a - b);
    return `${sorted[0]}..${sorted[sorted.length - 1]} (count=${sorted.length})`;
};

const commitInChunks = async (updates) => {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach((updateItem) => {
            batch.update(updateItem.ref, updateItem.data);
        });
        await batch.commit();
        console.log(`[write] committed ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
    }
};

const run = async () => {
    console.log(`[migration] start migrateHomeworkResultQuestionNumbers mode=${isWriteMode ? 'WRITE' : 'DRY-RUN'}`);

    const assignmentsSnapshot = await db.collection(HOMEWORK_ASSIGNMENTS).get();
    const assignmentMap = new Map();

    assignmentsSnapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        assignmentMap.set(docSnap.id, {
            id: docSnap.id,
            ...data,
            questionNumbers: normalizeQuestionNumberArray(data.questionNumbers),
        });
    });

    const resultsSnapshot = await db.collection(HOMEWORK_RESULTS).get();

    const summary = {
        totalHomeworkResultsCount: resultsSnapshot.size,
        migratedCandidateCount: 0,
        alreadyValidCount: 0,
        skippedCount: 0,
        manualReviewCount: 0,
    };

    const migrationSamples = [];
    const manualReview = [];
    const updates = [];

    for (const docSnap of resultsSnapshot.docs) {
        const data = docSnap.data() || {};
        const assignmentId = data.assignmentId || data.homeworkAssignmentId;
        const results = data.results;

        if (!assignmentId) {
            summary.manualReviewCount += 1;
            manualReview.push({ docId: docSnap.id, assignmentId: null, reason: 'missing-assignment-id' });
            continue;
        }

        const assignment = assignmentMap.get(String(assignmentId));
        if (!assignment) {
            summary.manualReviewCount += 1;
            manualReview.push({ docId: docSnap.id, assignmentId: String(assignmentId), reason: 'assignment-not-found' });
            continue;
        }

        const normalizedQuestionNumbers = assignment.questionNumbers;
        if (!normalizedQuestionNumbers) {
            summary.manualReviewCount += 1;
            manualReview.push({ docId: docSnap.id, assignmentId: String(assignmentId), reason: 'invalid-assignment-question-numbers' });
            continue;
        }

        if (!results || typeof results !== 'object' || Array.isArray(results)) {
            summary.manualReviewCount += 1;
            manualReview.push({ docId: docSnap.id, assignmentId: String(assignmentId), reason: 'invalid-results-object' });
            continue;
        }

        const resultKeys = Object.keys(results);
        if (resultKeys.length === 0) {
            summary.skippedCount += 1;
            continue;
        }

        const decision = shouldMigrateResultKeys(resultKeys, normalizedQuestionNumbers);

        if (decision.reason === 'already-valid') {
            summary.alreadyValidCount += 1;
            continue;
        }

        if (!decision.shouldMigrate) {
            summary.manualReviewCount += 1;
            manualReview.push({
                docId: docSnap.id,
                assignmentId: String(assignmentId),
                reason: decision.reason,
                oldKeyRange: getKeyRangeLabel(resultKeys),
                expectedKeyRange: getKeyRangeLabel(normalizedQuestionNumbers.map(String)),
            });
            continue;
        }

        const newResults = remapSequentialResultKeysToQuestionNumbers(results, normalizedQuestionNumbers);

        summary.migratedCandidateCount += 1;

        const sample = {
            docId: docSnap.id,
            assignmentId: String(assignmentId),
            oldKeyRange: getKeyRangeLabel(resultKeys),
            newKeyRange: getKeyRangeLabel(Object.keys(newResults)),
        };

        if (migrationSamples.length < 10) {
            migrationSamples.push(sample);
        }

        if (isWriteMode) {
            updates.push({
                ref: docSnap.ref,
                data: {
                    results: newResults,
                    legacyResultsBeforeQuestionNumberMigration: results,
                    migratedAt: FieldValue.serverTimestamp(),
                    migratedBy: MIGRATION_BY,
                    migrationVersion: MIGRATION_VERSION,
                },
            });
        }
    }

    if (isWriteMode && updates.length > 0) {
        await commitInChunks(updates);
    }

    const report = {
        mode: isWriteMode ? 'write' : 'dry-run',
        generatedAt: new Date().toISOString(),
        summary,
        sampleMigrations: migrationSamples,
        manualReview,
    };

    const reportFilePath = path.resolve(process.cwd(), 'migration-homework-results-report.json');
    fs.writeFileSync(reportFilePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log('--- MIGRATION SUMMARY ---');
    console.log(`total homeworkResults count: ${summary.totalHomeworkResultsCount}`);
    console.log(`migrated candidate count: ${summary.migratedCandidateCount}`);
    console.log(`already valid count: ${summary.alreadyValidCount}`);
    console.log(`skipped count: ${summary.skippedCount}`);
    console.log(`manual review count: ${summary.manualReviewCount}`);
    console.log('sample 10건:');
    console.table(migrationSamples);
    console.log('manual review list:');
    console.log(manualReview);
    console.log(`[migration] report written: ${reportFilePath}`);
    console.log(`[migration] done mode=${isWriteMode ? 'WRITE' : 'DRY-RUN'}`);
};

run().catch((error) => {
    console.error('[migration] failed', error);
    process.exitCode = 1;
});