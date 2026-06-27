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
        const patch = {
            userDocId: entry.userDocId,
            role: entry.role,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (dryRun) {
            console.log('[setupDemoAuthIndex] would merge', ref.path, patch);
            continue;
        }

        await ref.set(patch, { merge: true });
        console.log('[setupDemoAuthIndex] merged', ref.path, {
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
