# Clinic 2-A: reservation time editing (not deployed)

## API

`updateClinicReservationTime` is a v1 callable in `us-central1`. Required request:

```json
{
  "sourceCollection": "clinicReservations",
  "reservationId": "existing-document-id",
  "expectedRevision": 0,
  "date": "2030-02-02",
  "plannedTime": "15:30"
}
```

Only `clinicReservations` and `clinicLogs` are accepted. Never falls back to a
different collection. All five fields are required; other fields are rejected.
Identity comes from the existing server profile/index resolver, not caller claims.
Allowed roles match existing clinic Rules: admin, staff, teacher, teaching,
staffOrTeaching. Dates are strict Gregorian `YYYY-MM-DD`; times are 24-hour
`HH:mm` in Asia/Seoul (+09:00), and must be in the future.

Returns `{ok, changed, sourceCollection, reservationId, reservationRevision}`;
changed responses also include `confirmationStatus`. Stale revisions return
`aborted`; clients must reload and ask the operator to review rather than blindly
retrying with a guessed revision. Terminal, started, cancelled, deleted or unknown
activity states fail closed. Unreserved activity records are not reservations.

## Data and concurrency

- Missing legacy `reservationRevision` means 0. Identical canonical date/time is
  a true no-op; no metadata backfill or revision change happens.
- A real change increments the revision and updates date/plannedTime, existing
  timeSlot/time/slot aliases, updatedAt/updatedBy, and server-managed fields.
  ID, activity status, comments, tutor, student links, staff memo references and
  legacyPayload stay intact. No migration or account-link write is performed.
- `reservationStartsAt` is a Firestore Timestamp. `reminderDueAt` is D-1 at
  **18:00 KST**, not 24 hours before start. No scheduler consumes it in 2-A.
- New reservations initialize revision 0 and `confirmationStatus: unconfirmed`.
  An actual change to a previously confirmed reservation sets
  `reconfirmation_required` (UI label: 재확정 필요); prior confirmedRevision,
  confirmedAt and confirmedBy are retained as historical evidence. No path in
  2-A sets a reservation to confirmed. `notificationSent` is preserved and is
  never used as confirmation evidence. Confirmation send history belongs to 2-B.
- Duplicate means the same student has another active reservation on that KST
  calendar date, even at a different hour, matching the existing creation policy.
  Both collections and linked Auth/demo aliases are checked. Booking identity
  can use an existing unlinked student profile without inventing an Auth UID.
- Creation and time updates use a shared `_clinicReservationDateLocks/{sha256}`
  document derived from canonical student profile ID/date. Transactions read
  the reservation, lock, and both date queries **before** writes. The lock and
  reservation commit atomically, serializing competing moves and creation.
  Admin SDK handles transaction retries; stale application revisions still fail.
- Each date query is capped at 501 documents. More than 500 in either collection
  returns `resource-exhausted` instead of silently skipping duplicates. Only the
  built-in date single-field index is needed (unless exempted in deployment).
  Lock documents are server-only and currently retained; no cleanup job is added.

## Rules and preserved behavior

Managed fields: reservationRevision, reservationStartsAt, reminderDueAt,
confirmationStatus, confirmedRevision, confirmedAt, confirmedBy. Client additions,
updates and removals are blocked. Reserved date/time changes require the callable.
Existing signed-in read access, staff deletion, comment/check-in/check-out/status
updates and unreserved activity creation/corrections remain allowed. Reservation
creation already uses createClinicReservation; direct client creation of booking
documents is now blocked. Legacy bulk/admin import scripts bypass Rules and must
participate in this lock protocol if used concurrently with live operations.

The existing broad signed-in clinic reads and staff permissions for other fields
are preserved, not audited or tightened by this change. Current UI time editing
must use this callable in a subsequent UI task; protected time fields cannot be
changed through generic updateDoc. Existing comment updates must retain the exact
stored booking time and managed fields rather than submit stale copies.

The root Functions entry no longer imports/exports
`onClinicLogsWriteCreateNotifications`; its source is retained for reference and
shared-code regression tests. `auditClinicLogs`, common notification/FCM/identity
code, and manual comment/no-show paths are unchanged. Removing a local export does
**not** disable an already deployed function. Deployment and explicit retirement
of that remote function need a separate approved operational step.

## Verification (Node.js 20)

From repository root, with Node.js 20 on PATH:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS node --test \
  functions/src/clinic/__tests__/*.test.js \
  functions/src/triggers/__tests__/*.test.js \
  functions/src/identity/__tests__/*.test.js \
  functions/src/notify/__tests__/*.test.js \
  functions/src/lessonReports/__tests__/*.test.js \
  functions/src/lessonReports/integration/emulator-safety.test.js
```

Unit tests use a local optimistic transaction double and fictional IDs; no Firebase
app, production service, notification document, or FCM request is used. Rules source
assertions do not prove actual authorization. Run the separate Rules suite against
an already running Firestore-only emulator, isolated from any Functions emulator:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS \
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
  CLINIC_EMULATOR_PORT=8081 \
  GCLOUD_PROJECT=demo-clinic-reservation \
  node --test functions/src/clinic/integration/reservationRules.emulator.test.cjs
```

`CLINIC_EMULATOR_PORT` is required (canonical decimal integer 1–65535); there is no
default. Start a separate Firestore-only emulator on the selected port first.
`FIRESTORE_EMULATOR_HOST` must exactly equal `127.0.0.1:${CLINIC_EMULATOR_PORT}`;
localhost, external hosts, mismatched ports and production project IDs are refused.
The suite refuses different/missing bindings before SDK imports. It uploads Rules
only to the demo emulator namespace, uses mock client tokens, and deletes only its
unique documents. It must not share this demo namespace with other tests. No FCM
SDK or Functions emulator is involved. SDK transactions and actual Rules must still
be verified against an available emulator before deployment; the in-memory double
does not model real RPC failures or server lock timing.

No manual confirmation API/UI, previous-day scheduler, notification creation,
deployment, account migration or commit is part of 2-A.
