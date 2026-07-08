# LoveBridge

한국/태국 국제커플을 위한 모바일형 웹앱 프로토타입입니다. 브라우저에서 바로 실행되는 MVP이며, 번역 채팅과 일정/기념일 관리 경험을 검증하는 데 초점을 둡니다.

## 주요 기능

- 홈, 번역 채팅, 공유 일정, 기념일, 설정 탭
- 한국어/태국어 자동 감지 및 번역
- Vercel 서버리스 API를 통한 Gemini 번역
- Gemini 실패 또는 환경변수 미설정 시 fallback 번역
- Google 로그인
- 초대 링크 기반 자동 커플 연결
- 실시간 채팅, 읽음 표시, 채팅 TXT 저장
- 오늘 기분 공유
- 일정 추가 및 기념일 D-day 계산
- LocalStorage 기반 세션 유지
- 고급 설정의 Firebase 입력 및 Firestore/Storage 저장 준비
- PWA manifest와 앱 아이콘

## 실행 방법

정적 파일만 확인하려면 `index.html`을 브라우저에서 열면 됩니다.

로컬 서버로 실행하려면:

```bash
npm start
```

Node.js가 없다면 Python 서버도 사용할 수 있습니다.

```bash
python server.py
```

접속 주소:

```text
http://localhost:3000
```

## Vercel 배포

Vercel에서 GitHub 저장소를 import할 때 Root Directory를 `CoupleThai`로 설정합니다.

Gemini 번역은 클라이언트 코드에 API 키를 넣지 않고 Vercel 서버리스 API에서 처리합니다. 여자친구나 일반 사용자는 API 키를 입력할 필요가 없습니다.

Vercel 프로젝트 환경변수에는 아래 값을 추가합니다.

```text
GEMINI_API_KEY=your_gemini_api_key
```

API 키는 GitHub에 커밋하지 않습니다. GitHub Push Protection이 API 키 노출을 차단하므로, 배포 환경변수로 관리해야 합니다.

## Firebase 연동

Firebase 입력은 설정 탭의 `고급 설정` 안에 있습니다. Firebase Web App 설정값을 입력하면 브라우저 LocalStorage에 저장됩니다. 값이 유효하면 Firestore에 아래 구조로 데이터 저장을 시도합니다.

```text
couples/{coupleId}
couples/{coupleId}/members/{userId}
couples/{coupleId}/messages/{messageId}
couples/{coupleId}/events/{eventId}
```

Storage bucket 기본값은 `lovethai-2ddbc.firebasestorage.app`입니다.

Google 로그인을 사용하려면 Firebase Console에서 Authentication의 Google 제공업체를 활성화하고, Authorized domains에 배포 도메인을 추가해야 합니다.

```text
lovebridge-couplethai.vercel.app
```

규칙 파일은 프로젝트에 포함되어 있습니다.

```text
firestore.rules
storage.rules
firebase.json
.firebaserc
```

현재 규칙은 Firebase Auth가 없는 MVP용입니다. 커플 앱이 동작하도록 읽기/쓰기를 허용하되, 허용 경로와 필드, 이미지 파일 타입, 업로드 크기 제한을 둡니다. 실서비스 수준의 비공개 커플 공간은 Firebase Auth를 추가한 뒤 `request.auth.uid` 기준으로 제한해야 합니다.

규칙 배포:

```bash
npx firebase login
npx firebase deploy --only firestore:rules,storage --project lovethai-2ddbc
```

실서비스 확장 단계에서는 Firebase Auth, 보안 규칙, 환경변수 처리가 필요합니다.
