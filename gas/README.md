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
clasp deploy -i <배포 ID> -d "변경 내용"   # 배포 ID·스크립트 ID는 저장소 밖 gas/배포.local.md 참고
```
`-i`(기존 배포 ID)를 빼면 새 주소가 생겨 대시보드가 끊겨요.

## 동작 메모 (2026-10-16 변경)
- **JSONP**: `?callback=__sbData`(대시보드가 쓰는 이름)일 때만 JSONP로 감싸고, 다른 callback 값이나 callback이 없으면 일반 JSON을 돌려줘요. 확인할 때는 `?callback=__sbData` 또는 callback 없이 열어 보세요.
- **응답 캐시**: 기록(`dailySnapshot`)이 끝나면 응답을 만들어 CacheService에 gzip 조각으로 6시간 저장해요(Drive 파일 없음). 캐시가 있으면 doGet이 바로 돌려주고, 없으면 계산 후 저장해요.
  - 사람이 적는 탭(명단·태그 수정·광고 계획·광고 매핑·전략 기록·채널 목표·메타 광고·인스타_과거기록)을 고치면 `onEdit`이 캐시를 비워요. 바로 반영이 안 되면 메뉴 「대시보드 데이터 새로 고침(캐시 비우기)」.
- **원본 갱신 여부**: 기록 때 채널별 `{changed, total, latest, prev, d}`를 계산해 스크립트 속성 `FRESH`에 저장하고 응답 `fresh` 키로 내보내요. 「실행 로그」에 `원본 갱신·채널` 행(미갱신이면 `경고: 원본 미갱신`)이 남아요.
- **잠금·순서**: 기록 함수는 스크립트 잠금으로 한 번에 하나만 돌아요(30초 기다려도 잠겨 있으면 로그만 남기고 끝). 원본을 다 읽은 뒤, 모든 원본이 성공했을 때만 지난 임시 기록을 지워요.
- **5분 제한**: 실행이 5분을 넘으면 남은 단계(계정 지표·태그·일별 합계·게시 후 조회·분석 탭·캐시)를 멈추고 1분 뒤 `resumeSnapshot` 1회용 트리거로 이어서 해요(최대 3번).
- 메뉴 「지금 스냅샷 기록」은 `dailySnapshot`을 불러요(월요일 = 확정, 그 밖 = 임시). `weeklySnapshot`은 예전 트리거 호환용으로 같은 동작이에요.
