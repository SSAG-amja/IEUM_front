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

1. 사용자가 개발용 출발지와 목적지를 입력하고 확인합니다.
2. 앱이 `POST /api/v1/routes`로 두 입력값을 보냅니다.
3. 서버가 역명 또는 `경도,위도` 좌표를 경로 그래프상의 위치로 해석합니다.
4. 서버 응답의 `geometry`를 지도 위 경로선으로 표시합니다.
5. 안내 시작 후 서버 응답의 실행 `instructions`를 보행, 역 내부, 열차, 도착 화면과 TTS에 순서대로 반영합니다.

실외 안내는 향후 GPS 위치를 기준으로 자동 진행되며, 현재는 우측 상단 `GPS 이동` 버튼으로 이를 시뮬레이션합니다. 역 내부와 열차 안내는 GPS를 사용하지 않으므로 2번 터치는 다시 듣기로 유지하고, 안내된 이동을 마친 뒤 화면을 4번 터치해 다음 단계로 진행합니다. 실시간 위치 추적, 경로 이탈 감지 및 자동 재탐색은 현재 구현 범위에 포함되지 않습니다.

## 임시 테스트 UI

서울 데이터 범위 밖에서 개발할 수 있도록 출발지와 목적지 `TextInput`을 두고 있습니다. 입력창 밖을 한 번 터치하거나 키보드의 완료를 누르면 키보드가 닫히는 처리도 이 입력 UI에만 필요한 임시 동작입니다.

실제 위치 및 음성 목적지 입력 흐름이 연결되면 다음 항목을 제거합니다.

- 출발지/목적지 텍스트 입력란과 기본값
- 입력창 외부 터치 및 완료 키에 연결한 키보드 닫기 처리
- 입력 출발지 기반의 테스트 안내 문구
- 실외 안내 단계의 `GPS 이동` 시뮬레이션 버튼

## 주요 코드

```text
app/index.tsx
components/ieum/ieum-prototype-screen.tsx
components/ieum/map-visual.tsx
services/route-api.ts
constants/ieum-prototype.ts
```

## 검증

```bash
npm run lint
npx tsc --noEmit
```
