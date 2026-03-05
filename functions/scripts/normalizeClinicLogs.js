// functions/scripts/normalizeClinicLogs.js
/* eslint-disable no-console */
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length === 0) admin.initializeApp();
  return admin.firestore();
}

function ymdFromAny(v) {
  if (!v) return '';
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return '';
  }
  if (typeof v.toDate === 'function') {
    return v.toDate().toISOString().slice(0, 10);
  }
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  } catch (_) {}
  return '';
}

async function docExists(db, col, id) {
  if (!id) return false;
  const snap = await db.collection(col).doc(String(id)).get();
  return snap.exists;
}

async function findUserDocIdByAuthUid(db, authUid) {
  if (!authUid) return '';
  const q = await db.collection('users').where('authUid', '==', String(authUid)).limit(2).get();
  if (q.empty) return '';
  if (q.size > 1) {
    console.warn('[WARN] multiple users matched authUid=', authUid, 'docIds=', q.docs.map((d) => d.id));
  }
  return q.docs[0].id;
}

async function findClassIdByName(db, name) {
  if (!name) return '';
  const q = await db.collection('classes').where('name', '==', String(name)).limit(2).get();
  if (q.empty) return '';
  if (q.size > 1) {
    console.warn('[WARN] multiple classes matched name=', name, 'docIds=', q.docs.map((d) => d.id));
  }
  return q.docs[0].id;
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    limit: 0,
    start: '',
    end: '',
  };

  argv.forEach((a) => {
    if (a === '--dryRun') out.dryRun = true;
    if (a.startsWith('--limit=')) out.limit = Number(a.split('=')[1]) || 0;
    if (a.startsWith('--start=')) out.start = String(a.split('=')[1] || '').trim();
    if (a.startsWith('--end=')) out.end = String(a.split('=')[1] || '').trim();
  });

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = initAdmin();

  console.log('[normalizeClinicLogs] args=', args);

  let q = db.collection('clinicLogs');

  // date range는 date 필드 기준(정규화 후 안정)
  if (args.start) q = q.where('date', '>=', args.start);
  if (args.end) q = q.where('date', '<=', args.end);

  // 주의: where+orderBy 인덱스 필요할 수 있음. 일단 orderBy 없이 가져오고,
  // limit이 있으면 createdAt 기준으로 제한하는 방식으로 안전 처리.
  if (args.limit > 0) q = q.limit(args.limit);

  const snap = await q.get();
  console.log('[normalizeClinicLogs] fetched=', snap.size);

  let touched = 0;
  let skipped = 0;
  let failed = 0;

  const skipReasons = new Map();

  let batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const id = doc.id;
    const data = doc.data() || {};

    try {
      const legacyKeys = {
        authUid: data.authUid || null,
        studentUid: data.studentUid || null,
        studentId: data.studentId || null,
        classId: data.classId || null,
        classDocId: data.classDocId || null,
        className: data.className || null,
      };

      const nextDate = ymdFromAny(data.date) || ymdFromAny(data.clinicDate) || ymdFromAny(data.createdAt) || '';

      // studentId resolve
      let nextStudentId = '';
      const candStudentId = String(data.studentId || '').trim();
      const candStudentUid = String(data.studentUid || '').trim();
      const candAuthUid = String(data.authUid || '').trim();

      if (candStudentId && (await docExists(db, 'users', candStudentId))) nextStudentId = candStudentId;
      else if (candStudentUid && (await docExists(db, 'users', candStudentUid))) nextStudentId = candStudentUid;
      else if (candAuthUid) nextStudentId = await findUserDocIdByAuthUid(db, candAuthUid);

      if (!nextStudentId) {
        skipped++;
        const r = 'studentId-unresolved';
        skipReasons.set(r, (skipReasons.get(r) || 0) + 1);
        continue;
      }

      // classId resolve
      let nextClassId = '';
      const candClassId = String(data.classId || '').trim();
      const candClassDocId = String(data.classDocId || '').trim();
      const candClassName = String(data.className || '').trim();

      if (candClassId && (await docExists(db, 'classes', candClassId))) nextClassId = candClassId;
      else if (candClassDocId && (await docExists(db, 'classes', candClassDocId))) nextClassId = candClassDocId;
      else if (candClassName) nextClassId = await findClassIdByName(db, candClassName);

      if (!nextClassId) {
        skipped++;
        const r = 'classId-unresolved';
        skipReasons.set(r, (skipReasons.get(r) || 0) + 1);
        continue;
      }

      const plannedTime =
        String(data.plannedTime || '').trim() ||
        String(data.timeSlot || '').trim() ||
        String(data.planned_time || '').trim() ||
        '';

      // studentAuthUid 보조
      let studentAuthUid = String(data.studentAuthUid || '').trim();
      if (!studentAuthUid) {
        const st = await db.collection('users').doc(nextStudentId).get();
        const au = st.exists ? String(st.data()?.authUid || '').trim() : '';
        if (au) studentAuthUid = au;
      }

      const patch = {};
      if (nextDate && String(data.date || '').trim() !== nextDate) patch.date = nextDate;
      if (String(data.studentId || '').trim() !== nextStudentId) patch.studentId = nextStudentId;
      if (String(data.classId || '').trim() !== nextClassId) patch.classId = nextClassId;
      if (plannedTime && String(data.plannedTime || '').trim() !== plannedTime) patch.plannedTime = plannedTime;
      if (studentAuthUid && String(data.studentAuthUid || '').trim() !== studentAuthUid) {
        patch.studentAuthUid = studentAuthUid;
      }

      // legacyKeys 백업(최소 1번은 남김)
      patch.legacyKeys = { ...(data.legacyKeys || {}), ...legacyKeys };

      if (Object.keys(patch).length <= 1) {
        // legacyKeys만 바뀌는 경우는 굳이 안 건드려도 됨
        skipped++;
        const r = 'already-normalized';
        skipReasons.set(r, (skipReasons.get(r) || 0) + 1);
        continue;
      }

      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      if (args.dryRun) {
        console.log('[dryRun] wouldUpdate', id, patch);
      } else {
        batch.set(db.collection('clinicLogs').doc(id), patch, { merge: true });
        batchCount++;
        if (batchCount >= 450) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }

      touched++;
    } catch (e) {
      failed++;
      console.error('[FAIL]', id, e);
    }
  }

  if (!args.dryRun && batchCount > 0) {
    await batch.commit();
  }

  console.log('[normalizeClinicLogs] done:', { touched, skipped, failed });

  const top = Array.from(skipReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log('[normalizeClinicLogs] skipReasonsTop=', top);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});