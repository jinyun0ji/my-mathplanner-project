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
  invalidates stale workers. A live processing lease returns `busy`; a partial
  materialization returns `dispatch_already_started`. Already emitted pushes
  cannot be recalled. A caller must display this result instead of claiming success.
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
Each recipient transaction rechecks the report, owner, revision, lease, due state
and server flag, then atomically **creates** the item and records that UID in the
receipt. Existing items are checked for event ownership and never updated, so
`isRead`, `readAt` and `createdAt` survive retries. The resolved recipient set is
frozen for retries of that event/revision; normal linkage changes apply to future
events, not an already started fan-out. A final transaction marks complete only
after all recorded targets succeeded. Failed UIDs/error codes are recorded.

If a worker crashes or the final commit fails, wait for the lease to expire and
retry the same version. A new owner resumes recorded recipients; stale owners
cannot create further items or finalize. Resolution failures retry resolution;
an incomplete fan-out retries its frozen plan. Leases are intentionally bounded,
not renewed indefinitely; a large/slow resolution can require a later retry.
The service caps recipient sets at 200 to bound receipt size and work per report.

State is recorded in `dispatchLastResult` and the receipt:

| Result | Report compatibility fields |
| --- | --- |
| `deferred_disabled` | No new items/completion; reservation stays pending |
| `no_recipients` | No publication; explicit empty-target result |
| `recipient_resolution_failed` | No publication; linkage/Auth lookup diagnosis |
| `partial_failure` / `failed` | No completion; failed UIDs recorded; same event can retry |
| `completed` | `status=sent`, `sendStatus=sent`, `sentAt` server Timestamp; schedule cleared |
| `already_sent` | No writes or delivery inference for a previously published report |

`studentNotificationSent` / `parentNotificationSent` mean all resolved recipients
in that role have inbox items, not FCM delivery. No parent targets means false,
not a fabricated success. A partial result can have one role complete, while
the report remains draft and `sentAt` remains null. Only successful completion
publishes it under the existing status-based query/rules. A job becoming disabled
mid-fan-out may already have some items; it does not publish or consume the job.

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
before claiming, inside each recipient transaction and at completion.
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
   partial errors, and derive `scheduledBy`/`sentBy` from authenticated context.
   Existing frontend code can still bypass these invariants until it is replaced;
   no claim is made that today's UI behavior has been repaired.
3. Review partial fan-out UX: existing onCreate FCM may fire for an item before
   the final report-publication transaction completes. A partial failure can
   leave a notification pointing to a report still hidden by current rules.
   Before live integration, choose atomic bounded fan-out/publication or a staged
   outbox/activation design. This module does not alter the shared FCM trigger.
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
read-before-write, atomic commit failure and optimistic conflict retries. It has
no network APIs, ADC or FCM implementation. This is local validation, not emulator
or operating-project verification.

The existing identity test initializes an Admin app without explicit credentials.
If the cloud machine injects an unusable ADC-file placeholder, its startup fails
before the mocked tests run. The second command removes that binding **only in
the test child process**; it does not change environment settings or any credential.
