# Lesson report dispatch service (not connected to runtime)

This module registers no Cloud Functions, Scheduler, HTTP/callable endpoint or FCM
sender. Existing exports, clients, flags, rules, account data and other notification
features remain unchanged. Instantiate `createLessonReportService({ db, auth })`
only in a future authenticated server integration. Tests supply entirely in-memory
dependencies; they never initialize an Admin app or contact Firebase.

## Public API

- `dispatch({ reportId, mode: 'now' | 'scheduled', expectedRevision })` creates the
  first-publication event, once per report and recipient. Completion means inbox
  documents exist, **not** that FCM accepted or a device displayed/read a push.
- `schedule({ reportId, scheduledSendAt, expectedRevision })` explicitly enrolls
  one draft report, increments its revision and sets the service version marker.
- `cancelSchedule({ reportId, expectedRevision })` cancels a pending schedule and
  invalidates stale workers. A live processing lease returns `busy`. Only a legacy
  partial receipt returns `dispatch_already_started`; new failed attempts leave no
  partial items and may be edited/cancelled. Already emitted pushes cannot be
  recalled. A caller must display these results instead of claiming success.
- `saveContent({ reportId, content, expectedRevision })` accepts a strict whitelist
  of report content fields. It preserves schedules, increments the revision, and
  preserves published status/sentAt while repairing a legacy sent/draft mismatch.
  Identity, class/date keys and delivery fields cannot be patched through this API.

All calls require an existing `lessonReports/{reportId}`. Read its
`dispatchRevision` (missing means 0) and submit that integer; stale/missing revisions
are rejected. This module is an internal trusted service, **not an authorization
boundary**. Future endpoints must authenticate staff, authorize access, validate
content and derive actor fields server-side. No generic user-provided report or
recipient list is accepted by `dispatch`.

## Identity compatibility

The report's `studentId` may be a users profile document ID or a linked Auth UID.
The adapter uses the existing `createUserIdentityResolver`, forward and reverse
`userAuthIndex` lookups, users profile alias fields, direct parent fields and all
legacy child arrays supported by the client. Strings, `{id}` objects and document
references are normalized. Only student/parent profiles qualify. Every resulting
UID must exist in Firebase Auth and be enabled; a UID indexed to a different
profile is excluded. No profile ID is blindly treated as an Auth UID.

All verified Auth accounts bound to the same profile are included, including a
review/demo login and an original account if both are valid. UIDs are deduplicated
across aliases, profiles and roles. Staff/institute review accounts are not
promoted to student/parent recipients. No link/index/user is written or migrated.
Missing linked profiles/verified UIDs fail resolution before creating any items;
they are not silently omitted to claim complete success.

Unlike the shared resolver's canonical `studentIds` query, legacy object/reference
arrays require reading parent profiles. This adapter bounds that role query at
1000 parents; exceeding it fails explicitly. Deployment review must assess that
read cost and bound. Do not raise it blindly or silently truncate recipients.
No new interpretation of accountLinks/students/parents collections is invented:
the current review-login and user-link code uses users plus userAuthIndex.

## Concurrency, idempotency and recovery

`lessonReports/{reportId}/dispatches/first-publication` is a server-only receipt.
The event key is shared by immediate and scheduled first publication. Item IDs
are SHA-256 of `[reportId, event, authUid]`; no separate retry event is generated.
This module does not offer an intentional resend feature.

A transaction claims a 60-second lease with a random owner and expected revision.
Recipient resolution and the frozen recipient plan are stored in the private
dispatch receipt, outside the notifications path. They cannot trigger FCM.

ONE publication transaction then reads the report, receipt and every target's
notification before writing anything. It rechecks owner, revision, lease, due
state, flag, existing event identities and payload budgets. It **creates all
missing items, publishes the report and completes the receipt in the same commit**.
No recipient write is committed separately. If even the last parent's write or
the report update fails, none of those new items exists and no onCreate event is
emitted. Once any new item can trigger FCM, `status=sent` is already committed.
No FCM-trigger change or staged outbox is needed for this bounded workflow.

Existing matching items are never updated: `isRead`, `readAt` and `createdAt`
survive retries. They are not re-created or re-triggered. Immediate and scheduled
calls share the same event, lease and deterministic IDs, so only one publication
can commit. Firestore retries callbacks on contention; callbacks perform only
transaction reads and buffered writes, with no Auth or FCM calls. Report/receipt
changes invalidate an in-flight transaction and force revalidation.

On a caught commit rejection, the service records `failed` separately and can
retry the same frozen target plan immediately. `failedUids` means the affected
atomic target set, not proof that each UID individually caused the failure. A lost
commit acknowledgement is reconciled by reading the report/receipt: an actual
success must never be overwritten as failed. If a process dies before cleanup,
the lease must expire before takeover; the new owner resumes the plan. Stale
owners cannot publish. Linkage changes apply to future events rather than changing
an already planned retry. Leases are bounded, not renewed indefinitely.

### Transaction bounds and size

- At most 200 recipients, including frozen legacy plans: at most 202 document
  reads and 202 writes (200 creates + report update + receipt update) in the
  publication transaction. Existing items reduce its write count. Every read
  precedes every write. No field-transform sentinels are used in this transaction.
- Per-item application budget: 8 KiB of JSON-encoded payload; whole-publication
  budget: 2 MiB estimated new payloads, paths, receipt and overhead. Oversized
  data returns `atomic_payload_too_large` without creating items or publishing.
  This conservative guard is **not** an exact protobuf/index-size calculation.
- Firestore still enforces its 1 MiB document limit, 10 MiB request limit, index
  constraints, transaction lock deadline (20 seconds), total transaction time
  (270 seconds) and idle expiry (60 seconds). API errors or exhausted automatic
  retries abort the entire publication. The application lease is separate from
  those SDK/server deadlines. Reads of legacy items may also cause server limits
  to be exceeded; no partial commit is possible in that case.
- Never split an oversized publication into recipient batches: that restores the
  unsafe intermediate state. A future requirement above these bounds needs a
  separately reviewed staged outbox that emits visible items only after public
  availability, with its own activation/idempotency design.

Reference contracts: [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
and [Firestore quotas](https://firebase.google.com/docs/firestore/quotas).

State is recorded in `dispatchLastResult` and the receipt:

| Result | Report compatibility fields |
| --- | --- |
| `deferred_disabled` | No new items/completion; reservation stays pending |
| `no_recipients` | No publication; explicit empty-target result |
| `recipient_resolution_failed` | No publication; linkage/Auth lookup diagnosis |
| `failed` | All new notification writes rolled back; no publication; atomic target set/error code recorded |
| `atomic_payload_too_large` / `recipient_limit_exceeded` | Fail closed; never fall back to partial fan-out |
| `notification_identity_conflict` | An existing deterministic ID belongs to another event/report; no new items |
| `completed` | `status=sent`, `sendStatus=sent`, `sentAt` server Timestamp; schedule cleared |
| `already_sent` | No writes or delivery inference for a previously published report |

`studentNotificationSent` / `parentNotificationSent` mean all resolved recipients
in that role have inbox items, not FCM delivery. No parent targets means false,
not a fabricated success. With the atomic implementation, no new partially
successful delivery state is produced: role flags, publication and `sentAt` update
together. A blocked/failed new event leaves them unchanged. `createdCount` on
completion counts all materialized targets (including matching existing items);
`newItemCount` counts only items newly created by this commit.

A legacy `partial_failure` receipt can be resumed using this atomic implementation;
already read items remain untouched. However, pushes emitted by the old unsafe
implementation or the old frontend cannot be recalled or made retroactively safe.
This guarantee applies to newly created items from this service, not other
producers or later external code that might revert the report to draft.

## Scheduling and rollout safeguards

`scheduledSendAt` must be an actual future Admin Firestore Timestamp. It represents
an absolute instant; no timezone conversion occurs in the service. Future UI must
interpret inputs/display in `Asia/Seoul`, e.g. a Korean ISO value with explicit
`+09:00` converted to Timestamp, never the browser's implicit local timezone.
`scheduleTimeZone=Asia/Seoul` documents that contract.

Only schedules explicitly enrolled via `schedule()` have
`dispatchServiceVersion=1`. A future Scheduler must query that marker,
`sendStatus=scheduled`, `scheduledSendAt <= now`, then pass the document's exact
revision to `dispatch(mode=scheduled)`. It must never backfill the marker onto
legacy pending documents. Existing reservations therefore cannot accidentally
be bulk-sent. Content edits, rescheduling and cancellation invalidate old versions.
Plan required indexes separately; this change creates none.

The production gate is the existing `isNotificationSendingEnabled()`, checked
before claiming, at publication transaction entry and again after all item reads.
`NOTIFICATION_TEST_UID` grants **no bypass** here. `sendingEnabled` is a dependency
injection seam for isolated unit tests, not an endpoint option. Future UID-scoped
verification should first provide a read-only recipient preview/dry run, then use
a separate, explicitly authorized non-production transport/allowlist. Do not turn
the global flag on merely to test this service or expose injection options to a
client. Flag changes are not atomic with an in-flight database commit across
instances; operational emergency shutdown also needs the downstream FCM gate.

## Required next-step integration work and limits

1. Add authorized server endpoints and connect the UI. Remove/disable the old
   frontend `notifyForFirstSend` and client status writes at that transition;
   do not run both producers. Old random-ID notifications cannot be safely
   deduplicated from ID alone; legacy `status=sent` reports are never resent here.
2. Route content save/schedule/cancel through these APIs, handle revisions/busy/
   failure errors, and derive `scheduledBy`/`sentBy` from authenticated context.
   Existing frontend code can still bypass these invariants until it is replaced;
   no claim is made that today's UI behavior has been repaired.
3. Keep notification creation and report-publication in the single bounded
   transaction. Both precede the existing onCreate event; the shared FCM trigger,
   notification-center schema and account/parent-link resolver remain unchanged.
4. Test with Firestore Emulator before deployment (optimistic retries here are
   simulated). Add composite indexes and a bounded Scheduler only in a later task.
   No Scheduler/endpoint is exported by this change.
5. Existing FCM onCreate is at-least-once and lacks delivery deduplication. One
   inbox item per event does not guarantee one push; actual FCM results remain
   in its existing delivery logs. This service never calls FCM or edits those logs.

## Local tests

From the repository root, using Node 20:

```sh
node --test functions/src/lessonReports/__tests__/*.test.js
env -u GOOGLE_APPLICATION_CREDENTIALS node --test functions/src/identity/__tests__/*.test.js functions/src/notify/__tests__/*.test.js
```

All IDs and Auth records in these tests are fictional. The fake database enforces
read-before-write, atomic commit failure and optimistic conflict retries. Its
onCreate observer runs after the entire commit and checks that the report and
receipt are already completed. Tests cover last-recipient rollback, concurrent
immediate/scheduled requests, callback retries, stopped workers/lease takeover,
lost acknowledgements, existing read items, limits and the global flag. It has
no network APIs, ADC or FCM implementation. This is local validation, not emulator
or operating-project verification.

The existing identity test initializes an Admin app without explicit credentials.
If the cloud machine injects an unusable ADC-file placeholder, its startup fails
before the mocked tests run. The second command removes that binding **only in
the test child process**; it does not change environment settings or any credential.
