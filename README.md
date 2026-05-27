# IEUM Mobile App

시각장애인 사용자를 위한 접근성 경로 안내 Expo 앱입니다. 현재 개발 연결 단계에서는 입력한 출발지와 목적지를 IEUM FastAPI 서버에 보내고, 실제 지도 위에 접근성 경로와 안내 문구를 표시합니다.

## 실행 준비

```bash
npm install
```

백엔드를 실행한 뒤 `.env.example`을 참고하여 개발 PC의 LAN 주소를 설정합니다. 실제 기기에서 실행할 때 `localhost`는 기기 자신을 가리키므로 사용할 수 없습니다.

```text
EXPO_PUBLIC_IEUM_API_URL=http://192.168.x.x:8020
```

```bash
npx expo start
```

Expo SDK 54 기준 `react-native-maps`와 `expo-location`은 Expo Go에서 테스트할 수 있습니다. 앱스토어 배포용 Android/iOS 빌드에서 Google Maps provider를 사용하려면 플랫폼 API 키 설정이 별도로 필요합니다.

## 연결 흐름

1. 사용자가 개발용 출발지를 확인하고, 안내 음성과 시작 진동 이후 목적지를 말합니다.
2. 목적지 발화 후 1.5초 동안 조용하면 종료 신호음/진동과 함께 녹음을 종료하고 음성 목적지를 확인합니다. 기기에서 발화 음량을 감지하지 못한 경우에도 12초 뒤 녹음을 제출합니다.
3. 앱이 `POST /api/v1/routes`로 출발지와 인식된 목적지를 보냅니다.
4. 서버가 주소, 역명 또는 `경도,위도` 좌표를 경로 그래프상의 위치로 해석합니다.
5. 서버 응답의 `geometry`를 지도 위 경로선으로 표시합니다.
6. 안내 시작 후 서버 응답의 실행 `instructions`를 보행, 역 내부, 열차, 도착 화면과 TTS에 순서대로 반영합니다.

실외 안내는 향후 GPS 위치를 기준으로 자동 진행되며, 현재는 우측 상단 `GPS 이동` 버튼으로 이를 시뮬레이션합니다. 역 내부와 열차 안내는 GPS를 사용하지 않으므로 2번 터치는 다시 듣기로 유지하고, 안내된 이동을 마친 뒤 화면을 4번 터치해 다음 단계로 진행합니다. 실시간 위치 추적, 경로 이탈 감지 및 자동 재탐색은 현재 구현 범위에 포함되지 않습니다.

화면은 `/` 시작, `/destination` 입력 및 경로 생성, `/guidance` 실행 안내의 세 라우트로 분리되어 있습니다. `RouteSessionProvider`가 화면 사이에서 입력값과 API 응답만 보관하고, 안내 화면은 서버 instruction cursor를 별도로 실행합니다.

## 임시 테스트 UI

서울 데이터 범위 밖에서 개발할 수 있도록 출발지 `TextInput`과 `고덕로 210` 기본값을 두고 있습니다. 입력창 밖을 한 번 터치하거나 키보드의 완료를 누르면 키보드가 닫히는 처리도 이 출발지 입력 UI에만 필요한 임시 동작입니다.

실제 위치 흐름이 연결되면 다음 항목을 제거합니다.

- 출발지 텍스트 입력란과 `고덕로 210` 기본값
- 입력창 외부 터치 및 완료 키에 연결한 키보드 닫기 처리
- 입력 출발지 기반의 테스트 안내 문구
- 실외 안내 단계의 `GPS 이동` 시뮬레이션 버튼
- 안내 단계 직접 확인용 debug fixture와 이전/다음 버튼

## 안내 화면 직접 확인

개발 중에는 API 경로를 만들지 않고 안내 유형별 화면을 바로 확인할 수 있습니다.

```text
/guidance?debug=walk
/guidance?debug=subway-internal
/guidance?debug=subway-ride
/guidance?debug=subway-exit
```

debug 진입 화면에는 이전/다음 버튼이 표시되며 제품 흐름에는 포함되지 않는 임시 검사 기능입니다.

## 주요 코드

```text
app/_layout.tsx
app/index.tsx
app/destination.tsx
app/guidance.tsx
features/ieum/session/route-session-provider.tsx
features/ieum/start/start-screen.tsx
features/ieum/destination/destination-screen.tsx
features/ieum/guidance/guidance-screen.tsx
features/ieum/guidance/use-guidance-controller.ts
features/ieum/guidance/instruction-presenter.ts
features/ieum/debug/route-fixtures.ts
components/ieum/map-visual.tsx
services/route-api.ts
```

## 검증

```bash
npm run lint
npx tsc --noEmit
```
