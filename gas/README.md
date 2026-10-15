# Apps Script (스냅샷 시트에 연결된 프로젝트)

`Code.gs` = 주간 기록 · 분석 탭 계산 · 데이터 API(doGet) 전체 코드.

## 처음 한 번 (PC에서)
```bash
npm install -g @google/clasp
clasp login                 # 브라우저에서 kukhyoun@jj.ac.kr 로그인
```
https://script.google.com/home/usersettings 에서 **Google Apps Script API 사용**을 켜 주세요.

## 매번
```bash
cd gas
clasp pull                  # 편집기 최신 코드 받기 (작업 전 필수)
# Code.gs 수정
clasp push                  # 편집기에 올리기
clasp deploy -i AKfycbyGL0h1nmGMIMiG0KsZksAyOUaxcdwKiXLysmB2ExGLEhVX3eUiwmRbv7uTPhsWf6Q6 -d "변경 내용"
```
`-i`(기존 배포 ID)를 빼면 새 주소가 생겨 대시보드가 끊겨요.
