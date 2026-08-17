const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { getRecipientsForStudent } = require('./src/notify/recipients');

const pick = (obj, keys) => {
  const out = {};
  keys.forEach((k) => {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  });
  return out;
};

const isSame = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// clinicLogs -> notifications payload builder
function buildNotificationPayload({ type, title, body, refId, data }) {
  return {
    type,                 // e.g. 'clinic'
    title,
    body,
    refCollection: 'clinicLogs',
    refId,                // clinic log doc id
    data: data || {},     // extra context for navigation
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

// upsert notification item
async function upsertNotificationItem({ userUid, notificationId, payload }) {
  const itemRef = db.collection('notifications').doc(userUid).collection('items').doc(notificationId);
  await itemRef.set(payload, { merge: true });

  // meta 문서가 이미 존재/사용 중이라면 업데이트(없어도 문제 없게 merge)
  const metaRef = db.collection('notifications').doc(userUid).collection('meta').doc('meta');
  await metaRef.set(
    {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

// Determine event type from before/after
function resolveClinicEvent(before, after) {
  // created
  if (!before && after) return 'created';
  // deleted
  if (before && !after) return 'deleted';
  // updated
  return 'updated';
}

// Only notify on meaningful updates
function isMeaningfulClinicUpdate(before, after) {
  // compare only key fields that matter to parents/students
  const keys = ['date', 'checkIn', 'checkOut', 'tutor', 'comment', 'notes', 'status'];
  const b = pick(before, keys);
  const a = pick(after, keys);
  return !isSame(b, a);
}

// Create title/body based on event+fields
function makeClinicMessage(event, before, after) {
  const src = after || before || {};
  const date = src.date || '';
  const checkIn = src.checkIn || '';
  const checkOut = src.checkOut || '';
  const tutor = src.tutor || '';

  if (event === 'deleted') {
    return {
      title: '📅 클리닉 일정이 취소됐어요',
      body: date && checkIn ? `${date} ${checkIn} 예약이 취소되었습니다.` : '클리닉 일정이 취소되었습니다.',
    };
  }

  // created or updated
  const isCompleted = !!checkOut;
  if (isCompleted) {
    return {
      title: '✅ 클리닉이 완료됐어요',
      body: date && checkIn ? `${date} ${checkIn} 클리닉이 완료되었습니다.` : '클리닉이 완료되었습니다.',
    };
  }

  // reservation/changed
  if (event === 'created') {
    return {
      title: '📅 클리닉 예약 알림',
      body: date && checkIn ? `${date} ${checkIn}에 클리닉이 예약되어 있어요.` : '클리닉이 예약되어 있어요.',
    };
  }

  // updated but not completed
  return {
    title: '🔄 클리닉 일정이 변경됐어요',
    body: date && checkIn ? `${date} ${checkIn} 클리닉 일정이 변경되었습니다.` : '클리닉 일정이 변경되었습니다.',
  };
}

exports.onClinicLogsWriteCreateNotifications = functions
  .region('us-central1')
  .firestore.document('clinicLogs/{logId}')
  .onWrite(async (change, context) => {
    const logId = context.params.logId;

    const beforeExists = change.before.exists;
    const afterExists = change.after.exists;

    console.log('[clinicNotifications] TRIGGERED', {
      logId,
      beforeExists,
      afterExists,
    });

    const before = beforeExists ? change.before.data() : null;
    const after = afterExists ? change.after.data() : null;

    const event = resolveClinicEvent(before, after);

    // clinicLogs에서 studentDocId는 studentId 필드로 들어온다고 했음
    const studentDocId = (after || before || {}).studentId || null;

    // 수신자 목록 만들기
    const recipients = await getRecipientsForStudent(studentDocId);
    const receivers = recipients
      ? [...new Set([recipients.studentUid, ...recipients.parentUids].filter(Boolean))]
      : [];

    if (receivers.length === 0) {
      console.warn('[clinicNotifications] no receivers', { logId, studentDocId });
      return null;
    }

    const { title, body } = makeClinicMessage(event, before, after);

    // 중복 방지: (logId + event + checkOut 존재 여부) 정도로 결정적 id
    // - created: logId_created
    // - deleted: logId_deleted
    // - updated: logId_updated
    // - completed 상태 변화는 updated로 들어오지만 checkOut 유무로 메시지가 달라서 id에 suffix 추가
    const completedSuffix = (after || {}).checkOut ? '_completed' : '';
    const notificationId = `${logId}_${event}${completedSuffix}`;

    const payload = buildNotificationPayload({
      type: 'clinic',
      title,
      body,
      refId: logId,
      data: {
        studentId: studentDocId,
        date: (after || before || {}).date || null,
        checkIn: (after || before || {}).checkIn || null,
        checkOut: (after || before || {}).checkOut || null,
        tutor: (after || before || {}).tutor || null,
      },
    });

    // fan-out write
    await Promise.all(
      receivers.map((userUid) =>
        upsertNotificationItem({
          userUid,
          notificationId,
          payload,
        }),
      ),
    );

    console.log('[clinicNotifications] notified', {
      logId,
      event,
      receiversCount: receivers.length,
      receivers,
      studentDocId,
    });

    return null;
  });
