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

## Stage 2-B-1: manual confirmation server (not deployed)

`confirmClinicReservations` is a v1 callable in `us-central1`:

```json
{
  "reservations": [
    { "sourceCollection": "clinicReservations", "reservationId": "existing-id", "expectedRevision": 0 }
  ]
}
```

Require 1–20 items and only the fields above. Reject duplicate source/ID pairs,
even with different revisions, and malformed items before any write. No source
fallback. Both collections and identical IDs in different collections are supported.
Missing legacy revision means 0. A stale current revision is an individual failure.

Caller roles match 2-A: admin/staff/teacher/teaching/staffOrTeaching, resolved from
server profiles, never client role claims. The existing resolver receives an
offline Auth adapter: only the already-verified callable caller UID is known to
exist; arbitrary student document IDs are never assumed to be Auth UIDs. Canonical
student profiles support index links/aliases, reverse-only and unlinked profiles.
No Auth service, recipient lookup, notification settings or FCM is contacted.
Transactions re-read caller/student profile and index evidence before committing.
Both initial authorization and the transaction reject server-profile `active === false`.
`active === true` and a missing legacy active field remain role-authorized. Client
role/active claims are ignored; a concurrent profile deactivation is rechecked on
transaction retry. `deactivateStaff` itself is unchanged.

### Result and atomicity

Each reservation commits independently, in request order. Response: `results` and
`summary: { requested, confirmed, alreadyConfirmed, failed }`. Each result has the
request identity plus:

- `status: confirmed`, eventKey, reservationRevision, outboxState=pending;
- `status: already_confirmed`, original eventKey and current outboxState;
- `status: failed`, error `{code, message}`.

Authorization/input errors reject the callable. Callers must inspect item results;
a normal callable response does not mean all items succeeded. A lost commit response
may report failure despite a commit: retry then returns already_confirmed.
If the callable itself times out during a bulk request, earlier independent commits
may already exist. Reload and retry the same keys; never assume bulk rollback.

Every transaction reads reservation, history, outbox and identity evidence before
writes. It validates revision, future KST time and pending activity state, then:

1. Creates `clinicReservationConfirmations/{eventKey}` with `tx.create`.
2. Creates `clinicConfirmationOutbox/{eventKey}` with `tx.create`.
3. Updates root confirmation fields and derived time metadata.

All three commit or none commit. Event keys hash an unambiguously JSON-encoded
version/source/ID/revision tuple; stored full identity is checked on retries.
History contains canonical student profile ID, source path, revision, date/time
and Timestamp snapshots, Asia/Seoul, actor Auth UID/profile ID and server confirmedAt.
The previous root confirmedRevision/At/By tuple is preserved in previousConfirmation,
including legacy evidence without a prior history document. This does not create
a verified historical delivery receipt.

Root confirmedAt, history confirmedAt and outbox createdAt use a server timestamp
transform in the same commit. Retries never refresh first actor/time or overwrite
history/outbox state. History is server-created only; Rules deny client writes.
Privileged Admin SDK access is **not** absolutely immutable.

Outbox starts pending, attempts=0, null owner/leaseUntil/attempt timestamps/lastError,
and empty recipientResults with recipientResolution=not_started. Defined states:
pending/deferred/processing/partial/completed/superseded. There is **no consumer**.

### Notification independence and compatibility

Notification OFF or FCM/recipient failure does not block confirmation: those
systems are neither imported nor invoked. A future worker owns flag checks and
deferred/retry transitions. If Firestore itself rejects the transaction, including
an outbox write, confirmation also fails to preserve required database atomicity.

- No notification items, FCM, UI, comment/no-show changes or Scheduler.
- 2-A production creation/time-update code and student/date locks are unchanged.
  Confirmation serializes with time edits through the same reservation document.
- Legacy confirmation backfills revision=0 and derives reservationStartsAt and
  reminderDueAt from server date/plannedTime without changing date/time or
  incrementing revision. Other activity/link/comment/notificationSent data survive.
- A later 2-A time edit increments revision and requires reconfirmation, preserving
  prior root confirmation evidence. Reconfirmation creates a new event. Old history
  and outbox remain; the future worker MUST reject outdated revisions/statuses.
- Confirmation winning a race can validly be followed by a time edit, leaving
  reconfirmation_required. An edit winning first rejects the old confirmation.
- Missing/partial/mismatched receipts or same-revision legacy confirmed metadata
  return failed-precondition for explicit review, never silent repair/re-notification.
  notificationSent is not confirmation evidence. Duplicate requests still require
  valid activity/future time; expired/completed reservations are rejected unchanged.
- Different legacy reservation IDs on one student/day are not deduplicated by
  confirmation; booking conflict prevention remains 2-A's responsibility.

Rules allow existing staff-group readers to read history and deny all client
history writes. Outbox reads/writes are denied to all clients, including staff.
Latest confirmation remains visible on the original document; internal recipient
receipts must not be copied there. Existing source Rules permissions are unchanged.

### Mac verification

Start the dedicated Firestore-only emulator as described above (never 8080, demo
project only). Run the suites sequentially:

```sh
cd /Users/subin/Desktop/mathplanner/management_ver_2
env -u GOOGLE_APPLICATION_CREDENTIALS \
  -u FIREBASE_AUTH_EMULATOR_HOST -u FUNCTIONS_EMULATOR \
  CLINIC_EMULATOR_PORT=8081 FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
  GCLOUD_PROJECT=demo-clinic-reservation GOOGLE_CLOUD_PROJECT=demo-clinic-reservation \
  node --test --test-concurrency=1 \
  functions/src/clinic/integration/reservationRules.emulator.test.cjs \
  functions/src/clinic/integration/reservationTransactions.emulator.test.cjs \
  functions/src/clinic/integration/confirmationRules.emulator.test.cjs \
  functions/src/clinic/integration/confirmationTransactions.emulator.test.cjs
```

Original Rules 8 and transaction 19 cases are unchanged. New Rules 5 cover staff
history reads, denied history writes/outbox access and source permission regression.
New transaction 10 cover both sources, server timestamps/no-op retries, concurrent
confirmation, server-rejected commit/retry, reconfirmation history, 2-A edit races
and item-independent failures with notification OFF, plus initial/mid-request
deactivation and concurrent deactivation/confirmation. The bulk failure case also
checks the exact error, unchanged data/updateTime, absent history/outbox, and the
successful item's exact source/ID. New entry guards are unit-tested.

The new Rules suite uploads repository Rules only to the guarded non-8080 demo
emulator. Transaction suites never upload Rules. Cleanup only deletes owned test
documents; no database reset or notifications. The in-memory double adds create-only
preconditions; confirmation unit tests also exercise the unchanged 2-A factory.

Codex cannot currently execute the emulator (no CLI/binary; official download blocked
with HTTP 403). Actual integration outcomes remain unverified until the Mac run;
unit/syntax/SDK registration checks are separate. `.run()` does not test HTTPS token/
App Check transport. Before any deployment, check that the retired clinic automatic
notification function is not still deployed: local export removal does not remove
a remote trigger.

## Stage 2-B-2a: internal Outbox → Inbox service (not activated)

`createClinicConfirmationOutboxService({ db, auth, ...options }).process(eventKey)`
in `confirmationOutbox.js` is an internal factory with explicit dependencies.
It registers **no callable, Outbox trigger or Scheduler**. The confirmation API,
2-A production code, common FCM trigger, UI and report/message logic are unchanged.
Auth must provide the real Admin `getUser` interface in any future server caller;
tests provide a fictional account map and never contact operational Auth.

**Do not invoke/activate this service on a live project before 2-B-2b.** Creating
an inbox is already an FCM event in the existing `onNotificationItemCreated`.
That handler does NOT yet inspect the new event/revision/receipt fields. A pending
push receipt is preparation data, not an effective FCM suppression flag. This
stage's tests must run with **Firestore only**, without a Functions emulator.

### State and transaction rules

| Current situation | Outcome |
| --- | --- |
| Due pending/deferred/partial or expired processing | Claim processing with UUID owner, increment attempts, set lastAttemptedAt and leaseUntil |
| Valid processing lease | busy; no changes |
| Future nextAttemptAt | not_due; no changes |
| Sending OFF | deferred, notification_disabled, future nextAttemptAt; no new inbox/Auth work at claim, no confirmation changes |
| Successful eligible recipients, no unresolved issues | completed: **inbox creation only**, not FCM success |
| Lookup/conflict/write/limit failure | partial; nextAttemptAt set, prior successes retained |
| Old revision, changed confirmation/time/student, inactive/started/deleted/past reservation | superseded; no new inbox |
| Expired/replaced owner after claim | lease_lost; old worker cannot publish or change the new owner's result |

Outbox identity fields/schemaVersion and the original six state values are retained.
busy/not_due/lease_lost/not_found are method outcomes, never persisted as new states.
Completed and superseded are terminal for target discovery. Reprocessing a completed
event whose source has changed can mark it superseded without touching existing
inboxes or push receipts. New parent links after completion do not silently resend
the old event. Deferred/partial work becomes retryable after nextAttemptAt.

Claim, paired creation and finalization use transactions. Every read precedes
writes. Source/history/outbox are re-read for every batch; owner/lease and sending
flag are checked again before writes. Concurrent source or profile/index changes
conflict with reads or invalidate recipient evidence. No Auth calls occur inside a
transaction. Auth disabled/account changes after lookup cannot be made atomic with
Firestore: 2-B-2b must revalidate before push, as agreed in plan A.

Defaults: lease 120 seconds, retry delay 30 seconds, 25 recipients per write batch,
200 resolved recipients per event. Each batch writes at most 25 inboxes + 25
receipts + one outbox update. Existing results are bounded to 500 entries/128 KiB;
new documents to 16 KiB each and estimated atomic writes to 2 MiB. Oversized plans
fail explicitly/partially instead of truncating into completed. These budgets are
below Firestore's limits; SDK/server enforcement still applies. Auth lookup time
must fit the configurable lease (up to ten minutes); expiration safely refuses
publication rather than extending an abandoned owner indefinitely.

### Recipient policy

`confirmationRecipients.js` adapts the report recipient field shapes and shared
Auth alias constants; neither existing recipient module is modified. It supports
student-side parent fields and parent-side child arrays, strings/{id}/references,
reverse userAuthIndex links and multiple verified login accounts. Even a legacy
equal-ID account requires an actual successful Auth lookup; no profile-ID fallback.
Each UID must exist, match its requested UID, be non-disabled and have consistent
binding evidence. active=false profiles are excluded; missing active is allowed.
An inactive/disabled student login is excluded individually; a separately active,
validly linked parent can still receive. Exclusions are recorded as such, not
reported as successful deliveries to that excluded account.

If both directions declare relationship data, contradictory/empty lists are treated
as conflicts, rather than unioned into a guessed parent. Direct-only or reverse-only
links are supported when the other direction is absent. Multiple profile claims
for an unindexed UID are ambiguous and excluded; a correct explicit forward index
keeps its rightful profile while excluding conflicting claims. Duplicate fields or
links to the same verified account produce one target. Known good targets continue
when another parent has a broken link or transient Auth error. Selected profile/
binding snapshots are hashed in memory and re-read in the inbox transaction; raw
profile data or credentials are never stored in receipts.

Bounds: up to 1000 parent profiles scanned, 50 Auth candidates per profile plus
the optional equal-ID candidate, and 500 unique Auth lookups per resolution.
Limits are explicit issues. Missing links, binding conflicts, inactive/disabled
exclusions and retryable Auth/read errors have different reason codes. Issues and
exclusions are stored with total counts and a 100-entry bounded detail list.

### Inbox and delivery receipt

`notificationIdFor(eventKey, authUid)` hashes JSON `[eventKey, authUid]` with prefix
`clinicConfirmationInbox_`. The same ID identifies its private receipt:

- `notifications/{authUid}/items/{notificationId}`
- `clinicConfirmationDeliveries/{notificationId}`

Inbox uses the existing builder: type=`CLINIC_RESERVATION_CONFIRMED`,
category=`clinicConfirmation`, title=`클리닉 예약 완료`, body=`YYYY-MM-DD HH:mm`
from the immutable confirmation snapshot. ref/refCollection/refId identify the
exact source; studentId is the canonical profile ID. Both inbox and receipt include
schemaVersion=1, deliveryKind=clinic_confirmation, eventKey, sourceCollection,
reservationId, sourcePath, reservationRevision, studentProfileDocId,
recipientAuthUid, notificationId and deliveryId.

Receipt adds confirmationRef/outboxRef/inboxPath, recipientProfileIds/recipientRoles,
inboxState=created, inboxCreatedAt, createdAt and updatedAt. Future push fields:
pushState=pending, pushAttempts=0, and null pushOwner/pushLeaseUntil/
pushNextAttemptAt/pushLastAttemptedAt/pushLastError/pushAcceptedAt. They are never
consumed here. Rules deny all client receipt reads/writes, including staff.

Only absent **pairs** are created with tx.create. Matching existing pairs are
never overwritten: isRead/readAt/createdAt and future accepted/unknown push states
survive retries. One-sided or conflicting pairs fail closed for that UID, while
normal targets continue. The service does not reconstruct a missing receipt as
push-pending, or recreate a deleted inbox and accidentally trigger a second push.
Per-UID outbox recipientResults summarize inbox creation and point at the receipt;
they do not claim FCM success. A rejected/lost-ack batch is safely retried by
reading the same deterministic pairs. Prior batches survive later batch failure.

### Verification and remaining 2-B-2b work

Run the existing Node.js 20 unit command above. New unit files cover real recipient
logic with fictional Auth, lease takeover, staged-write conflicts, paired rollback,
read/push-state preservation, partial retries, limits and OFF/test-UID behavior.
Existing 2-B-1 and 2-A tests remain part of that command.

With the existing dedicated **Firestore-only** emulator on 8081, from Mac repo root:

```sh
env -u GOOGLE_APPLICATION_CREDENTIALS \
  -u FIREBASE_AUTH_EMULATOR_HOST -u FUNCTIONS_EMULATOR \
  CLINIC_EMULATOR_PORT=8081 FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 \
  GCLOUD_PROJECT=demo-clinic-reservation GOOGLE_CLOUD_PROJECT=demo-clinic-reservation \
  node --test --test-concurrency=1 \
  functions/src/clinic/integration/confirmationOutbox.emulator.test.cjs \
  functions/src/clinic/integration/confirmationInboxRules.emulator.test.cjs
```

These add 12 transaction/recipient cases plus two Rules cases. Auth is fictional,
Firestore transactions are real. Only the new Rules suite uploads repository Rules
to the guarded demo emulator. No 8080/production/Auth/FCM/Functions access, database
reset or unrelated cleanup. Run separately from other writers; do not start/load
Functions alongside these inbox-writing tests. The original four-suite command
still verifies the existing 42 cases. Actual emulator outcomes in Codex are **not
verified**; SDK registration/syntax checks are not emulator execution.

Before activation, 2-B-2b must add a new-type branch in the common FCM trigger that
validates the private receipt and current revision/relationship immediately before
push, claims push ownership, records accepted/failed/unknown outcomes and never
automatically resends unknown outcomes. Recovery must inspect push state even when
the outbox is inbox-completed; direct push from this service would double-send.
Parent filtering, Auth UID subscriptions, click navigation and legacy remote clinic
trigger retirement also remain separate prerequisites. No UI changes are included.
