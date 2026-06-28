/* eslint-disable no-console */
const admin = require('firebase-admin');

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--write');

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!admin.apps.length) {
    admin.initializeApp(projectId ? { projectId } : undefined);
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const DEMO_AUTH_INDEX_ENTRIES = [
    {
        authUid: 'v2wTP8NiWMQwsVvwL6uDbPotkFz1',
        userDocId: 'ulloGGaEVgfhYlDJX6zi',
        role: 'student',
    },
    {
        authUid: 'qKIVPaoWfWaDhggNJ3ttyefZ59s1',
        userDocId: 'AEI9gfytJRPufKUp1AA1cKfNVh03',
        role: 'parent',
    },
];

async function main() {
    console.log(`[setupDemoAuthIndex] projectId=${projectId || '(default credentials)'} mode=${dryRun ? 'dry-run' : 'write'}`);

    for (const entry of DEMO_AUTH_INDEX_ENTRIES) {
        const ref = db.collection('userAuthIndex').doc(entry.authUid);
        const snapshot = await ref.get();
        const existing = snapshot.exists ? snapshot.data() : null;
        const patch = {
            userDocId: entry.userDocId,
            role: entry.role,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (snapshot.exists) {
            console.log('[setupDemoAuthIndex] exists', ref.path, {
                userDocId: existing?.userDocId,
                role: existing?.role,
                matchesExpected: existing?.userDocId === entry.userDocId && existing?.role === entry.role,
            });
            continue;
        }

        if (dryRun) {
            console.log('[setupDemoAuthIndex] missing; would create', ref.path, patch);
            continue;
        }

        await ref.set(patch, { merge: true });
        console.log('[setupDemoAuthIndex] created', ref.path, {
            userDocId: entry.userDocId,
            role: entry.role,
        });
    }

    console.log('[setupDemoAuthIndex] done');
}

main().catch((error) => {
    console.error('[setupDemoAuthIndex] failed', error);
    process.exitCode = 1;
});
