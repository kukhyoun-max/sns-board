# 전주대 SNS 성과 보드

전주대학교 대외협력홍보실 SNS(인스타그램 · 유튜브 · hong._.video)와 타 대학 벤치마크(jbnu1947 · wonkwang_univ · woosukuni)의 콘텐츠 성과를 매주 기록하고 보여주는 대시보드.
답변과 화면 문구는 모두 **한국어**로 써요. 사용자는 짧고 데이터 중심의 답, 여러 개의 짧은 선택지를 선호해요.

## 구조

```
Supermetrics(구글 시트 애드온)  ──▶  원본 시트 3개(각자 갱신) + 스냅샷 시트의 쿼리 탭(월 06:00 자동 갱신)
                                                          │
Apps Script (gas/Code.gs, 스냅샷 시트에 연결)  ──월 07:00 트리거──▶  「스냅샷」 탭에 한 주 기록 추가 · 분석 탭 재계산
                                                          │
                                       doGet(JSONP) 웹앱 = 데이터 API
                                                          │
대시보드 (src/ → build.sh → index.html)  ──GitHub Pages──▶  https://kukhyoun-max.github.io/sns-board/
```

| 폴더/파일 | 내용 |
|---|---|
| `src/head.html` | `<title>`·폰트·기본 CSS (`</style>` 직전까지) |
| `src/extra.css` | 추가 CSS (여기에 이어서 작성) |
| `src/body.html` | 화면 뼈대 HTML + chart.js 태그 |
| `src/app.js` | 대시보드 전체 로직 (바닐라 JS, Chart.js 4.4.1, 엑셀 내보내기는 SheetJS를 필요할 때 로드) |
| `build.sh` | `src/` → `index.html` 조립. `bash build.sh preview` 는 샘플 데이터로 `.preview/` 생성 |
| `index.html` | **빌드 결과물.** 직접 고치지 말고 `src/`를 고친 뒤 `bash build.sh` |
| `sample/data.json` | 테스트용 샘플 (실데이터 일부, 사람 이름은 가명, 광고 데이터는 비움) |
| `gas/` | Apps Script 코드 (clasp로 동기화) |

## 작업 순서

### 대시보드 화면 고치기
1. `src/app.js` · `src/extra.css` 수정
2. `bash build.sh preview` → `cd .preview && python3 -m http.server 8767` → http://localhost:8767 에서 확인 (PC 폭 + 모바일 400px 폭, 콘솔 에러 없음, 가로 넘침 없음)
3. `bash build.sh` → `index.html` 갱신
4. `git add -A && git commit && git push` → GitHub Pages가 1~2분 뒤 자동 반영 (브라우저 캐시 때문에 `?v=날짜` 붙여 확인)

### Apps Script(데이터 API) 고치기
1. 작업 전에 항상 `cd gas && clasp pull` (편집기에서 직접 고친 내용이 있을 수 있음)
2. `gas/Code.gs` 수정 → `clasp push`
3. **같은 배포 ID로** 새 버전 배포 — 웹앱 주소가 바뀌면 대시보드가 끊겨요:
   `clasp deploy -i AKfycbyGL0h1nmGMIMiG0KsZksAyOUaxcdwKiXLysmB2ExGLEhVX3eUiwmRbv7uTPhsWf6Q6 -d "설명"`
4. 웹앱 주소에 `?callback=x` 를 붙여 열어 보고 JSON이 나오는지 확인
5. 고친 `gas/` 도 커밋

## 지켜야 할 것 (중요)
- **Supermetrics 원본 시트 3개는 절대 수정하지 않음** (읽기만). JJ 스튜디오 자동매칭이 원본을 읽고 있어요.
  - 인스타그램 원본 `1qejkY4I…`, 유튜브 원본 `1K6MHQMg…`, 공개 원본 `1eTHTdR9…`
  - 쓰기는 스냅샷 시트(`1WshbvV-…`)에만.
- **doPost 같은 쓰기용 공개 엔드포인트를 만들지 않음.** 웹앱은 읽기 전용 doGet(JSONP)만.
- 웹앱(API) 주소는 링크만 있으면 누구나 데이터를 볼 수 있어요. 대시보드 밖으로 따로 공유하지 않아요.
- 이 저장소는 **공개** 저장소예요. 토큰·비밀번호·API 키·광고 계정 정보, 실명이 들어간 데이터 파일은 커밋하지 않아요.

## 데이터 모델 (API 응답 = `sample/data.json` 구조)
- `dates[]`: 기록일 목록. 2025-12-01 ~ 2026-06-11은 과거 월별 DB에서 가져온 기록, 2026-10-08부터 매주 기록.
- `items[]`: 콘텐츠 하나당 1개.
  - `c` 채널, `t` 유형, `d` 게시일, `n` 제목, `u` URL, `g` 분류, `p` 제작 주체, `w` 참여자
  - `h[]`: `dates`와 같은 순서의 기록 `[조회, 좋아요, 댓글, 공유, 저장]`. 기록 없으면 null.
  - `r` 리치, `e` 참여 조회, `a` 평균 시청(초), `l` 영상 길이(초)
  - `L`: 유튜브 전체 기간 값 `[조회, 좋아요, 댓글, 공유]` (「유튜브_전체기간」 탭). 있으면 누적값으로 우선 사용.
  - `ad`: 광고 집행 표시 `{s, k: 구글 캠페인, mk: 메타 캠페인}`
- `acct[]` 계정 지표, `ads` 구글애즈·메타 광고, `coverage` 채널별 데이터 시작일, `roles` 참여자 역할, `strat` 「전략 기록」 탭, `goals` 「채널 목표」 탭.

## 지표 정의
- **평소 대비(배):** 게시물 조회수 ÷ 그 채널의 기준값. 기준값 = 최근 365일 게시물 조회수의 중앙값 (광고 집행·스토리 제외).
- **히트:** 평소 대비 1.5배 이상. **히트율** = 히트 게시물 수 ÷ 전체 게시물 수.
- **기록 사이 증가:** 두 기록일 사이 누적값 차이. 양쪽 기록이 다 있는 채널만 합산.
- 과거 기록은 월 단위라 간격이 일정하지 않아요.

## 스냅샷 시트 주요 탭
스냅샷 · 유튜브_전체기간 · 광고 계획 · 광고 매핑 · 메타 광고 · 명단 · 태그 · 태그 수정 · 전략 기록 · 채널 목표 · 계정 지표 · 주간 증가_* · 유형별 요약 · 벤치마크 · 실행 로그
- 사람이 직접 적는 탭: 광고 계획, 광고 매핑, 명단, 태그 수정, 전략 기록, 채널 목표
- 나머지는 스크립트·Supermetrics가 채우는 탭이에요. 손으로 고치지 않아요.

## 알려진 이슈
- 구글애즈 보고서가 26.01.30에서 멈춰 있어요 (kukhyoun5 계정).
