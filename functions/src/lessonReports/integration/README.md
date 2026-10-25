# Firestore Emulator integration tests

Run separately from `../__tests__/*.test.js`. These tests use the installed
Firebase Admin SDK and actual Firestore Emulator transactions, not Fake Firestore.
No production service code, dependency versions, flags or Firebase config changes
are required. Node 20 and Node 24 syntax/API compatibility is intended.

## Required safety checks

The entry point aborts before SDK import unless BOTH existing process variables
match exactly:

- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
- `GCLOUD_PROJECT=demo-lesson-report`

A conflicting `GOOGLE_CLOUD_PROJECT` also aborts. The test never fills missing
variables, reads/prints `.env` or starts an emulator automatically. It pins the
SDK host/project a second time, then performs a read-only REST preflight with a
three-second timeout. Do not launch this suite alongside a Functions emulator or
another process that forwards notifications to real FCM. Use a standalone
Firestore Emulator started for the `demo-lesson-report` project.

No default Admin app, real Auth client or Messaging client is constructed. Only
`Auth.getUser` uses a fictional per-fixture allowlist; profile/index/parent-link
resolution and every transaction/read/write use real Firestore Emulator data.
Consequently this does not test Firebase Authentication itself. The send gate is
injected per service instance, without changing global environment flags.

## Commands

From the repository root, in a shell whose emulator variables have already been
verified (the commands deliberately do not set them):

```sh
node --test --test-concurrency=1 functions/src/lessonReports/integration/dispatch.emulator.test.js
```

Use the same command with your installed Node 20 executable to validate the
Functions runtime, and Node 24 for your development runtime. The read-only guard
tests below can run without any emulator or credentials:

```sh
node --test functions/src/lessonReports/integration/emulator-safety.test.js
node --test functions/src/lessonReports/__tests__/*.test.js
```

## Assertions and isolation

- Concurrent immediate calls: exactly one `completed`, one deterministic item
  per UID; report, receipt and all new items have identical server `updateTime`.
- Rollback/retry: wrap only SDK Transaction.create to redirect the parent create
  to an already-existing fixture sentinel. The real server rejects the commit
  with gRPC code 6 (`ALREADY_EXISTS`); the buffered student create must roll back.
  Retry without that fault must succeed. No mocked commit/rollback is used.
- Due scheduled/immediate race, gate OFF, existing item/read timestamp/updateTime
  preservation, distinct profile/Auth IDs, and schedule revision/cancellation.
- UUIDs isolate every case. Setup uses atomic `create` operations. Cleanup deletes
  only known fixture paths (including their known service receipt/items), never a
  collection, project or database. Cleanup is skipped if atomic seed failed.
  Cleanup completion is asserted. Existing logs are never deleted.

Server `updateTime` equality verifies actual atomic commit grouping; this does
not launch or test the FCM trigger or promise exactly-once device delivery.
An existing matching item is intentionally not part of the new commit and must
retain its earlier updateTime. If the process is forcibly killed, after-hooks
cannot run; identify leftover `it-lesson-report-<UUID>` fixture paths and remove
only that run's known documents, not all emulator data.

## Validation status in the connected cloud workspace

The supplied macOS workspace/Emulator is not reachable from this cloud workspace.
Both required process variables were absent here, so actual Emulator integration
execution was refused. Guard checks and unit tests can be validated here; the
seven actual integration cases remain unverified until run in the local shell
with the correct variables and a standalone Emulator. Do not interpret a syntax
check or the guard's intentional failure as an Emulator test pass.

Locally available in this cloud workspace: Admin SDK 12.7.0, Node 20.20.2 and
Node 24.19.0. On both runtimes, all three guard tests and all 36 existing unit
tests passed, and the integration JavaScript passed syntax checks. The requested
macOS Node 24.18.0 executable was not available here. Current cloud branch:
`test/lesson-report-dispatch`, created from `273929c` without committing changes.
