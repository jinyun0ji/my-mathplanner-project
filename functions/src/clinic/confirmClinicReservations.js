const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { createClinicConfirmationService } = require('./confirmationService');

const confirmClinicReservations = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context?.auth?.uid) throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
    return createClinicConfirmationService({ db: getFirestore() }).confirmReservations(data, context);
});

module.exports = { confirmClinicReservations };
