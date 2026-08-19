# Step 2 — iOS native push registration

## Repository configuration

- App bundle ID: `com.chaesooyong.management` (matches `GoogleService-Info.plist`).
- iOS deployment target: 15.0.
- The Capacitor project uses Swift Package Manager (`CapApp-SPM`), not CocoaPods.
- `CapacitorPushNotifications`, Firebase Core, and Firebase Messaging are native dependencies.
- Debug signing uses `aps-environment=development`; Release uses `aps-environment=production` through the `APS_ENVIRONMENT` build setting.
- Push Notifications is declared as a target capability. Background Modes / Remote notifications is intentionally not enabled: initial registration and ordinary visible notifications do not require background notification processing.
- `GoogleService-Info.plist` is included in the App target's Resources phase. `FirebaseApp.configure()` runs once at app launch. The AppDelegate forwards APNs success/failure to Capacitor and assigns the APNs token to Firebase Messaging.
- The Capacitor `registration` event confirms APNs registration. The native `NativeFcmToken` bridge then obtains the Firebase Messaging registration token; only that FCM token is stored.

## Console and signing prerequisites (user verification required)

Repository files cannot prove these external settings. Verify all of them before device testing:

1. **Firebase Console → Project settings → Your apps:** the iOS app is `com.chaesooyong.management`.
2. **Firebase Console → Project settings → Cloud Messaging:** upload an active APNs authentication `.p8` key and verify its Key ID and Apple Team ID (`53T3372XDJ`). A single APNs authentication key can cover development and production; keep the private `.p8` file outside this repository.
3. **Apple Developer → Identifiers:** the explicit App ID for `com.chaesooyong.management` has Push Notifications enabled.
4. Regenerate/refresh provisioning profiles after enabling the capability, if existing profiles predate it.
5. **Xcode → App → Signing & Capabilities:** select the correct Team, confirm automatic signing/profiles resolve, and confirm Push Notifications appears. Do not add Background Modes for this registration-only step.

## Physical iPhone test

1. On a networked development machine run `npm install --legacy-peer-deps`, `npm run build`, and `npx cap sync ios`. The last command must report `@capacitor/push-notifications@6.x` under iOS plugins.
2. Open `ios/App/App.xcodeproj` in Xcode (this repository is SPM-based and has no `.xcworkspace` to open). Wait for Swift packages to resolve.
3. Select the App scheme and a **physical iPhone**, with the correct Signing Team. Do not use Simulator for acceptance.
4. For a clean permission test, delete the existing app from the iPhone, then Build & Run. Reinstalling is recommended when capability/provisioning or notification permission state changed.
5. Log in. The logged-in Firebase `user.uid` is the canonical token owner.
6. Accept the iOS notification permission prompt.
7. In the Xcode console, verify the development-only sequence: `[push][native] environment detected`, `permission status`, `registering`, `registration success`, `FCM token ready` (only prefix and length), `firestore token owner`, and `firestore token stored`.
8. In Firestore verify `users/{AUTH_UID}/fcmTokens/{TOKEN}`. The document ID and `token` field are the same FCM token; `platform` is `ios`; `updatedAt` is a server timestamp.

Success means the physical device produces the Capacitor registration event, Firebase Messaging returns a non-empty FCM token, and that exact token exists under the logged-in Firebase Auth UID. This step does not send a notification and does not enable `NOTIFICATION_SENDING_ENABLED`.

If it fails, collect the complete Xcode console segment from app launch through the `registration error` or `timeout` line (redact full tokens), notification permission status, bundle ID, selected Team/profile name, iOS version/device model, and any Firebase Messaging/APNs or Firestore error. Also report which expected log line was the last one observed.
