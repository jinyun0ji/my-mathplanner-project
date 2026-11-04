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

## Actual transaction integration suite

`integration/reservationTransactions.emulator.test.cjs` is separate from the
existing eight Rules cases. The Rules suite verifies client authorization; this
suite uses the **real Admin Firestore SDK**, the unchanged callable `.run()`
entry points, and the existing identity resolver. No deployed callable or HTTP
Functions endpoint is invoked. In-memory doubles cannot prove the following:

| Emulator checks | Evidence/assertions |
| --- | --- |
| Both source collections | Original ID/data survive; revision increments; persisted Timestamp values reflect KST |
| Previous confirmation | Reconfirmation required; previous confirmedRevision/At/By retained |
| No-op and stale revision | Data and server updateTime unchanged; no lock write |
| Duplicate detection | Actual queries across both collections; different-hour same-day duplicate rejected |
| Permissions and activity states | Linked parent/anonymous denied; completed/no-show/cancelled/check-in denied |
| Server commit rejection | Append an update of a uniquely named missing document; Emulator must reject the entire commit (gRPC 5); reservation and existing lock updateTime unchanged |
| Failure recovery | Rejected update/creation leaves no partial reservation/lock; a subsequent normal call succeeds |
| Callback abort and SDK retry | Non-retryable staged callback failure rolls back; a one-time injected gRPC ABORTED (10) exercises the actual SDK retry loop and commits revision/lock only once |
| Real concurrent requests | Create vs move, same reservation edits, and two reservations moving to one empty student/day yield one winner and one expected rejection |
| Identity compatibility | Profile ID differs from Auth UID; review index, userUid alias queries and reverse-only links use the same canonical student/date lock |

Fault injection only adds a failing operation or error around the service callback;
it does not replace transaction reads, writes, rollback or commit with a fake.
The retryable error is injected deliberately: it does not prove that a particular
concurrent run incurred a natural server retry. Concurrent cases assert actual
server outcomes and fail on unexpected lock timeout/retry exhaustion. A barrier
releases requests before entering transactions, never while holding read locks.

Additional safety compared with the Rules suite:

- Port **8080 is refused**, even if explicitly specified. Port and exact loopback
  host/demo project are validated before **any Firebase import**.
- Credential-file bindings, Auth emulator and Functions-emulator runtime bindings
  are refused. Run in a fresh Node process. Auth `getUser` is replaced locally
  with an offline user-not-found result: no Auth service is contacted; Firestore
  and the production identity resolution code otherwise remain real.
- No Rules upload, emulator import/export, database reset, FCM or notification
  writes. Admin access intentionally bypasses Rules; keep the Rules suite separate.
- Each case has its own student profile and all IDs are fictional/unique. Exact
  seeded/staged document references (including auto-ID reservations and hashed
  locks) are tracked. Cleanup validates ownership and deletes only these documents,
  even following rejected commits. Interrupted/killed processes can leave their
  unique documents behind; no broad cleanup command is provided.

### Mac execution (Node.js 20)

Use a **separate Firestore-only Emulator**, without importing existing data and
without a Functions emulator. If it is already running on port 8081, skip the
startup example and run the test command below. Otherwise, in terminal A:

```sh
cd /Users/subin/Desktop/mathplanner/management_ver_2
CLINIC_TEST_REPO="$PWD"
CLINIC_TEST_DIR="$(mktemp -d /tmp/clinic-transaction-emulator.XXXXXX)"
node - "$CLINIC_TEST_REPO" "$CLINIC_TEST_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const [repo, temporary] = process.argv.slice(2);
fs.writeFileSync(path.join(temporary, 'firebase.json'), JSON.stringify({
  firestore: { rules: path.join(repo, 'firestore.rules') },
  emulators: {
    firestore: { host: '127.0.0.1', port: 8081 },
    hub: { host: '127.0.0.1', port: 4401 },
    logging: { host: '127.0.0.1', port: 4501 },
    ui: { enabled: false },
    singleProjectMode: true
  }
}, null, 2));
NODE
cd "$CLINIC_TEST_DIR"
firebase emulators:start --only firestore --project demo-clinic-reservation --config "$CLINIC_TEST_DIR/firebase.json"
```

The config and new emulator logs stay in that temporary directory. Repository
`.env`, firebase.json, existing logs, the existing 8080 emulator and its Rules/data
are untouched. If 8081/4401/4501 are occupied, use other free dedicated ports;
update the test command to match the Firestore port (never 8080). Do not run the
Rules suite or another writer in this demo namespace at the same time.

In terminal B, with Node.js 20 selected:

```sh
cd /Users/subin/Desktop/mathplanner/management_ver_2
node --version
env -u GOOGLE_APPLICATION_CREDENTIALS \
  -u FIREBASE_AUTH_EMULATOR_HOST -u FUNCTIONS_EMULATOR \
  CLINIC_EMULATOR_PORT=8081 \
  FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
  GCLOUD_PROJECT=demo-clinic-reservation \
  GOOGLE_CLOUD_PROJECT=demo-clinic-reservation \
  node --test functions/src/clinic/integration/reservationTransactions.emulator.test.cjs
```

Run this file on its own. Transaction instrumentation and per-case fixtures are
intentionally sequential; competing requests are explicitly launched inside the
concurrency cases. Stop only the dedicated emulator when done;
do not delete or reset an existing emulator's data.

At authoring time the Codex environment has no Firebase CLI/emulator binary and
the official emulator download is blocked with proxy HTTP 403. The real integration
cases have **not been run there**. Unit/guard and syntax checks are separate from
Emulator pass/fail results. Real server defects remain unconfirmed until this suite
is executed. If an integration case fails, retain its test name, expected vs actual
code/state and SDK/emulator versions; investigate production code separately before
changing it. Callable transport token/App Check validation is outside `.run()` tests.
