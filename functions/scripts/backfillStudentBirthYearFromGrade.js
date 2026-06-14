/* eslint-disable no-console */
/**
 * 기존 학생 grade를 birthYear로 보강합니다. grade 필드는 삭제하지 않습니다.
 *
 * Dry run: node functions/scripts/backfillStudentBirthYearFromGrade.js
 * 실제 반영: node functions/scripts/backfillStudentBirthYearFromGrade.js --write
 * 기준 연도 지정: node functions/scripts/backfillStudentBirthYearFromGrade.js --year=2026 --write
 */
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--write');
const yearArg = process.argv.find((arg) => arg.startsWith('--year='));
const baseYear = Number(yearArg?.split('=')[1] || new Date().getFullYear());
const gradeOffsets = { 고1: 16, 고2: 17, 고3: 18 };
const BATCH_SIZE = 400;

async function main() {
  if (!Number.isInteger(baseYear)) throw new Error('유효한 기준 연도가 필요합니다.');
  console.log(`[backfillStudentBirthYearFromGrade] start mode=${dryRun ? 'dry-run' : 'write'} baseYear=${baseYear}`);

  const snapshot = await db.collection('users').where('role', '==', 'student').get();
  const targets = snapshot.docs.filter((studentDoc) => {
    const data = studentDoc.data();
    return gradeOffsets[data.grade] && (data.birthYear === null || data.birthYear === undefined || data.birthYear === '');
  });

  targets.forEach((studentDoc) => {
    const data = studentDoc.data();
    console.log({
      id: studentDoc.id,
      name: data.name || '',
      grade: data.grade,
      birthYear: baseYear - gradeOffsets[data.grade],
    });
  });

  if (!dryRun) {
    for (let index = 0; index < targets.length; index += BATCH_SIZE) {
      const batch = db.batch();
      targets.slice(index, index + BATCH_SIZE).forEach((studentDoc) => {
        const data = studentDoc.data();
        batch.update(studentDoc.ref, {
          birthYear: baseYear - gradeOffsets[data.grade],
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }

  console.log(`[backfillStudentBirthYearFromGrade] complete ${dryRun ? 'candidates' : 'updated'}=${targets.length}`);
}

main().catch((error) => {
  console.error('[backfillStudentBirthYearFromGrade] failed', error);
  process.exitCode = 1;
});
