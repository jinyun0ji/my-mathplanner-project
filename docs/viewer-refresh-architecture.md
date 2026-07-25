# 학생/학부모 데이터 refresh 구조

## 조사 결과 (변경 전)

`loadViewerDataOnce()`는 `AppRoutes`의 viewer effect 한 곳에서 로그인/권한 확정, 사용자 UID,
연결 학생 또는 학부모의 선택 학생이 바뀔 때 호출됐다. 탭 변경, pull-to-refresh, App Resume,
푸시 진입에는 별도 호출이 없었다. 관리자 Master View에는 별도의 호출 경로가 있으며 이번 viewer
내비게이션 변경 대상에서 제외했다.

한 번의 호출은 학생 문서와 클래스 문서를 먼저 읽은 뒤 공지, 출결, 클리닉 로그/예약, 성적,
숙제/숙제 결과, 수업 로그, 시험/통계, 영상 진행/메모, 외부 일정, 휴원일, 발송된 리포트를
한꺼번에 조회했다.

## 변경 후 탭별 사용 데이터

| 탭 | refresh 함수 | one-shot 데이터 |
| --- | --- | --- |
| 홈 | `refreshHome()` | 출결, 숙제, 성적, 클리닉, 일정, 공지 |
| 클래스 | `refresh('class')` | 수업/시험/통계/리포트, 영상 |
| 학습관리/리포트 | `refreshLearning()` | 숙제/결과, 성적, 클리닉, 수업/시험, 영상 |
| 게시판 | `refreshBoard()` | 공지/게시글 |
| 일정 | `refreshSchedule()` | 외부 일정, 휴원일, 클리닉 예약 |
| 메신저 | `refreshMessenger()` | one-shot 없음(실시간 채팅 사용) |
| 메뉴/더보기 | `refreshMenu()` | 공지 |

모든 탭은 학생과 노출 가능한 클래스 범위를 공통 기반으로 사용한다. 탭 refresh controller는
20초 TTL과 in-flight 중복 제거를 적용한다. 같은 탭 재선택과 pull-to-refresh 및 알림 진입은
현재/대상 탭만 강제 refresh한다. 백그라운드 체류가 30초 이상인 App Resume만 현재 탭 refresh를
시도한다.

실시간 허용 목록은 게시글(`announcements`), 클리닉 리포트(`lessonReports`), 채팅
(`chatMessages`), 클리닉 예약(`clinicReservations`) 네 종류로 제한한다. 숙제, 시험, 성적,
출결, 영상, 자료에는 새 listener를 만들지 않는다.

## 예약 전날 자동 알림 후속 작업

Scheduled Function을 매일 한 번 실행하여 다음날 `clinicReservations`를 조회하고 학생 문서의
`authUid`와 연결 학부모를 수신자로 결정한다. 중복 발송은 기존 schema를 바꾸지 않도록 별도
`notificationDeliveryLogs/{reservationId_yyyyMMdd}` 문서를 transaction으로 선점한 뒤 전송하는
방식을 사용한다. 실제 스케줄러/FCM 배포는 운영 시간대와 발송 문구 확정 후 별도 커밋으로 구현한다.
