# 앱 심사용 데모 계정 안내

Google 로그인은 실제 사용자용입니다.

앱 심사용 계정은 로그인 화면의 **심사용 이메일 로그인**을 열어 이메일/비밀번호 로그인을 사용해 주세요.

## 데모 계정

- 학생 데모 계정: `demo.student@chaesooyongmath.com` / `<비밀번호는 콘솔에 별도 기재>`
- 학부모 데모 계정: `demo.parent@chaesooyongmath.com` / `<비밀번호는 콘솔에 별도 기재>`
- 학부모 데모 계정: `demo.staff@chaesooyongmath.com` / `<비밀번호는 콘솔에 별도 기재>`

## 운영 전제

- Firebase Console에서 Email/Password provider를 활성화합니다.
- 계정은 Firebase Auth에서 관리자가 수동으로 생성합니다.
- 비밀번호는 코드나 저장소에 저장하지 않고 앱 심사 콘솔에만 별도로 기재합니다.
- 생성한 Auth UID는 `userAuthIndex/{authUid}` 문서로 기존 학생/학부모 `users` 문서에 연결합니다.
