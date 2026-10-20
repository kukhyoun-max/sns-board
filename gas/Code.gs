/**
 * 주간 성과 스냅샷 — 전주대 SNS 콘텐츠별 1주 증가량 기록
 *
 * - 원본 시트 3개는 "읽기만" 합니다 (수정·서식 변경 없음).
 * - 매일 08:00(KST) 스냅샷을 갱신하고 분석 탭을 다시 계산합니다 (dailySnapshot).
 *   · 월요일 기록 = 그 주의 확정 기록 / 화~일 기록 = 「이번 주 진행 중」 임시 기록(다음 날 최신값으로 교체)
 *   · 주간 증가_인스타 / _유튜브 / _hong : 콘텐츠별 증가량 + 참여율·시청 완료율
 *   · 유형별 요약 : 릴스·캐러셀·영상 길이 등 유형별 성과
 *   · 벤치마크   : 퍼블릭 데이터의 타 대학 계정 비교 (최근 180일 게시물)
 *   · 계정 지표  : 「계정_인스타원본」「계정_유튜브원본」 탭(Supermetrics)이 있으면 주간 누적
 * - 최초 1회: 함수 선택 → setup → 실행 (권한 승인)
 */

const TZ = 'Asia/Seoul';
const SNAP = '스냅샷';
const LEGACY_WEEKLY = '주간 증가'; // 이전 버전 통합 탭(있으면 삭제)
const LOG = '실행 로그';
const TYPE_SUMMARY = '유형별 요약';
const BENCH = '벤치마크';
const ACCOUNT = '계정 지표';
const ACCT_ERR = '수집 오류';                 // 계정 지표 칸에 Supermetrics 오류 문구가 들어왔을 때 남기는 값

// 실행 안정성 · 응답 캐시
const TIME_LIMIT_MS = 5 * 60 * 1000;          // 실행 시간이 이만큼 넘으면 남은 단계를 멈추고 1분 뒤 이어서 실행
const RESUME_MAX = 3;                         // 이어서 실행은 최대 N번까지
const JSONP_CB = '__sbData';                  // 대시보드(src/app.js)가 쓰는 JSONP 함수 이름 — 이것만 허용
const CACHE_PREFIX = 'resp';                  // 응답 캐시 키 (CacheService, gzip+base64 조각)
const CACHE_TTL = 21600;                      // 6시간(최대값)
const CACHE_CHUNK = 90000;                    // 키당 100KB 제한 → 9만 자씩 (base64라 1자 = 1바이트)
const PROP_FRESH = 'FRESH';                   // 원본 갱신 여부(채널별) — 기록 때 저장, 응답 fresh 키로 냄
const PROP_PENDING = 'PENDING';               // 시간 초과로 남은 단계
const PROP_RUNNING = 'SNAP_RUNNING';          // 기록 중 표시(이때 doGet은 캐시에 넣지 않음)

const BENCH_PREFIX = '벤치·';
const BENCH_DAYS = 180;                       // 벤치마크는 최근 N일 게시물만 기록
const OUR_ACCOUNTS = ['hong._.video', 'jjuniv']; // 벤치마크 표에서 (우리) 표시

// Supermetrics 계정 단위 쿼리를 받을 탭 (이 스프레드시트 안)
const ACCOUNT_SOURCES = [
  { channel: '인스타그램', tab: '계정_인스타원본' },
  { channel: '유튜브', tab: '계정_유튜브원본' },
];

// 스냅샷 열 구조 (0부터)
const SNAP_HEADER = ['기록일', '채널', '콘텐츠키', '게시일', '제목/캡션', 'URL',
  '조회수', '좋아요', '댓글', '공유', '저장',
  '유형', '리치', '참여 조회수', '평균 시청(초)', '영상 길이(초)'];
const METRICS = ['views', 'likes', 'comments', 'shares', 'saves'];
const NUMF = METRICS.concat(['reach', 'engaged', 'avgSec']);
const C = { date: 3, title: 4, url: 5, views: 6, likes: 7, comments: 8, shares: 9, saves: 10,
  type: 11, reach: 12, engaged: 13, avgSec: 14, lengthSec: 15 };
const M0 = C.views;

// ───────── 원본 정의 ─────────
const SOURCES = [
  {
    channel: '인스타그램',
    id: '1qejkY4IaDvwI30gqmo7O1MkS2HJkR5wqnHCkZpTE0gQ',
    anchor: ['날짜'],
    fields: {
      date: ['날짜'],
      title: ['미디어 캡션'],
      url: ['미디어 퍼머링크', '퍼머링크', '미디어 URL'],
      views: ['조회수'],
      likes: ['좋아요 수', '좋아요'],
      comments: ['댓글 수', '댓글'],
      shares: ['공유'],
      saves: ['고유 저장', '저장'],
      reach: ['미디어 리치'],
      type: ['미디어 제품 유형'],
      mediaType: ['미디어 유형'],
    },
    keyFn: (d, t, u) => /instagram\.com\/(p|reel|reels|tv)\//.test(u) ? u.split('?')[0] : capKey_(d, t),
    typeFn: (product, media) => typeLabel_(product, media),
  },
  {
    channel: '유튜브',
    id: '1K6MHQMgs8aa_tiE_QCm9wc-dklMM5CZ3kaYZK-LXNGo',
    anchor: ['게시 날짜'], // 시트에 쿼리 블록이 2개(A~K, L~T) 있어 둘 다 읽음
    needDisplay: true,
    fields: {
      date: ['게시 날짜'],
      title: ['비디오 제목'],
      url: ['비디오 URL'],
      views: ['동영상 조회'],
      likes: ['좋아요'],
      comments: ['댓글'],
      engaged: ['참여한 조회수'],
      avgSec: ['평균 조회 시간(초)'],
      length: ['비디오 길이'],
      desc: ['비디오 설명'],
    },
    keyFn: (d, t, u) => {
      const m = u.match(/(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/);
      return m ? 'yt:' + m[1] : (u || capKey_(d, t));
    },
    typeFn: (p, m, item) => lengthBucket_(item.lengthSec),
  },
  {
    channel: 'hong._.video',
    id: '1eTHTdR9dFutwtNAOG2us6rFw7hqjPdMOH8-IuEYXDC4',
    anchor: ['Date'],
    filter: { col: 'Username', value: 'hong._.video' },
    fields: {
      date: ['Date'],
      title: ['Post caption'],
      url: ['Post media URL'],
      views: ['Reels views'],
      likes: ['Likes'],
      comments: ['Comments'],
      mediaType: ['Post type'],
    },
    keyFn: (d, t, u) => capKey_(d, t), // Post media URL은 CDN 주소라 매주 바뀜
    typeFn: (p, media) => typeLabel_('', media),
  },
  {
    // 퍼블릭 데이터의 타 계정 → 채널명 "벤치·{username}"
    channel: '벤치마크',
    bench: true,
    id: '1eTHTdR9dFutwtNAOG2us6rFw7hqjPdMOH8-IuEYXDC4',
    anchor: ['Date'],
    skipUsers: ['hong._.video'],
    maxDays: BENCH_DAYS,
    fields: {
      user: ['Username'],
      date: ['Date'],
      title: ['Post caption'],
      url: ['Post media URL'],
      views: ['Reels views'],
      likes: ['Likes'],
      comments: ['Comments'],
      mediaType: ['Post type'],
    },
    keyFn: (d, t, u) => capKey_(d, t),
    typeFn: (p, media) => typeLabel_('', media),
  },
];

// ───────── 채널별 주간 증가 탭 열 정의 ─────────
// ctx: { c: 현재 행, p: 직전 행, inc: [조회,좋아요,댓글,공유,저장 증가], rate(i) }
const COL_BASE = [
  { h: '게시일', v: x => x.c[C.date] },
  { h: '유형', v: x => x.c[C.type] },
  { h: '제목/캡션', v: x => x.c[C.title] },
  { h: 'URL', v: x => x.c[C.url] },
  { h: '현재 조회수', v: x => x.c[C.views], f: '#,##0' },
  { h: '조회수 증가', v: x => x.inc[0], f: '#,##0' },
  { h: '조회수 증가율', v: x => x.rate(0), f: '0.0%' },
  { h: '현재 좋아요', v: x => x.c[C.likes], f: '#,##0' },
  { h: '좋아요 증가', v: x => x.inc[1], f: '#,##0' },
  { h: '좋아요 증가율', v: x => x.rate(1), f: '0.0%' },
  { h: '댓글 증가', v: x => x.inc[2], f: '#,##0' },
];
const COL_TAIL = [
  { h: '비교 기간', v: x => x.period },
  { h: '비고', v: x => x.note },
];
const WEEKLY_TABS = [
  {
    channel: '인스타그램', tab: '주간 증가_인스타',
    cols: COL_BASE.concat([
      { h: '공유 증가', v: x => x.inc[3], f: '#,##0' },
      { h: '저장 증가', v: x => x.inc[4], f: '#,##0' },
      { h: '리치', v: x => x.c[C.reach], f: '#,##0' },
      { h: '참여율(누적)', v: x => igEngagement_(x.c), f: '0.0%' },
      { h: '저장률', v: x => ratio_(x.c[C.saves], x.c[C.reach]), f: '0.0%' },
      { h: '공유율', v: x => ratio_(x.c[C.shares], x.c[C.reach]), f: '0.0%' },
    ], COL_TAIL),
  },
  {
    channel: '유튜브', tab: '주간 증가_유튜브',
    cols: COL_BASE.concat([
      { h: '참여 조회 비율', v: x => ratio_(x.c[C.engaged], x.c[C.views]), f: '0.0%' },
      { h: '영상 길이(초)', v: x => x.c[C.lengthSec], f: '#,##0' },
      { h: '평균 시청(초)', v: x => x.c[C.avgSec], f: '#,##0' },
      { h: '시청 완료율', v: x => ratio_(x.c[C.avgSec], x.c[C.lengthSec]), f: '0.0%' },
    ], COL_TAIL),
  },
  {
    channel: 'hong._.video', tab: '주간 증가_hong',
    cols: COL_BASE.concat([
      { h: '좋아요율(조회 대비)', v: x => ratio_(x.c[C.likes], x.c[C.views]), f: '0.0%' },
    ], COL_TAIL),
  },
];

// ───────── 메뉴 / 최초 설정 ─────────
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 스냅샷')
    .addItem('지금 스냅샷 기록', 'dailySnapshot') // 월요일 = 확정, 그 밖 = 임시 기록(다음 실행 때 교체)
    .addItem('분석 탭만 다시 계산', 'buildAll')
    .addItem('태그 다시 계산(분류·제작·참여자)', 'recalcTags')
    .addItem('과거 기록 가져오기(_hist_ 탭)', 'importHistory')
    .addItem('게시 후 조회 다시 채우기(스냅샷 기록으로)', 'backfillAgeViews')
    .addItem('일별 합계 다시 채우기(스냅샷 기록으로)', 'backfillDailyTotals')
    .addItem('대시보드 데이터 새로 고침(캐시 비우기)', 'clearDashboardCache')
    .addItem('보드 접속 키 만들기(「보드 접근」 탭)', 'makeBoardKeys')
    .addItem('메타 광고 과거 채우기(API, 처음 한 번)', 'backfillMeta')
    .addItem('유튜브 분석 승인(브랜드 계정, 처음 한 번)', 'ytAuthorize')
    .addItem('유튜브 분석 승인 마무리(YT_AUTH_CODE 넣은 뒤)', 'ytAuthFinish')
    .addItem('인스타 스토리·계정 일별·팔로워 분포 지금 받기', 'collectInstagramExtras')
    .addItem('유튜브·인스타 추가 지표 지금 받기(매일 몫)', 'collectMoreNow')
    .addItem('주간 추가 수집 지금(시청 지속률·전체 게시물 등)', 'weeklyExtras')
    .addItem('과거 데이터 채우기(끝날 때까지 여러 번)', 'backfillExtras')
    .addItem('페이스북 페이지 지금 받기', 'facebookNow')
    .addSeparator()
    .addItem('최초 설정(탭·트리거)', 'setup')
    .addToUi();
}

function setup() {
  const ss = SpreadsheetApp.getActive();
  ensureSheets_(ss);
  setupDaily();
  weeklySnapshot();
}

// 트리거: 매일 08:00(KST) dailySnapshot (기존 주간 트리거는 지움)
function setupDaily() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['weeklySnapshot', 'dailySnapshot'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  SNAP_HOURS.forEach(h => ScriptApp.newTrigger('dailySnapshot').timeBased().everyDays(1).atHour(h).nearMinute(0).inTimezone(TZ).create());
}
// 하루 여러 번 기록: 같은 날 기록은 바꿔 써서(runSnapshot_ 3단계) 줄이 쌓이지 않음. 원본 읽기·API 단계가 다시 돌아 화면 값이 그만큼 새로워짐
const SNAP_HOURS = [8, 12, 16, 20];
const TRIG_VER = '2026-10-20 하루 4번·스토리 1시간';
// 트리거 버전이 바뀌면 기록·스토리·밤 브리핑 트리거를 다시 맞춤(편집기에서 setup을 다시 돌리지 않아도 되게). 과거 채우기·스토리 실행이 부름
function ensureTriggers_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('TRIG_VER') === TRIG_VER) return;
  const ts = ScriptApp.getProjectTriggers();
  setupDaily();
  ts.filter(t => t.getHandlerFunction() === 'storySnapshot').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('storySnapshot').timeBased().everyHours(1).create();
  if (!ts.some(t => t.getHandlerFunction() === 'nightBrief')) ScriptApp.newTrigger('nightBrief').timeBased().everyDays(1).atHour(22).nearMinute(0).inTimezone(TZ).create();
  p.setProperty('TRIG_VER', TRIG_VER);
}

// ───────── 매일 갱신 (트리거 실행 함수) ─────────
// 월요일 기록은 확정으로 남기고, 화~일 기록은 최신 1개만 남긴다 (스냅샷 탭 용량 유지)
// 순서: 원본을 모두 읽음 → 원본 갱신 여부(fresh) 계산 → 모두 성공했을 때만 지난 임시 기록을 지움 → 오늘 기록 추가 → 분석·캐시
function dailySnapshot() {
  return withLock_('스냅샷 기록', () => runSnapshot_());
}

// 예전 주간 트리거·setup 호환용 이름. 지금은 dailySnapshot과 같다(월요일 = 확정, 그 밖 = 임시).
function weeklySnapshot() {
  return dailySnapshot();
}

// 스크립트 잠금: 트리거·메뉴가 겹쳐 같은 날 기록이 두 번 쌓이는 것을 막는다 (안에서 다시 부르면 그대로 실행)
let LOCK_DEPTH_ = 0;
function withLock_(name, fn) {
  if (LOCK_DEPTH_ > 0) return fn();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    try { logRows_(SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID), [[new Date(), name, 0, '건너뜀: 다른 기록 작업이 실행 중(잠금)']]); } catch (e) {}
    return null;
  }
  LOCK_DEPTH_++;
  try { return fn(); }
  finally { LOCK_DEPTH_--; lock.releaseLock(); }
}

// 확인용 실행 로그(2026-10-21): 「실행 로그」 최근 300줄을 작은 별도 시트에 복사 — 스냅샷 시트가 커서 드라이브 연결로 행을 못 읽어, Claude가 캡처 없이 결과를 확인하려고.
// 첫 탭에 [실행 시각, 단계, 줄 수, 상태]. 시트 ID는 스크립트 속성 LOG_MIRROR_ID(없으면 새로 만듦). 10분에 한 번까지
function logMirror_(force) {
  const p = PropertiesService.getScriptProperties(), now = Date.now();
  if (!force && now - Number(p.getProperty("LOG_MIRROR_AT") || 0) < 10 * 60 * 1000) return;
  p.setProperty("LOG_MIRROR_AT", String(now));
  const ss = SpreadsheetApp.openById(SS_ID), log = ss.getSheetByName(LOG);
  if (!log || log.getLastRow() < 2) return;
  const n = Math.min(300, log.getLastRow() - 1), rows = log.getRange(log.getLastRow() - n + 1, 1, n, 4).getDisplayValues().reverse();
  let id = p.getProperty("LOG_MIRROR_ID"), m = null;
  try { if (id) m = SpreadsheetApp.openById(id); } catch (e) { m = null; }
  if (!m) { m = SpreadsheetApp.create("SNS 보드 실행 로그(확인용)"); p.setProperty("LOG_MIRROR_ID", m.getId()); }
  const sh = m.getSheets()[0];
  sh.clearContents();
  sh.getRange(1, 1, rows.length + 1, 4).setValues([["실행 시각(최근 순)", "단계", "줄 수", "상태"]].concat(rows.map(r => r.map(x => String(x).slice(0, 20000)))));
}
function logRows_(ss, rows) {
  if (!rows || !rows.length) return;
  let log = ss.getSheetByName(LOG);
  if (!log) { ensureSheets_(ss); log = ss.getSheetByName(LOG); }
  log.getRange(log.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}

// 요일(1=월 … 7=일). getDay()는 스크립트 프로젝트 시간대를 따르므로 TZ로 직접 계산한다
function weekday_(ymd) { return Number(Utilities.formatDate(new Date(ymd + 'T12:00:00+09:00'), TZ, 'u')); }
function isMonday_(ymd) { return weekday_(ymd) === 1; }
function isWeekend_(ymd) { return weekday_(ymd) >= 6; }

// 이번 주 임시 기록인가 (월요일 아님 · 최근 7일 안 · 오늘 아님)
function isProvisional_(d, today) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== today && d < today && d > shiftDate_(today, -7) && !isMonday_(d);
}

// 스냅샷 맨 아래부터: 오늘 기록 블록 [todayFrom, end), 그 위로 이어진 임시 기록 블록 [provFrom, todayFrom)
// col: A열 표시값(2행부터). 반환 인덱스는 col 기준(0 = 2행)
function scanTail_(col, today) {
  let i = col.length - 1;
  while (i >= 0 && col[i] === today) i--;
  const todayFrom = i + 1;
  const prov = [];
  while (i >= 0 && isProvisional_(col[i], today)) { if (prov.indexOf(col[i]) < 0) prov.push(col[i]); i--; }
  return { todayFrom: todayFrom, provFrom: i + 1, provDates: prov };
}

function runSnapshot_() {
  const t0 = Date.now();
  const ss = SpreadsheetApp.getActive();
  ensureSheets_(ss);
  const props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_RUNNING, String(t0));
  props.deleteProperty(PROP_PENDING);
  try { clearResumeTriggers_(); } catch (e) {}
  try { cacheClear_(); } catch (e) {}
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const snap = ss.getSheetByName(SNAP);
  const logs = [];
  try {
    // 1) 원본 읽기 (아직 시트에 아무것도 쓰지 않음)
    const rows = [];
    const bySrc = [];
    const failed = [];
    SOURCES.forEach(src => {
      try {
        const byCh = readSource_(src, today);
        const chs = Object.keys(byCh);
        let total = 0;
        const part = [];
        chs.forEach(ch => {
          Object.keys(byCh[ch]).forEach(k => {
            const it = byCh[ch][k];
            part.push([today, ch, k, it.date, it.title, it.url]
              .concat(METRICS.map(m => it[m]))
              .concat([it.type, it.reach, it.engaged, it.avgSec, it.lengthSec]));
            total++;
          });
        });
        if (!total) throw new Error('읽은 콘텐츠가 0건');
        bySrc.push(byCh);
        Array.prototype.push.apply(rows, part);
        logs.push([new Date(), src.channel, total, src.bench ? '정상 (계정 ' + chs.length + '개)' : '정상']);
        if (src.channel === '유튜브' && YT_API_LOG_) logs.push([new Date(), '유튜브 API', YT_API_LOG_.n, YT_API_LOG_.msg]);
        if (src.bench && BENCH_API_LOG_.msg) logs.push([new Date(), '타대학 API', BENCH_API_LOG_.n, BENCH_API_LOG_.msg]);
        if (IG_API_LOG_[src.channel]) logs.push([new Date(), IG_CH[src.channel].log, IG_API_LOG_[src.channel].n, IG_API_LOG_[src.channel].msg]);
      } catch (e) {
        failed.push({ src: src, msg: e.message });
        logs.push([new Date(), src.channel, 0, '오류: ' + e.message]);
      }
    });
    const allOk = failed.length === 0;
    const isFailedCh = ch => failed.some(f => f.src.bench ? ch.indexOf(BENCH_PREFIX) === 0 : ch === f.src.channel);

    // 2) 원본 갱신 여부: 직전 기록 대비 값이 바뀐 게시물 수
    const last0 = snap.getLastRow();
    const col = last0 >= 2 ? snap.getRange(2, 1, last0 - 1, 1).getDisplayValues().map(r => r[0]) : [];
    try {
      const prevDate = col.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d < today).sort().pop() || '';
      let prevRows = [];
      if (prevDate) {
        let a = -1, b = -1;
        col.forEach((d, i) => { if (d === prevDate) { if (a < 0) a = i; b = i; } });
        prevRows = snap.getRange(a + 2, 1, b - a + 1, M0 + METRICS.length).getValues()
          .filter(r => fmtDate_(r[0]) === prevDate);
      }
      const fresh = freshStats_(prevRows, bySrc, prevDate, today);
      failed.filter(f => !f.src.bench).forEach(f => { fresh[f.src.channel] = { changed: null, total: 0, latest: '', prev: prevDate, d: today, error: f.msg }; });
      props.setProperty(PROP_FRESH, JSON.stringify(fresh));
      Object.keys(fresh).forEach(ch => logs.push(freshLog_(ch, fresh[ch])));
    } catch (e) { logs.push([new Date(), '원본 갱신', 0, '오류: ' + e.message]); }

    // 3) 쓰기: 오늘 기존 기록 중 이번에 읽은 채널만 교체, 모든 원본이 성공했을 때만 지난 임시 기록 삭제
    const tail = scanTail_(col, today);
    const keepToday = [];
    if (tail.todayFrom < col.length) {
      snap.getRange(tail.todayFrom + 2, 1, col.length - tail.todayFrom, SNAP_HEADER.length).getValues()
        .forEach(r => { if (isFailedCh(String(r[1]))) keepToday.push(r); });
    }
    const clearFrom = allOk ? tail.provFrom : tail.todayFrom;
    if (clearFrom < col.length) snap.getRange(clearFrom + 2, 1, col.length - clearFrom, SNAP_HEADER.length).clearContent();
    const out = keepToday.concat(rows);
    if (out.length) snap.getRange(snap.getLastRow() + 1, 1, out.length, SNAP_HEADER.length).setValues(out);
    if (allOk && tail.provDates.length) {
      const acc = ss.getSheetByName(ACCOUNT);
      if (acc && acc.getLastRow() >= 2) {
        const d = acc.getRange(2, 1, acc.getLastRow() - 1, 1).getDisplayValues();
        for (let i = d.length - 1; i >= 0; i--) if (tail.provDates.indexOf(d[i][0]) >= 0) acc.deleteRow(i + 2);
      }
      logs.push([new Date(), '임시 기록 교체', 0, tail.provDates.join(', ') + ' → ' + today]);
    } else if (!allOk && tail.provDates.length) {
      logs.push([new Date(), '임시 기록 교체', 0, '보류: 원본 읽기 실패가 있어 ' + tail.provDates.join(', ') + ' 기록을 남겨 둠']);
    }
    if (keepToday.length) logs.push([new Date(), '스냅샷', keepToday.length, '읽기 실패 채널은 오늘 앞서 기록한 값 유지']);
    logRows_(ss, logs.splice(0));

    // 4) 나머지 단계 (5분이 넘으면 멈추고 이어서 실행)
    runSteps_({ ss: ss, today: today, bySrc: bySrc, logs: logs, t0: t0, n: 0 }, SNAP_STEPS.slice());
  } finally {
    try { logRows_(ss, logs); } catch (e) {}
    props.deleteProperty(PROP_RUNNING);
  }
}

// prevRows: 직전 기록일의 스냅샷 행, bySrc: 이번에 읽은 원본 → { 채널(벤치 접두어 없음): {changed, total, latest, prev, d} }
// changed = 두 기록에 모두 있는 게시물 중 조회·좋아요·댓글·공유·저장 중 하나라도 바뀐 수, latest = 원본 최신 게시일
function freshStats_(prevRows, bySrc, prevDate, today) {
  const val = x => (x === '' || x === null || x === undefined || isNaN(Number(x))) ? null : Number(x);
  const prev = {};
  (prevRows || []).forEach(r => { prev[String(r[1]) + '§' + String(r[2])] = r; });
  const out = {};
  (bySrc || []).forEach(byCh => Object.keys(byCh).forEach(ch => {
    let changed = 0, total = 0, latest = '';
    Object.keys(byCh[ch]).forEach(k => {
      const it = byCh[ch][k];
      if (it.date && it.date > latest) latest = it.date;
      const p = prev[ch + '§' + k];
      if (!p) return;
      total++;
      if (METRICS.some((m, i) => val(it[m]) !== val(p[M0 + i]))) changed++;
    });
    const name = ch.indexOf(BENCH_PREFIX) === 0 ? ch.slice(BENCH_PREFIX.length) : ch;
    out[name] = { changed: changed, total: total, latest: latest, prev: prevDate || '', d: today };
  }));
  return out;
}

function freshLog_(ch, f) {
  if (f.error) return [new Date(), '원본 갱신·' + ch, 0, '오류: ' + f.error];
  const stale = f.total >= 5 && f.changed === 0;
  const msg = (stale ? '경고: 원본 미갱신 — ' : '정상 — ') + '바뀐 게시물 ' + f.changed + '/' + f.total +
    (f.prev ? ' (비교 ' + f.prev + ')' : ' (첫 기록)') + ' · 원본 최신 게시 ' + (f.latest || '없음');
  return [new Date(), '원본 갱신·' + ch, f.changed, msg];
}

function loadFresh_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_FRESH) || '{}'); } catch (e) { return {}; }
}

// ───────── 기록 뒤 단계 (시간 초과 시 다음 실행에서 이어 받음) ─────────
const SNAP_STEPS = ['acct', 'meta', 'igx', 'yta', 'igm', 'hong', 'fb', 'tags', 'daily', 'age', 'build', 'cache'];
const STEP_FN = {
  acct: x => {
    try { accountSnapshot_(x.ss, x.today, x.logs); } catch (e) { x.logs.push([new Date(), '계정 지표', 0, '오류: ' + e.message]); }
  },
  meta: x => {
    try { metaStep_(x.ss, x.today, x.logs); } catch (e) { x.logs.push([new Date(), '메타 광고 API', 0, '오류: ' + e.message]); }
  },
  igx: x => {
    try { igxStep_(x.ss, x.today, x.logs); } catch (e) { x.logs.push([new Date(), '인스타 추가 수집', 0, '오류: ' + e.message]); }
  },
  yta: x => {
    try { ytaStep_(x.ss, x.today, x.logs); } catch (e) { x.logs.push([new Date(), '유튜브 추가 수집', 0, '오류: ' + e.message]); }
  },
  igm: x => {
    try { igmStep_(x.ss, x.today, x.logs); } catch (e) { x.logs.push([new Date(), '인스타 게시물 추가', 0, '오류: ' + e.message]); }
  },
  hong: x => {
    try { hongPostsStep_(x.ss, x.logs); } catch (e) { x.logs.push([new Date(), HONG_POSTS, 0, '오류: ' + e.message]); }
    try { officialPostsStep_(x.ss, x.logs); } catch (e) { x.logs.push([new Date(), OFF_IG_POSTS, 0, '오류: ' + e.message]); }
  },
  fb: x => {
    try { fbStep_(x.ss, x.today, x.logs); } catch (e) { x.logs.push([new Date(), '페이스북', 0, '오류: ' + e.message]); }
  },
  tags: x => {
    try { const b = stepBySrc_(x, true); saveTags_(x.ss, b, x.today); x.logs.push([new Date(), '태그', b.length, '정상']); }
    catch (e) { x.logs.push([new Date(), '태그', 0, '오류: ' + e.message]); }
  },
  daily: x => {
    try { const n = saveDailyTotals_(x.ss, stepBySrc_(x, false), x.today); x.logs.push([new Date(), '일별 합계', n, '정상']); }
    catch (e) { x.logs.push([new Date(), '일별 합계', 0, '오류: ' + e.message]); }
  },
  age: x => {
    try { const n = saveAgeViews_(x.ss, stepBySrc_(x, false), x.today); x.logs.push([new Date(), '게시 후 조회', n, '정상']); }
    catch (e) { x.logs.push([new Date(), '게시 후 조회', 0, '오류: ' + e.message]); }
  },
  build: x => {
    try { buildAll(); } catch (e) { x.logs.push([new Date(), '분석 탭', 0, '오류: ' + e.message]); }
  },
  cache: x => {
    try { const r = cacheBuild_(); x.logs.push([new Date(), '응답 캐시', r.n, '정상 (' + Math.round(r.raw / 1024) + 'KB → 압축 ' + Math.round(r.bytes / 1024) + 'KB)']); }
    catch (e) { x.logs.push([new Date(), '응답 캐시', 0, '오류: ' + e.message]); }
  },
};

function runSteps_(ctx, steps) {
  for (let i = 0; i < steps.length; i++) {
    if (Date.now() - ctx.t0 > TIME_LIMIT_MS) {
      const rest = steps.slice(i);
      const again = ctx.n < RESUME_MAX;
      if (again) savePending_(ctx.today, rest, ctx.n + 1);
      ctx.logs.push([new Date(), '시간 초과', 0, '경고: 실행 ' + Math.round((Date.now() - ctx.t0) / 1000) + '초 — 남은 단계 ' + rest.join(', ') +
        (again ? ' 는 1분 뒤 이어서 실행' : ' 는 이어서 실행 한도(' + RESUME_MAX + '번)를 넘어 다음 정기 실행으로 넘김')]);
      return false;
    }
    STEP_FN[steps[i]](ctx);
  }
  return true;
}

// 단계에 쓸 원본: 이번 실행에서 읽은 것 → 없으면(이어서 실행) 태그는 원본을 다시 읽고, 합계·나이는 스냅샷 기록으로
function stepBySrc_(ctx, needFull) {
  if (ctx.bySrc) return ctx.bySrc;
  if (needFull) {
    const b = [];
    SOURCES.forEach(src => { try { b.push(readSource_(src, ctx.today)); } catch (e) { ctx.logs.push([new Date(), src.channel, 0, '오류(이어서 실행): ' + e.message]); } });
    return b;
  }
  if (!ctx.snapBySrc) {
    const snap = ctx.ss.getSheetByName(SNAP);
    const last = snap.getLastRow();
    const col = last >= 2 ? snap.getRange(2, 1, last - 1, 1).getDisplayValues().map(r => r[0]) : [];
    const t = scanTail_(col, ctx.today);
    const byCh = {};
    if (t.todayFrom < col.length) snap.getRange(t.todayFrom + 2, 1, col.length - t.todayFrom, SNAP_HEADER.length).getValues().forEach(r => {
      const ch = String(r[1]), k = String(r[2]); if (!ch || !k) return;
      const it = { date: fmtDate_(r[C.date]) };
      METRICS.forEach((m, i) => { it[m] = r[M0 + i]; });
      (byCh[ch] = byCh[ch] || {})[k] = it;
    });
    ctx.snapBySrc = [byCh];
  }
  return ctx.snapBySrc;
}

function savePending_(date, steps, n) {
  PropertiesService.getScriptProperties().setProperty(PROP_PENDING, JSON.stringify({ date: date, steps: steps, n: n }));
  clearResumeTriggers_();
  ScriptApp.newTrigger('resumeSnapshot').timeBased().after(60 * 1000).create();
}

function clearResumeTriggers_() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'resumeSnapshot').forEach(t => ScriptApp.deleteTrigger(t));
}

// 시간 초과로 남은 단계 이어서 실행 (savePending_이 만든 1회용 트리거가 부름)
function resumeSnapshot() {
  try { clearResumeTriggers_(); } catch (e) {}
  return withLock_('이어서 실행', () => {
    const props = PropertiesService.getScriptProperties();
    let p = null;
    try { p = JSON.parse(props.getProperty(PROP_PENDING) || 'null'); } catch (e) {}
    props.deleteProperty(PROP_PENDING);
    if (!p || !p.steps || !p.steps.length) return;
    const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    if (p.date !== today) { logRows_(ss, [[new Date(), '이어서 실행', 0, '건너뜀: ' + p.date + ' 기록의 남은 단계(다음 정기 실행이 다시 계산)']]); return; }
    props.setProperty(PROP_RUNNING, String(Date.now()));
    try { cacheClear_(); } catch (e) {}
    const ctx = { ss: ss, today: today, bySrc: null, logs: [[new Date(), '이어서 실행', p.n, p.steps.join(', ')]], t0: Date.now(), n: p.n };
    try { runSteps_(ctx, p.steps.filter(s => STEP_FN[s])); }
    finally { try { logRows_(ss, ctx.logs); } catch (e) {} props.deleteProperty(PROP_RUNNING); }
  });
}

// ───────── 원본 읽기 ─────────
// 반환: { 채널명: { 콘텐츠키: item } }
// 같은 원본 시트(퍼블릭 원본: hong·벤치마크)는 한 실행에서 한 번만 읽음
const SRC_VALUES_ = {};
function readSource_(src, today) {
  const ck = src.id + '|' + (src.sheet || '') + '|' + (src.needDisplay ? 1 : 0);
  let got = SRC_VALUES_[ck];
  if (!got) {
    const ss = SpreadsheetApp.openById(src.id);
    const sh = ss.getSheetByName(src.sheet || '시트1') || ss.getSheets()[0];
    const rng = sh.getDataRange();
    got = { values: rng.getValues(), disp: src.needDisplay ? rng.getDisplayValues() : null };
    if (!src.sheet) SRC_VALUES_[ck] = got; // _hist_ 탭(importHistory)은 저장하지 않음
  }
  const values = got.values;
  const disp = got.disp;
  if (values.length < 2) throw new Error('데이터 없음');

  const header = values[0].map(h => String(h).trim());
  const anchors = [];
  header.forEach((h, i) => { if (src.anchor.indexOf(h) >= 0) anchors.push(i); });
  if (!anchors.length) {
    // Supermetrics 인증 만료 등으로 A1에 오류 문구가 찍힌 경우
    throw new Error('헤더 없음 — ' + String(values[0][0]).slice(0, 100));
  }
  const starts = anchors.slice();
  starts[0] = 0;
  const cutoff = src.maxDays ? shiftDate_(today, -src.maxDays) : '';

  const out = {};
  starts.forEach((start, b) => {
    const end = b + 1 < starts.length ? starts[b + 1] : header.length;
    const find = names => {
      for (const n of names) {
        const i = header.indexOf(n, start);
        if (i >= 0 && i < end) return i;
      }
      return -1;
    };
    const idx = {};
    Object.keys(src.fields).forEach(f => { idx[f] = find(src.fields[f]); });
    const fIdx = src.filter ? find([src.filter.col]) : -1;
    if (src.filter && fIdx < 0) return;
    if (src.bench && idx.user < 0) return;

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const get = f => (idx[f] >= 0 ? row[idx[f]] : '');
      if (src.filter && String(row[fIdx]).trim() !== src.filter.value) continue;

      let channel = src.channel;
      if (src.bench) {
        const u = String(get('user')).trim();
        if (!u || (src.skipUsers || []).indexOf(u) >= 0) continue;
        channel = BENCH_PREFIX + u;
      }

      const date = idx.date >= 0 ? fmtDate_(row[idx.date]) : '';
      const title = String(get('title'));
      const url = String(get('url')).trim();
      if (!date && !title && !url) continue;
      if (cutoff && date && date < cutoff) continue;

      const key = src.keyFn(date, title, url);
      if (!key) continue;

      const item = { date: date, title: cut_(title.replace(/\s+/g, ' ').trim(), 80), url: url, full: title, desc: idx.desc >= 0 ? String(row[idx.desc] || '') : '' };
      NUMF.forEach(m => { item[m] = idx[m] >= 0 ? num_(row[idx[m]]) : ''; });
      item.lengthSec = (idx.length >= 0 && disp) ? parseDur_(disp[r][idx.length]) : '';
      item.type = src.typeFn
        ? src.typeFn(String(get('type')).trim(), String(get('mediaType')).trim(), item)
        : '';

      out[channel] = out[channel] || {};
      const prev = out[channel][key];
      if (!prev) { out[channel][key] = item; continue; }
      // 키 중복 시 누적값이 큰 쪽 유지
      NUMF.forEach(m => {
        if (item[m] !== '' && (prev[m] === '' || item[m] > prev[m])) prev[m] = item[m];
      });
      if (!prev.lengthSec && item.lengthSec) prev.lengthSec = item.lengthSec;
      if (!prev.type && item.type) prev.type = item.type;
    }
  });
  if (src.channel === '유튜브' && !src.sheet) ytOverlay_(out, today);
  if (IG_CH[src.channel] && !src.sheet) igOverlay_(out, today, src.channel);
  if (src.bench && !src.sheet) benchOverlay_(out, today, cutoff);
  return out;
}

// ───────── 계정 단위 지표 (Supermetrics 탭 → 계정 지표 누적) ─────────
function accountSnapshot_(ss, today, logs) {
  const acc = ss.getSheetByName(ACCOUNT);
  ACCOUNT_SOURCES.forEach(a => {
    const name = '계정·' + a.channel;
    const src = ss.getSheetByName(a.tab);
    if (!src) { logs.push([new Date(), name, 0, '대기: 「' + a.tab + '」 탭 없음']); return; }
    const v = src.getDataRange().getValues();
    if (v.length < 2 || /^error/i.test(String(v[0][0]))) {
      logs.push([new Date(), name, 0, '오류: ' + String(v[0][0]).slice(0, 100)]);
      return;
    }
    // 가로형(1행 지표명 / 2행 값) · 세로형(A열 지표명 / B열 값) 모두 지원
    const vertical = v[0].length === 2 && v[0][1] !== '' && !isNaN(Number(v[0][1]));
    const hdr = vertical ? v.map(r => String(r[0]).trim()) : v[0].map(h => String(h).trim());
    // Supermetrics 오류 문구(예: 유튜브 「Channel total subscribers」의 "Can't be calculated… ALLOW_SUM_UNIQUE")는 '수집 오류'로 기록
    // (응답에서는 숫자가 아니라 m에서 빠지고, acct[].e 에 지표 이름이 들어감)
    const errCols = [];
    const data = (vertical ? v.map(r => r[1]) : v[1])
      .map((x, j) => {
        if (typeof x === 'string' && (x.length > 40 || /can'?t be calculated|ALLOW_SUM_UNIQUE|^#?error/i.test(x))) { errCols.push(hdr[j] || ('열' + (j + 1))); return ACCT_ERR; }
        return x;
      });

    // 헤더 병합 (새 지표가 생기면 열 추가)
    const lastCol = Math.max(acc.getLastColumn(), 2);
    let head = acc.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
    hdr.forEach(h => { if (h && head.indexOf(h) < 0) head.push(h); });
    acc.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');

    const row = head.map((h, i) => {
      if (i === 0) return today;
      if (i === 1) return a.channel;
      const j = hdr.indexOf(h);
      return j >= 0 ? data[j] : '';
    });

    // 같은 날·같은 채널 행이 있으면 덮어쓰기
    const last = acc.getLastRow();
    let target = last + 1;
    if (last >= 2) {
      const keys = acc.getRange(2, 1, last - 1, 2).getDisplayValues();
      for (let i = keys.length - 1; i >= 0; i--) {
        if (keys[i][0] === today && keys[i][1] === a.channel) { target = i + 2; break; }
      }
    }
    acc.getRange(target, 1, 1, head.length).setValues([row]);
    logs.push([new Date(), name, 1, errCols.length ? '정상 · 경고: 수집 오류 지표 — ' + errCols.join(', ') : '정상']);
  });
}

// ───────── 분석 탭 ─────────
function buildAll() {
  return withLock_('분석 탭', () => buildAll_());
}
function buildAll_() {
  const ss = SpreadsheetApp.getActive();
  ensureSheets_(ss);
  const byCh = loadSnap_(ss);
  buildWeekly_(ss, byCh);
  buildTypeSummary_(ss, byCh);
  buildBench_(ss, byCh);
}

// 채널 → 기록일 → 콘텐츠키 → 행
function loadSnap_(ss) {
  const data = ss.getSheetByName(SNAP).getDataRange().getValues().slice(1);
  const byCh = {};
  data.forEach(r => {
    while (r.length < SNAP_HEADER.length) r.push('');
    const d = String(r[0]), ch = String(r[1]), k = String(r[2]);
    if (!d || !ch || !k) return;
    byCh[ch] = byCh[ch] || {};
    byCh[ch][d] = byCh[ch][d] || {};
    byCh[ch][d][k] = r;
  });
  return byCh;
}

// 한 채널의 최신 기록일 vs 직전 기록일 비교
function compareChannel_(chData) {
  if (!chData) return null;
  const dates = Object.keys(chData).sort();
  const cur = dates[dates.length - 1];
  const prev = dates.length > 1 ? dates[dates.length - 2] : null;
  const curMap = chData[cur];
  const prevMap = prev ? chData[prev] : null;
  const list = Object.keys(curMap).map(k => {
    const c = curMap[k];
    const p = prevMap ? prevMap[k] : null;
    const inc = METRICS.map((m, i) => {
      const cv = c[M0 + i];
      if (cv === '' || cv === null) return '';
      if (!prev) return '';
      if (!p) return cv;               // 직전 기록 이후 새로 올라온 콘텐츠
      const pv = p[M0 + i];
      return pv === '' ? '' : cv - pv;
    });
    const note = !prev ? '첫 기록(다음 주부터 비교)' : (!p ? '신규 — 게시 후 누적' : '');
    return {
      c: c, p: p, inc: inc, isNew: !!(prev && !p), note: note,
      period: prev ? prev + ' → ' + cur : cur,
      rate: i => (p && inc[i] !== '' && Number(p[M0 + i]) > 0) ? inc[i] / p[M0 + i] : '',
    };
  });
  return { cur: cur, prev: prev, list: list };
}

function buildWeekly_(ss, byCh) {
  WEEKLY_TABS.forEach(cfg => {
    const cmp = compareChannel_(byCh[cfg.channel]);
    const header = cfg.cols.map(c => c.h);
    const vi = header.indexOf('조회수 증가'), ci = header.indexOf('현재 조회수');
    const out = cmp ? cmp.list.map(x => cfg.cols.map(col => {
      const v = col.v(x);
      return (v === undefined || v === null) ? '' : v;
    })) : [];
    const key = r => (r[vi] === '' ? -Infinity : r[vi]);
    out.sort((a, b) => (key(b) - key(a)) || (Number(b[ci]) - Number(a[ci])));
    writeTable_(ss.getSheetByName(cfg.tab), header, out, cfg.cols.map(c => c.f || null));
  });
}

function buildTypeSummary_(ss, byCh) {
  const header = ['채널', '유형', '콘텐츠 수', '신규 콘텐츠', '조회수 증가 합계', '콘텐츠당 조회수 증가',
    '좋아요 증가 합계', '평균 현재 조회수', '평균 참여율(인스타)', '평균 시청 완료율(유튜브)', '비교 기간'];
  const fmts = [null, null, '#,##0', '#,##0', '#,##0', '#,##0', '#,##0', '#,##0', '0.0%', '0.0%', null];
  const out = [];
  WEEKLY_TABS.forEach(cfg => {
    const cmp = compareChannel_(byCh[cfg.channel]);
    if (!cmp) return;
    const g = {};
    cmp.list.forEach(x => {
      const t = x.c[C.type] || '(미분류)';
      const s = g[t] = g[t] || { n: 0, nNew: 0, vSum: 0, vN: 0, lSum: 0, cur: 0, eng: [], comp: [] };
      s.n++;
      if (x.isNew) s.nNew++;
      if (x.inc[0] !== '') { s.vSum += Number(x.inc[0]); s.vN++; }
      if (x.inc[1] !== '') s.lSum += Number(x.inc[1]);
      s.cur += Number(x.c[C.views]) || 0;
      const e = igEngagement_(x.c); if (e !== '') s.eng.push(e);
      const cp = ratio_(x.c[C.avgSec], x.c[C.lengthSec]); if (cp !== '') s.comp.push(cp);
    });
    Object.keys(g).forEach(t => {
      const s = g[t];
      out.push([cfg.channel, t, s.n, s.nNew,
        s.vN ? s.vSum : '', s.vN ? s.vSum / s.vN : '',
        s.vN ? s.lSum : '', s.cur / s.n,
        cfg.channel === '인스타그램' ? avg_(s.eng) : '',
        cfg.channel === '유튜브' ? avg_(s.comp) : '',
        cmp.prev ? cmp.prev + ' → ' + cmp.cur : cmp.cur]);
    });
  });
  // 채널 순서 유지, 채널 안에서는 조회수 증가 합계(없으면 평균 조회수) 순
  const order = WEEKLY_TABS.map(c => c.channel);
  out.sort((a, b) => (order.indexOf(a[0]) - order.indexOf(b[0]))
    || ((b[4] === '' ? b[7] : b[4]) - (a[4] === '' ? a[7] : a[4])));
  writeTable_(ss.getSheetByName(TYPE_SUMMARY), header, out, fmts);
}

function buildBench_(ss, byCh) {
  const sh = ss.getSheetByName(BENCH);
  if (sh.getFilter()) sh.getFilter().remove();
  sh.clear();

  const chs = Object.keys(byCh).filter(ch => ch.indexOf(BENCH_PREFIX) === 0);
  OUR_ACCOUNTS.forEach(u => { if (byCh[u]) chs.push(u); });
  const label = ch => {
    const u = ch.indexOf(BENCH_PREFIX) === 0 ? ch.slice(BENCH_PREFIX.length) : ch;
    return OUR_ACCOUNTS.indexOf(u) >= 0 ? u + ' (우리)' : u;
  };

  const summary = [];
  const top = [];
  chs.forEach(ch => {
    const cmp = compareChannel_(byCh[ch]);
    if (!cmp) return;
    const cut180 = shiftDate_(cmp.cur, -BENCH_DAYS);
    const cut7 = shiftDate_(cmp.cur, -7);
    const list = cmp.list.filter(x => String(x.c[C.date]) >= cut180);
    if (!list.length) return;
    let n7 = 0, likeInc = '', comInc = '', viewInc = '', likes = 0, coms = 0;
    const add = (acc, v) => (v === '' ? acc : (acc === '' ? 0 : acc) + Number(v));
    list.forEach(x => {
      if (String(x.c[C.date]) >= cut7) n7++;
      likeInc = add(likeInc, x.inc[1]);
      comInc = add(comInc, x.inc[2]);
      viewInc = add(viewInc, x.inc[0]);
      likes += Number(x.c[C.likes]) || 0;
      coms += Number(x.c[C.comments]) || 0;
      top.push([label(ch), x.c[C.date], x.c[C.type], x.c[C.title],
        x.inc[1], x.inc[0], x.c[C.likes], x.c[C.views]]);
    });
    summary.push([label(ch), list.length, n7, likeInc, comInc, viewInc,
      likes / list.length, coms / list.length,
      cmp.prev ? cmp.prev + ' → ' + cmp.cur : cmp.cur]);
  });

  const sKey = r => (r[3] === '' ? r[6] : r[3]);
  summary.sort((a, b) => sKey(b) - sKey(a));
  const tKey = r => (r[4] === '' ? Number(r[6]) || 0 : r[4]);
  top.sort((a, b) => tKey(b) - tKey(a));
  const top20 = top.slice(0, 20);

  const sHead = ['계정', '최근 180일 게시물', '최근 7일 신규 게시물', '좋아요 증가 합계', '댓글 증가 합계',
    '릴스 조회 증가 합계', '게시물당 평균 좋아요', '게시물당 평균 댓글', '비교 기간'];
  const tHead = ['계정', '게시일', '유형', '캡션', '좋아요 증가', '릴스 조회 증가', '현재 좋아요', '현재 릴스 조회'];

  sh.getRange(1, 1).setValue('계정별 요약 — 최근 ' + BENCH_DAYS + '일 게시물 기준 (좋아요 증가 순)').setFontWeight('bold');
  sh.getRange(2, 1, 1, sHead.length).setValues([sHead]).setFontWeight('bold').setBackground('#f1f3f4');
  if (summary.length) {
    sh.getRange(3, 1, summary.length, sHead.length).setValues(summary);
    sh.getRange(3, 2, summary.length, 7).setNumberFormat('#,##0');
  }
  const t0 = 3 + summary.length + 2;
  sh.getRange(t0, 1).setValue('이번 주 TOP 20 콘텐츠 (좋아요 증가 순, 첫 기록 주에는 현재 좋아요 순)').setFontWeight('bold');
  sh.getRange(t0 + 1, 1, 1, tHead.length).setValues([tHead]).setFontWeight('bold').setBackground('#f1f3f4');
  if (top20.length) {
    sh.getRange(t0 + 2, 1, top20.length, tHead.length).setValues(top20);
    sh.getRange(t0 + 2, 5, top20.length, 4).setNumberFormat('#,##0');
  }
  sh.setFrozenRows(0);
}

// ───────── 유틸 ─────────
function writeTable_(sh, header, rows, fmts) {
  if (sh.getFilter()) sh.getFilter().remove();
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) {
    const n = rows.length;
    sh.getRange(2, 1, n, header.length).setValues(rows);
    fmts.forEach((f, i) => { if (f) sh.getRange(2, i + 1, n, 1).setNumberFormat(f); });
    sh.getRange(1, 1, n + 1, header.length).createFilter();
  }
  sh.setFrozenRows(1);
}

function ensureSheets_(ss) {
  let snap = ss.getSheetByName(SNAP);
  if (!snap) {
    const def = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
    snap = (def && def.getLastRow() === 0) ? def.setName(SNAP) : ss.insertSheet(SNAP);
  }
  if (snap.getLastRow() === 0 || snap.getLastColumn() < SNAP_HEADER.length) {
    snap.getRange(1, 1, 1, SNAP_HEADER.length).setValues([SNAP_HEADER]).setFontWeight('bold');
    snap.setFrozenRows(1);
    snap.getRange('A:F').setNumberFormat('@'); // 날짜·캡션을 텍스트로 고정
    snap.getRange('G:K').setNumberFormat('#,##0');
    snap.getRange('L:L').setNumberFormat('@');
    snap.getRange('M:P').setNumberFormat('#,##0');
  }
  WEEKLY_TABS.forEach(cfg => { if (!ss.getSheetByName(cfg.tab)) ss.insertSheet(cfg.tab); });
  [TYPE_SUMMARY, BENCH].forEach(n => { if (!ss.getSheetByName(n)) ss.insertSheet(n); });
  let acc = ss.getSheetByName(ACCOUNT);
  if (!acc) {
    acc = ss.insertSheet(ACCOUNT);
    acc.getRange(1, 1, 1, 2).setValues([['기록일', '채널']]).setFontWeight('bold');
    acc.setFrozenRows(1);
    acc.getRange('A:B').setNumberFormat('@');
  }
  const legacy = ss.getSheetByName(LEGACY_WEEKLY);
  if (legacy) ss.deleteSheet(legacy);
  let log = ss.getSheetByName(LOG);
  if (!log) {
    log = ss.insertSheet(LOG);
    log.getRange(1, 1, 1, 4).setValues([['실행 시각', '채널', '기록 행수', '상태']]).setFontWeight('bold');
    log.setFrozenRows(1);
    log.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  }
}

function clearDate_(sh, date) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const col = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  let first = -1;
  for (let i = col.length - 1; i >= 0; i--) {
    if (col[i][0] === date) first = i; else break;
  }
  if (first >= 0) sh.getRange(first + 2, 1, col.length - first, SNAP_HEADER.length).clearContent();
}

function typeLabel_(product, media) {
  const p = String(product || '').toUpperCase(), m = String(media || '').toUpperCase();
  if (p === 'REELS') return '릴스';
  if (p === 'STORY') return '스토리';
  if (m === 'CAROUSEL_ALBUM') return '캐러셀';
  if (m === 'IMAGE') return '이미지';
  if (m === 'VIDEO') return p === 'FEED' ? '영상' : '릴스/영상';
  return product || media || '';
}

function lengthBucket_(sec) {
  if (sec === '' || sec === null || sec === undefined) return '';
  if (sec <= 60) return '1분 이하';
  if (sec <= 180) return '1~3분';
  if (sec <= 600) return '3~10분';
  return '10분 초과';
}

function igEngagement_(c) {
  const reach = Number(c[C.reach]);
  if (!(reach > 0)) return '';
  const sum = [C.likes, C.comments, C.shares, C.saves].reduce((a, i) => a + (Number(c[i]) || 0), 0);
  return sum / reach;
}

function ratio_(a, b) {
  if (a === '' || a === null || b === '' || b === null) return '';
  const nb = Number(b);
  return nb > 0 ? Number(a) / nb : '';
}

function avg_(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : '';
}

function parseDur_(s) {
  const parts = String(s || '').trim().split(':');
  if (parts.length < 2) return '';
  let sec = 0;
  for (const p of parts) {
    const n = Number(p);
    if (isNaN(n)) return '';
    sec = sec * 60 + n;
  }
  return sec;
}

function shiftDate_(ymd, days) {
  const d = new Date(ymd + 'T12:00:00+09:00');
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function capKey_(d, t) {
  const c = String(t || '').replace(/\s+/g, '').slice(0, 40);
  return (d || c) ? d + '|' + c : '';
}

function num_(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,\s]/g, '');
  if (!s) return 0;
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim().slice(0, 10);
}

// ───────── 게시 후 1·3·7일 시점 조회 (「게시 후 조회」 탭) ─────────
// 같은 나이에서 비교하려고, 게시물이 1·3·7일째가 됐을 때의 조회를 한 번만 적어 둔다.
// 원본(Supermetrics)은 평일 06:00에만 갱신돼서 주말 실행분은 건너뛴다 → 「경과일」에 실제 나이를 같이 기록.
const AGE_SHEET = '게시 후 조회';
const AGE_HEADER = ['채널', '콘텐츠키', '게시일', '1일 조회', '1일 경과', '3일 조회', '3일 경과', '7일 조회', '7일 경과', '갱신일'];
const AGE_WIN = [[1, 2], [3, 6], [7, 10]]; // [최소, 최대] 경과일
function ageSheet_(ss) {
  let sh = ss.getSheetByName(AGE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(AGE_SHEET);
    sh.getRange(1, 1, 1, AGE_HEADER.length).setValues([AGE_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
// obs: [[채널, 키, 게시일, 조회, 기록일], ...] → 탭에 반영. 반환: 새로 채운 칸 수
function mergeAgeViews_(ss, obs) {
  const sh = ageSheet_(ss);
  const map = {}, order = [];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, AGE_HEADER.length).getValues().forEach(r => {
    const k = r[0] + '§' + r[1]; if (!map[k]) order.push(k); map[k] = r.map((x, j) => j === 2 ? fmtDate_(x) : j === 9 ? fmtDate_(x) : x);
  });
  let n = 0;
  obs.forEach(o => {
    const ch = o[0], key = o[1], posted = fmtDate_(o[2]), views = o[3] === '' || o[3] == null ? null : num_(o[3]), day = fmtDate_(o[4]);
    if (OWN_CHANNELS.indexOf(ch) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(posted) || views == null) return;
    const age = Math.round((new Date(day + 'T00:00:00Z') - new Date(posted + 'T00:00:00Z')) / 864e5);
    const k = ch + '§' + key;
    let r = map[k];
    AGE_WIN.forEach((w, j) => {
      if (age < w[0] || age > w[1]) return;
      if (!r) { r = map[k] = [ch, key, posted, '', '', '', '', '', '', day]; order.push(k); }
      const c = 3 + j * 2;
      // 같은 구간에서는 목표 나이(최소값)에 가장 가까운 관측을 남김
      if (r[c] === '' || r[c] === null || Math.abs(age - w[0]) < Math.abs(Number(r[c + 1]) - w[0])) { r[c] = views; r[c + 1] = age; r[9] = day; n++; }
    });
  });
  const rows = order.map(k => map[k]);
  if (rows.length) {
    sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), AGE_HEADER.length).clearContent();
    sh.getRange(2, 1, rows.length, AGE_HEADER.length).setValues(rows);
  }
  return n;
}
function saveAgeViews_(ss, bySrc, today) {
  if (!ss.getSheetByName(AGE_SHEET)) backfillAgeViews(); // 처음 한 번: 기존 스냅샷 기록으로 채움
  if (isWeekend_(today)) return 0; // 주말: 원본이 금요일 값 그대로라 건너뜀
  const obs = [];
  bySrc.forEach(byCh => Object.keys(byCh).forEach(ch => Object.keys(byCh[ch]).forEach(k => {
    const it = byCh[ch][k]; obs.push([ch, k, it.date, it.views, today]);
  })));
  return mergeAgeViews_(ss, obs);
}
// 한 번만: 「스냅샷」 탭에 이미 있는 기록으로 채우기 (메뉴·편집기에서 실행)
function backfillAgeViews() {
  return withLock_('게시 후 조회 다시 채우기', () => { const n = backfillAgeViews_(); dropCache_(); return n; });
}
function backfillAgeViews_() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const v = ss.getSheetByName(SNAP).getDataRange().getValues().slice(1);
  const obs = v.filter(r => r[0] && r[1]).map(r => [String(r[1]), String(r[2]), r[C.date], r[C.views], r[0]]);
  return mergeAgeViews_(ss, obs);
}
function loadAgeViews_(ss) {
  const sh = ss.getSheetByName(AGE_SHEET), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, AGE_HEADER.length).getValues().forEach(r => {
    const g = j => r[3 + j * 2] === '' || r[3 + j * 2] === null ? null : [Number(r[3 + j * 2]), Number(r[4 + j * 2])];
    out[r[0] + '§' + r[1]] = [g(0), g(1), g(2)];
  });
  return out;
}

// ───────── 일별 합계 (「일별 합계」 탭) ─────────
// 「스냅샷」 탭은 용량 때문에 화~일 기록을 최신 1개만 남긴다 → 채널별 합계만 매일 따로 남겨 일별 증가를 볼 수 있게 함
// 원본이 평일에만 갱신돼서 주말은 건너뜀 (월요일 값 - 금요일 값 = 주말 포함 3일치)
const DAILY_SHEET = '일별 합계';
const DAILY_HEADER = ['기록일', '채널', '게시물 수', '조회수', '좋아요', '댓글', '공유', '저장'];
function dailySheet_(ss) {
  let sh = ss.getSheetByName(DAILY_SHEET);
  if (!sh) { sh = ss.insertSheet(DAILY_SHEET); sh.getRange(1, 1, 1, DAILY_HEADER.length).setValues([DAILY_HEADER]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
// rows: [[기록일, 채널, 콘텐츠키, 조회, 좋아요, 댓글, 공유, 저장], ...] → 날짜·채널별 합계로 탭에 반영(같은 날짜는 덮어씀)
function mergeDailyTotals_(ss, rows) {
  const sh = dailySheet_(ss);
  const agg = {};
  rows.forEach(r => {
    const d = fmtDate_(r[0]), ch = String(r[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !ch) return;
    const k = d + '§' + ch, a = agg[k] || (agg[k] = [d, ch, 0, 0, 0, 0, 0, 0]);
    a[2]++;
    for (let j = 0; j < 5; j++) { const v = r[3 + j]; if (v !== '' && v != null && !isNaN(Number(v))) a[3 + j] += Number(v); }
  });
  const keep = [];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, DAILY_HEADER.length).getValues().forEach(r => { const k = fmtDate_(r[0]) + '§' + r[1]; if (!agg[k]) keep.push([fmtDate_(r[0])].concat(r.slice(1))); });
  const out = keep.concat(Object.keys(agg).map(k => agg[k])).sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : String(x[1]).localeCompare(String(y[1])));
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, DAILY_HEADER.length).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, DAILY_HEADER.length).setValues(out);
  return Object.keys(agg).length;
}
function saveDailyTotals_(ss, bySrc, today) {
  if (!ss.getSheetByName(DAILY_SHEET)) backfillDailyTotals();
  if (isWeekend_(today)) return 0;
  const rows = [];
  bySrc.forEach(byCh => Object.keys(byCh).forEach(ch => Object.keys(byCh[ch]).forEach(k => {
    const it = byCh[ch][k]; rows.push([today, ch, k].concat(METRICS.map(m => it[m])));
  })));
  return mergeDailyTotals_(ss, rows);
}
// 한 번만: 「스냅샷」 탭의 기록일별로 합계 채우기
function backfillDailyTotals() {
  return withLock_('일별 합계 다시 채우기', () => { const n = backfillDailyTotals_(); dropCache_(); return n; });
}
function backfillDailyTotals_() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const v = ss.getSheetByName(SNAP).getDataRange().getValues().slice(1).filter(r => r[0] && r[1]);
  return mergeDailyTotals_(ss, v.map(r => [r[0], r[1], r[2]].concat([0, 1, 2, 3, 4].map(j => r[M0 + j]))));
}
// 팔로워 일별(최근 400일): 타 대학(「타대학 일별」 [날짜, 계정, 팔로워…]) + 우리 계정(IGX_DAY_SHEET [채널, 날짜, 팔로워…])
function loadFollowers_(ss) {
  const out = [], from = shiftDate_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), -400);
  const ymd = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').slice(0, 10);
  const b = ss.getSheetByName('타대학 일별');
  if (b && b.getLastRow() > 1) b.getRange(2, 1, b.getLastRow() - 1, 3).getValues().forEach(r => { const d = ymd(r[0]), n = Number(r[2]); if (d >= from && n > 0) out.push([d, String(r[1]).trim(), n]); });
  const o = ss.getSheetByName(IGX_DAY_SHEET);
  if (o && o.getLastRow() > 1) o.getRange(2, 1, o.getLastRow() - 1, 3).getValues().forEach(r => { const d = ymd(r[1]), n = Number(r[2]); if (d >= from && n > 0) out.push([d, String(r[0]).trim(), n]); });
  return out.sort((x, y) => x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0);
}
function loadDailyTotals_(ss) {
  const sh = ss.getSheetByName(DAILY_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, DAILY_HEADER.length).getValues().map(r => {
    const raw = String(r[1]); const ch = raw.indexOf(BENCH_PREFIX) === 0 ? raw.slice(BENCH_PREFIX.length) : raw;
    return [fmtDate_(r[0]), ch].concat(r.slice(2).map(x => x === '' ? null : Number(x)));
  });
}

// ───────── 대시보드용 데이터 API (GitHub Pages에서 JSONP로 읽음) ─────────
const SS_ID = '1WshbvV-foluKpVu79vdZ75BBfH-ycME_nPe0RcJuwr4';

// ───────── 보드 접근: 사람별 접속 키 (2026-10-18) ─────────
// 「보드 접근」 탭 [이름, 키, 사용, 메모, 만든 날, 마지막 접속, 접속 수, 접속 링크]
//  · 이름만 적으면 키·접속 링크가 생김(탭을 고칠 때 바로, 또는 메뉴 「보드 접속 키 만들기」)
//  · 줄을 지우거나 사용을 X로 바꾸면 그 사람만 막힘(탭을 고치면 바로, 늦어도 5분 안)
//  · 키는 이 탭에만 있음(저장소·코드에 넣지 않음)
const ACCESS_SHEET = '보드 접근';
const ACCESS_HEAD = ['이름', '키', '사용', '메모', '만든 날', '마지막 접속', '접속 수', '접속 링크'];
const BOARD_URL = 'https://kukhyoun-max.github.io/sns-board/';
const ACCESS_CACHE = 'acc:keys';
const accessSS_ = () => SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
const newKey_ = () => (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 24);
// 탭이 없으면 만들고(담당자·분석 스크립트 두 줄), 키가 빈 줄에 키·사용·만든 날·링크를 채움
function accessFill_(ss) {
  let sh = ss.getSheetByName(ACCESS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ACCESS_SHEET);
    sh.getRange(1, 1, 1, ACCESS_HEAD.length).setValues([ACCESS_HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, 2, 4).setValues([['담당자', '', 'O', ''], ['분석 스크립트', '', 'O', 'run_all.sh가 성과 JSON을 받을 때 씀']]);
  }
  const n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  const v = sh.getRange(2, 1, n, ACCESS_HEAD.length).getValues();
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  let made = 0;
  v.forEach(r => {
    if (!String(r[0]).trim()) return;
    if (!String(r[1]).trim()) { r[1] = newKey_(); r[4] = today; made++; }
    if (!String(r[2]).trim()) r[2] = 'O';
    r[7] = BOARD_URL + '#k=' + String(r[1]).trim();
  });
  sh.getRange(2, 1, n, ACCESS_HEAD.length).setValues(v);
  CacheService.getScriptCache().remove(ACCESS_CACHE);
  return made;
}
// 메뉴: 보드 접속 키 만들기
function makeBoardKeys() {
  const ss = accessSS_();
  const made = accessFill_(ss);
  try { ss.toast(made ? '접속 키 ' + made + '개를 만들었어요. 「접속 링크」 열을 그 사람에게 보내 주세요.' : '새로 만들 키가 없어요. 이름을 적은 줄에만 키가 생겨요.', '보드 접근'); } catch (e) {}
}
// 허용된 키 → {이름, 줄}. 5분 캐시
function accessKeys_() {
  const c = CacheService.getScriptCache();
  const hit = c.get(ACCESS_CACHE);
  if (hit) return JSON.parse(hit);
  const sh = accessSS_().getSheetByName(ACCESS_SHEET);
  const o = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach((r, i) => {
      const k = String(r[1]).trim();
      if (String(r[0]).trim() && k.length >= 16 && String(r[2]).trim().toUpperCase() === 'O') o[k] = { n: String(r[0]).trim(), row: i + 2 };
    });
  }
  c.put(ACCESS_CACHE, JSON.stringify(o), 300);
  return o;
}
// 키 확인. 맞으면 이름, 아니면 null. 마지막 접속·접속 수는 키마다 30분에 한 번만 적음
function accessCheck_(key) {
  if (!key || key.length < 16) return null;
  const hit = accessKeys_()[key];
  if (!hit) return null;
  const c = CacheService.getScriptCache(), tk = 'acc:t:' + key;
  if (!c.get(tk)) {
    c.put(tk, '1', 1800);
    const lock = LockService.getScriptLock();
    if (lock.tryLock(2000)) {
      try {
        const sh = accessSS_().getSheetByName(ACCESS_SHEET);
        if (sh && String(sh.getRange(hit.row, 2).getValue()).trim() === key) {
          const cnt = Number(sh.getRange(hit.row, 7).getValue()) || 0;
          sh.getRange(hit.row, 6, 1, 2).setValues([[Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), cnt + 1]]);
        }
      } catch (e) {} finally { lock.releaseLock(); }
    }
  }
  return hit.n;
}
const OWN_CHANNELS = ['인스타그램', '유튜브', 'hong._.video'];
const DASH_METRICS = ['조회수', '좋아요', '댓글', '공유', '저장'];

// 읽기 전용. ?callback=__sbData 이면 JSONP, 그 밖의 callback 값이나 없으면 일반 JSON.
// ?key=<접속 키>가 「보드 접근」 탭에 있고 사용 = O일 때만 데이터를 줌. 아니면 {error:'auth'}
// 응답은 기록 때 CacheService에 미리 만들어 둔 것을 쓰고, 없으면 계산해서 캐시(기록 중이면 캐시에 넣지 않음).
function doGet(e) {
  const cb = (e && e.parameter && e.parameter.callback) || '';
  const key = String((e && e.parameter && e.parameter.key) || '').trim();
  let json = null;
  let who = null;
  try { who = accessCheck_(key); } catch (err) { who = null; }
  if (!who) json = JSON.stringify({ error: 'auth', msg: key ? '접속 키가 맞지 않거나 막혔어요' : '접속 키가 필요해요' });
  // 분석 데이터(part): 키가 맞을 때만, part마다 따로 캐시
  const part = String((e && e.parameter && e.parameter.part) || '');
  if (!json && part) {
    if (!PART_TABS[part]) json = JSON.stringify({ error: 'part' });
    else {
      const pre = part === 'yv' ? 'pyv:' + String(e.parameter.v || '').replace(/[^\w-]/g, '').slice(0, 20) : 'part:' + part;
      try { json = cacheGet_(pre); } catch (err) { json = null; }
      if (json && part === 'today' && e.parameter.fresh) { try { if (Date.now() - Number(JSON.parse(json).ts || 0) > 2 * 60 * 1000) json = null; } catch (err) { json = null; } }
      if (!json) {
        try { json = JSON.stringify(buildPart_(part, e)); if (!isRecording_() || part === 'today') { try { cachePut_(json, pre, part === 'today' ? TODAY_TTL : 0); } catch (err) {} } }
        catch (err) { json = JSON.stringify({ error: '분석 데이터를 만들지 못했어요: ' + String(err && err.message || err) }); }
      }
    }
  }
  if (!json) { try { json = cacheGet_(); } catch (err) { json = null; } }
  if (!json) {
    try {
      json = JSON.stringify(buildDashboardData_());
      if (!isRecording_()) { try { cachePut_(json); } catch (err) {} }
    } catch (err) {
      json = JSON.stringify({ error: '데이터를 만들지 못했어요: ' + String(err && err.message || err) });
    }
  }
  if (cb === JSONP_CB || PART_CB.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ───────── 응답 캐시 (CacheService · gzip+base64 조각, Drive 파일 저장 없음) ─────────
function isRecording_() {
  const t = Number(PropertiesService.getScriptProperties().getProperty(PROP_RUNNING) || 0);
  return t > 0 && Date.now() - t < 10 * 60 * 1000; // 10분 넘은 표시는 실패한 실행의 흔적으로 보고 무시
}
function cachePut_(json, pre, ttl) {
  pre = pre || CACHE_PREFIX;
  ttl = ttl || CACHE_TTL;
  const gz = Utilities.gzip(Utilities.newBlob('', 'application/json').setDataFromString(json, 'UTF-8'));
  const b64 = Utilities.base64Encode(gz.getBytes());
  const id = String(Date.now());
  const parts = {};
  let n = 0;
  for (let i = 0; i < b64.length; i += CACHE_CHUNK) parts[pre + ':' + id + ':' + (n++)] = b64.slice(i, i + CACHE_CHUNK);
  const c = CacheService.getScriptCache();
  c.putAll(parts, ttl);
  c.put(pre + ':meta', JSON.stringify({ id: id, n: n, len: b64.length }), ttl); // 조각을 다 넣은 뒤 마지막에
  return { n: n, bytes: b64.length, raw: json.length };
}
function cacheGet_(pre) {
  pre = pre || CACHE_PREFIX;
  const c = CacheService.getScriptCache();
  const meta = JSON.parse(c.get(pre + ':meta') || 'null');
  if (!meta || !meta.n) return null;
  const keys = [];
  for (let i = 0; i < meta.n; i++) keys.push(pre + ':' + meta.id + ':' + i);
  const got = c.getAll(keys);
  let b64 = '';
  for (const k of keys) { if (got[k] == null) return null; b64 += got[k]; } // 조각 하나라도 빠지면 캐시 없음으로
  if (b64.length !== meta.len) return null;
  return Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(b64), 'application/x-gzip')).getDataAsString('UTF-8');
}
function cacheClear_() {
  CacheService.getScriptCache().removeAll([CACHE_PREFIX + ':meta', 'part:yt:meta', 'part:ig:meta']); // 영상 하나(pyv)는 6시간 뒤 저절로 지워짐
}
function dropCache_() { try { cacheClear_(); } catch (e) {} }
function cacheBuild_() {
  return cachePut_(JSON.stringify(buildDashboardData_()));
}
// 메뉴: 사람이 적는 탭(태그 수정·명단·전략 기록·채널 목표 등)을 고친 뒤 대시보드에 바로 반영하고 싶을 때
function clearDashboardCache() {
  dropCache_();
  try { SpreadsheetApp.getActive().toast('대시보드 캐시를 비웠어요. 다음에 대시보드를 열 때 새로 계산해요(15초 안팎).'); } catch (e) {}
}
// 단순 트리거: 사람이 적는 탭을 고치면 캐시를 비움 (실패해도 무시 — 메뉴로 비울 수 있음)
function onEdit(e) {
  try {
    const name = e && e.range && e.range.getSheet().getName();
    if (name === ACCESS_SHEET) { accessFill_(e.source); return; }
    if ([ROSTER_SHEET, ID_SHEET, ADMAP_SHEET, ADPLAN_SHEET, TAGFIX_SHEET, STRAT_SHEET, GOAL_SHEET, META_SHEET, IG_HIST_SHEET, AD_EXTRA_SHEET, GADS_SHEET].indexOf(name) >= 0) dropCache_();
  } catch (err) {}
}

function buildDashboardData_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const v = ss.getSheetByName(SNAP).getDataRange().getValues();
  const n_ = x => (x === '' || x === null || isNaN(Number(x))) ? null : Number(x);
  const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x == null ? '' : x).trim();

  const rows = v.slice(1).filter(r => s_(r[0]) && s_(r[1]));
  const dates = Array.from(new Set(rows.map(r => s_(r[0]).slice(0, 10)))).sort();
  const di = {}; dates.forEach((d, i) => { di[d] = i; });

  const channels = [];
  const items = {};
  const rawKey = {};
  rows.forEach(r => {
    const raw = s_(r[1]);
    const bench = raw.indexOf(BENCH_PREFIX) === 0;
    const ch = bench ? raw.slice(BENCH_PREFIX.length) : raw;
    if (channels.indexOf(ch) < 0) channels.push(ch);
    const key = ch + '§' + s_(r[2]);
    rawKey[key] = raw + '§' + s_(r[2]);
    let it = items[key];
    if (!it) {
      const url = s_(r[C.url]);
      it = items[key] = {
        c: ch, t: s_(r[C.type]) || '미분류', d: s_(r[C.date]).slice(0, 10),
        n: cut_(s_(r[C.title]), 70),
        // 유튜브 URL · 인스타는 퍼머링크 모양일 때만(지금 인스타 원본 「미디어 URL」은 만료되는 CDN 주소라 비움)
        u: /youtube\.com|youtu\.be/.test(url) ? url : (ch === '인스타그램' ? (igPermalink_(url) || igPermalink_(s_(r[2]))) : ''),
        h: dates.map(() => null),
      };
    }
    // 인스타: 예전 기록에는 CDN 주소뿐이라, 나중 기록(인스타 API)에 게시물 주소가 있으면 그것을 씀
    if (!it.u && ch === '인스타그램') it.u = igPermalink_(s_(r[C.url]));
    it.h[di[s_(r[0]).slice(0, 10)]] = [0, 1, 2, 3, 4].map(i => n_(r[M0 + i]));
    it.r = n_(r[C.reach]); it.e = n_(r[C.engaged]); it.a = n_(r[C.avgSec]); it.l = n_(r[C.lengthSec]);
    if (s_(r[C.type])) it.t = s_(r[C.type]);
  });

  const order = OWN_CHANNELS.filter(c => channels.indexOf(c) >= 0)
    .concat(channels.filter(c => OWN_CHANNELS.indexOf(c) < 0).sort());

  const acct = [];
  const accSh = ss.getSheetByName(ACCOUNT);
  if (accSh && accSh.getLastRow() > 1) {
    const a = accSh.getDataRange().getValues();
    const head = a[0].map(String);
    a.slice(1).forEach(r => {
      const d = s_(r[0]).slice(0, 10), ch = s_(r[1]);
      if (!d || !ch) return;
      const m = {}, er = [];
      head.slice(2).forEach((h, j) => {
        const x = n_(r[j + 2]);
        if (x !== null && h) m[h] = x;
        else if (h && String(r[j + 2]).trim() === ACCT_ERR) er.push(h); // 숫자가 아니므로 m에는 넣지 않음
      });
      const row = { d: d, ch: ch, m: m };
      if (er.length) row.e = er; // 수집 오류 지표 이름 (예: 유튜브 Channel total subscribers)
      acct.push(row);
    });
  }

  let hist = null;
  try { hist = loadIgHistory_(ss, items, rawKey, dates); } catch (e) { hist = { error: e.message }; }

  // 게시 후 1·3·7일 조회: it.ag = [[조회, 경과일] | null × 3]
  try { const AG = loadAgeViews_(ss); Object.keys(items).forEach(k => { const g = AG[rawKey[k]]; if (g) items[k].ag = g; }); } catch (e) {}

  const keys = Object.keys(items);
  const list = keys.map(k => items[k]);
  let extra = { roles: {}, ads: null };
  try { extra = attachTags_(ss, list, keys.map(k => rawKey[k])); } catch (e) { extra.tagError = e.message; }

  return {
    updated: dates[dates.length - 1] || '',
    built: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), // 이 응답을 만든 시각(하루 여러 번 기록, 보드가 새 기록인지 봄)
    dates: dates,
    channels: order.map(c => ({ name: c, bench: OWN_CHANNELS.indexOf(c) < 0 })),
    metrics: DASH_METRICS,
    items: list.filter(it => !it._drop && !ytHidden_(it)),
    acct: acct,
    roles: extra.roles,
    ads: extra.ads,
    coverage: COVERAGE,
    hist: hist,
    strat: loadStrat_(ss),
    goals: loadGoals_(ss),
    daily: (function () { try { return loadDailyTotals_(ss); } catch (e) { return []; } })(),
    // 팔로워 일별 [날짜, 계정, 팔로워] — 타 대학 비교의 팔로워당 반응·증가용
    fol: (function () { try { return loadFollowers_(ss); } catch (e) { return []; } })(),
    tagError: extra.tagError || '',
    // 원본 갱신 여부 { 채널: {changed: 직전 기록 대비 값이 바뀐 게시물 수, total: 두 기록 모두 있는 게시물 수, latest: 원본 최신 게시일, prev, d} }
    // 마지막 기록 때 계산해 스크립트 속성에 저장한 값 (응답 때 다시 계산하지 않음)
    fresh: loadFresh_(),
  };
}

// 인스타 퍼머링크(https://www.instagram.com/p|reel|tv/…)만 남김, 아니면 ''
function igPermalink_(s) {
  const t = String(s || '').trim();
  return /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+/.test(t) ? t.split('?')[0] : '';
}

// 글자(코드 포인트) 단위로 자르기 — UTF-16 slice는 이모지 가운데를 끊어 짝 없는 서로게이트를 남김
// 이미 시트에 반쪽으로 저장된 서로게이트도 함께 지움
function cut_(s, n) {
  const t = String(s == null ? '' : s).replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  const a = Array.from(t);
  return a.length > n ? a.slice(0, n).join('') : t;
}


// ═════════════════ 태깅·광고 ═════════════════
/**
 * 태깅·광고 — 콘텐츠 분류 / 제작 주체 / 참여자 / 광고 여부
 * 대시보드(GitHub·아티팩트)와 같은 규칙. 시트에서 고칠 수 있는 탭:
 *  「명단」      이름 → 역할(홍보대사/근로장학생/직원) — 여기 적은 게 코드 기본값보다 우선
 *  「광고 매핑」  구글애즈 캠페인 → 유튜브 영상 ID(쉼표로 여러 개, @제목일부 도 가능) / 확인·추정
 *  「태그 수정」  콘텐츠키(또는 URL) → 분류·제작을 직접 지정 (자동 태그보다 우선)
 * 자동 결과는 「태그」 탭에 저장(매주 스냅샷 때 갱신).
 */
const TAG_SHEET = '태그';
const ROSTER_SHEET = '명단';
// 「아이디 매칭」 탭: 이름 · 인스타 아이디(hong 크레딧 「🎬by. 아이디」) · 담당 시리즈(크레딧 없는 hong 게시물의 캡션 낱말). 실명이라 코드에 넣지 않고 시트에만 둔다
const ID_SHEET = '아이디 매칭';
var HANDLES = {}, SERIES = [];
const ADMAP_SHEET = '광고 매핑';
const ADPLAN_SHEET = '광고 계획';
const TAGFIX_SHEET = '태그 수정';
const ADS_ID = '1KWALIRH1NfizDTtiKa6koega5ECAirOuOCc8pXNU5pE'; // 전주대_구글애즈_캠페인리포트
const COVERAGE = { '유튜브': '2024-01-01', '인스타그램': '2024-12-27', 'hong._.video': '2021-01-01', acct: '지난주(월~일)' };
const ADMAP_SEED = [["2019 전주대학교  CF", "rTFFwv7w5X0", "확인"], ["2020 CF 본편", "d46MRvYKTYM, zQTtrjirNoI, E8XcB6NX-Yg", "추정"], ["2020 CF 본편 건너뛸 수 있는 광고", "d46MRvYKTYM, zQTtrjirNoI, E8XcB6NX-Yg", "추정"], ["하림융합전공 소개_센터장 디스플레이 광고", "atZ_KytBKb0", "추정"], ["동영상광고 2021 C F", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["2021 CF", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["2021 CF_키워드", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["2021 CF_지역", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["입학_2021 CF_지역", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["입학_2021 CF 키워드", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["10월_CF_성장_취업", "EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["10월_CF_창업", "UwbBowD8UwA", "확인"], ["CF 동영상 창업", "UwbBowD8UwA", "추정"], ["20220811_2022 CF 영상 '신입생'편", "XeFvocm3LEM", "확인"], ["20220721 스킵 불가_2022 CF 티저", "XeFvocm3LEM, AuNPHA1_7Bs", "추정"], ["스킵가능_2022 CF 영상 티저", "XeFvocm3LEM, AuNPHA1_7Bs", "추정"], ["전라북도의 중심, 전주대학교", "_o_ORvqXk-w", "확인"], ["기숙사 소개 영상 광고", "Y-VTucYX-C0", "추정"], ["천원의 아침밥 소개", "8tWIqtvGCAU", "확인"], ["학과 동영상 공모전", "@2022 천하제일", "추정"], ["전주대학교 캠퍼스 스토리", "NjYhL4pFfGM", "확인"], ["2023 ESG 동영상 광고", "7n_vNR4Z8QI", "추정"], ["(디스커버리) 2023 유웨이 온터뷰 광고", "fHn9rzClVaI, b125ICdQy4Y", "확인"], ["천원의 아침밥 - 사장님의 마음", "JfC9Ax3ifrY", "확인"], ["선행릴레이 캠페인 영상", "JocZENhjodk", "확인"], ["브랜드 광고 '시설'편", "HP2hSCEWRd0", "추정"], ["(전주대 HP 방문자/18--24) 개교 60주년 30초 광고", "MODUK0zsLiM", "확인"], ["(전주대 HP 방문자_40-50대) 개교 60주년 30초 광고", "MODUK0zsLiM", "확인"], ["(전주대 HP 방문자_전연령) 개교 60주년 15초 광고", "MODUK0zsLiM", "추정"], ["FPV 드론 영상(18-24세/전국)", "d7sEsLmKhvc", "확인"], ["[도서관] FPV 드론 영상(18-24세/전국)", "lcf3SN9ad-A", "확인"], ["[방송광고/인근지역/18-24] '도서관'편", "b1dxndu1rgo", "확인"], ["[방송광고/인근지역/40-60] '도서관'편", "b1dxndu1rgo", "확인"], ["(18-24) 카카오클라우드센터 유치", "gI0zmwS3Dok", "확인"], ["(18-24/전국) 2025 정시모집 TV 광고", "UyS82wPiEJg", "추정"], ["(45-64/전국) 2025 정시모집 TV 광고", "UyS82wPiEJg", "추정"], ["2025 동영상 광고 - 51초", "LyrHjY20PXs", "추정"], ["2025 동영상 광고 - 숏츠", "axUL_0OPwtg", "추정"], ["2025 농촌봉사활동", "goCPo6bqm8o", "확인"], ["2025 국토대장정", "SML_fJsyBTQ", "추정"], ["[20초 Ver] 새로운 별들의 새로운 시작 '전주대학교'", "el1j8k0C_ek, _C0mUel-abs, bdAIJziubkk, YIa0V8JRiUg", "확인"], ["[20초_B Ver] 새로운 별들의 새로운 시작 '전주대학교'", "el1j8k0C_ek, _C0mUel-abs, bdAIJziubkk, YIa0V8JRiUg", "확인"], ["글로컬대학30 응원 & 릴스 영상", "Gzw0jIEYp6U, Dba7HtkPltg", "확인"], ["자유전공학부 팟캐스트 인터뷰", "TEOyPw5SxdM, F6aAIU-pqXE", "확인"]];
// 「광고 매핑」 탭에 없으면 덧붙이는 줄 (2026-10-16 광고 연결 점검)
//  · 2027 수시 동영상·범퍼 캠페인 ↔ 'AI를 넘어 AX' 영상 3개: 캠페인 기간(8/28~)에 올라왔고 조회 39만~90만에 좋아요 1~189라 광고 영상으로 봄. 캠페인별 소재는 구글애즈에서 확인 필요 → 추정
//  · 메타 트래픽 광고 「체험콘텐츠4종」: 수시 마감 브리핑에 '씨름부+밤과내일'로 적힌 두 게시물만 확인, 나머지 2종은 미확인
const ADMAP_ADD = [
  ['2027-수시모집-동영상 광고', 'pEYNhKpZXug, kRX6YAzXnW8, VbT4hrrlFxg', '추정'],
  ['2027-수시모집-동영상 광고-18~24세', 'pEYNhKpZXug, kRX6YAzXnW8, VbT4hrrlFxg', '추정'],
  ['2027-수시모집-범퍼 광고', 'pEYNhKpZXug, kRX6YAzXnW8, VbT4hrrlFxg', '추정'],
  ['2027-수시모집-트래픽 광고-체험콘텐츠4종', '@씨름부 VS 체험왕, @각자의 밤', '확인'],
  // 메타 캠페인 이름이 게시물 캡션이 아니라 자동 연결이 안 되는 2024년 캠페인
  ['카카오클라우드 유치 광고 캠페인', '@전북 카카오클라우드 디지털혁신센터 유치', '추정'],
  ['공연예술학과 홍보 영상 홍보 캠페인', '@공연예술학과 홍보 영상', '추정']
];
function addAdMapRows_(sh) {
  const have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(r => { have[String(r[0]).trim()] = 1; });
  const add = ADMAP_ADD.filter(r => !have[r[0]]);
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 3).setValues(add);
}

/* 콘텐츠 분류 태깅 규칙 (서버에서만 계산 — src/app.js에는 이 규칙이 없고 응답의 g를 그대로 씀)
 * 위에서부터 처음 맞는 분류. 2026-10-16 개선:
 *  · 일반 낱말이 섞이는 키워드에 경계 추가 — 수시로(자주)·정시에·개발자·유치원·스트리트·컨트리·알려드립니다(공지 투)
 *  · '댓글로'는 참여 유도(댓글로 참여·응모·신청…)일 때만 이벤트, '모집 중'은 신입생·편입생 등 입시 대상일 때만 입시
 *  · 브랜드 영상의 고유 문구(새로운 별들·AI를 넘어 등)는 입시·모집보다 먼저 확인
 *  · '알려드립니다'는 안내·일정·기간·신청·공지·마감이 함께 있으면 정보·꿀팁으로 보지 않음
 *  2026-10-16 (태깅 점검 반영):
 *  · 이벤트·참여는 첫머리(60자)에 이벤트·당첨자 발표가 있거나 본문에 참여 방법·응모가 있을 때만 — 경기·행사 안내 속 경품 한 줄로는 이벤트가 되지 않음
 *  · 유튜브는 제목 + 설명란 첫머리(링크·크레딧 전)로 분류 — ytHead_()
 *  · '숏폼·예능' → '예능·챌린지'로 이름을 바꾸고, hong·60초 이하 자동 배정은 없앰(형식은 t 필드가 따로 나타냄)
 *  · 유튜브 「기타」에 많던 낱말 보강: ○○대학 소개·편의 시설·기숙사·학식·연수·간담회·JUNI:ON·패션왕 등 */
var TAG_CATEGORIES = [
  ['이벤트·참여', function (t) {
    return /이벤트|𝗘𝗩𝗘𝗡𝗧|𝐄𝐕𝐄𝐍𝐓|EVENT|당첨자\s?(발표|안내)|경품|추첨/i.test(t.slice(0, 60)) ||
      /참여\s?(방법|대상)|응모\s?(방법|기간)|댓글로\s*(참여|응모|신청|도전|남겨\s*주시면|달아\s*주시면)|댓글\s*이벤트|달꾸|기프티콘을?\s?(선물|드립|증정)/.test(t);
  }],
  ['홍보대사 모집', /홍보대사\s?(모집|선발)/],
  ['브랜드 영상', /새로운 별들|AI를 넘어|AX 시대|빛나는 순간|가장 나다운|나다운 라이프|같이 만드는 가치|진심을 다합니다/],
  ['입시·모집', /수시(?!로)|정시(?![에간])|입시|원서|모집요강|신입생 모집|모집기간|모집 기간|예비\s?신입생|입학정보|입학 상담|편입|추가\s?모집|대입\s?전형|입학처|(신입생|편입생|수시|정시|학생)\s?모집\s?중|대학입학/],
  ['학생 이야기', /패션왕을 찾아라/], // 단과대 이름이 붙는 시리즈라 학과·전공보다 먼저
  ['동문 소식', null], // 동문 이름(ALUMNI · 「명단」 탭 역할 '동문') 또는 '동문'·'졸업생 근황' 등 — alumniRe_()
  ['행사·축제', /^(?![\s\S]*(축구부|운동부))[\s\S]*(전북현대|K\s?리그|프로\s?(축구|야구|농구|배구)|직관(?!적))/i], // 외부 구단 방문·직관 (우리 운동부 언급이 없을 때)
  ['체육부 소식', /축구부|U-?\s?리그|U-?LEAGUE|유리그|대학축구|연맹전|왕중왕전|씨름|레슬링|싸울아비|태권도\s?(시범단|대회)|시범단|전국체육대회|전국체전|운동부|체육부|선수단|경기 결과/i],
  ['학사·생활 안내', /수강\s?신청|등록 (기간|일정|안내)|재학생 등록|장학|국가장학금|생활관|기숙사 (신청|입사)|셔틀|직통 버스|버스 운행|천원의 아침밥|아침밥|학사|휴학|복학 신청|전과|만족도 조사|도서관 이용|안내📢|안내 📢|이용 (방법|안내)|운영 안내|신청 안내/],
  ['성과·뉴스', /선정|우승|수상|최우수|S등급|최고 등급|금메달|협약|유치(?!원)|개발(?![자팀])|1위|1등|최초|획득|성과|기록 경신|글로컬|체결|개소|출범식|📰/],
  ['행사·축제', /체육대회|JJ체전|체전|전북현대|직관(?!적)|특강|강연|포럼|세미나|컨퍼런스|전시|축제|대동제|중동제|스케치|𝗦𝗞𝗘𝗧𝗖𝗛|SKETCH|학위수여식|입학식|졸업식|기념식|JUMF|페스티벌|공연|패션쇼|FASHION SHOW|선서식|팝업|박람회|부스|토크 콘서트|Major Fair|MAJOR FAIR|메이저 ?페어|가맥|낙화|(?<![스컨])트리(?!트)|오리엔테이션|적응력|학생성공주간|간담회|축하연|워크숍|발대식|해단식|문학기행|제이제이 랜드|JJ ?LAND|롤드컵|e-?sports|이스포츠|전우전|학위\s?수여|멘토링|환영\s?인사|라이브\s?중계|콘서트|영화제|취임|시무/i],
  ['시설·공간', /도서관|(?<!(📍|장소)\s*)스타(센터|타워)|해치\s?라운지|글로벌\s?라운지|편의\s?시설|시설\s?(소개|안내|투어|이용|모음)|기숙사|[1-4]인실|보존\s?서고|루디아\s?홀|학습\s?공간|진리관|신축|개관|리모델링|열람실|좋은 공간|공간\s?(소개|추천)|카페 투어|공부하기 좋은|휴식 장소|장소 추천|랜선 투어|캠퍼스 투어|둘러보기/],
  ['학과·전공', /[가-힣]+(학과|학부)|과잠|전공|오늘의 강의|복담화|단과대|[가-힣]{2,6}대학(을|를)?\s?소개|교수님|약학|간호|출품작|학과별/],
  ['정보·꿀팁', /꿀팁|팁(?!스)|알려\s?(줄게|줄께|줌|주는|주고|줍니다|드릴게|드릴께|드릴|드려요)|^(?![\s\S]*(안내|일정|기간|신청|공지|마감))[\s\S]*알려\s?드립니다|방법|가이드|용어|미리 알|재테크|해결|백과|요리|퇴치|공부법|Q&A|FAQ|홍알홍알|용돈|취업을 원해|Dream ?JOB/i],
  ['학생 이야기', /인터뷰|브이로그|vlog|후기|탐방|봉사|국토대장정|해외|자기소개|What'?s in my|하루|공강|MBTI|데이트|고백|새내기|대학생활|갓생|방학|룸투어|어디서,?\s?(어떻게\s)?살|여름 기록|방학 기록|일상|선배|동아리|은하수|UCDC|연수|한\s?달 살기|교환학생|파란사다리|학식|썰|RC\s?공동체|서포터즈|JUNI:?ON|주니온|체험기|체험하기|취미|필수 활동|자주 가는|신입생에게|재학생에게|궁금하다면|이야기,? 들어|온 이유|강철부대|합격한/i],
  ['캠퍼스·계절', /벚꽃|겹벚꽃|유채|철쭉|단풍|가을|봄꽃|눈 내린|눈사람|겨울|캠퍼스|핫스팟|일출|명소|피크닉|전망대|드론|FPV|포토 ?스팟|스타정원|야간 개장|해 질|Sunset|노을|새벽|과거와 현재|인생샷|호수|새하얗게/i],
  ['시즌 인사', /새해|크리스마스|𝐂𝐡𝐫𝐢𝐬𝐭𝐦𝐚𝐬|𝐂𝐡𝐢𝐫𝐬𝐭𝐦𝐚𝐬|Merry Christmas|성탄|어버이날|스승의 (날|은혜)|스승(님)?에게|한글날|현충일|기림의 날|년은 어땠|광복절|추석|설날|애도|추모|수능|응원합니다|파이팅|화이팅|종강|개강|중간고사|기말고사|시험 ?기간|시험 (공부|끝)/],
  ['예능·챌린지', /POV|𝗣𝗢𝗩|VS|챌린지|밈|유형|체험왕|스피드 ?게임|소개팅|마음의 소리|드래곤|ㅋㅋ|레전드|몇 초|맞혀|퀴즈|노래|커버|댄스|Dance|𝘿𝙖𝙣𝙘𝙚|ASMR|비밀|토템|연애|토론회|들어주마|갸루|다섯 글자|초\s?안에|웃으면|눈 마주치면|오싹|공포|복학생|\d{2}학번|TOP\s?\d|게임|버티기|challenge|이상형|하우머치|알고리즘|솔까말|솔직히 까놓고|한심좌|환심좌|패러디|방위대|EYES/i],
  ['브랜드 영상', /60년|세상의 중심|슬로건|캠페인|선행\s?릴레이|\bCF\b|홍보\s?동영상|수퍼스타를 키우는|함께 한다는 것|^Jeonju University\s*$/], // 고유 문구는 맨 위(입시·모집 앞)에서 먼저 확인
];

// 캡션에서 제작 크레딧 앞부분만 분류에 사용
function categoryText(caption) {
  var c = String(caption || '');
  var cut = c.search(/\n\s*(🎬|📸|🎥|▪️?\s*제작|제작\s*[:|▪])|Created by|🎬\s*by/);
  if (cut > 0) c = c.slice(0, cut);
  return c.slice(0, 220);
}

// 유튜브 설명란 첫머리: 구독 안내·링크·구분선·크레딧·해시태그 앞까지 (설명란 대부분이 인스타 캡션과 같은 본문으로 시작함)
function ytHead_(desc) {
  var d = String(desc || '');
  // 첫 문단 구분('.'·'-' 두 줄) 뒤에는 입시 일정·운영 안내가 덧붙는 경우가 많아 첫 문단만 씀
  var cut = d.search(/\n\s*[.\-]\s*\n\s*[.\-]\s*\n|👇|👉|https?:\/\/|입학처 (홈페이지|누리집)|【온라인 상담|【𝐍𝐄𝐖𝐒】|─|━|🎬|📸|🎥|▪️?\s*제작|제작\s*[:|▪]|Created by|\n\s*#|\s#전주대학교/);
  if (cut >= 0) d = d.slice(0, cut);
  return d.slice(0, 200);
}

// 분류가 안 되면 '기타' (예전에는 hong 전부와 60초 이하 유튜브를 숏폼으로 넣었으나 형식과 주제가 섞여 없앰)
function tagCategory(text, channel, opts) {
  var t = String(text || '');
  for (var i = 0; i < TAG_CATEGORIES.length; i++) {
    var re = TAG_CATEGORIES[i][1] || alumniRe_();
    if (typeof re === 'function' ? re(t) : re.test(t)) return TAG_CATEGORIES[i][0];
  }
  return '기타';
}

// 동문(졸업생) — 「명단」 탭에 역할 '동문'으로 추가하면 여기에 더해짐
var ALUMNI = ['김영권', '구자철'];
function alumniRe_() {
  var names = ALUMNI.filter(function (n) { return /^[가-힣A-Za-z]{2,10}$/.test(n); });
  return new RegExp((names.length ? names.join('|') + '|' : '') + '동문의 밤|동문인의 밤|동문회|총동문|당선\\s?동문|동문\\s?축하연|동문 (소식|근황|선배)|졸업생\\s?(소식|근황|활약|인터뷰)');
}
// 체육부 소식 → 세부(종목)
function sportSub(text) {
  var t = String(text || '');
  if (/씨름/.test(t)) return '씨름부';
  if (/레슬링|류한수|류인탁/i.test(t)) return '레슬링부';
  if (/싸울아비|태권도|시범단/.test(t)) return '태권도 시범단';
  if (/축구|U-?\s?리그|U-?LEAGUE|유리그|연맹전|왕중왕전/i.test(t)) return '축구부';
  return '기타 운동부';
}
// 예전 분류 '스포츠'(2026-10-15 폐지) → 새 분류
function legacySport_(text) {
  var g = tagCategory(categoryText(text), '');
  if (g === '체육부 소식' || g === '동문 소식' || g === '행사·축제' || g === '학과·전공' || g === '성과·뉴스') return g;
  return /축구|태권도|씨름|레슬링/.test(String(text || '')) ? '체육부 소식' : '행사·축제';
}

// ───────── 제작 주체 · 참여자 ─────────
// 이름 명단은 「태그 설정」에서 고칠 수 있게 할 예정 — 여기 있는 건 기본값
var AMBASSADORS = [
  // 2026
  '***','***','***','***','***','***','***','***','***','***','***','***','***','***',
  // 2025 이전
  '***','***','***','***','***','***','***','***','***','***','***','***','***','***','***',
  '***','***','***','***','***','***','***','***','***','***','***','***','***','***','***',
  '***','***','***','***','***','***'
];
// 부서 근로장학생 — 홍보대사가 아닌 이름은 기본적으로 근로장학생으로 봄
var WORKSTUDY = ['***','***','***','***','***','***','***','***'];
// 홍보실 직원 — 이름이 있어도 자체 제작
var STAFF = ['***'];
// 「명단」 역할 '서포터즈'(대학혁신지원사업 JUNI:ON 등 학과·기관 학생 기자단) → 제작 주체 학과·기관 협업
// 「명단」 역할 '출연'(크레딧에 이름이 있지만 제작자가 아닌 동아리원·출연자) → 참여자·제작 판단에서 뺌
var PARTNER = [], EXCLUDE = [];
var NAME_STOP = /(학과|학부|대학|대학교|교수|센터|사업단|위원회|학생회|홍보실|홍보대사|서포터즈|콘텐츠|숏폼|유튜브|인스타|기획|제작|촬영|편집|출연|시나리오|재학생|박물관|지원실|입학처|입학|협조|제공|그림|디자인|사진|영상|음악|내레이션|나레이션|썸네일|자막|모델|도움|주니온|홈페이지|전주대|자세히|애플워치|졸업생|베이스|글로벌|호텔리어|서비스|이벤트|당첨자|안내|일정|장소|기간|문의|블로그|페이스북|트위터|카카오톡)$/;

function creditBlock(caption) {
  var c = String(caption || '');
  var i = c.search(/(^|\n)[^\p{L}\p{N}\n]*(제작|촬영|편집|기획|Created by)\s*($|\n|[:|▪]|&| 및|·|by)/u);
  if (i < 0) return '';
  var b = c.slice(i, i + 420);
  var j = b.search(/\n\s*-\s*\n|\n\s*#|\n\s*\n\s*[^▪🔸\s]/u);
  if (j > 0) b = b.slice(0, j);
  return b;
}
// 크레딧 블록에서 이름 추출 → [{n, amb}] (amb: 그 줄이나 머리줄에 '홍보대사'가 있음)
function creditNames(caption) {
  var b = creditBlock(caption);
  if (!b) return [];
  var lines = b.split('\n');
  var headAmb = /홍보대사/.test(lines[0]);
  var out = [], seen = {}, skip = false;
  for (var k = 0; k < lines.length; k++) {
    var line = lines[k];
    if (/출연|교수님/.test(line)) { skip = /출연/.test(line); continue; }
    if (skip && /^\s*🔸/u.test(line)) continue;
    skip = false;
    if (/대외협력홍보실/.test(line)) continue;
    var amb = headAmb || /홍보대사/.test(line);
    var toks = line.replace(/\([^)]*\)/g, ' ').split(/[\s,&·|:▪️🔸@\/]+/u);
    for (var t = 0; t < toks.length; t++) {
      var n = toks[t];
      if (seen[n] || STAFF.indexOf(n) >= 0 || EXCLUDE.indexOf(n) >= 0) continue;
      if (!inRoster_(n) && !nameLike_(n)) continue; // 명단 이름(2~4자) 또는 이름 모양(성+2자)만
      seen[n] = 1; out.push({ n: n, amb: amb });
    }
  }
  return out;
}
function inRoster_(n) { return AMBASSADORS.indexOf(n) >= 0 || WORKSTUDY.indexOf(n) >= 0 || PARTNER.indexOf(n) >= 0; }
// 명단에 없는 크레딧 토큰이 사람 이름처럼 보이는가: 한글 3자 · 흔한 성으로 시작 · 불용어·조사·기관 접미어가 아님
// (2자·4자는 '안내'·'신청'·'홍보대사'처럼 이름이 아닌 말이 많아 명단에 있을 때만 인정)
var NAME_SURNAMES = '김이박최정강조윤장임한오서신권황안송류유전홍고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변금';
var NAME_STOP2 = /(을|를|에서|으로|에게|까지|부터|처럼|도록|니다|해요|하는|하고|했던|있는|없는|들의|들이|생|팀|단|님|회|실|청|처|관|시|군|가)$|^(오류가|정확한|금요일|금메달|이야기|이번에|이번주|이용권|정보원|전주시|한국어|한국인|홍보팀|홍보부|기획단|기자단|운영진|지원단|관계자|선생님|작업물|안녕하|감사합|최고의|최신판|김치전|조회수|장학금|장학생|전공자|전체적|오리엔|유튜버|성공적|차세대|주인공|구독자|진로탐|나만의|우리의|함께한)$/;
function nameLike_(n) {
  return /^[가-힣]{3}$/.test(n) && NAME_SURNAMES.indexOf(n.charAt(0)) >= 0 && !NAME_STOP.test(n) && !NAME_STOP2.test(n);
}
// 역할은 「명단」(없으면 코드 기본 명단) 기준. 명단에 없는 이름은 '미확인'
function roleOf(name, ambCtx) {
  if (/^@/.test(name)) return '홍보대사'; // hong 크레딧 아이디 중 「아이디 매칭」에 이름이 없는 것
  if (WORKSTUDY.indexOf(name) >= 0) return '근로장학생';
  if (PARTNER.indexOf(name) >= 0) return '서포터즈';
  if (AMBASSADORS.indexOf(name) >= 0) return '홍보대사';
  return '미확인';
}

// channel: 인스타그램 | 유튜브 | hong._.video | (타 대학 계정명)
// m: { views, likes } — 유튜브 광고 추정에 사용
// 반환: { p: 제작 주체, w: [참여자 이름], roles: {이름: 역할} }
function tagProducer(channel, caption, m) {
  var c = String(caption || '');
  var res = { p: '자체 제작', w: [], roles: {} };
  if (channel === 'hong._.video') {
    // 홍보대사 운영 계정: 크레딧(「🎬 by …」)과 상관없이 모두 홍보대사 제작
    res.p = '홍보대사';
    // 참여자: 「🎬by. 아이디」 → 「아이디 매칭」 이름(없으면 @아이디). 크레딧이 없으면 「담당 시리즈」 낱말이 캡션에 있는 사람
    var mm = /\bby\.?\s*:?\s*((?:@?[A-Za-z0-9._]{2,30}(?:\s*[,&\/·]\s*|\s+(?=@)))*@?[A-Za-z0-9._]{2,30})/i.exec(c);
    var ids = mm ? mm[1].split(/[\s,&\/·]+/).map(function (x) { return x.replace(/^@/, '').replace(/\.+$/, ''); }).filter(function (x) { return x.length >= 2; }) : [];
    ids.forEach(function (id) { var nm = HANDLES[id.toLowerCase()] || '@' + id; if (res.w.indexOf(nm) < 0) { res.w.push(nm); res.roles[nm] = roleOf(nm); } });
    if (!res.w.length) SERIES.forEach(function (x) { if (x[0] && c.indexOf(x[0]) >= 0 && res.w.indexOf(x[1]) < 0) { res.w.push(x[1]); res.roles[x[1]] = roleOf(x[1]); } });
    return res;
  }
  if (channel !== '인스타그램' && channel !== '유튜브') { res.p = '타 대학'; return res; }
  var credit = creditBlock(c);
  var names = creditNames(c);
  var hasAmb = /홍보대사/.test(credit), hasWork = false, hasPartner = /서포터즈|JUNI:?ON|주니온/i.test(credit); // 크레딧에 서포터즈가 적혀 있으면 명단 없이도 협업
  names.forEach(function (x) {
    var r = roleOf(x.n, x.amb);
    res.w.push(x.n); res.roles[x.n] = r;
    if (r === '홍보대사') hasAmb = true; else if (r === '서포터즈') hasPartner = true; else hasWork = true; // '미확인'(명단에 없는 이름)도 예전처럼 근로장학생 제작으로 봄
  });
  if (hasAmb) res.p = '홍보대사';
  else if (hasWork && !(hasPartner && names.every(function (x) { return roleOf(x.n) !== '근로장학생'; }))) res.p = '근로장학생'; // 서포터즈와 미확인만 있으면 협업으로
  else if (hasPartner) res.p = '학과·기관 협업';
  else if (/Created by|by\s*@/.test(credit)) res.p = '학생 크리에이터';
  else if (/(협조|제공|서포터즈|총학생회|주니온|JUNI:?ON|사업단|위원회)/i.test(credit) && !/대외협력홍보실/.test(credit)) res.p = '학과·기관 협업';
  return res;
}

// 광고 조회 패턴 (광고 리포트에 없는 기간의 보조 판단): 조회 10만 이상인데 1만 조회당 좋아요 3개 미만
function isAdPattern(m) { return !!(m && m.views >= 100000 && (m.likes || 0) / m.views * 1e4 < 3); }


// ───────── 시트 연동 ─────────
function ensureTagSheets_(ss) {
  let sh = ss.getSheetByName(ROSTER_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ROSTER_SHEET);
    const rows = [['이름', '역할', '메모']]
      .concat(AMBASSADORS.map(n => [n, '홍보대사', '']))
      .concat(WORKSTUDY.map(n => [n, '근로장학생', '']))
      .concat(STAFF.map(n => [n, '직원', '이름이 있어도 자체 제작']));
    sh.getRange(1, 1, rows.length, 3).setValues(rows);
    sh.setFrozenRows(1); sh.getRange('A1:C1').setFontWeight('bold');
    sh.getRange(rows.length + 2, 1).setValue('※ 홍보대사·근로장학생 명단. 역할을 바꾸거나 이름을 추가하면 다음 태그 계산부터 반영돼요. 역할: 홍보대사 · 근로장학생 · 직원 · 동문 · 서포터즈(학과·기관 협업으로 집계) · 출연(제작자가 아님, 참여자에서 뺌). 명단에 없는 크레딧 이름은 역할 「미확인」으로 표시하고, 제작 주체는 근로장학생으로 봐요.');
  }
  sh = ss.getSheetByName(ID_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ID_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([['이름', '인스타 아이디', '담당 시리즈']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 2).setNote('캡션 크레딧에 이름 대신 적히는 인스타 아이디(예: 🎬by. jarchiveo). @ 없이, 여러 개면 쉼표로.');
    sh.getRange(1, 3).setNote('크레딧이 없는 hong 게시물을 이 사람 것으로 볼 캡션 낱말(예: 복학생). 여러 개면 쉼표로.');
  }
  // 첫 채움: 탭이 비어 있고 Apps Script 프로젝트에 idSeed_(실명이라 git 밖 IdSeed.gs)가 있으면 그 줄을 넣는다
  if (sh.getLastRow() < 2 && typeof idSeed_ === 'function') { const seed = idSeed_(); if (seed && seed.length) sh.getRange(2, 1, seed.length, 3).setNumberFormat('@').setValues(seed); }
  sh = ss.getSheetByName(ADMAP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ADMAP_SHEET);
    const rows = [['캠페인 이름(구글애즈)', '유튜브 영상 ID (쉼표로 여러 개, @제목일부)', '연결 확실도(확인/추정)']].concat(ADMAP_SEED);
    sh.getRange(1, 1, rows.length, 3).setValues(rows);
    sh.setFrozenRows(1); sh.getRange('A1:C1').setFontWeight('bold');
  }
  sh = ss.getSheetByName(ADPLAN_SHEET);
  if (!sh) {
    sh = ss.insertSheet(ADPLAN_SHEET);
    sh.getRange(1, 1, 1, 7).setValues([['캠페인 이름(일부)', '시작일', '종료일', '예산(원)', '목표', '대상 영상 ID', '메모']]);
    sh.setFrozenRows(1); sh.getRange('A1:G1').setFontWeight('bold');
    sh.getRange(3, 1).setValue('※ 앞으로 집행할 광고를 한 줄씩 적어요. 캠페인 이름은 구글애즈 캠페인 이름의 일부만 적어도 되고, 그 이름이 들어간 캠페인 실적을 합산해 대시보드 「광고」 탭에 예산 소진율·기간 경과로 보여줘요. (이 안내 줄은 지워도 돼요)');
  }
  sh = ss.getSheetByName(TAGFIX_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TAGFIX_SHEET);
    sh.getRange(1, 1, 1, 4).setValues([['콘텐츠키 또는 URL', '분류', '제작', '메모']]);
    sh.setFrozenRows(1); sh.getRange('A1:D1').setFontWeight('bold');
  }
  sh = ss.getSheetByName(TAG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TAG_SHEET);
    sh.getRange(1, 1, 1, 7).setValues([['채널', '콘텐츠키', '분류', '제작', '참여자', '계산일', 'URL']]);
    sh.setFrozenRows(1);
  }
}

// 「명단」 → 코드 기본 명단 덮어쓰기
function loadRoster_(ss) {
  const sh = ss.getSheetByName(ROSTER_SHEET);
  if (!sh || sh.getLastRow() < 2) return;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const amb = [], ws = [], st = [], pt = [], ex = [];
  v.forEach(r => {
    const n = String(r[0]).trim(), role = String(r[1]).trim();
    if (!/^[가-힣]{2,4}$/.test(n)) return;
    if (role === '홍보대사') amb.push(n); else if (role === '근로장학생') ws.push(n); else if (role === '직원') st.push(n);
    else if (role === '동문' && ALUMNI.indexOf(n) < 0) ALUMNI.push(n);
    else if (role === '서포터즈' || role === '협업') pt.push(n);
    else if (role === '출연' || role === '제외') ex.push(n);
  });
  if (amb.length || ws.length) { AMBASSADORS = amb; WORKSTUDY = ws; STAFF = st; }
  PARTNER = pt; EXCLUDE = ex;
  // 아이디 매칭
  HANDLES = {}; SERIES = [];
  const ih = ss.getSheetByName(ID_SHEET);
  if (ih && ih.getLastRow() > 1) ih.getRange(2, 1, ih.getLastRow() - 1, 3).getValues().forEach(r => {
    const nm = String(r[0]).trim(); if (!/^[가-힣]{2,4}$/.test(nm)) return;
    if (!inRoster_(nm)) AMBASSADORS.push(nm); // 명단에 없으면 hong 제작자 = 홍보대사로 본다
    String(r[1] || '').split(/[,\s]+/).map(x => x.replace(/^@/, '').trim().toLowerCase()).filter(Boolean).forEach(id => { HANDLES[id] = nm; });
    String(r[2] || '').split(',').map(x => x.trim()).filter(Boolean).forEach(k => SERIES.push([k, nm]));
  });
}

// 원본 item(전체 캡션 포함) → 태그
function tagItem_(channel, it) {
  const ch = channel.indexOf(BENCH_PREFIX) === 0 ? channel.slice(BENCH_PREFIX.length) : channel;
  const cap = it.full || it.title || '';
  const g = tagCategory(ch === '유튜브' ? cap + '\n' + ytHead_(it.desc) : categoryText(cap), ch, { lengthSec: it.lengthSec });
  const pr = tagProducer(ch, cap + '\n' + (it.desc || ''), { views: it.views, likes: it.likes });
  return { g: g, p: pr.p, w: pr.w, roles: pr.roles };
}

// 스냅샷에서 읽은 원본 → 「태그」 탭 갱신 (기존 키는 유지, 이번에 읽은 키는 덮어씀)
function saveTags_(ss, bySrc, today) {
  ensureTagSheets_(ss);
  loadRoster_(ss);
  const sh = ss.getSheetByName(TAG_SHEET);
  const map = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().forEach(r => { map[r[0] + '§' + r[1]] = r; });
  bySrc.forEach(byCh => Object.keys(byCh).forEach(ch => Object.keys(byCh[ch]).forEach(k => {
    const it = byCh[ch][k];
    const t = tagItem_(ch, it);
    map[ch + '§' + k] = [ch, k, t.g, t.p, t.w.join(', '), today, it.url || ''];
  })));
  const rows = Object.keys(map).map(k => map[k]);
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 7).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 7).setValues(rows);
}

// 메뉴: 지금 원본을 읽어 태그만 다시 계산 (스냅샷은 기록하지 않음)
function recalcTags() {
  return withLock_('태그 다시 계산', () => {
    const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
    const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const bySrc = [];
    SOURCES.forEach(src => { try { bySrc.push(readSource_(src, today)); } catch (e) { Logger.log(src.channel + ' 오류: ' + e.message); } });
    saveTags_(ss, bySrc, today);
    dropCache_();
  });
}

// 대시보드용: 태그 맵 · 역할 · 수정값
function loadTagData_(ss) {
  loadRoster_(ss);
  const tags = {}, roles = {};
  const sh = ss.getSheetByName(TAG_SHEET);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().forEach(r => {
    // 예전 규칙으로 저장된 참여자 중 이름이 아닌 말(「영상을」「있도록」 등)은 여기서 뺌
    const w = String(r[4] || '').split(',').map(x => x.trim()).filter(n => n && STAFF.indexOf(n) < 0 && EXCLUDE.indexOf(n) < 0 && (inRoster_(n) || nameLike_(n) || /^@[A-Za-z0-9._]+$/.test(n)));
    tags[r[0] + '§' + r[1]] = { g: String(r[2] || ''), p: String(r[3] || ''), w: w, u: String(r[6] || '') };
    w.forEach(n => { roles[n] = roleOf(n); });
  });
  // 역할은 명단 기준만: 홍보대사 / 근로장학생 / 미확인(명단에 없는 이름 — 「명단」 탭에 추가하면 다음 응답부터 반영)
  const fix = {};
  const fs = ss.getSheetByName(TAGFIX_SHEET);
  if (fs && fs.getLastRow() > 1) fs.getRange(2, 1, fs.getLastRow() - 1, 3).getValues().forEach(r => {
    const k = String(r[0]).trim(); if (!k) return;
    fix[k] = { g: String(r[1] || '').trim(), p: String(r[2] || '').trim() };
  });
  return { tags: tags, roles: roles, fix: fix };
}

// 구글애즈 리포트 + 「광고 매핑」
// ───────── 광고 원본 ─────────
// 구글애즈 일별 리포트는 두 곳에서 읽어 합친다(같은 날짜·캠페인은 스냅샷 시트 탭이 우선):
//  ① ADS_ID 시트(개인 계정, 2026-07-17에 한 번 내보낸 정적 파일 — 2026-01-30까지)
//  ② 스냅샷 시트 「구글애즈 리포트」 탭 — 구글애즈 → 보고서 → 일별 캠페인 보고서를 내보내 그대로 붙여 넣는 곳
// 일별 리포트가 없는 기간은 「광고 추가 입력」 탭의 캠페인 합계(브리핑·결과 보고 수치)로 채운다.
const GADS_SHEET = '구글애즈 리포트';
const AD_EXTRA_SHEET = '광고 추가 입력';
const AD_EXTRA_HEAD = ['매체(구글/메타)', '캠페인 이름', '시작일', '종료일', '노출', '클릭', '비용(원)', '지출(USD)', '도달', '결과(전환·랜딩 조회)', '출처·메모'];
// 2027 수시 광고(2026-08-01~09-11) — 02_광고/2026-08 수시 광고/ad_report.html(9/11 18시 마감 브리핑) 캠페인별 합계
const AD_EXTRA_SEED = [
  ['구글', '2027-수시모집-디스플레이 광고', '2026-08-01', '2026-09-11', 8300744, 42810, 10336935, '', '', 952.76, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['구글', '2027-수시모집-동영상 광고-18~24세', '2026-08-01', '2026-09-11', 1223476, 3051, 5663291, '', '', 81, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['구글', '2027-수시모집-동영상 광고', '2026-08-01', '2026-09-11', 1035412, 1664, 4348301, '', '', 11, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['구글', '2027-수시모집-디스플레이 광고-18~24세', '2026-08-01', '2026-09-11', 2861725, 23749, 3714378, '', '', 261.24, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['구글', '2027-수시모집-범퍼 광고', '2026-08-01', '2026-09-11', 904771, 888, 1452745, '', '', 3, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['구글', '2027-수시모집-체험콘텐츠 인피드-18~24세', '2026-08-01', '2026-09-11', 639758, 201, 786062, '', '', 9, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['구글', '2027-수시모집-검색 광고', '2026-08-01', '2026-09-11', 23, 5, 20461, '', '', 6, '수시 마감 브리핑(9/11) 캠페인 합계'],
  ['메타', '2027-수시모집-트래픽 광고-체험콘텐츠4종', '2026-08-01', '2026-09-11', '', '', '', 1627.91, 264517, 12594, '수시 마감 브리핑(9/11) · 결과=랜딩 페이지 조회'],
  ['메타', '2027-수시모집-트래픽 광고-고등학생', '2026-08-01', '2026-09-11', '', '', '', 1737.76, 184285, 2409, '수시 마감 브리핑(9/11) · 결과=랜딩 페이지 조회'],
  ['메타', '2027-수시모집-트래픽 광고-AI콘텐츠', '2026-09-11', '2026-09-11', '', '', '', 9.98, 6384, 133, '수시 마감 브리핑(9/11) · 9/11 신규 게시']
];
function ensureAdSheets_(ss) {
  if (!ss.getSheetByName(AD_EXTRA_SHEET)) {
    const sh = ss.insertSheet(AD_EXTRA_SHEET);
    sh.getRange(1, 1, 1, AD_EXTRA_HEAD.length).setValues([AD_EXTRA_HEAD]).setFontWeight('bold');
    sh.getRange(2, 1, AD_EXTRA_SEED.length, AD_EXTRA_HEAD.length).setValues(AD_EXTRA_SEED);
    sh.getRange(AD_EXTRA_SEED.length + 3, 1).setValue('※ 일별 리포트(「' + GADS_SHEET + '」 탭·「' + META_SHEET + '」 탭)가 없는 광고를 캠페인 합계로 적는 곳. 같은 캠페인이 일별 리포트에 들어오면 이 줄은 자동으로 빠져요. 구글 금액은 원, 메타는 USD.');
    sh.setFrozenRows(1);
  }
  if (!ss.getSheetByName(GADS_SHEET)) {
    const sh = ss.insertSheet(GADS_SHEET);
    sh.getRange(1, 1).setValue('※ 구글애즈 → 보고서 → 「캠페인」 보고서(열: 일·캠페인·노출수·클릭수·비용, 기간: 2026-02-01 ~ 어제)를 내보내 A1부터 그대로 붙여 넣으세요. 영어(Day·Campaign·Impr.·Clicks·Cost)도 돼요. 이 안내 줄은 지워도 돼요.');
  }
  if (!ss.getSheetByName(GVID_SHEET)) {
    const sh = ss.insertSheet(GVID_SHEET);
    sh.getRange(1, 1).setValue('※ 구글애즈 → 보고서 → 「동영상」 보고서(열: 캠페인·동영상 URL 또는 동영상 ID·동영상·비용·노출수·조회수, 기간: 전체)를 내보내 A1부터 그대로 붙여 넣으세요. 여기 있는 영상은 광고 집행 영상으로 「확인」 표시돼요. 이 안내 줄은 지워도 돼요.');
  }
  if (!ss.getSheetByName(META_AD_SHEET)) {
    const sh = ss.insertSheet(META_AD_SHEET);
    sh.getRange(1, 1).setValue('※ 메타 광고 관리자 → 「광고」 탭 → 내보내기(열: 캠페인 이름·광고 이름·본문·인스타그램 게시물 링크·시작·종료·지출 금액·노출·도달, 기간: 전체)를 A1부터 그대로 붙여 넣으세요. 게시물 링크나 본문(캡션)으로 인스타 게시물에 광고 표시를 붙여요. 이 안내 줄은 지워도 돼요.');
  }
}
// ───────── 광고 소재 ↔ 콘텐츠 연결 (ID·링크·본문이 있는 광고 보고서) ─────────
// 캠페인 보고서에는 영상·게시물 정보가 없어서 「광고 매핑」(사람이 적음)·캡션 앞부분·조회 패턴으로 짐작했는데,
// 구글 「동영상」 보고서와 메타 「광고」 단위 보고서를 붙여 두면 소재를 직접 맞춘다(이 연결이 가장 우선).
const GVID_SHEET = '구글애즈 동영상';
const META_AD_SHEET = '메타 광고(광고별)';
function adHead_(v, need) {
  for (let r = 0; r < Math.min(v.length, 8); r++) {
    const head = v[r].map(h => String(h).trim());
    if (head.some(h => need.test(h))) return { r: r, head: head };
  }
  return null;
}
function loadAdLinks_(ss) {
  const out = { g: [], m: [] };
  const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x == null ? '' : x).trim();
  const find = (head, re) => head.findIndex(h => re.test(h));
  const ytId = x => { const m = /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(x); return m ? m[1] : (/^[\w-]{11}$/.test(x) ? x : ''); };
  try {
    const sh = ss.getSheetByName(GVID_SHEET);
    const v = sh && sh.getLastRow() > 1 ? sh.getDataRange().getValues() : [];
    const h = v.length ? adHead_(v, /^(캠페인|Campaign)$/i) : null;
    if (h) {
      const cc = find(h.head, /^(캠페인|Campaign)$/i);
      const ic = find(h.head, /(동영상|Video|YouTube).*(ID|URL)|^URL$/i);
      const tc = find(h.head, /^(동영상|Video|동영상 제목|Video title)$/i);
      v.slice(h.r + 1).forEach(r => {
        const c = s_(r[cc]); if (!c || /^(합계|Total)/i.test(c)) return;
        let id = ic >= 0 ? ytId(s_(r[ic])) : '';
        if (!id) { const u = r.map(s_).find(x => /youtu/.test(x)); id = u ? ytId(u) : ''; }
        const title = tc >= 0 ? s_(r[tc]) : '';
        if (id || title) out.g.push({ c: c, id: id, title: title });
      });
    }
  } catch (e) {}
  try {
    const sh = ss.getSheetByName(META_AD_SHEET);
    const v = sh && sh.getLastRow() > 1 ? sh.getDataRange().getValues() : [];
    const h = v.length ? adHead_(v, /^(캠페인 이름|Campaign name)$/i) : null;
    if (h) {
      const cc = find(h.head, /^(캠페인 이름|Campaign name)$/i), ac = find(h.head, /^(광고 이름|Ad name)$/i);
      const bc = find(h.head, /본문|Body|광고 문구|Primary text/i), lc = find(h.head, /(게시물|post).*(링크|link|URL)|퍼머링크|permalink/i);
      const ec = find(h.head, /^(종료|보고 종료|Ends|Reporting ends)$/i);
      v.slice(h.r + 1).forEach(r => {
        const c = s_(r[cc]); if (!c) return;
        const link = lc >= 0 ? s_(r[lc]) : (r.map(s_).filter(x => /instagram\.com\//.test(x))[0] || '');
        out.m.push({ c: c, ad: ac >= 0 ? s_(r[ac]) : '', body: bc >= 0 ? s_(r[bc]) : '', link: link, end: ec >= 0 ? s_(r[ec]).slice(0, 10) : '' });
      });
    }
  } catch (e) {}
  // API로 받은 「메타 소재」(캠페인 ID·이름·광고 ID·광고 이름·본문·게시물 링크) — 종료일은 「메타 일별」의 캠페인 마지막 날
  try {
    const sh = ss.getSheetByName(META_CR_SHEET);
    if (sh && sh.getLastRow() > 1) {
      const last = {};
      const ds = ss.getSheetByName(META_DAILY_SHEET);
      if (ds && ds.getLastRow() > 1) ds.getRange(2, 1, ds.getLastRow() - 1, 2).getValues().forEach(r => {
        const d = fmtDate_(r[0]), id = String(r[1]); if (!last[id] || d > last[id]) last[id] = d;
      });
      sh.getRange(2, 1, sh.getLastRow() - 1, META_CR_HEAD.length).getValues().forEach(r => {
        const c = s_(r[1]); if (!c || !last[String(r[0])]) return; // 한 번도 노출되지 않은 캠페인의 광고는 빼고
        out.m.push({ c: c, ad: s_(r[3]), body: s_(r[4]), link: s_(r[5]), end: last[String(r[0])] || '' });
      });
    }
  } catch (e) {}
  return out;
}
// 머리글 행을 찾아(안내 줄·보고서 제목 줄 건너뜀) 일·캠페인·노출·비용·클릭 열 위치를 돌려준다
function gadsCols_(v) {
  const pick = (head, names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  for (let r = 0; r < Math.min(v.length, 6); r++) {
    const head = v[r].map(h => String(h).trim());
    const c = { d: pick(head, ['Day', '일', '날짜']), c: pick(head, ['Campaign', '캠페인']), i: pick(head, ['Impr.', 'Impressions', '노출수']), co: pick(head, ['Cost', '비용']), k: pick(head, ['Clicks', '클릭수']) };
    if (c.d >= 0 && c.c >= 0) return Object.assign(c, { r: r });
  }
  return null;
}
function loadAds_(ss) {
  const out = { end: '', daily: [], camps: [], rows: [], plans: [], v2c: {}, src: [] };
  const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x).trim();
  const n_ = x => Number(String(x).replace(/[,₩\s]/g, '')) || 0;
  // 일별 행 모으기: key 날짜§캠페인 → [날짜, 캠페인, 노출, 비용, 클릭] (뒤에 읽은 원본이 덮어씀)
  const day = {};
  const take = (v, label) => {
    const c = v && v.length ? gadsCols_(v) : null;
    if (!c) return 0;
    let n = 0;
    v.slice(c.r + 1).forEach(r => {
      const d = s_(r[c.d]).slice(0, 10), cn = String(r[c.c]).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !cn || /^(합계|Total)/i.test(cn)) return;
      day[d + '§' + cn] = [d, cn, c.i >= 0 ? n_(r[c.i]) : 0, c.co >= 0 ? n_(r[c.co]) : 0, c.k >= 0 ? n_(r[c.k]) : 0]; n++;
    });
    out.src.push(label + ' ' + n + '행');
    return n;
  };
  try { take(SpreadsheetApp.openById(ADS_ID).getSheets()[0].getDataRange().getValues(), '구글애즈 리포트 시트'); } catch (e) { out.error = '구글애즈 리포트 시트: ' + e.message; }
  try { ensureAdSheets_(ss); const gs = ss.getSheetByName(GADS_SHEET); if (gs && gs.getLastRow() > 1) take(gs.getDataRange().getValues(), '「' + GADS_SHEET + '」 탭'); } catch (e) { out.error = (out.error ? out.error + ' / ' : '') + GADS_SHEET + ': ' + e.message; }
  const camps = {}, daily = {}, cd = {};
  Object.keys(day).forEach(k => {
    const [d, c, imp, cost, clk] = day[k];
    const o = camps[c] = camps[c] || { n: c, from: d, to: d, imp: 0, cost: 0, clk: 0, videos: [], conf: '' };
    if (d < o.from) o.from = d; if (d > o.to) o.to = d;
    o.imp += imp; o.cost += cost; o.clk += clk;
    const x = daily[d] = daily[d] || [0, 0]; x[0] += cost; x[1] += imp;
    const y = cd[c + '§' + d] = cd[c + '§' + d] || [c, d, 0, 0, 0]; y[2] += cost; y[3] += imp; y[4] += clk;
    if (d > out.end) out.end = d;
  });
  // 「광고 추가 입력」의 구글 캠페인 합계 — 같은 캠페인이 일별 리포트에 그 기간 데이터로 있으면 건너뜀
  loadAdExtra_(ss).filter(x => x.pf === '구글').forEach(x => {
    const o = camps[x.n];
    if (o && o.to >= x.from && o.from <= x.to) return;
    camps[x.n] = { n: x.n, from: x.from, to: x.to, imp: x.imp || 0, cost: x.cost || 0, clk: x.clk || 0, videos: [], conf: '', manual: x.memo || '합계 입력' };
    // 일별 값이 없으니 월별 그래프에는 종료일에 합계를 둔다(화면에 '종료월 기준' 표시)
    const y = cd[x.n + '§' + x.to] = cd[x.n + '§' + x.to] || [x.n, x.to, 0, 0, 0]; y[2] += x.cost || 0; y[3] += x.imp || 0; y[4] += x.clk || 0;
    const z = daily[x.to] = daily[x.to] || [0, 0]; z[0] += x.cost || 0; z[1] += x.imp || 0;
    if (x.to > out.end) out.end = x.to;
    out.manualEnd = out.manualEnd && out.manualEnd > x.to ? out.manualEnd : x.to;
  });
  const ms = ss.getSheetByName(ADMAP_SHEET);
  if (ms) try { addAdMapRows_(ms); } catch (e) {}
  const map = ms && ms.getLastRow() > 1 ? ms.getRange(2, 1, ms.getLastRow() - 1, 3).getValues() : ADMAP_SEED.concat(ADMAP_ADD);
  out.map = map.map(r => [String(r[0]).trim(), String(r[1] || '').trim(), String(r[2] || '').trim()]).filter(r => r[0] && r[0].charAt(0) !== '※');
  map.forEach(r => {
    const c = String(r[0]).trim(); if (!c || !camps[c]) return;
    camps[c].videos = String(r[1] || '').split(',').map(x => x.trim()).filter(Boolean);
    camps[c].conf = String(r[2] || '추정').trim() || '추정';
  });
  out.daily = Object.keys(daily).sort().map(d => [d, Math.round(daily[d][0]), Math.round(daily[d][1])]);
  out.camps = Object.keys(camps).map(k => camps[k]).sort((a, b) => a.from < b.from ? -1 : 1)
    .map(c => Object.assign({ n: c.n, from: c.from, to: c.to, imp: Math.round(c.imp), cost: Math.round(c.cost), clk: Math.round(c.clk), videos: c.videos, conf: c.conf }, c.manual ? { manual: c.manual } : {}));
  const ci = {}; out.camps.forEach((c, i) => { ci[c.n] = i; });
  out.rows = Object.keys(cd).map(k => cd[k]).filter(y => y[2] || y[3] || y[4])
    .map(y => [ci[y[0]], y[1], Math.round(y[2]), Math.round(y[3]), Math.round(y[4])])
    .sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] - b[0]);
  const ps = ss.getSheetByName(ADPLAN_SHEET);
  if (ps && ps.getLastRow() > 1) ps.getRange(2, 1, ps.getLastRow() - 1, 7).getValues().forEach(r => {
    const n = String(r[0]).trim();
    if (!n || n.charAt(0) === '※') return;
    out.plans.push({ n: n, from: s_(r[1]).slice(0, 10), to: s_(r[2]).slice(0, 10), budget: n_(r[3]) || null, goal: String(r[4] || '').trim(),
      videos: String(r[5] || '').split(',').map(x => x.trim()).filter(Boolean), memo: String(r[6] || '').trim() });
  });
  return out;
}

// 대시보드 items에 태그·광고 붙이기 (items: buildDashboardData_의 결과, keys: 같은 순서의 원본 키)
function attachTags_(ss, items, keys) {
  const T = loadTagData_(ss);
  const A = loadAds_(ss);
  const vid = u => { const m = /(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : ''; };
  // 영상 → 캠페인
  const v2c = {};
  A.camps.forEach(c => c.videos.forEach(x => {
    let ids = [];
    if (x.charAt(0) === '@') ids = items.filter(it => it.c === '유튜브' && it.n.indexOf(x.slice(1)) >= 0).map(it => vid(it.u));
    else ids = [x];
    ids.forEach(id => { if (id) (v2c[id] = v2c[id] || []).push(c); });
  }));
  A.camps.forEach(c => { c.videos = c.videos.filter(x => x.charAt(0) !== '@'); });
  items.forEach((it, i) => {
    const t = T.tags[keys[i]] || {};
    const f = T.fix[keys[i].split('§')[1]] || (it.u && T.fix[it.u]) || (t.u && T.fix[t.u]) || {};
    // 「태그 수정」 분류에 「제외」(비공개·테스트 업로드 등) → 대시보드 데이터에서 뺌(기록은 시트에 그대로)
    if (f.g === '제외') { it._drop = 1; return; }
    // 반영 순서: 「태그 수정」 > 「태그」 탭 자동값 > it.g·it.p(「인스타_과거기록」 탭 값) > 기본값
    it.g = f.g || t.g || it.g || '기타';
    if (it.g === '숏폼·예능') it.g = '예능·챌린지'; // 예전 이름(2026-10-16 변경) — 「태그 다시 계산」 전 값·「태그 수정」·과거 기록 탭
    it.p = f.p || t.p || it.p || (OWN_CHANNELS.indexOf(it.c) >= 0 ? '자체 제작' : '타 대학');
    // 「태그 수정」에 '체육부 소식/축구부'처럼 적으면 세부 분류까지 지정
    let sub = '';
    if (it.g.indexOf('/') > 0) { sub = it.g.split('/')[1].trim(); it.g = it.g.split('/')[0].trim(); }
    if (it.g === '스포츠') it.g = legacySport_(it.n);
    if (it.g === '체육부 소식') it.s = sub || sportSub(it.n);
    if (t.w && t.w.length) it.w = t.w;
    if (it.c === '유튜브') {
      const cs = v2c[vid(it.u)];
      if (cs) it.ad = { s: cs.some(c => c.conf === '확인') ? '확인' : '추정', k: cs.map(c => c.n) };
    }
  });
  // 「광고 매핑」의 메타 캠페인(구글애즈 리포트에 없는 캠페인 이름) → 인스타그램 게시물
  //  대상 칸: 인스타 URL·숏코드(쉼표로 여러 개) 또는 @캡션 일부. 메타 「Instagram 게시물: …」 캠페인은 대시보드가 캡션 앞부분으로 자동 연결하므로
  //  여기에는 자동 연결이 안 되는 캠페인(트래픽 광고 등)만 적으면 돼요
  const gNames = {}; A.camps.forEach(c => { gNames[c.n] = 1; });
  const igCode = u => { const m = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/.exec(u || ''); return m ? m[1] : ''; };
  (A.map || []).forEach(([c, target, conf]) => {
    if (gNames[c] || !target) return;
    target.split(',').map(x => x.trim()).filter(Boolean).forEach(x => {
      const code = x.charAt(0) === '@' ? '' : (igCode(x) || (/^[\w-]{6,20}$/.test(x) ? x : ''));
      items.filter(it => it.c === '인스타그램' && (code ? igCode(it.u) === code : x.charAt(0) === '@' && String(it.n || '').indexOf(x.slice(1)) >= 0)).forEach(it => {
        it.ad = it.ad || { s: conf === '확인' ? '확인' : '추정', k: [] };
        if (conf === '확인') it.ad.s = '확인';
        it.ad.mk = it.ad.mk || [];
        if (it.ad.mk.indexOf(c) < 0) it.ad.mk.push(c);
      });
    });
  });
  // 유튜브 전체 기간(「유튜브_전체기간」 탭, Supermetrics 2012~어제) → it.L = [조회, 좋아요, 댓글, 공유]
  try {
    const ls = ss.getSheetByName('유튜브_전체기간');
    if (ls && ls.getLastRow() > 1) {
      const lv = ls.getDataRange().getValues(), lh = lv[0].map(h => String(h).trim());
      const iu = lh.indexOf('Video URL'), iv = lh.indexOf('Video views'), il = lh.indexOf('Likes'), ic = lh.indexOf('Comments'), ish = lh.indexOf('Shares');
      const L = {};
      if (iu >= 0 && iv >= 0) lv.slice(1).forEach(r => { const id = vid(String(r[iu])); if (id) L[id] = [Number(r[iv]) || 0, il >= 0 ? Number(r[il]) || 0 : null, ic >= 0 ? Number(r[ic]) || 0 : null, ish >= 0 ? Number(r[ish]) || 0 : null]; });
      items.forEach(it => { if (it.c === '유튜브') { const x = L[vid(it.u)]; if (x) it.L = x; } });
    }
  } catch (e) {}
  // 소재 보고서(「구글애즈 동영상」·「메타 광고(광고별)」)로 직접 연결 — 가장 확실하므로 추정·패턴보다 우선해 「확인」으로 올림
  try {
    const L = loadAdLinks_(ss);
    const nz = x => String(x || '').replace(/(\.\.\.|…)\s*$/, '').replace(/[\s⠀.]+/g, '');
    const tn = x => String(x || '').replace(/\s+/g, ' ').trim();
    const camp = {}; A.camps.forEach(c => { camp[c.n] = c; });
    const mark = (it, c, meta) => {
      it.ad = it.ad || { s: '확인', k: [] };
      if (it.ad.s !== '확인') { it.ad.s = '확인'; if (!meta) it.ad.k = []; } // 추정·패턴 연결은 확인된 소재로 대체
      if (meta) { it.ad.mk = it.ad.mk || []; if (it.ad.mk.indexOf(c) < 0) it.ad.mk.push(c); }
      else if (it.ad.k.indexOf(c) < 0) it.ad.k.push(c);
    };
    const yts = items.filter(it => it.c === '유튜브');
    L.g.forEach(x => {
      const hits = x.id ? yts.filter(it => vid(it.u) === x.id) : yts.filter(it => tn(it.n) === tn(x.title));
      hits.forEach(it => {
        mark(it, x.c, false);
        const c = camp[x.c], id = vid(it.u);
        if (c && id && c.videos.indexOf(id) < 0) { c.videos.push(id); c.conf = '확인'; }
      });
    });
    const igs = items.filter(it => it.c === '인스타그램').map(it => [it, nz(it.n)]);
    L.m.forEach(x => {
      const code = igCode(x.link);
      let hits = code ? igs.filter(([it]) => igCode(it.u) === code).map(p => p[0]) : [];
      if (!hits.length) {
        // 본문(캡션) 또는 광고 이름(「Instagram 게시물: 캡션…」) 앞 30자로 맞춤
        const t = x.body || String(x.ad).replace(/^(Instagram (게시물|post)|게시물):\s*"?/i, '');
        const key = nz(t).slice(0, 30);
        if (key.length >= 8) {
          hits = igs.filter(([it, n]) => n.length >= 8 && (!x.end || it.d <= x.end) && n.startsWith(key.slice(0, Math.min(key.length, n.length)))).map(p => p[0]);
          if (hits.length > 1) hits = [hits.sort((a, b) => a.d < b.d ? 1 : -1)[0]]; // 같은 문구로 시작하는 시리즈면 종료일 직전 게시물
        }
      }
      hits.forEach(it => mark(it, x.c, true));
    });
  } catch (e) {}
  // 캠페인 연결이 없는 유튜브 영상도 조회 패턴(조회 10만 이상·1만 조회당 좋아요 3개 미만)이면 광고 추정 — 기간과 관계없이
  // (예전에는 광고 리포트 이후 영상만 봤으나, 리포트 안에도 영상 연결이 없는 캠페인이 많아 전 기간으로 넓힘)
  items.forEach(it => {
    if (it.c !== '유튜브' || it.ad) return;
    const v = it.L || it.h.filter(Boolean).pop() || [];
    if (isAdPattern({ views: v[0], likes: v[1] })) it.ad = { s: '패턴', k: [] };
  });
  return { roles: T.roles, ads: { end: A.end, daily: A.daily, camps: A.camps, rows: A.rows, plans: A.plans, meta: loadMeta_(ss), fx: Number(PropertiesService.getScriptProperties().getProperty('META_KRW_PER_USD')) || 0, error: A.error || '', src: A.src || [], manualEnd: A.manualEnd || '' } };
}

// ───────── 인스타그램 과거 기록 (엑셀로 기록하던 시기) ─────────
// 「인스타_과거기록」 탭: Supermetrics로 다시 받을 수 없는 2024-12-26 이전 인스타그램 게시물 (사람이 정리해 넣는 탭)
// 기록일 없이 한 번 적은 값이라 h는 비우고 P = [조회, 좋아요, 댓글, 공유, 저장] 에 둔다. x = 1 은 과거 기록 표시
// 스냅샷에 같은 콘텐츠키가 있으면 스냅샷(Supermetrics) 값을 쓴다
const IG_HIST_SHEET = '인스타_과거기록';
function loadIgHistory_(ss, items, rawKey, dates) {
  const sh = ss.getSheetByName(IG_HIST_SHEET);
  if (!sh || sh.getLastRow() < 2) return null;
  const v = sh.getDataRange().getValues();
  const head = v[0].map(h => String(h).trim());
  const col = n => head.indexOf(n);
  const ix = { key: col('콘텐츠키'), date: col('게시일'), title: col('제목/캡션'), url: col('URL'), type: col('유형'), reach: col('리치'),
    g: col('분류'), p: col('제작'), imp: col('노출'), ad: col('광고'), m: ['조회수', '좋아요', '댓글', '공유', '저장'].map(col) };
  if (ix.key < 0 || ix.date < 0) throw new Error(IG_HIST_SHEET + ' 탭에 콘텐츠키·게시일 열이 없어요');
  const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x == null ? '' : x).trim();
  const n_ = x => (x === '' || x === null || isNaN(Number(x))) ? null : Number(x);
  const at = (r, i) => i >= 0 ? r[i] : '';
  let n = 0, skip = 0, from = '', to = '';
  v.slice(1).forEach(r => {
    const k = s_(at(r, ix.key)), d = s_(at(r, ix.date)).slice(0, 10);
    if (!k || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    const key = '인스타그램§' + k;
    if (items[key]) { skip++; return; }
    const url = s_(at(r, ix.url));
    items[key] = {
      c: '인스타그램', t: s_(at(r, ix.type)) || '미분류', d: d, n: cut_(s_(at(r, ix.title)), 70),
      u: /instagram\.com\/(p|reel)\//.test(url) ? url : '',
      h: dates.map(() => null), P: ix.m.map(i => n_(at(r, i))),
      r: n_(at(r, ix.reach)), im: n_(at(r, ix.imp)), x: 1,
      g: s_(at(r, ix.g)), p: s_(at(r, ix.p)),
    };
    // 「광고」 열에 값이 있으면(과거 엑셀에 '광고 집행'으로 적힌 게시물) 광고 표시 — 평소 대비·히트율 기준에서 빠짐
    if (s_(at(r, ix.ad))) items[key].ad = { s: '확인', k: [], x: '과거 기록: ' + s_(at(r, ix.ad)) };
    rawKey[key] = key;
    n++; if (!from || d < from) from = d; if (d > to) to = d;
  });
  return { '인스타그램': { n: n, from: from, to: to, skip: skip } };
}

// ───────── 과거 기록 가져오기 ─────────
// 「_hist_채널_yyyy-MM-dd」 탭(과거 Supermetrics 원본 그대로)을 같은 규칙으로 읽어 스냅샷 맨 위에 넣고, 탭은 지움
// 「_meta_ads」 탭은 「메타 광고」 탭으로 바꿔 둠
function importHistory() {
  return withLock_('과거 기록 가져오기', () => { importHistory_(); dropCache_(); });
}
function importHistory_() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const snap = ss.getSheetByName(SNAP);
  const tabs = ss.getSheets().filter(s => /^_hist_/.test(s.getName()))
    .sort((a, b) => a.getName() < b.getName() ? -1 : 1);
  const have = {};
  if (snap.getLastRow() > 1) snap.getRange(2, 1, snap.getLastRow() - 1, 2).getDisplayValues().forEach(r => { have[r[0] + '§' + r[1]] = 1; });
  const rows = [], logs = [], bySrc = [];
  tabs.forEach(sh => {
    const m = sh.getName().match(/^_hist_(.+)_(\d{4}-\d{2}-\d{2})$/);
    if (!m) return;
    const ch = m[1], date = m[2];
    const base = SOURCES.filter(s => s.channel === ch)[0];
    if (!base) { logs.push([new Date(), '과거·' + ch + ' ' + date, 0, '오류: 알 수 없는 채널']); return; }
    if (have[date + '§' + ch]) { logs.push([new Date(), '과거·' + ch + ' ' + date, 0, '이미 있어서 건너뜀']); return; }
    try {
      const byCh = readSource_(Object.assign({}, base, { id: ss.getId(), sheet: sh.getName() }), date);
      let n = 0;
      Object.keys(byCh).forEach(c => Object.keys(byCh[c]).forEach(k => {
        const it = byCh[c][k];
        rows.push([date, c, k, it.date, it.title, it.url]
          .concat(METRICS.map(x => it[x]))
          .concat([it.type, it.reach, it.engaged, it.avgSec, it.lengthSec]));
        n++;
      }));
      // 0건이면 열 이름이 안 맞는 등 읽기 실패로 보고 경고만 남김 — 탭은 지우지 않음(아래 삭제는 '정상'·'건너뜀'만)
      if (!n) { logs.push([new Date(), '과거·' + ch + ' ' + date, 0, '경고: 읽은 콘텐츠 0건 — 열 이름을 확인해 주세요(탭은 그대로 둠)']); return; }
      bySrc.push(byCh);
      logs.push([new Date(), '과거·' + ch + ' ' + date, n, '정상']);
    } catch (e) {
      logs.push([new Date(), '과거·' + ch + ' ' + date, 0, '오류: ' + e.message]);
    }
  });
  if (rows.length) {
    rows.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
    snap.insertRowsBefore(2, rows.length);
    snap.getRange(2, 1, rows.length, SNAP_HEADER.length).setValues(rows);
    snap.getRange(rows.length + 2, 1, 1, SNAP_HEADER.length)
      .copyFormatToRange(snap, 1, SNAP_HEADER.length, 2, rows.length + 1);
    try { saveTagsMissing_(ss, bySrc); logs.push([new Date(), '과거·태그', bySrc.length, '정상']); }
    catch (e) { logs.push([new Date(), '과거·태그', 0, '오류: ' + e.message]); }
  }
  logs.filter(l => /정상|건너뜀/.test(l[3])).forEach(l => {
    const sh = ss.getSheetByName('_hist_' + l[1].replace('과거·', '').replace(' ', '_'));
    if (sh) ss.deleteSheet(sh);
  });
  const mt = ss.getSheetByName('_meta_ads');
  if (mt) {
    const old = ss.getSheetByName(META_SHEET);
    if (old) ss.deleteSheet(old);
    mt.setName(META_SHEET);
    logs.push([new Date(), '메타 광고', Math.max(mt.getLastRow() - 1, 0), '정상']);
  }
  if (logs.length) {
    const log = ss.getSheetByName(LOG);
    log.getRange(log.getLastRow() + 1, 1, logs.length, 4).setValues(logs);
  }
}

// 「태그」 탭에 없는 콘텐츠만 태그 추가 (기존 태그는 그대로)
function saveTagsMissing_(ss, bySrc) {
  ensureTagSheets_(ss);
  loadRoster_(ss);
  const sh = ss.getSheetByName(TAG_SHEET);
  const have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { have[r[0] + '§' + r[1]] = 1; });
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const add = [];
  bySrc.forEach(byCh => Object.keys(byCh).forEach(ch => Object.keys(byCh[ch]).forEach(k => {
    if (have[ch + '§' + k]) return;
    have[ch + '§' + k] = 1;
    const it = byCh[ch][k];
    const t = tagItem_(ch, it);
    add.push([ch, k, t.g, t.p, t.w.join(', '), today, it.url || '']);
  })));
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 7).setValues(add);
}

// ───────── 메타(인스타·페북) 광고: 「메타 광고」 탭 (광고 관리자 캠페인 보고서 내보내기) ─────────
const META_SHEET = '메타 광고';
// 「광고 추가 입력」 탭 읽기(매체·캠페인·기간·노출·클릭·비용(원)·지출(USD)·도달·결과·메모)
function loadAdExtra_(ss) {
  try {
    ensureAdSheets_(ss);
    const sh = ss.getSheetByName(AD_EXTRA_SHEET);
    if (!sh || sh.getLastRow() < 2) return [];
    const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x == null ? '' : x).trim();
    const n_ = x => { const n = Number(String(x).replace(/[,₩$\s]/g, '')); return x === '' || x === null || isNaN(n) ? null : n; };
    return sh.getRange(2, 1, sh.getLastRow() - 1, AD_EXTRA_HEAD.length).getValues().map(r => {
      const pf = /메타|meta|인스타|페이스북/i.test(s_(r[0])) ? '메타' : /구글|google|유튜브/i.test(s_(r[0])) ? '구글' : '';
      return { pf: pf, n: s_(r[1]), from: s_(r[2]).slice(0, 10), to: s_(r[3]).slice(0, 10), imp: n_(r[4]), clk: n_(r[5]), cost: n_(r[6]), spend: n_(r[7]), reach: n_(r[8]), res: n_(r[9]), memo: s_(r[10]) };
    }).filter(x => x.pf && x.n && /^\d{4}-\d{2}-\d{2}$/.test(x.to) && x.n.charAt(0) !== '※');
  } catch (e) { return []; }
}
function loadMeta_(ss) {
  // 메타 탭은 내보내기 전체를 통째로 바꿔 붙이는 방식(같은 이름의 서로 다른 캠페인이 있어 중복 제거는 하지 않음)
  // API로 받은 캠페인(「메타 일별」)이 있으면 그것을 쓰고, 수동 탭에서는 같은 이름·겹치는 기간의 캠페인을 뺌(API 이전 과거분만 남음)
  let api = [];
  try { api = loadMetaApi_(ss); } catch (e) {}
  const out = loadMetaTab_(ss).filter(c => !api.some(a => a.n === c.n && (!c.end || a.from <= c.end) && (!c.from || a.end >= c.from))).concat(api);
  // 「광고 추가 입력」의 메타 캠페인 합계 — 같은 이름의 캠페인이 그 기간에 메타 탭에 있으면 건너뜀
  loadAdExtra_(ss).filter(x => x.pf === '메타').forEach(x => {
    if (out.some(c => c.n === x.n && (!c.end || c.end >= x.from))) return;
    out.push({ n: x.n, st: 'completed', res: x.res, rt: 'landing_page_view', reach: x.reach, budget: null, spend: x.spend, cur: 'USD', end: x.to, from: x.from, imp: x.imp, clk: x.clk, lpv: x.res, manual: x.memo || '합계 입력' });
  });
  return out;
}
function loadMetaTab_(ss) {
  const sh = ss.getSheetByName(META_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  const head = v[0].map(h => String(h).trim());
  const ix = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const col = {
    n: ix(['캠페인 이름']), st: ix(['캠페인 게재']), res: ix(['결과']), rt: ix(['결과 표시 도구']),
    reach: ix(['도달']), budget: ix(['광고 세트 예산']), spend: ix(['지출 금액 (USD)', '지출 금액 (KRW)', '지출 금액']),
    end: ix(['종료']), imp: ix(['노출']), clk: ix(['링크 클릭']), lpv: ix(['랜딩 페이지 조회']), from: ix(['시작'])
  };
  const cur = /KRW/.test(head[col.spend] || '') ? 'KRW' : 'USD';
  const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x == null ? '' : x).trim();
  const n_ = x => { const n = Number(String(x).replace(/,/g, '')); return x === '' || x === null || isNaN(n) ? null : n; };
  return v.slice(1).filter(r => s_(r[col.n])).map(r => {
    const g = k => col[k] >= 0 ? r[col[k]] : '';
    return { n: s_(g('n')), st: s_(g('st')), res: n_(g('res')), rt: s_(g('rt')).replace('actions:', ''), reach: n_(g('reach')),
      budget: n_(g('budget')), spend: n_(g('spend')), cur: cur, end: s_(g('end')).slice(0, 10), from: s_(g('from')).slice(0, 10),
      imp: n_(g('imp')), clk: n_(g('clk')), lpv: n_(g('lpv')) };
  });
}

// ───────── 전략 기록 · 채널 목표 (대시보드 「전략」 탭에서 읽음) ─────────
const STRAT_SHEET = '전략 기록', GOAL_SHEET = '채널 목표';
function ensureStratSheets_(ss) {
  if (!ss.getSheetByName(STRAT_SHEET)) {
    const sh = ss.insertSheet(STRAT_SHEET);
    sh.getRange(1, 1, 1, 8).setValues([['시작일', '종료일', '채널(인스타/유튜브/hong, 비우면 전체)', '분류(일부만 적어도 됨)', '형식(릴스/캐러셀/쇼츠 등)', '제목 키워드', '시도 내용', '메모']]);
    sh.setFrozenRows(1); sh.getRange('A1:H1').setFontWeight('bold');
    sh.getRange(3, 1).setValue('※ 한 줄에 시도 하나. 대시보드 「전략」 탭이 조건에 맞는 게시물을 모아 평소 대비 성과로 자동 채점해요. (이 안내 줄은 지워도 돼요)');
  }
  if (!ss.getSheetByName(GOAL_SHEET)) {
    const sh = ss.insertSheet(GOAL_SHEET);
    sh.getRange(1, 1, 1, 5).setValues([['월(YYYY-MM, 비우면 매월)', '채널(인스타/유튜브/hong)', '지표(게시 수/조회수/히트율/평균 조회/팔로워 순증)', '목표값', '메모']]);
    sh.setFrozenRows(1); sh.getRange('A1:E1').setFontWeight('bold');
    sh.getRange(3, 1).setValue('※ 예) (비움) · 인스타 · 게시 수 · 12  /  (비움) · 유튜브 · 히트율 · 25  — 히트율은 % 숫자로 적어요. (이 안내 줄은 지워도 돼요)');
  }
}
function loadStrat_(ss) {
  try {
    ensureStratSheets_(ss);
    const sh = ss.getSheetByName(STRAT_SHEET);
    if (sh.getLastRow() < 2) return [];
    const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x == null ? '' : x).trim();
    return sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues()
      .filter(r => /^\d{4}-\d{2}-\d{2}/.test(s_(r[0])) && s_(r[6]))
      .map(r => ({ from: s_(r[0]).slice(0, 10), to: s_(r[1]).slice(0, 10), ch: s_(r[2]), g: s_(r[3]), t: s_(r[4]), kw: s_(r[5]), what: s_(r[6]), memo: s_(r[7]) }));
  } catch (e) { return []; }
}
function loadGoals_(ss) {
  try {
    ensureStratSheets_(ss);
    const sh = ss.getSheetByName(GOAL_SHEET);
    if (sh.getLastRow() < 2) return [];
    const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM') : String(x == null ? '' : x).trim();
    return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues()
      .filter(r => s_(r[1]) && s_(r[2]) && r[3] !== '' && !isNaN(Number(String(r[3]).replace(/[,%]/g, ''))))
      .map(r => ({ ym: s_(r[0]).slice(0, 7), ch: s_(r[1]), metric: s_(r[2]), target: Number(String(r[3]).replace(/[,%]/g, '')), memo: s_(r[4]) }));
  } catch (e) { return []; }
}

// ───────── 메타 광고 API: 매일 기록 때 광고 관리자 데이터를 직접 받음 (02_광고/2026-10-17_광고데이터_자동화_설계안.md 3장) ─────────
// 스크립트 속성(프로젝트 설정 → 스크립트 속성)에만 둠 — 코드·저장소·로그에 값을 쓰지 않음
//  · META_TOKEN   : 비즈니스 설정 → 시스템 사용자 토큰(ads_read 권한만, 만료 없음)
//  · META_ACCOUNT : 광고 계정 ID(숫자만 또는 act_숫자)
// 쓰는 탭(스크립트가 채움, 손으로 고치지 않음)
//  · 「메타 일별」  : 날짜 × 캠페인 지출·노출·링크 클릭·랜딩 페이지 조회 (매일 최근 META_DAYS일만 다시 씀)
//  · 「메타 캠페인」: 캠페인별 상태·목표·전체 기간 도달(도달은 날짜별 값을 더하면 안 돼서 기간 단위로 따로 받음)
//  · 「메타 소재」  : 광고별 인스타 게시물 링크·본문 → 인스타 게시물에 광고 「확인」 표시
// 처음 한 번: 편집기에서 backfillMeta 실행(외부 요청 권한 승인 + 36개월치 일별 채우기). 그 뒤는 매일 08:00 기록의 meta 단계.
// 토큰이 없으면 meta 단계는 건너뛰고 지금처럼 「메타 광고」 수동 탭·「광고 추가 입력」만 써요.
const META_API = 'https://graph.facebook.com/v24.0/';   // 그래프 API 버전 — 지원 종료(약 2년) 전에 올림
const META_DAILY_SHEET = '메타 일별', META_CAMP_SHEET = '메타 캠페인', META_CR_SHEET = '메타 소재';
const META_DAILY_HEAD = ['날짜', '캠페인 ID', '캠페인 이름', '지출', '노출', '링크 클릭', '랜딩 페이지 조회', '게시물 참여', '영상 조회'];
const META_CAMP_HEAD = ['캠페인 ID', '캠페인 이름', '상태', '목표', '도달(전체 기간)', '통화', '받은 시각'];
const META_CR_HEAD = ['캠페인 ID', '캠페인 이름', '광고 ID', '광고 이름', '본문', '인스타그램 게시물 링크'];
const META_DAYS = 37;        // 매일 다시 받는 기간(늦게 잡히는 지출·전환 보정 포함)
const META_MONTHS = 37;      // 메타 인사이트 보관 한도(37개월) — 처음 채울 때 여기까지 거슬러 올라감
const META_STATUS = '["ACTIVE","PAUSED","ARCHIVED","CAMPAIGN_PAUSED","ADSET_PAUSED","IN_PROCESS","WITH_ISSUES"]';

function metaConf_() {
  const p = PropertiesService.getScriptProperties();
  // META_ACCOUNT: 광고 계정 ID 하나 또는 쉼표로 여러 개(예전 계정 + 지금 계정)
  const token = p.getProperty('META_TOKEN');
  const acts = String(p.getProperty('META_ACCOUNT') || '').split(/[,\s]+/).map(x => x.replace(/^act_/, '').trim()).filter(x => /^\d+$/.test(x)).map(x => 'act_' + x);
  return token && acts.length ? { token: token, act: acts[0], acts: acts, warn: [] } : null;
}
// 모든 광고 계정에서 같은 요청 → 행을 합침. 일부 계정만 실패하면 conf.warn에 남기고 나머지로 진행, 전부 실패하면 오류
function metaAll_(conf, edge, params) {
  const out = [], errs = [];
  conf.acts.forEach(act => {
    try { Array.prototype.push.apply(out, metaGet_(conf, act + edge, params)); }
    catch (e) { errs.push(act.slice(-4) + ': ' + e.message); }
  });
  if (errs.length === conf.acts.length) throw new Error(errs.join(' / '));
  errs.forEach(x => { if (conf.warn.indexOf(x) < 0) conf.warn.push(x); });
  return out;
}
// GET + 다음 쪽(paging.next)까지 모음. 오류에는 메타 메시지만 남김(토큰이 섞이지 않게)
function metaGet_(conf, path, params) {
  const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  let url = META_API + path + '?' + q + '&access_token=' + encodeURIComponent(conf.token);
  const out = [];
  for (let page = 0; url && page < 200; page++) {
    let res, j;
    // 메타 일시 오류(code 1·2, is_transient, HTTP 5xx)는 잠깐 쉬고 한 번 더 시도
    for (let t = 0; ; t++) {
      res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      try { j = JSON.parse(res.getContentText()); } catch (e) { j = null; }
      const temp = !j ? res.getResponseCode() >= 500 : !!(j.error && (j.error.is_transient || j.error.code === 1 || j.error.code === 2));
      if (!temp || t >= 1) break; // 한 번만 다시 — 계속 실패하면 metaDailySplit_가 기간을 나눔
      Utilities.sleep(2000);
    }
    if (!j) throw new Error('메타 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')');
    if (j.error) throw new Error((j.error.code === 190 ? '토큰 만료·무효 — ' : '') + 'code ' + j.error.code + ': ' + String(j.error.message || '').replace(/access_token=[^&\s]+/g, 'access_token=…'));
    Array.prototype.push.apply(out, j.data || []);
    url = j.paging && j.paging.next || '';
  }
  return out;
}
function metaAct_(r, type) {
  const a = (r.actions || []).filter(x => x.action_type === type)[0];
  return a ? Number(a.value) || 0 : 0;
}
// 비동기 보고서: 무거운 인사이트 조회(캠페인 × 날짜)는 바로 받으면 메타가 30초쯤 뒤 code 2로 포기해서,
// 보고서 작업을 맡기고(POST) 끝날 때까지 기다린 뒤 결과를 쪽별로 받음
function metaAsync_(conf, act, params) {
  const err = j => new Error((j.error.code === 190 ? '토큰 만료·무효 — ' : '') + 'code ' + j.error.code + ': ' + String(j.error.message || '').replace(/access_token=[^&\s]+/g, 'access_token=…'));
  // 값은 본문이 아니라 주소(쿼리)에 붙임 — 본문(form)으로 보내면 메타가 "name_placeholder must be an integer"(code 100)로 거절
  const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(META_API + act + '/insights?' + q + '&access_token=' + encodeURIComponent(conf.token), { method: 'post', muteHttpExceptions: true });
  let j; try { j = JSON.parse(res.getContentText()); } catch (e) { throw new Error('메타 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')'); }
  if (j.error) throw err(j);
  const id = j.report_run_id;
  if (!id) throw new Error('메타 비동기 보고서 ID를 받지 못함');
  for (let i = 0; ; i++) {
    if (i >= 60) throw new Error('code 2: 비동기 보고서가 4분 안에 끝나지 않음');
    Utilities.sleep(i < 5 ? 2000 : 5000);
    const s = JSON.parse(UrlFetchApp.fetch(META_API + id + '?fields=async_status&access_token=' + encodeURIComponent(conf.token), { muteHttpExceptions: true }).getContentText());
    if (s.error) throw err(s);
    if (s.async_status === 'Job Completed') break;
    if (/Failed|Skipped/.test(s.async_status || '')) throw new Error('code 2: 비동기 보고서 실패(' + s.async_status + ')');
  }
  return metaGet_(conf, id + '/insights', { limit: 500 });
}
// 일별 캠페인 실적 [from, to] → 「메타 일별」 행 (계정마다 비동기 보고서, 일부 계정 실패는 conf.warn)
function metaDailyRows_(conf, from, to) {
  const params = { level: 'campaign', time_increment: 1, time_range: JSON.stringify({ since: from, until: to }),
    fields: 'campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions' };
  const out = [], errs = [];
  conf.acts.forEach(act => {
    try { Array.prototype.push.apply(out, metaAsync_(conf, act, params)); }
    catch (e) { errs.push(act.slice(-4) + ': ' + e.message); }
  });
  if (errs.length === conf.acts.length) throw new Error(errs.join(' / '));
  errs.forEach(x => { if (conf.warn.indexOf(x) < 0) conf.warn.push(x); });
  return out.filter(r => Number(r.spend) || Number(r.impressions))
    .map(r => [r.date_start, String(r.campaign_id), r.campaign_name, Number(r.spend) || 0, Number(r.impressions) || 0,
      Number(r.inline_link_clicks) || 0, metaAct_(r, 'landing_page_view'), metaAct_(r, 'post_engagement'), metaAct_(r, 'video_view')]);
}
// 기간이 길어 메타가 일시 오류(code 1·2)로 포기하면 기간을 반으로 나눠 다시 받음. 7일 미만도 실패하면 그 구간은 건너뛰고 conf.warn에 남김
function metaDailySplit_(conf, from, to) {
  try { return metaDailyRows_(conf, from, to); }
  catch (e) {
    if (!/code [12]\b/.test(e.message)) throw e;
    const days = Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 864e5);
    if (days < 7) { conf.warn.push('일시 오류로 건너뜀 ' + from + '~' + to); return []; }
    const mid = shiftDate_(from, Math.floor(days / 2));
    return metaDailySplit_(conf, from, mid).concat(metaDailySplit_(conf, shiftDate_(mid, 1), to));
  }
}
// 「메타 일별」에서 from 이후(to가 있으면 from~to) 행만 새 값으로 바꿔 씀(나머지 행은 그대로)
function metaMergeDaily_(ss, from, rows, to) {
  const sh = ss.getSheetByName(META_DAILY_SHEET) || ss.insertSheet(META_DAILY_SHEET);
  const old = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, META_DAILY_HEAD.length).getValues() : [];
  const keep = old.map(r => [fmtDate_(r[0]), String(r[1]), String(r[2])].concat(r.slice(3))).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && (r[0] < from || (to && r[0] > to)));
  const all = keep.concat(rows).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[2] < b[2] ? -1 : 1);
  sh.clearContents();
  sh.getRange(1, 1, 1, META_DAILY_HEAD.length).setValues([META_DAILY_HEAD]).setFontWeight('bold');
  if (all.length) {
    sh.getRange(2, 1, all.length, 3).setNumberFormat('@'); // 날짜·ID가 숫자·날짜로 바뀌지 않게
    sh.getRange(2, 1, all.length, META_DAILY_HEAD.length).setValues(all);
  }
  sh.setFrozenRows(1);
  return all.length;
}
// 캠페인 상태·목표·전체 기간 도달과 광고 소재 → 두 탭을 통째로 다시 씀
function metaRefreshInfo_(ss, conf) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const st = {};
  metaAll_(conf, '/campaigns', { fields: 'name,effective_status,objective', effective_status: META_STATUS, limit: 500 })
    .forEach(c => { st[c.id] = c; });
  const camp = metaAll_(conf, '/insights', {
    level: 'campaign', date_preset: 'maximum', limit: 500, fields: 'campaign_id,campaign_name,reach,objective,account_currency'
  }).map(r => {
    const c = st[r.campaign_id] || {};
    return [String(r.campaign_id), r.campaign_name, c.effective_status || '', r.objective || c.objective || '', Number(r.reach) || 0, r.account_currency || '', now];
  });
  const ads = metaAll_(conf, '/ads', {
    fields: 'name,campaign_id,campaign{name},creative{body,instagram_permalink_url}', effective_status: META_STATUS, limit: 200
  }).map(a => [String(a.campaign_id || ''), (a.campaign && a.campaign.name) || '', String(a.id), a.name || '',
    (a.creative && a.creative.body) || '', (a.creative && a.creative.instagram_permalink_url) || '']);
  [[META_CAMP_SHEET, META_CAMP_HEAD, camp], [META_CR_SHEET, META_CR_HEAD, ads]].forEach(([name, head, rows]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clearContents();
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    if (rows.length) {
      sh.getRange(2, 1, rows.length, head.length).setNumberFormat('@');
      sh.getRange(2, 1, rows.length, head.length).setValues(rows.map(r => r.map(String)));
    }
    sh.setFrozenRows(1);
  });
  return { camps: camp.length, ads: ads.length };
}
// 매일 기록 단계: 최근 META_DAYS일 일별 + 캠페인·소재 갱신
function metaStep_(ss, today, logs) {
  const conf = metaConf_();
  if (!conf) { logs.push([new Date(), '메타 광고 API', 0, '건너뜀: 스크립트 속성 META_TOKEN·META_ACCOUNT 없음']); return; }
  // 과거 채우기가 덜 끝났는데 예약이 없으면 1분 뒤로 예약(편집기에서 다시 누르지 않아도 이어짐)
  if (PropertiesService.getScriptProperties().getProperty('META_BF') && !ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backfillMeta'))
    ScriptApp.newTrigger('backfillMeta').timeBased().after(60 * 1000).create();
  const ds = ss.getSheetByName(META_DAILY_SHEET);
  if (!ds || ds.getLastRow() < 2) logs.push([new Date(), '메타 광고 API', 0, '경고: 「' + META_DAILY_SHEET + '」 탭이 비어 있음 — 편집기에서 backfillMeta를 한 번 실행하세요']);
  const to = shiftDate_(today, -1), from = shiftDate_(today, -META_DAYS);
  const rows = metaDailySplit_(conf, from, to);
  const n = metaMergeDaily_(ss, from, rows);
  const r = metaRefreshInfo_(ss, conf);
  logs.push([new Date(), '메타 광고 API', rows.length, '정상 — ' + from + '~' + to + ' 일별 ' + rows.length + '행(탭 전체 ' + n + '행) · 캠페인 ' + r.camps + '개 · 소재 ' + r.ads + '개' + (conf.warn.length ? ' · 일부 계정 실패: ' + conf.warn.join(' / ').slice(0, 200) : '')]);
}
// 처음 한 번(편집기에서 실행): 메타가 허용하는 가장 오래된 날(37개월 전 다음 날)부터 어제까지 한 달씩 받아 「메타 일별」을 채움
// 첫 구간이 기간 한도(code 100)에 걸리면 그 달은 건너뛰고 다음 달부터 받음. 그 이전은 「메타 광고」 수동 탭(2023-06~)이 맡음
// 한 달 받을 때마다 탭에 바로 쓰고 진행 위치를 스크립트 속성 META_BF에 남김. 4분 30초가 지나면 멈추고 1분 뒤 자기 자신을 다시 예약(끝까지 자동)
function backfillMeta() {
  return withLock_('메타 과거 채우기', () => {
    const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
    const p = PropertiesService.getScriptProperties(), t0 = Date.now();
    const conf = metaConf_();
    if (!conf) throw new Error('스크립트 속성 META_TOKEN·META_ACCOUNT를 먼저 넣으세요');
    const ym = (y, m) => { const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 10); };
    let s = JSON.parse(p.getProperty('META_BF') || 'null');
    if (!s) {
      const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      const Y = Number(today.slice(0, 4)), Mo = Number(today.slice(5, 7)) - 1;
      const back = ym(Y, Mo - META_MONTHS).slice(0, 8) + today.slice(8, 10); // 37개월 전 같은 날(말일 넘침은 아래 비교로 걸러짐)
      const start = shiftDate_(/^\d{4}-\d{2}-(29|30|31)$/.test(back) ? ym(Y, Mo - META_MONTHS + 1) : back, 1);
      s = { start: start, a: start, end: shiftDate_(today, -1), got: 0, n: 0, skipped: [], warn: [] };
    }
    conf.warn = s.warn;
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backfillMeta').forEach(t => ScriptApp.deleteTrigger(t));
    while (s.a <= s.end) {
      if (Date.now() - t0 > 270 * 1000) {
        p.setProperty('META_BF', JSON.stringify(s));
        ScriptApp.newTrigger('backfillMeta').timeBased().after(60 * 1000).create();
        logRows_(ss, [[new Date(), '메타 과거 채우기', s.n, '진행 중 — ' + s.start + '~' + s.a + ' 전날까지 ' + s.n + '행 · 1분 뒤 자동으로 이어서']]);
        return s.n;
      }
      const a = s.a, next = ym(Number(a.slice(0, 4)), Number(a.slice(5, 7))), b = shiftDate_(next, -1) < s.end ? shiftDate_(next, -1) : s.end;
      let rows;
      try { rows = metaDailySplit_(conf, a, b); }
      catch (e) {
        // 보관 기간(37개월) 밖이라는 code 100만 건너뜀 — 다른 code 100(잘못된 요청)까지 건너뛰면 37개월이 조용히 비어 버림
        // 요청 한도(code 4·17·32·613)면 위치를 저장하고 30분 뒤 자동으로 다시(최대 20번)
        if (/code (4|17|32|613)\b/.test(e.message) && (s.rl = (s.rl || 0) + 1) <= 20) {
          p.setProperty('META_BF', JSON.stringify(s));
          ScriptApp.newTrigger('backfillMeta').timeBased().after(30 * 60 * 1000).create();
          logRows_(ss, [[new Date(), '메타 과거 채우기', s.n, '요청 한도 — ' + a + '부터 30분 뒤 자동으로 이어서(' + s.rl + '번째)']]);
          return s.n;
        }
        if (s.got || !/code 100\b/.test(e.message) || !/37|month|start date|time.?range|date range/i.test(e.message)) { p.setProperty('META_BF', JSON.stringify(s)); throw e; } // 다시 실행하면 이 달부터 이어서
        s.skipped.push(a.slice(0, 7)); s.start = next; s.a = next; continue;
      }
      s.n = metaMergeDaily_(ss, a, rows, b);
      s.got += rows.length; s.a = next;
      p.setProperty('META_BF', JSON.stringify(s));
    }
    p.deleteProperty('META_BF');
    const r = metaRefreshInfo_(ss, conf);
    logRows_(ss, [[new Date(), '메타 과거 채우기', s.n, '정상 — ' + s.start + '~' + s.end + (s.skipped.length ? ' (기간 한도로 건너뜀: ' + s.skipped.join(', ') + ')' : '') + ' · 캠페인 ' + r.camps + '개 · 소재 ' + r.ads + '개' + (conf.warn.length ? ' · 일부 계정 실패: ' + conf.warn.join(' / ').slice(0, 200) : '')]]);
    dropCache_();
    return s.n;
  });
}
// 대시보드용: 「메타 일별」 + 「메타 캠페인」 → loadMetaTab_와 같은 모양의 캠페인 목록 (+ api: 1, mo: 월별 [YYYY-MM, 지출, 노출])
function loadMetaApi_(ss) {
  const ds = ss.getSheetByName(META_DAILY_SHEET), cs = ss.getSheetByName(META_CAMP_SHEET);
  if (!ds || ds.getLastRow() < 2) return [];
  const info = {};
  if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, META_CAMP_HEAD.length).getValues()
    .forEach(r => { info[String(r[0])] = { st: String(r[2]), obj: String(r[3]), reach: Number(r[4]) || null, cur: String(r[5] || '') }; });
  const by = {};
  ds.getRange(2, 1, ds.getLastRow() - 1, META_DAILY_HEAD.length).getValues().forEach(r => {
    const d = fmtDate_(r[0]), id = String(r[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !id) return;
    const o = by[id] = by[id] || { n: String(r[2]), from: d, end: d, spend: 0, imp: 0, clk: 0, lpv: 0, eng: 0, vv: 0, mo: {} };
    if (d < o.from) o.from = d;
    if (d >= o.end) { o.end = d; o.n = String(r[2]); } // 이름을 바꾼 캠페인은 마지막 이름
    o.spend += Number(r[3]) || 0; o.imp += Number(r[4]) || 0; o.clk += Number(r[5]) || 0;
    o.lpv += Number(r[6]) || 0; o.eng += Number(r[7]) || 0; o.vv += Number(r[8]) || 0;
    const x = o.mo[d.slice(0, 7)] = o.mo[d.slice(0, 7)] || [0, 0]; x[0] += Number(r[3]) || 0; x[1] += Number(r[4]) || 0;
  });
  const recent = shiftDate_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), -3);
  const r2 = v => Math.round(v * 100) / 100;
  return Object.keys(by).map(id => {
    const o = by[id], c = info[id] || {}, obj = c.obj || '';
    // 목표별 결과: 트래픽 = 랜딩 페이지 조회(없으면 링크 클릭), 참여 = 게시물 참여, 인지도 = 도달, 동영상 = 영상 조회
    const rt = /TRAFFIC|LINK_CLICKS/.test(obj) ? (o.lpv ? 'landing_page_view' : 'link_click')
      : /ENGAGEMENT|PAGE_LIKES/.test(obj) ? 'post_engagement' : /AWARENESS|REACH/.test(obj) ? 'reach' : /VIDEO_VIEWS/.test(obj) ? 'video_view' : 'link_click';
    const res = { landing_page_view: o.lpv, link_click: o.clk, post_engagement: o.eng, reach: c.reach, video_view: o.vv }[rt];
    const st = c.st === 'ACTIVE' && o.end >= recent ? 'active' : c.st === 'ARCHIVED' ? 'archived' : /PAUSED/.test(c.st || '') ? 'inactive' : 'completed';
    return { n: o.n, st: st, res: res == null ? null : Math.round(res), rt: rt, reach: c.reach || null, budget: null, spend: r2(o.spend), cur: c.cur || 'USD',
      end: o.end, from: o.from, imp: o.imp, clk: o.clk, lpv: o.lpv, api: 1, mo: Object.keys(o.mo).sort().map(k => [k, r2(o.mo[k][0]), o.mo[k][1]]) };
  });
}

// ───────── 유튜브 API: 매일 기록 때 유튜브에서 직접 받음 (Supermetrics 원본 시트는 월요일에만 갱신) ─────────
// 원본 시트(「유튜브 데이터 수집」)를 읽은 뒤 같은 영상(yt:영상ID)의 값을 API 값으로 덮어쓰고, 시트에 아직 없는 새 영상을 더한다.
//  · 조회·좋아요·댓글·참여 조회·평균 시청은 유튜브 분석 API, 기간은 YT_PERIOD_START ~ 오늘 — 원본 시트(Supermetrics)와 같은 기준이라 기록이 이어진다
//  · 제목·게시일·설명·길이는 유튜브 데이터 API
//  · 켜기: 스크립트 속성 YT_API = on. 끄거나 API가 실패하면 지금처럼 원본 시트 값만 쓴다
//  · 처음 한 번: 편집기에서 testYouTubeApi 실행(유튜브 읽기 권한 승인 + 원본 시트와 숫자 비교, 시트에는 쓰지 않음)
const YT_PERIOD_START = '2024-01-01';         // 원본 시트 쿼리의 시작일(이 날 이후 게시 영상은 조회 = 전체 기간 조회)
const YT_BATCH = 80;                           // 분석 API 한 번에 묻는 영상 수 — 주소 길이 한도(약 2,000자) 때문에 200개는 넘침
const YT_NEW_DAYS = 60;                        // 원본 시트에 없는 영상은 최근 N일 안에 올라온 것만 더함
let YT_API_ = null, YT_API_LOG_ = null;

function ytOverlay_(out, today) {
  if (PropertiesService.getScriptProperties().getProperty('YT_API') !== 'on') return;
  const ch = out['유튜브'] = out['유튜브'] || {};
  try {
    const api = YT_API_ || (YT_API_ = fetchYouTube_(Object.keys(ch).filter(k => k.indexOf('yt:') === 0).map(k => k.slice(3)), today));
    const base = ytLifetime_(); // 원본 시트와 같은 시점(월요일)의 전체 기간 값
    let upd = 0, add = 0;
    Object.keys(api.videos).forEach(id => {
      const v = api.videos[id], a = api.stats[id], k = 'yt:' + id, it = ch[k];
      if (it) {
        if (!it.lengthSec && v.lengthSec) { it.lengthSec = v.lengthSec; it.type = lengthBucket_(v.lengthSec); }
        if (a) { // 분석 API(채널 권한이 있을 때): 원본 시트와 같은 기간 값으로 바로 교체
          it.views = a.views; it.likes = a.likes; it.comments = a.comments;
          if (a.engaged !== '') it.engaged = a.engaged;
          if (a.avgSec !== '') it.avgSec = a.avgSec;
          upd++;
          return;
        }
        // 분석 API가 안 되면: 원본 시트 값 + (지금 공개 수치 − 월요일 전체 기간 값). 원본 시트는 기간 조회라 전체 조회로 바로 바꾸면 기록이 튄다
        const b = base[id];
        if (!b) return;
        const add_ = (cur, now, then) => (cur === '' || then == null || now < then) ? cur : cur + (now - then);
        it.views = add_(it.views, v.views, b[0]);
        it.likes = add_(it.likes, v.likes, b[1]);
        it.comments = add_(it.comments, v.comments, b[2]);
        upd++;
      } else if (v.date >= shiftDate_(today, -YT_NEW_DAYS) && v.date >= YT_PERIOD_START) {
        // 새 영상: 분석 값이 아직 없으면(게시 1~2일) 데이터 API의 공개 수치 — 이 기간 영상은 전체 조회 = 기간 조회
        const s = a || { views: v.views, likes: v.likes, comments: v.comments, engaged: '', avgSec: '' };
        ch[k] = { date: v.date, title: cut_(v.title.replace(/\s+/g, ' ').trim(), 80), url: 'https://www.youtube.com/watch?v=' + id, full: v.title, desc: v.desc,
          views: s.views, likes: s.likes, comments: s.comments, shares: '', saves: '', reach: '', engaged: s.engaged, avgSec: s.avgSec,
          lengthSec: v.lengthSec, type: lengthBucket_(v.lengthSec) };
        add++;
      }
    });
    YT_API_LOG_ = { n: upd + add, msg: '정상 (갱신 ' + upd + ' · 새 영상 ' + add + (api.note ? ' · ' + api.note : '') + ')' };
  } catch (e) {
    YT_API_LOG_ = { n: 0, msg: '오류(원본 시트 값 사용): ' + e.message };
  }
}

// 반환: { videos: {id: {date, title, desc, lengthSec, views, likes, comments}}, stats: {id: {views, likes, comments, engaged, avgSec}}, chId, note }
function fetchYouTube_(seedIds, today) {
  if (!seedIds.length) throw new Error('원본 시트에 영상이 없어 채널을 찾을 수 없음');
  // 채널 ID: 원본 시트에 있는 영상들의 채널(브랜드 계정이어도 ID로 찾음)
  const v0 = YouTube.Videos.list('snippet', { id: seedIds.slice(0, 50).join(',') });
  if (!v0.items || !v0.items.length) throw new Error('영상 정보를 받지 못함');
  const cnt = {};
  v0.items.forEach(x => { cnt[x.snippet.channelId] = (cnt[x.snippet.channelId] || 0) + 1; });
  const chId = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  const uploads = YouTube.Channels.list('contentDetails', { id: chId }).items[0].contentDetails.relatedPlaylists.uploads;
  const ids = [];
  let tok = '';
  do {
    const r = YouTube.PlaylistItems.list('contentDetails', { playlistId: uploads, maxResults: 50, pageToken: tok });
    (r.items || []).forEach(x => ids.push(x.contentDetails.videoId));
    tok = r.nextPageToken || '';
  } while (tok);
  const videos = {};
  for (let i = 0; i < ids.length; i += 50) {
    const r = YouTube.Videos.list('snippet,statistics,contentDetails', { id: ids.slice(i, i + 50).join(','), maxResults: 50 });
    (r.items || []).forEach(x => {
      const st = x.statistics || {};
      videos[x.id] = {
        date: Utilities.formatDate(new Date(x.snippet.publishedAt), TZ, 'yyyy-MM-dd'),
        title: String(x.snippet.title || ''), desc: String(x.snippet.description || ''),
        lengthSec: isoDur_(x.contentDetails && x.contentDetails.duration),
        views: Number(st.viewCount) || 0, likes: Number(st.likeCount) || 0, comments: Number(st.commentCount) || 0,
      };
    });
  }
  // 분석 API: 원본 시트와 같은 기간 값. 채널 관리 권한이 없으면 실패 → 기존 영상은 원본 시트 값 유지
  const stats = {};
  let note = '';
  const want = Object.keys(videos).filter(id => videos[id].date >= YT_PERIOD_START || seedIds.indexOf(id) >= 0);
  let metrics = 'views,likes,comments,engagedViews,averageViewDuration';
  // 브랜드 계정으로 승인받은 토큰(ytAuthorize)이 있으면 그것으로, 없으면 스크립트 소유 계정으로(브랜드 채널이면 Forbidden)
  try {
    const bearer = ytBrandToken_(); // 토큰 갱신이 실패하면 분석 값 없이 차이 방식으로 넘어감
    for (let i = 0; i < want.length; i += YT_BATCH) {
      const q = m => {
        const prm = { ids: 'channel==' + chId, startDate: YT_PERIOD_START, endDate: today, metrics: m, dimensions: 'video', filters: 'video==' + want.slice(i, i + YT_BATCH).join(','), maxResults: 200 };
        if (!bearer) return YouTubeAnalytics.Reports.query(prm);
        const res = UrlFetchApp.fetch('https://youtubeanalytics.googleapis.com/v2/reports?' + Object.keys(prm).map(k => k + '=' + encodeURIComponent(prm[k])).join('&'),
          { headers: { Authorization: 'Bearer ' + bearer }, muteHttpExceptions: true });
        const j = JSON.parse(res.getContentText() || '{}');
        if (j.error) throw new Error('HTTP ' + res.getResponseCode() + ' ' + String(j.error.message || '').slice(0, 120));
        return j;
      };
      let r;
      try { r = q(metrics); }
      catch (e) {
        if (metrics.indexOf('engagedViews') < 0) throw e;
        metrics = 'views,likes,comments,averageViewDuration'; note = '참여 조회 지표 없음';
        r = q(metrics);
      }
      const head = (r.columnHeaders || []).map(h => h.name);
      const at = n => head.indexOf(n);
      (r.rows || []).forEach(row => {
        stats[row[at('video')]] = {
          views: row[at('views')], likes: row[at('likes')], comments: row[at('comments')],
          engaged: at('engagedViews') >= 0 ? row[at('engagedViews')] : '',
          avgSec: at('averageViewDuration') >= 0 ? row[at('averageViewDuration')] : '',
        };
      });
    }
  } catch (e) {
    note = '분석 API 실패(채널 권한 확인): ' + String(e.message).slice(0, 80);
  }
  return { videos: videos, stats: stats, chId: chId, note: note };
}

// 「유튜브_전체기간」 탭(Supermetrics, 원본 시트와 같은 월요일 갱신) → {영상ID: [조회, 좋아요, 댓글]}
function ytLifetime_() {
  const out = {};
  const sh = (SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID)).getSheetByName('유튜브_전체기간');
  if (!sh || sh.getLastRow() < 2) return out;
  const v = sh.getDataRange().getValues(), h = v[0].map(x => String(x).trim());
  const iu = h.indexOf('Video URL'), iv = h.indexOf('Video views'), il = h.indexOf('Likes'), ic = h.indexOf('Comments');
  if (iu < 0 || iv < 0) return out;
  v.slice(1).forEach(r => {
    const m = /(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/.exec(String(r[iu]));
    if (m) out[m[1]] = [Number(r[iv]) || 0, il >= 0 ? Number(r[il]) || 0 : null, ic >= 0 ? Number(r[ic]) || 0 : null];
  });
  return out;
}

// ISO 8601 길이(PT1H2M3S) → 초
function isoDur_(s) {
  const m = String(s || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return '';
  return Number(m[1] || 0) * 86400 + Number(m[2] || 0) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0);
}

// 편집기에서 실행: 권한 승인 + 원본 시트 값과 API 값 비교 (시트에 쓰지 않음, 결과는 실행 로그에 출력)
function testYouTubeApi() {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const was = props.getProperty('YT_API');
  props.deleteProperty('YT_API'); // 원본 시트 값만 읽기
  let sheet;
  try { sheet = readSource_(SOURCES.filter(s => s.channel === '유튜브')[0], today)['유튜브'] || {}; }
  finally { if (was) props.setProperty('YT_API', was); }
  const ids = Object.keys(sheet).filter(k => k.indexOf('yt:') === 0).map(k => k.slice(3));
  const api = fetchYouTube_(ids, today);
  const ratios = [], base = ytLifetime_(), lr = [];
  let miss = 0, nob = 0;
  ids.forEach(id => {
    const a = api.stats[id], s = sheet['yt:' + id], v = api.videos[id], b = base[id];
    if (v && b && b[0] > 100) lr.push(v.views / b[0]); else nob++;
    if (!a) { miss++; return; }
    if (s.views > 100) ratios.push(a.views / s.views);
  });
  lr.sort((a, b) => a - b);
  const ql = p => lr.length ? lr[Math.floor((lr.length - 1) * p)].toFixed(3) : '-';
  Logger.log('공개 조회÷「유튜브_전체기간」(월요일) 비율(%s개, 기준 없음 %s개): 하위10%% %s · 중앙 %s · 상위10%% %s — 1.000~1.05면 차이 방식으로 이어 붙일 수 있음', lr.length, nob, ql(0.1), ql(0.5), ql(0.9));
  ratios.sort((a, b) => a - b);
  const q = p => ratios.length ? ratios[Math.floor((ratios.length - 1) * p)].toFixed(3) : '-';
  const fresh = Object.keys(api.videos).filter(id => !sheet['yt:' + id] && api.videos[id].date >= shiftDate_(today, -YT_NEW_DAYS));
  Logger.log('채널 영상 %s개 · 원본 시트 %s개 · 분석 값 있음 %s개 · 분석 값 없음 %s개', Object.keys(api.videos).length, ids.length, Object.keys(api.stats).length, miss);
  Logger.log('조회 API÷시트 비율(조회 100 초과 %s개): 하위10%% %s · 중앙 %s · 상위10%% %s — 1.000 근처(조금 큼)면 같은 기준', ratios.length, q(0.1), q(0.5), q(0.9));
  Logger.log('시트에 없는 최근 %s일 새 영상 %s개: %s', YT_NEW_DAYS, fresh.length, fresh.map(id => api.videos[id].date + ' ' + api.videos[id].title.slice(0, 20)).join(' / '));
  if (api.note) Logger.log('참고: %s', api.note);
}

// ───────── 인스타 API: 매일 기록 때 우리 계정(jjuniv·hong._.video) 게시물 값을 메타 그래프 API로 직접 받음 ─────────
// 원본 시트(「인스타그램」·공개 원본, Supermetrics 월요일 갱신)를 읽은 뒤 같은 게시물의 값을 API 값으로 덮어쓰고, 시트에 아직 없는 새 게시물을 더한다.
//  · 토큰: 메타 광고와 같은 스크립트 속성 META_TOKEN(시스템 사용자, instagram_basic·instagram_manage_insights·pages_show_list·pages_read_engagement 포함)
//  · 인스타 계정 ID는 토큰에 연결된 페이지에서 username으로 찾음(IG_CH의 prop 속성에 ID를 넣으면 그 값 우선)
//    hong._.video는 페이스북 페이지에 연결하고, 그 페이지·인스타 계정을 비즈니스 설정에서 시스템 사용자 sns-board에 할당해야 보임
//  · 게시물 연결: 원본 시트 키(날짜|캡션 앞 40자)를 바꾸지 않고, 캡션 앞 40자 + 날짜 ±1일로 같은 게시물을 찾음. URL 열에는 게시물 주소를 넣음
//  · 켜기: 스크립트 속성 IG_API = on(jjuniv) · HONG_API = on(hong). 끄거나 API가 실패하면 지금처럼 원본 시트 값만 쓴다
//  · 처음 한 번: 편집기에서 testInstagramApi / testHongApi 실행(시트에 쓰지 않음, 원본 시트와 숫자·날짜 기준 비교)
const IG_CH = {
  '인스타그램':   { user: 'jjuniv',       prop: 'IG_USER',      on: 'IG_API',   from: '2024-12-27', log: '인스타 API' },
  'hong._.video': { user: 'hong._.video', prop: 'IG_USER_HONG', on: 'HONG_API', from: '2021-01-01', log: 'hong API', allNew: true },
};
const IG_NEW_DAYS = 60;                        // 원본 시트에 없는 게시물은 최근 N일 것만 더함
// allNew(hong, 2026-10-18): 공개 원본에 hong 게시물이 일부만 있어 from 이후 전부 더함. 단 N일보다 오래된 것은 원본 시트에 연결 안 된 게시물이 ±1일 안에 있으면 같은 게시물일 수 있어 뺌
const IG_DATE_TZ = TZ;                         // 원본 시트 「날짜」의 기준 시간대 — testInstagramApi 결과로 확인
const IG_API_ = {}, IG_API_LOG_ = {};          // 채널별 API 결과·실행 로그
const IG_EACH_MAX = 200;                      // 인사이트를 게시물마다 받을 때 최대 개수

function igOverlay_(out, today, chName) {
  const cf = IG_CH[chName];
  if (PropertiesService.getScriptProperties().getProperty(cf.on) !== 'on') return;
  const ch = out[chName] = out[chName] || {};
  try {
    const api = IG_API_[chName] || (IG_API_[chName] = fetchInstagram_(chName));
    const m = igMatch_(ch, api.media);
    let upd = 0, add = 0, held = 0;
    const recent = shiftDate_(today, -IG_NEW_DAYS), newFrom = cf.allNew ? cf.from : recent;
    const linked = {}, loose = {};
    Object.keys(m.byId).forEach(id => { linked[m.byId[id]] = 1; });
    Object.keys(ch).forEach(k => { if (!linked[k]) loose[ch[k].date] = 1; });
    const nearLoose = d => [-1, 0, 1].some(i => loose[shiftDate_(d, i)]);
    api.media.forEach(x => {
      const k = m.byId[x.id], it = k ? ch[k] : null;
      if (it) {
        ['views', 'likes', 'comments', 'shares', 'saves', 'reach'].forEach(f => { if (x[f] !== '') it[f] = x[f]; });
        if (x.url) it.url = x.url;
        upd++;
      } else if (x.date >= newFrom && x.product !== 'STORY') {
        const key = capKey_(x.date, x.caption);
        if (!key || ch[key]) return;
        if (x.date < recent && nearLoose(x.date)) { held++; return; }
        ch[key] = { date: x.date, title: cut_(x.caption.replace(/\s+/g, ' ').trim(), 80), url: x.url, full: x.caption, desc: '',
          views: x.views, likes: x.likes, comments: x.comments, shares: x.shares, saves: x.saves, reach: x.reach, engaged: '', avgSec: '',
          lengthSec: '', type: typeLabel_(x.product, x.mediaType) };
        add++;
      }
    });
    IG_API_LOG_[chName] = { n: upd + add, msg: '정상 (갱신 ' + upd + ' · 새 게시물 ' + add + (held ? ' · 겹칠 수 있어 뺌 ' + held : '') + (m.amb ? ' · 캡션 겹침 ' + m.amb : '') + (api.note ? ' · ' + api.note : '') + ')' };
  } catch (e) {
    IG_API_LOG_[chName] = { n: 0, msg: '오류(원본 시트 값 사용): ' + e.message };
  }
}

// 원본 시트 게시물 ↔ API 게시물: 캡션 앞 30자(글자·숫자만 — 이모지·공백·특수 공백 차이 무시)가 같고 날짜 차이 1일 이내. 후보가 여럿이면 날짜가 같은 쪽, 그래도 여럿이면 연결하지 않음
// 남은 것: 같은 날짜에 시트·API 양쪽 모두 연결 안 된 게시물이 하나씩뿐이면 짝으로 봄(dateOnly)
function igMatch_(ch, media) {
  const norm = t => String(t || '').replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').slice(0, 30);
  const idx = {};
  Object.keys(ch).forEach(k => { const c = norm(ch[k].full || ch[k].title); (idx[c] = idx[c] || []).push(k); });
  const byId = {}, used = {};
  let amb = 0, sameDay = 0, offDay = 0, dateOnly = 0;
  media.forEach(x => {
    let c = (idx[norm(x.caption)] || []).filter(k => !used[k] && Math.abs(dayDiff_(ch[k].date, x.date)) <= 1);
    if (c.length > 1) c = c.filter(k => ch[k].date === x.date);
    if (c.length !== 1) { if (c.length > 1) amb++; return; }
    byId[x.id] = c[0]; used[c[0]] = 1;
    if (ch[c[0]].date === x.date) sameDay++; else offDay++;
  });
  const sDay = {}, aDay = {};
  Object.keys(ch).forEach(k => { if (!used[k]) (sDay[ch[k].date] = sDay[ch[k].date] || []).push(k); });
  media.forEach(x => { if (!byId[x.id] && x.product !== 'STORY') (aDay[x.date] = aDay[x.date] || []).push(x); });
  Object.keys(aDay).forEach(d => {
    if (aDay[d].length === 1 && sDay[d] && sDay[d].length === 1) { byId[aDay[d][0].id] = sDay[d][0]; used[sDay[d][0]] = 1; dateOnly++; }
  });
  return { byId: byId, amb: amb, sameDay: sameDay, offDay: offDay, dateOnly: dateOnly };
}
function dayDiff_(a, b) {
  if (!a || !b) return 99;
  return Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400000);
}

// 반환: { media: [{id, date, caption, url, product, mediaType, views, likes, comments, shares, saves, reach}], user, note }
function fetchInstagram_(chName) {
  const cf = IG_CH[chName];
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('META_TOKEN');
  if (!token) throw new Error('스크립트 속성 META_TOKEN 없음');
  const conf = { token: token };
  let user = String(p.getProperty(cf.prop) || '').trim();
  if (!user) {
    const pages = metaGet_(conf, 'me/accounts', { fields: 'name,instagram_business_account{id,username}', limit: 100 });
    const igs = pages.map(x => x.instagram_business_account).filter(Boolean);
    const pick = igs.filter(x => x.username === cf.user)[0];
    if (pick) user = pick.id;
    else if (igs.length) {
      // 페이지 없이 포트폴리오에만 있는 계정(hong): 페이지에 연결된 다른 계정의 business_discovery로 ID를 찾음 — 게시물 조회는 시스템 사용자 자산 할당이 있어야 됨
      const res = UrlFetchApp.fetch(META_API + igs[0].id + '?fields=' + encodeURIComponent('business_discovery.username(' + cf.user + '){id}') + '&access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
      const j = JSON.parse(res.getContentText() || '{}');
      user = j.business_discovery && j.business_discovery.id || '';
    }
    if (!user) throw new Error('토큰에 연결된 페이지에서 ' + cf.user + '을 찾지 못함(보이는 계정: ' + (igs.map(x => x.username).join(', ') || '없음') + ' — 페이지 연결·시스템 사용자 자산 할당 확인)');
  }
  const base = 'id,caption,timestamp,permalink,media_type,media_product_type,like_count,comments_count';
  let note = '', list;
  try {
    // 게시물 목록에 인사이트를 함께 받음(요청 수 최소)
    list = igMedia_(conf, user, base + ',insights.metric(views,reach,saved,shares)', 50, cf.from);
  } catch (e) {
    // 일부 게시물 형식이 지표를 지원하지 않으면 목록만 받고 게시물마다 따로 받음
    note = '인사이트 개별 조회';
    list = igMedia_(conf, user, base, 100, cf.from);
    // 게시물이 많으면(hong) 실행 시간 한도에 걸리므로 최근 IG_EACH_MAX개만 따로 받고, 나머지는 원본 시트 값을 유지(조회 칸을 비워 둠)
    list.forEach((x, i) => {
      if (i >= IG_EACH_MAX) { x.insights = { data: [] }; return; }
      try { x.insights = { data: metaGet_(conf, x.id + '/insights', { metric: 'views,reach,saved,shares' }) }; } catch (e2) { x.insights = { data: [] }; }
    });
  }
  const media = list.map(x => {
    const ins = {};
    ((x.insights && x.insights.data) || []).forEach(d => { ins[d.name] = d.values && d.values[0] ? Number(d.values[0].value) || 0 : (d.total_value ? Number(d.total_value.value) || 0 : ''); });
    const has = n => Object.prototype.hasOwnProperty.call(ins, n) ? ins[n] : '';
    return {
      id: String(x.id), date: Utilities.formatDate(new Date(x.timestamp), IG_DATE_TZ, 'yyyy-MM-dd'),
      caption: String(x.caption || ''), url: String(x.permalink || ''),
      product: String(x.media_product_type || ''), mediaType: String(x.media_type || ''),
      views: has('views'), likes: Number(x.like_count) || 0, comments: Number(x.comments_count) || 0,
      shares: has('shares'), saves: has('saved'), reach: has('reach'),
    };
  });
  return { media: media, user: user, note: note };
}

// 게시물 목록(최신순)을 from(IG_CH) 이전 게시물이 나올 때까지만 받음 — 오래된 게시물은 인사이트가 없어 요청이 실패할 수 있고, 원본 시트도 그 이후만 다룸
function igMedia_(conf, user, fields, limit, from) {
  let url = META_API + user + '/media?fields=' + encodeURIComponent(fields) + '&limit=' + limit + '&access_token=' + encodeURIComponent(conf.token);
  const out = [];
  for (let page = 0; url && page < 50; page++) {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    let j;
    try { j = JSON.parse(res.getContentText()); } catch (e) { throw new Error('메타 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')'); }
    if (j.error) throw new Error((j.error.code === 190 ? '토큰 만료·무효 — ' : '') + 'code ' + j.error.code + ': ' + String(j.error.message || '').replace(/access_token=[^&\s]+/g, 'access_token=…'));
    const d = j.data || [];
    let old = false;
    d.forEach(x => { if (Utilities.formatDate(new Date(x.timestamp), TZ, 'yyyy-MM-dd') >= from) out.push(x); else old = true; });
    url = !old && j.paging && j.paging.next || '';
  }
  return out;
}

// ───────── 「hong 게시물」 탭: hong 게시물의 캡션 전문·주소·지표 (JJ 스튜디오 자동매칭·조회수 패치가 읽음) ─────────
// 스냅샷의 제목은 앞 80자뿐이라 캡션 끝 「🎬 by 아이디」가 잘림 → 전문을 따로 둔다. 미디어 ID 기준으로 갱신(지워진 게시물 줄은 남음)
//  · 열: 미디어 ID · 게시일 · 형식 · 캡션 · 게시물 주소 · 조회 · 좋아요 · 댓글 · 공유 · 저장 · 도달 · 기록 시각. 열을 바꾸면 JJ 스튜디오도 같이 고쳐야 함
//  · HONG_API = on일 때만. 매일 기록의 hong 단계
const HONG_POSTS = 'hong 게시물';
function hongPostsStep_(ss, logs) {
  const ch = 'hong._.video';
  if (PropertiesService.getScriptProperties().getProperty(IG_CH[ch].on) !== 'on') { logs.push([new Date(), HONG_POSTS, 0, '건너뜀: HONG_API 꺼짐']); return; }
  const api = IG_API_[ch] || (IG_API_[ch] = fetchInstagram_(ch));
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const rows = api.media.filter(x => x.product !== 'STORY')
    .map(x => [x.id, x.date, typeLabel_(x.product, x.mediaType), x.caption, x.url, x.views, x.likes, x.comments, x.shares, x.saves, x.reach, now]);
  const r = igxUpsert_(ss, HONG_POSTS, ['미디어 ID', '게시일', '형식', '캡션', '게시물 주소', '조회', '좋아요', '댓글', '공유', '저장', '도달', '기록 시각'], [0], rows);
  logs.push([new Date(), HONG_POSTS, rows.length, '정상 (갱신 ' + r.updated + ' · 새 게시물 ' + r.added + ')']);
}
// ───────── 「jjuniv 게시물」·「유튜브 게시물」 탭: 공식 계정 게시물 캡션·설명란 전문 (JJ 스튜디오 자동매칭이 읽음, 2026-10-20) ─────────
// JJ 스튜디오는 크레딧 줄(「🎬 시리즈 | 회차」)로 기획서에 「업로드 완료」를 붙인다. 예전엔 Supermetrics 원본(월요일만 갱신)을 읽어 화~일 업로드가 다음 주까지 안 붙었다.
//  · 인스타 열: 「hong 게시물」과 같음. 유튜브 열: 영상 ID · 게시일 · 형식 · 제목 · 설명 · 영상 주소 · 조회 · 좋아요 · 댓글 · 기록 시각. 열 이름을 바꾸면 JJ 서버(AM_CFG.IG_TAB·YT_TAB)도 같이
//  · 유튜브는 일부 공개·비공개(예약 포함)로 확인된 영상을 뺀다(업로드 완료가 먼저 붙지 않게). 조회는 공개 수치(전체 기간)
//  · 요청서: 05_데이터 분석/03_대시보드 작업/2026-10-20_공식 계정 게시물 탭 요청(JJ 스튜디오).md
const OFF_IG_POSTS = 'jjuniv 게시물', OFF_YT_POSTS = '유튜브 게시물';
function officialPostsStep_(ss, logs) {
  const p = PropertiesService.getScriptProperties();
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  if (p.getProperty(IG_CH['인스타그램'].on) !== 'on') logs.push([new Date(), OFF_IG_POSTS, 0, '건너뜀: IG_API 꺼짐']);
  else {
    try {
      const api = IG_API_['인스타그램'] || (IG_API_['인스타그램'] = fetchInstagram_('인스타그램'));
      const rows = api.media.filter(x => x.product !== 'STORY')
        .map(x => [x.id, x.date, typeLabel_(x.product, x.mediaType), x.caption, x.url, x.views, x.likes, x.comments, x.shares, x.saves, x.reach, now]);
      const r = igxUpsert_(ss, OFF_IG_POSTS, ['미디어 ID', '게시일', '형식', '캡션', '게시물 주소', '조회', '좋아요', '댓글', '공유', '저장', '도달', '기록 시각'], [0], rows);
      logs.push([new Date(), OFF_IG_POSTS, rows.length, '정상 (갱신 ' + r.updated + ' · 새 게시물 ' + r.added + ')']);
    } catch (e) { logs.push([new Date(), OFF_IG_POSTS, 0, '오류: ' + e.message]); }
  }
  if (p.getProperty('YT_API') !== 'on') logs.push([new Date(), OFF_YT_POSTS, 0, '건너뜀: YT_API 꺼짐']);
  else {
    try {
      const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      const api = YT_API_ || (YT_API_ = fetchYouTube_(Object.keys(ytLifetime_()), today));
      let priv = {};
      try { priv = ytPrivMap_(); } catch (e) {}
      let hidden = 0;
      const rows = [];
      Object.keys(api.videos).forEach(id => {
        const v = api.videos[id];
        if (priv[id] && priv[id] !== 'public') { hidden++; return; }
        rows.push([id, v.date, lengthBucket_(v.lengthSec), v.title, v.desc, 'https://www.youtube.com/watch?v=' + id, v.views, v.likes, v.comments, now]);
      });
      const r = igxUpsert_(ss, OFF_YT_POSTS, ['영상 ID', '게시일', '형식', '제목', '설명', '영상 주소', '조회', '좋아요', '댓글', '기록 시각'], [0], rows);
      logs.push([new Date(), OFF_YT_POSTS, rows.length, '정상 (갱신 ' + r.updated + ' · 새 영상 ' + r.added + (hidden ? ' · 비공개·일부 공개 뺌 ' + hidden : '') + ')']);
    } catch (e) { logs.push([new Date(), OFF_YT_POSTS, 0, '오류: ' + e.message]); }
  }
}
// 편집기에서 실행: 기록을 기다리지 않고 두 탭을 지금 채움(결과는 「실행 로그」 탭)
function officialPostsNow() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const logs = [];
  officialPostsStep_(ss, logs);
  logRows_(ss, logs);
  Logger.log(JSON.stringify(logs));
}

// 편집기에서 실행: 매일 기록을 기다리지 않고 「hong 게시물」 탭만 지금 채움(결과는 「실행 로그」 탭)
function hongPostsNow() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const logs = [];
  try { hongPostsStep_(ss, logs); } catch (e) { logs.push([new Date(), HONG_POSTS, 0, '오류: ' + e.message]); }
  logRows_(ss, logs);
  Logger.log(JSON.stringify(logs));
}

// 편집기에서 실행: 원본 시트 값과 API 값 비교 (시트에 쓰지 않음, 결과는 실행 로그에 출력)
function testInstagramApi() { testIgApi_('인스타그램'); }
function testHongApi() { testIgApi_('hong._.video'); }
function testIgApi_(chName) {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const on = IG_CH[chName].on, was = props.getProperty(on);
  props.deleteProperty(on);
  let sheet;
  try { sheet = readSource_(SOURCES.filter(s => s.channel === chName)[0], today)[chName] || {}; }
  finally { if (was) props.setProperty(on, was); }
  const api = fetchInstagram_(chName);
  Logger.log('%s 계정 ID %s', IG_CH[chName].user, api.user);
  const m = igMatch_(sheet, api.media);
  const r = { views: [], reach: [], likes: [], saves: [] };
  api.media.forEach(x => {
    const k = m.byId[x.id]; if (!k) return;
    Object.keys(r).forEach(f => { const s = Number(sheet[k][f]); if (s > 20 && x[f] !== '') r[f].push(x[f] / s); });
  });
  const med = a => { a.sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)].toFixed(3) + '(' + a.length + '개)' : '-'; };
  const fresh = api.media.filter(x => !m.byId[x.id] && x.date >= shiftDate_(today, -IG_NEW_DAYS));
  Logger.log('API 게시물 %s개 · 원본 시트 %s개 · 연결 %s개(날짜 같음 %s · 하루 차이 %s · 날짜만 %s) · 캡션 겹침 %s', api.media.length, Object.keys(sheet).length, Object.keys(m.byId).length, m.sameDay, m.offDay, m.dateOnly, m.amb);
  // 연결 안 된 게시물 진단: 시트 날짜 범위, API 쪽 몇 개와 같은 날짜(±1일) 시트 캡션 앞부분(숨은 문자가 보이게 JSON으로)
  const sd = Object.keys(sheet).map(k => sheet[k].date).filter(Boolean).sort();
  const usedK = {}; Object.keys(m.byId).forEach(id => { usedK[m.byId[id]] = 1; });
  Logger.log('원본 시트 날짜 범위 %s ~ %s · 연결 안 된 시트 게시물 %s개', sd[0], sd[sd.length - 1], Object.keys(sheet).filter(k => !usedK[k]).length);
  api.media.filter(x => !m.byId[x.id]).slice(0, 6).forEach(x => {
    const near = Object.keys(sheet).filter(k => !usedK[k] && Math.abs(dayDiff_(sheet[k].date, x.date)) <= 1).map(k => sheet[k].date + ' ' + JSON.stringify(String(sheet[k].full || sheet[k].title).slice(0, 25)));
    Logger.log('미연결 API %s %s ↔ 시트 후보: %s', x.date, JSON.stringify(x.caption.slice(0, 25)), near.join(' | ') || '없음');
  });
  Logger.log('API÷시트 중앙값 — 조회 %s · 도달 %s · 좋아요 %s · 저장 %s (1.000~1.05면 같은 기준, 시트는 월요일 값)', med(r.views), med(r.reach), med(r.likes), med(r.saves));
  Logger.log('「하루 차이」가 많으면 원본 시트 날짜가 다른 시간대 기준 → IG_DATE_TZ를 바꿔야 새 게시물이 월요일에 중복되지 않음');
  Logger.log('시트에 없는 최근 %s일 게시물 %s개: %s', IG_NEW_DAYS, fresh.length, fresh.map(x => x.date + ' ' + x.caption.replace(/\s+/g, ' ').slice(0, 18)).join(' / '));
  if (api.note) Logger.log('참고: %s', api.note);
}

// ───────── 페이스북 페이지 API 시험 (2026-10-19): 받을 수 있는지만 확인, 시트에 쓰지 않음 ─────────
// 편집기에서 testFacebookApi 실행 → 실행 로그에 페이지 찾기·게시물 수·지표별 성공/실패를 출력
//  · 토큰: 메타 광고·인스타와 같은 META_TOKEN(시스템 사용자 sns-board). 페이지가 시스템 사용자에 할당돼 있어야 me/accounts에 보임
//  · 페이지: FB_PAGE(아이디) — 스크립트 속성 FB_PAGE_ID에 숫자 ID를 넣으면 그 값 우선
//  · 지표 이름은 메타가 자주 바꿔서(2025-11 노출 계열 폐지 등) 후보를 하나씩 따로 불러 보고 되는 것만 고른다
const FB_PAGE = 'discoveryjjss';
const FB_FROM = '2021-07-01';                  // 과거 엑셀은 2021-07 이후가 거의 비어 있음(2023 3건·2024 1~2월만) → 그때부터 API로 채움(2026-10-19 2025-01에서 앞당김)
const FB_POST_METRICS = ['post_media_view', 'post_total_media_view_unique', 'post_impressions_unique', 'post_clicks', 'post_reactions_by_type_total', 'post_video_views'];
const FB_PAGE_METRICS = ['page_follows', 'page_daily_follows_unique', 'page_daily_unfollows_unique', 'page_media_view', 'page_total_media_view_unique', 'page_impressions_unique', 'page_post_engagements', 'page_views_total', 'page_video_views'];

// 한 번만 GET(다음 쪽 안 따라감). 오류에는 메타 메시지만 남김
function fbGet1_(token, path, params) {
  const q = Object.keys(params || {}).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(META_API + path + '?' + (q ? q + '&' : '') + 'access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  let j;
  try { j = JSON.parse(res.getContentText()); } catch (e) { throw new Error('메타 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')'); }
  if (j.error) throw new Error((j.error.code === 190 ? '토큰 만료·무효 — ' : '') + 'code ' + j.error.code + ': ' + String(j.error.message || '').replace(/access_token=[^&\s]+/g, 'access_token=…'));
  return j;
}

function testFacebookApi() {
  // 결과는 편집기 실행 로그와 시트 「실행 로그」 탭에 함께 남김(로그 창에서 복사하기 번거로워서)
  const lines = [];
  // 토큰이 섞인 문자열(paging 주소 등)은 남기기 전에 가림 — 2026-10-19 응답 paging.previous에 페이지 토큰이 그대로 찍혔음
  const L = (f, ...a) => { let i = 0; const s = String(f).replace(/%s/g, () => String(a[i++])).replace(/access_token=[^&\s"]+/g, 'access_token=…'); lines.push(s); Logger.log(s); };
  try { testFacebookApi_(L); }
  catch (e) { L('오류: %s', e.message); }
  finally { logRows_(SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID), lines.map(s => [new Date(), '페이스북 시험', 0, s.slice(0, 500)])); }
}
function testFacebookApi_(L) {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('META_TOKEN');
  if (!token) throw new Error('스크립트 속성 META_TOKEN 없음');
  // 1) 페이지 찾기: 시스템 사용자에 할당된 페이지 목록(페이지 토큰 포함 — 로그에 쓰지 않음)
  let pages = [];
  try { pages = metaGet_({ token: token }, 'me/accounts', { fields: 'id,name,username,link,tasks,access_token,instagram_business_account{username}', limit: 100 }); }
  catch (e) { L('me/accounts 실패: %s', e.message); }
  L('토큰에 보이는 페이지 %s개: %s', pages.length, pages.map(x => x.name + '(' + (x.username || '-') + ' · ' + x.id + ' · 인스타 ' + (x.instagram_business_account ? x.instagram_business_account.username : '없음') + ' · 권한 ' + (x.tasks || []).join('/') + ')').join(' | ') || '없음');
  const want = String(p.getProperty('FB_PAGE_ID') || '').trim();
  const page = pages.filter(x => want ? x.id === want : (x.username === FB_PAGE || String(x.link || '').indexOf('/' + FB_PAGE) >= 0))[0];
  if (!page) {
    // 할당 안 된 경우: 공개 페이지로 찾아지는지만 확인
    try { const j = fbGet1_(token, want || FB_PAGE, { fields: 'id,name,link,followers_count' }); L('할당 목록엔 없고 공개 조회는 됨: %s', JSON.stringify(j)); }
    catch (e) { L('공개 조회도 안 됨: %s', e.message); }
    L('→ 비즈니스 설정에서 %s 페이지를 시스템 사용자 sns-board에 할당(콘텐츠·인사이트)한 뒤 다시 실행', FB_PAGE);
    return;
  }
  const pt = page.access_token || token;
  L('페이지 찾음: %s (ID %s) · 페이지 토큰 %s', page.name, page.id, page.access_token ? '있음' : '없음(시스템 사용자 토큰으로 시도)');
  try { L('페이지 정보: %s', JSON.stringify(fbGet1_(pt, page.id, { fields: 'name,link,followers_count,fan_count' }))); }
  catch (e) { L('페이지 정보 실패: %s', e.message); }

  // 2) 게시물: FB_FROM 이후 몇 개까지 받아지는지, 반응·댓글·공유 수가 오는지
  const posts = [];
  let url = META_API + page.id + '/posts?fields=' + encodeURIComponent('id,message,created_time,permalink_url,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)') + '&limit=25&access_token=' + encodeURIComponent(pt); // 100이면 code 1 「Please reduce the amount of data」(2026-10-19)
  try {
    for (let n = 0; url && n < 30; n++) {
      const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
      if (j.error) throw new Error('code ' + j.error.code + ': ' + j.error.message);
      let old = false;
      (j.data || []).forEach(x => { if (Utilities.formatDate(new Date(x.created_time), TZ, 'yyyy-MM-dd') >= FB_FROM) posts.push(x); else old = true; });
      url = !old && j.paging && j.paging.next || '';
    }
  } catch (e) { L('게시물 목록 실패: %s', String(e.message).replace(/access_token=[^&\s]+/g, 'access_token=…')); }
  const d = x => Utilities.formatDate(new Date(x.created_time), TZ, 'yyyy-MM-dd');
  L('%s 이후 게시물 %s개%s', FB_FROM, posts.length, posts.length ? ' · ' + d(posts[posts.length - 1]) + ' ~ ' + d(posts[0]) : '');
  posts.slice(0, 5).forEach(x => L('  %s %s · 반응 %s · 댓글 %s · 공유 %s · %s', d(x), JSON.stringify(String(x.message || '').replace(/\s+/g, ' ').slice(0, 20)),
    x.reactions && x.reactions.summary ? x.reactions.summary.total_count : '-', x.comments && x.comments.summary ? x.comments.summary.total_count : '-', x.shares ? x.shares.count : 0, x.status_type || ''));

  // 3) 게시물 인사이트: 최근 게시물 하나로 지표별 시험
  if (posts[0]) FB_POST_METRICS.forEach(m => {
    try { const j = fbGet1_(pt, posts[0].id + '/insights', { metric: m }); const v = j.data && j.data[0] && j.data[0].values && j.data[0].values[0]; L('  게시물 지표 %s: 됨 %s', m, v ? JSON.stringify(v.value) : '(값 없음)'); }
    catch (e) { L('  게시물 지표 %s: 안 됨 — %s', m, e.message); }
  });

  // 4) 페이지 일별 인사이트: 최근 7일 합
  const until = Math.floor(Date.now() / 1000), since = until - 7 * 86400;
  FB_PAGE_METRICS.forEach(m => {
    try {
      const j = fbGet1_(pt, page.id + '/insights', { metric: m, period: 'day', since: since, until: until });
      const vals = (j.data && j.data[0] && j.data[0].values || []).map(v => Number(v.value) || 0);
      let note = '';
      // 7일 범위로 빈 목록이면(2026-10-19 전부 data: []) 기간 없이 기본값(최근 2일)으로 한 번 더
      if (!vals.length) { const k = fbGet1_(pt, page.id + '/insights', { metric: m, period: 'day' }); note = ' · 기간 없이: ' + JSON.stringify((k.data || []).map(x => (x.values || []).map(v => v.value))).slice(0, 150); }
      L('  페이지 지표 %s: 됨 · 최근 %s일 합 %s%s', m, vals.length, vals.reduce((a, b) => a + b, 0), note); // paging은 토큰이 들어 있어 남기지 않음
    } catch (e) { L('  페이지 지표 %s: 안 됨 — %s', m, e.message); }
  });
}

// ───────── 페이스북 페이지 매일 수집(fb, 2026-10-19): 쌓기만 하고 보드에는 아직 연결하지 않음 ─────────
//  · 「페이스북 일별」  : 날짜별 팔로워·새 팔로우·팔로우 취소·조회·본 사람·반응·페이지 방문·영상 조회. 처음엔 최근 FB_DAY_FIRST일, 이후 최근 7일 다시 씀(늦게 잡히는 값 보정)
//  · 「페이스북 게시물」: FB_FROM 이후 게시물별 반응·댓글·공유 + 조회·본 사람·클릭·반응 종류·영상 조회. 지표는 처음엔 전부, 이후 최근 FB_POST_DAYS일 게시물만 다시 받음(그 전 값은 유지)
//  · 켜기: 스크립트 속성 FB_API = on. 토큰은 META_TOKEN(pages_read_user_content·read_insights 포함, 2026-10-19 재발급)
//  · 메타의 「day」는 태평양 시간 기준 하루라 우리 날짜와 몇 시간 어긋난다(인스타 계정 일별과 같음)
const FB_DAY_SHEET = '페이스북 일별', FB_POST_SHEET = '페이스북 게시물';
const FB_DAY_HEAD = ['날짜', '팔로워', '새 팔로우', '팔로우 취소', '조회', '본 사람', '반응', '페이지 방문', '영상 조회', '기록 시각'];
const FB_DAY_M = ['page_follows', 'page_daily_follows_unique', 'page_daily_unfollows_unique', 'page_media_view', 'page_total_media_view_unique', 'page_post_engagements', 'page_views_total', 'page_video_views'];
const FB_POST_HEAD = ['게시물 ID', '게시 시각', '유형', '게시물 주소', '글', '반응', '댓글', '공유', '조회', '본 사람', '클릭', '반응 종류', '영상 조회', '기록 시각'];
const FB_POST_M = ['post_media_view', 'post_total_media_view_unique', 'post_clicks', 'post_reactions_by_type_total', 'post_video_views'];
const FB_DAY_FIRST = 90;     // 처음 채울 때 거슬러 갈 날 수(메타 한 번 요청 한도 90일)
const FB_POST_DAYS = 60;     // 매일 지표를 다시 받는 최근 게시물 기간

// 시스템 사용자에 할당된 페이지와 페이지 토큰
function fbPage_(token) {
  const want = String(PropertiesService.getScriptProperties().getProperty('FB_PAGE_ID') || '').trim();
  const pages = metaGet_({ token: token }, 'me/accounts', { fields: 'id,username,link,access_token', limit: 100 });
  const page = pages.filter(x => want ? x.id === want : (x.username === FB_PAGE || String(x.link || '').indexOf('/' + FB_PAGE) >= 0))[0];
  if (!page) throw new Error(FB_PAGE + ' 페이지가 토큰에 보이지 않음(시스템 사용자 자산 할당 확인)');
  return { id: page.id, pt: page.access_token || token };
}
// 인사이트 여러 지표를 한 번에, 실패하면 지표마다 따로(안 되는 지표는 miss에)
function fbInsights_(pt, id, metrics, extra, miss) {
  const get = m => fbGet1_(pt, id + '/insights', Object.assign({ metric: m }, extra || {})).data || [];
  try { return get(metrics.join(',')); }
  catch (e) {
    const out = [];
    metrics.forEach(m => { try { Array.prototype.push.apply(out, get(m)); } catch (e2) { if (miss.indexOf(m) < 0) miss.push(m); } });
    return out;
  }
}
// 기존 줄의 값을 바탕으로 빈칸만 남기고 덮어씀(지표를 다시 받지 않은 옛 게시물 값 유지)
function fbMerge_(ss, name, head, rows) {
  const sh = ss.getSheetByName(name);
  const old = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().forEach(r => { old[String(r[0] instanceof Date ? fmtDate_(r[0]) : r[0])] = r; });
  return rows.map(r => { const b = old[String(r[0])]; return b ? r.map((v, i) => (v === '' || v == null) ? (b[i] instanceof Date ? fmtDate_(b[i]) : b[i]) : v) : r; });
}

function fbDaily_(ss, c, today, miss) {
  const sh = ss.getSheetByName(FB_DAY_SHEET);
  const first = !sh || sh.getLastRow() < 2;
  const unix = d => Math.floor(new Date(d + 'T00:00:00+09:00').getTime() / 1000);
  const data = fbInsights_(c.pt, c.id, FB_DAY_M, { period: 'day', since: unix(shiftDate_(today, first ? -FB_DAY_FIRST : -7)), until: unix(today) }, miss);
  const by = {};
  data.forEach(d => (d.values || []).forEach(v => {
    const day = shiftDate_(Utilities.formatDate(new Date(v.end_time), TZ, 'yyyy-MM-dd'), -1); // end_time = 그 날이 끝난 시각
    (by[day] = by[day] || {})[d.name] = Number(v.value) || 0;
  }));
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const rows = Object.keys(by).sort().map(day => [day].concat(FB_DAY_M.map(m => by[day][m] === undefined ? '' : by[day][m])).concat([now]));
  if (rows.length) igxUpsert_(ss, FB_DAY_SHEET, FB_DAY_HEAD, [0], fbMerge_(ss, FB_DAY_SHEET, FB_DAY_HEAD, rows));
  return rows.length;
}

// 일별 과거 채우기: 탭의 가장 이른 날짜 앞으로 90일씩 거슬러 받음. 값이 하나도 없는 구간이 나오면(메타 보관 기간 끝) 스크립트 속성 FB_DAY_BACK = done
function fbDailyBack_(ss, c, miss, deadline) {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('FB_DAY_BACK') === 'done') return { n: 0, done: true };
  const unix = d => Math.floor(new Date(d + 'T00:00:00+09:00').getTime() / 1000);
  const sh = ss.getSheetByName(FB_DAY_SHEET);
  if (!sh || sh.getLastRow() < 2) return { n: 0, done: false };
  let to = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().map(r => r[0]).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()[0];
  let n = 0, done = false;
  while (to > FB_FROM && !(deadline && Date.now() > deadline)) {
    const from = shiftDate_(to, -FB_DAY_FIRST) < FB_FROM ? FB_FROM : shiftDate_(to, -FB_DAY_FIRST);
    const by = {};
    fbInsights_(c.pt, c.id, FB_DAY_M, { period: 'day', since: unix(from), until: unix(to) }, miss).forEach(d => (d.values || []).forEach(v => {
      const day = shiftDate_(Utilities.formatDate(new Date(v.end_time), TZ, 'yyyy-MM-dd'), -1);
      if (day < to) (by[day] = by[day] || {})[d.name] = Number(v.value) || 0;
    }));
    const days = Object.keys(by).sort().filter(day => FB_DAY_M.some(m => by[day][m]));  // 0만 있는 날은 보관 기간 밖으로 봄
    if (!days.length) { done = true; break; }
    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    igxUpsert_(ss, FB_DAY_SHEET, FB_DAY_HEAD, [0], days.map(day => [day].concat(FB_DAY_M.map(m => by[day][m] === undefined ? '' : by[day][m])).concat([now])));
    n += days.length;
    to = days[0];
  }
  if (done || to <= FB_FROM) { p.setProperty('FB_DAY_BACK', 'done'); done = true; }
  return { n: n, done: done, to: to };
}

// 지표는 최근 FB_POST_DAYS일 게시물 + 아직 탭에 없는 게시물만 받음. deadline이 지나면 지표가 필요한 게시물은 탭에 쓰지 않고 남겨 둠 → 다음 실행이 이어서 받음
function fbPosts_(ss, c, today, miss, deadline) {
  const sh = ss.getSheetByName(FB_POST_SHEET);
  const have = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(r => { have[r[0]] = 1; });
  const recent = shiftDate_(today, -FB_POST_DAYS);
  const list = [];
  let url = META_API + c.id + '/posts?fields=' + encodeURIComponent('id,message,created_time,permalink_url,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)') + '&limit=25&access_token=' + encodeURIComponent(c.pt);
  let end = '더 없음';
  for (let n = 0; url; n++) {
    if (n >= 60) { end = '쪽 한도'; break; }
    let j;
    try { j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText()); } catch (e) { throw new Error('메타 응답을 읽지 못함'); }
    if (j.error) throw new Error('code ' + j.error.code + ': ' + String(j.error.message || '').replace(/access_token=[^&\s"]+/g, 'access_token=…'));
    let old = false;
    (j.data || []).forEach(x => { if (Utilities.formatDate(new Date(x.created_time), TZ, 'yyyy-MM-dd') >= FB_FROM) list.push(x); else old = true; });
    if (old) { end = FB_FROM + ' 이전 도달'; break; }
    url = j.paging && j.paging.next || '';
  }
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  let ins = 0, left = 0;
  const rows = [];
  list.forEach(x => {
    const at = Utilities.formatDate(new Date(x.created_time), TZ, 'yyyy-MM-dd HH:mm');
    const v = {};
    if (!have[String(x.id)] || at.slice(0, 10) >= recent) {
      if (deadline && Date.now() > deadline) { if (!have[String(x.id)]) { left++; return; } } // 시간이 모자라면 새 게시물은 다음 실행으로
      else {
        fbInsights_(c.pt, x.id, FB_POST_M, null, miss).forEach(d => { const a = d.values && d.values[0] ? d.values[0].value : ''; v[d.name] = typeof a === 'object' && a !== null ? JSON.stringify(a) : a; });
        ins++;
      }
    }
    const g = m => v[m] === undefined ? '' : v[m];
    rows.push([String(x.id), at, x.status_type || '', x.permalink_url || '', String(x.message || '').slice(0, 1000),
      x.reactions && x.reactions.summary ? x.reactions.summary.total_count : '', x.comments && x.comments.summary ? x.comments.summary.total_count : '', x.shares ? x.shares.count : 0,
      g('post_media_view'), g('post_total_media_view_unique'), g('post_clicks'), g('post_reactions_by_type_total'), g('post_video_views'), now]);
  });
  const r = rows.length ? igxUpsert_(ss, FB_POST_SHEET, FB_POST_HEAD, [0], fbMerge_(ss, FB_POST_SHEET, FB_POST_HEAD, rows)) : { added: 0 };
  return { n: rows.length, added: r.added, ins: ins, end: end, left: left, from: list.length ? list[list.length - 1].created_time.slice(0, 10) : '' };
}

// 매일 기록 단계(fb). 「끝」은 게시물 목록이 어디서 멈췄는지 — 「더 없음」이면 메타가 준 게시물이 전부(개수 상한 확인용)
// sec: 이 단계에 쓸 시간(초). 매일 기록 때는 다른 단계 몫을 남기려고 짧게, facebookNow는 길게 — 모자라면 다음 실행이 이어서 받음
function fbStep_(ss, today, logs, sec) {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('FB_API') !== 'on') { logs.push([new Date(), '페이스북', 0, '건너뜀: FB_API 꺼짐']); return; }
  const token = p.getProperty('META_TOKEN');
  if (!token) { logs.push([new Date(), '페이스북', 0, '건너뜀: META_TOKEN 없음']); return; }
  const deadline = Date.now() + (sec || 90) * 1000;
  const c = fbPage_(token), parts = [], miss = [];
  try { parts.push('일별 ' + fbDaily_(ss, c, today, miss) + '일'); } catch (e) { parts.push('일별 오류: ' + String(e.message).slice(0, 120)); }
  try { const r = fbPosts_(ss, c, today, miss, deadline); if (!r.left && r.end !== '쪽 한도') p.setProperty('FB_POST_BACK', 'done'); else p.deleteProperty('FB_POST_BACK'); parts.push('게시물 ' + r.n + '개(' + r.from + '~ · 새 ' + r.added + ' · 지표 받음 ' + r.ins + (r.left ? ' · 다음에 이어서 ' + r.left : '') + ' · 끝: ' + r.end + ')'); } catch (e) { parts.push('게시물 오류: ' + String(e.message).slice(0, 120)); }
  try { const b = fbDailyBack_(ss, c, miss, deadline); if (b.n || !b.done) parts.push('일별 과거 ' + b.n + '일' + (b.done ? '(끝)' : '(다음에 이어서, ' + (b.to || '') + '까지 받음)')); } catch (e) { parts.push('일별 과거 오류: ' + String(e.message).slice(0, 120)); }
  logs.push([new Date(), '페이스북', 0, parts.join(' · ') + (miss.length ? ' · 받지 못한 지표: ' + miss.join(', ') : '')]);
}
// 편집기·메뉴에서 바로 한 번(처음 켤 때)
function facebookNow() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const logs = [];
  try { fbStep_(ss, Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), logs, 280); } catch (e) { logs.push([new Date(), '페이스북', 0, '오류: ' + e.message]); }
  logRows_(ss, logs);
  logs.forEach(l => Logger.log(l[3]));
}

// 과거 채우기 자동 이어서(2026-10-19): 게시물 지표(FB_POST_BACK)·일별 과거(FB_DAY_BACK)가 다 끝날 때까지 1분 뒤 자기 자신을 다시 예약.
// 시작은 storySnapshot(2시간마다)의 ensureFbBackfill_이 맡아 사람이 누르지 않아도 됨. 같은 오류가 반복돼도 20번에서 멈춤(FB_BF_RUNS)
function fbBackfill() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'fbBackfill').forEach(t => ScriptApp.deleteTrigger(t));
  const p = PropertiesService.getScriptProperties();
  facebookNow();
  const done = p.getProperty('FB_POST_BACK') === 'done' && p.getProperty('FB_DAY_BACK') === 'done';
  const runs = Number(p.getProperty('FB_BF_RUNS') || 0) + 1;
  p.setProperty('FB_BF_RUNS', String(done ? 0 : runs));
  if (!done && runs < 20) ScriptApp.newTrigger('fbBackfill').timeBased().after(60 * 1000).create();
  else logRows_(SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID), [[new Date(), '페이스북', 0, done ? '과거 채우기 끝' : '과거 채우기 자동 반복 20번에서 멈춤 — 실행 로그의 오류를 확인하세요']]);
}
function ensureFbBackfill_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('FB_API') !== 'on' || Number(p.getProperty('FB_BF_RUNS') || 0) >= 20) return;
  if (p.getProperty('FB_POST_BACK') === 'done' && p.getProperty('FB_DAY_BACK') === 'done') return;
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'fbBackfill')) return;
  ScriptApp.newTrigger('fbBackfill').timeBased().after(60 * 1000).create();
}

// ───────── 유튜브 분석 API: 「전주대학교」 브랜드 계정으로 한 번 승인받기 ─────────
// 채널이 브랜드 계정이라 Apps Script 기본 권한(개인 계정)으로는 분석 API가 Forbidden이다.
// 구글 클라우드에서 만든 OAuth 클라이언트로 브랜드 계정을 골라 승인받고, 갱신 토큰을 스크립트 속성에 둔다.
// 승인 뒤 돌아오는 곳은 http://localhost(열리지 않는 주소)다. 브랜드 계정을 고르면 브라우저가 브랜드 계정으로 바뀌어
// 스크립트 전용 콜백(…/usercallback)은 「인증이 필요합니다」로 막히기 때문 — 대신 주소창의 코드를 붙여 넣어 마무리한다.
//  · 스크립트 속성: YT_OAUTH_ID(클라이언트 ID) · YT_OAUTH_SECRET(클라이언트 보안 비밀) — 사람이 넣음
//                   YT_AUTH_CODE — 승인 뒤 열리지 않는 페이지의 주소창 주소 전체를 사람이 붙여 넣음(마무리 후 자동 삭제)
//                   YT_REFRESH(갱신 토큰) — 마무리 때 자동 저장. 코드·저장소·로그에 값을 쓰지 않음
//  · 클라우드 콘솔 OAuth 클라이언트의 「승인된 리디렉션 URI」에 http://localhost 가 있어야 한다
//  · 순서: 메뉴 「유튜브 분석 승인」 → 「실행 로그」 탭 링크 → 「전주대학교」 채널 허용 → 주소창 주소를 YT_AUTH_CODE에 → 메뉴 「유튜브 분석 승인 마무리」(10분 안)
const YT_SCOPES = 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly';
const YT_REDIRECT = 'http://localhost';

function ytAuthorize() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('YT_OAUTH_ID');
  if (!id || !p.getProperty('YT_OAUTH_SECRET')) throw new Error('스크립트 속성 YT_OAUTH_ID·YT_OAUTH_SECRET을 먼저 넣으세요');
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + [
    ['client_id', id], ['redirect_uri', YT_REDIRECT], ['response_type', 'code'], ['scope', YT_SCOPES],
    ['access_type', 'offline'], ['prompt', 'consent select_account'],
  ].map(x => x[0] + '=' + encodeURIComponent(x[1])).join('&');
  // 누를 수 있는 링크를 「실행 로그」 탭 맨 아래에 씀(로그 창의 긴 주소는 복사하다 끊기기 쉬움)
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  logRows_(ss, [[new Date(), '유튜브 분석 승인', 0, '아래 링크 → 「전주대학교」 채널 허용 → 열리지 않는 페이지의 주소창 주소 전체를 스크립트 속성 YT_AUTH_CODE에 → 메뉴 「유튜브 분석 승인 마무리」(10분 안)']]);
  const log = ss.getSheetByName(LOG), row = log.getLastRow() + 1;
  log.getRange(row, 1, 1, 4).setValues([[new Date(), '유튜브 분석 승인', 0, '']]);
  log.getRange(row, 4).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('▶ 유튜브 분석 승인하기 (클릭)').setLinkUrl(url).build());
  try { log.activate(); log.getRange(row, 4).activate(); } catch (e) {}
  Logger.log(url);
}

// 승인 마무리: YT_AUTH_CODE(주소창 주소 전체 또는 코드만) → 갱신 토큰 저장
function ytAuthFinish() {
  const p = PropertiesService.getScriptProperties();
  const raw = String(p.getProperty('YT_AUTH_CODE') || '').trim();
  const m = raw.match(/[?&]code=([^&#\s]+)/);
  const code = m ? decodeURIComponent(m[1]) : raw;
  if (!code) throw new Error('스크립트 속성 YT_AUTH_CODE에 승인 후 주소창 주소를 먼저 넣으세요');
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true, payload: {
    code: code, client_id: p.getProperty('YT_OAUTH_ID'), client_secret: p.getProperty('YT_OAUTH_SECRET'),
    redirect_uri: YT_REDIRECT, grant_type: 'authorization_code' } });
  p.deleteProperty('YT_AUTH_CODE'); // 한 번만 쓰는 코드라 성공·실패와 관계없이 지움
  const j = JSON.parse(res.getContentText() || '{}');
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  if (!j.refresh_token) {
    const msg = '실패: ' + (j.error_description || j.error || ('HTTP ' + res.getResponseCode())) + ' — 코드는 10분 안에 한 번만 쓸 수 있어요. 메뉴 「유튜브 분석 승인」부터 다시';
    logRows_(ss, [[new Date(), '유튜브 분석 승인 마무리', 0, msg]]);
    throw new Error(msg);
  }
  p.setProperty('YT_REFRESH', j.refresh_token);
  CacheService.getScriptCache().remove('ytBrandToken');
  let ch = '';
  try {
    const c = JSON.parse(UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: 'Bearer ' + j.access_token } }).getContentText());
    ch = c.items && c.items[0] ? c.items[0].snippet.title : '';
  } catch (e) {}
  logRows_(ss, [[new Date(), '유튜브 분석 승인 마무리', 1, '승인 완료 — 채널: ' + (ch || '확인 못 함') + ' · testYouTubeApi로 「분석 값 있음」 확인']]);
  Logger.log('승인 완료 — 채널: %s', ch || '확인 못 함');
}

// 갱신 토큰 → 접근 토큰(50분 캐시). 승인 전이면 ''
function ytBrandToken_() {
  const p = PropertiesService.getScriptProperties();
  const rt = p.getProperty('YT_REFRESH');
  if (!rt) return '';
  const cache = CacheService.getScriptCache();
  const hit = cache.get('ytBrandToken');
  if (hit) return hit;
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', muteHttpExceptions: true, payload: {
    client_id: p.getProperty('YT_OAUTH_ID'), client_secret: p.getProperty('YT_OAUTH_SECRET'), refresh_token: rt, grant_type: 'refresh_token' } });
  const j = JSON.parse(res.getContentText() || '{}');
  if (!j.access_token) throw new Error('유튜브 브랜드 계정 토큰 갱신 실패(' + (j.error || res.getResponseCode()) + ') — ytAuthorize로 다시 승인');
  cache.put('ytBrandToken', j.access_token, 3000);
  return j.access_token;
}

// ───────── 인스타: 지나면 다시 받을 수 없는 데이터 쌓기 ─────────
// API가 과거를 돌려주지 않아 매일(스토리는 2시간마다) 받아 두어야 하는 것만 모은다. 채널은 IG_CH 중 켜진 것(IG_API·HONG_API = on).
//  · 「인스타 스토리」      : 스토리는 게시 24시간 뒤 사라지면 지표도 못 받음 → storySnapshot(2시간마다)이 살아 있는 스토리의 최신 값을 덮어씀
//  · 「인스타 계정 일별」   : 팔로워 수(그날 값만 줌)·하루 새 팔로워·도달·프로필 방문·링크 클릭(API는 최근 30일 정도만 줌)
//  · 「인스타 팔로워 분포」 : 팔로워 연령·성별·도시(지금 시점 값만 줌) → 월요일마다 한 번 기록
// 지표 이름은 메타가 자주 바꾼다. 받을 수 없는 지표는 빈칸으로 두고 「실행 로그」에 남김(나머지는 계속 받음).
const IGX_STORY_SHEET = '인스타 스토리', IGX_DAY_SHEET = '인스타 계정 일별', IGX_DEMO_SHEET = '인스타 팔로워 분포';
const IGX_STORY_HEAD = ['채널', '스토리 ID', '게시 시각', '유형', '링크', '조회', '도달', '답장', '공유', '상호작용', '팔로우', '프로필 방문', '탭 다음', '탭 이전', '나가기', '다음 스토리', '마지막 수집'];
const IGX_STORY_M = ['views', 'reach', 'replies', 'shares', 'total_interactions', 'follows', 'profile_visits'];
const IGX_DAY_HEAD = ['채널', '날짜', '팔로워', '팔로잉', '게시물 수', '새 팔로워', '도달', '조회', '프로필 방문', '링크 클릭', '참여 계정', '기록 시각'];
const IGX_DAY_M = ['reach', 'views', 'profile_views', 'website_clicks', 'accounts_engaged'];
const IGX_DEMO_HEAD = ['기록일', '채널', '구분', '항목', '팔로워 수'];

let IGX_CH_ = null;
function igxChannels_() {
  if (IGX_CH_) return IGX_CH_;
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty('META_TOKEN');
  if (!token) return [];
  // 계정을 못 찾는 채널(예: 아직 연결 안 된 hong)은 빼고 나머지로 진행
  return (IGX_CH_ = Object.keys(IG_CH).filter(ch => p.getProperty(IG_CH[ch].on) === 'on').map(ch => {
    try { return { ch: ch, conf: { token: token }, user: igUserId_(ch, { token: token }) }; } catch (e) { return null; }
  }).filter(Boolean));
}
// 인스타 계정 ID: 속성(IG_USER 등)에 있으면 그것, 없으면 토큰에 연결된 페이지에서 찾음
function igUserId_(chName, conf) {
  const cf = IG_CH[chName];
  const fixed = String(PropertiesService.getScriptProperties().getProperty(cf.prop) || '').trim();
  if (fixed) return fixed;
  const igs = metaGet_(conf, 'me/accounts', { fields: 'instagram_business_account{id,username}', limit: 100 }).map(x => x.instagram_business_account).filter(Boolean);
  const pick = igs.filter(x => x.username === cf.user)[0];
  if (!pick) throw new Error(cf.user + ' 계정을 토큰에서 찾지 못함');
  return pick.id;
}
// GET 한 번(쪽 넘김 없음). 오류는 메타 메시지만
function igxGet_(conf, path, params) {
  const q = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch(META_API + path + '?' + q + '&access_token=' + encodeURIComponent(conf.token), { muteHttpExceptions: true });
  let j;
  try { j = JSON.parse(res.getContentText()); } catch (e) { throw new Error('메타 응답을 읽지 못함(HTTP ' + res.getResponseCode() + ')'); }
  if (j.error) throw new Error('code ' + j.error.code + ': ' + String(j.error.message || '').replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 160));
  return j;
}
// 인사이트 값 → {지표: 값}. 한꺼번에 실패하면 지표마다 따로 받아 되는 것만 씀. 안 되는 지표는 miss에 모음
function igxInsights_(conf, id, metrics, extra, miss) {
  const read = data => {
    const o = {};
    (data || []).forEach(d => {
      const v = d.total_value ? d.total_value.value : (d.values && d.values.length ? d.values[d.values.length - 1].value : '');
      o[d.name] = typeof v === 'number' ? v : (v === '' || v == null ? '' : Number(v) || 0);
    });
    return o;
  };
  try { return read(igxGet_(conf, id + '/insights', Object.assign({ metric: metrics.join(',') }, extra || {})).data); }
  catch (e) {
    const o = {};
    metrics.forEach(m => {
      try { Object.assign(o, read(igxGet_(conf, id + '/insights', Object.assign({ metric: m }, extra || {})).data)); }
      catch (e2) { if (miss && miss.indexOf(m) < 0) miss.push(m); }
    });
    return o;
  }
}
// 행 머리글이 있는 탭을 키(열 번호들)로 덮어쓰거나 덧붙임
function igxUpsert_(ss, name, head, keyCols, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  // 열 구성이 바뀌었으면(머리글이 다르면) 탭을 비우고 새로 씀 — 예전 줄이 엉뚱한 열에 남지 않게
  if (sh.getLastRow() > 0 && sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), head.length)).getDisplayValues()[0].join('§').replace(/§+$/, '') !== head.join('§')) sh.clear();
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  const n = sh.getLastRow() - 1;
  const old = n > 0 ? sh.getRange(2, 1, n, head.length).getValues() : [];
  const key = r => keyCols.map(i => String(r[i] instanceof Date ? fmtDate_(r[i]) : r[i])).join('§');
  const at = {};
  old.forEach((r, i) => { at[key(r)] = i; });
  const add = [];
  // 같은 키가 이번 묶음 안에 두 번 오면 덧붙인 줄을 바꿈(예전엔 빈 줄이 생겨 「열 수가 일치하지 않음」)
  rows.forEach(r => { const k = key(r); if (!(k in at)) { at[k] = old.length + add.length; add.push(r); } else if (at[k] < old.length) old[at[k]] = r; else add[at[k] - old.length] = r; });
  const all = old.concat(add);
  if (all.length) {
    keyCols.forEach(i => sh.getRange(2, i + 1, all.length, 1).setNumberFormat('@')); // 채널·ID·날짜는 글자로(긴 ID가 숫자로 바뀌지 않게), 지표는 숫자 그대로
    sh.getRange(2, 1, all.length, head.length).setValues(all.map(r => r.map((v, i) => v == null ? '' : keyCols.indexOf(i) >= 0 ? String(v instanceof Date ? fmtDate_(v) : v) : v)));
  }
  return { updated: rows.length - add.length, added: add.length };
}

// 스토리: 지금 살아 있는 스토리의 지표를 받아 「인스타 스토리」에 덮어씀(2시간마다 + 매일 기록 때)
function igxStories_(ss) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const rows = [], miss = [];
  igxChannels_().forEach(c => {
    const list = igxGet_(c.conf, c.user + '/stories', { fields: 'id,timestamp,media_type,media_product_type,permalink', limit: 100 }).data || [];
    list.forEach(s => {
      const v = igxInsights_(c.conf, s.id, IGX_STORY_M, null, miss);
      let nav = {};
      try {
        const d = igxGet_(c.conf, s.id + '/insights', { metric: 'navigation', breakdown: 'story_navigation_action_type' }).data || [];
        ((d[0] && d[0].total_value && d[0].total_value.breakdowns && d[0].total_value.breakdowns[0].results) || [])
          .forEach(x => { nav[String(x.dimension_values[0]).toUpperCase()] = x.value; });
      } catch (e) { if (miss.indexOf('navigation') < 0) miss.push('navigation'); }
      rows.push([c.ch, String(s.id), Utilities.formatDate(new Date(s.timestamp), TZ, 'yyyy-MM-dd HH:mm'), s.media_type || '', s.permalink || '']
        .concat(IGX_STORY_M.map(m => v[m] === undefined ? '' : v[m]))
        .concat(['TAP_FORWARD', 'TAP_BACK', 'TAP_EXIT', 'SWIPE_FORWARD'].map(k => nav[k] === undefined ? '' : nav[k]))
        .concat([now]));
    });
  });
  const r = rows.length ? igxUpsert_(ss, IGX_STORY_SHEET, IGX_STORY_HEAD, [0, 1], rows) : { updated: 0, added: 0 };
  return { n: rows.length, added: r.added, miss: miss };
}

// 계정 일별: 오늘 기준 팔로워 수 + 어제 하루 지표 + 새 팔로워 최근 30일
function igxAccountDay_(ss, today) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const yday = shiftDate_(today, -1);
  const unix = d => Math.floor(new Date(d + 'T00:00:00+09:00').getTime() / 1000);
  const rows = [], miss = [];
  igxChannels_().forEach(c => {
    const u = igxGet_(c.conf, c.user, { fields: 'followers_count,follows_count,media_count' });
    const day = igxInsights_(c.conf, c.user, IGX_DAY_M, { period: 'day', metric_type: 'total_value', since: unix(yday), until: unix(today) }, miss);
    // 새 팔로워(하루씩): 매번 최근 30일(API 한도)을 다시 받음 — 메타가 1~2일 늦게 잡는 날, 나중에 켠 채널(hong, 2026-10-17)도 빈칸이 남지 않게 (2026-10-20)
    const nf = {};
    try {
      const d = igxGet_(c.conf, c.user + '/insights', { metric: 'follower_count', period: 'day', since: unix(shiftDate_(today, -29)), until: unix(today) }).data || [];
      ((d[0] && d[0].values) || []).forEach(x => { nf[shiftDate_(Utilities.formatDate(new Date(x.end_time), TZ, 'yyyy-MM-dd'), -1)] = x.value; });
    } catch (e) { miss.push('follower_count'); }
    Object.keys(nf).filter(d => d !== yday).forEach(d => rows.push([c.ch, d, '', '', '', nf[d], '', '', '', '', '', now]));
    rows.push([c.ch, yday, '', '', '', nf[yday] === undefined ? '' : nf[yday]].concat(IGX_DAY_M.map(m => day[m] === undefined ? '' : day[m])).concat([now]));
    rows.push([c.ch, today, u.followers_count, u.follows_count, u.media_count, '', '', '', '', '', '', now]);
  });
  // 같은 날짜 줄이 둘(어제 지표 / 오늘 팔로워 수)로 나뉘므로 기존 값과 합쳐 씀
  const sh2 = ss.getSheetByName(IGX_DAY_SHEET);
  const old = {};
  if (sh2 && sh2.getLastRow() > 1) sh2.getRange(2, 1, sh2.getLastRow() - 1, IGX_DAY_HEAD.length).getValues().forEach(r => { old[r[0] + '§' + fmtDate_(r[1])] = r; });
  const merged = {};
  rows.forEach(r => {
    const k = r[0] + '§' + r[1];
    const base = merged[k] || old[k] || r.map(() => '');
    merged[k] = r.map((v, i) => (v === '' || v == null) ? (base[i] instanceof Date ? fmtDate_(base[i]) : base[i]) : v);
  });
  const out = Object.keys(merged).map(k => merged[k]).sort((a, b) => (a[0] + a[1] < b[0] + b[1] ? -1 : 1));
  igxUpsert_(ss, IGX_DAY_SHEET, IGX_DAY_HEAD, [0, 1], out);
  return { n: out.length, miss: miss };
}

// 팔로워 분포(연령·성별·도시): 월요일 또는 탭이 비어 있을 때 한 번
function igxDemographics_(ss, today) {
  const sh = ss.getSheetByName(IGX_DEMO_SHEET);
  if (sh && sh.getLastRow() > 1 && !isMonday_(today)) return { n: 0, skip: true, miss: [] };
  const rows = [], miss = [];
  igxChannels_().forEach(c => {
    ['age', 'gender', 'city', 'country'].forEach(b => {
      try {
        const d = igxGet_(c.conf, c.user + '/insights', { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: b }).data || [];
        ((d[0] && d[0].total_value && d[0].total_value.breakdowns && d[0].total_value.breakdowns[0].results) || [])
          .forEach(x => rows.push([today, c.ch, ({ age: '연령', gender: '성별', city: '도시', country: '국가' })[b], String(x.dimension_values[0]), x.value]));
      } catch (e) { miss.push('follower_demographics/' + b); }
    });
  });
  if (rows.length) igxUpsert_(ss, IGX_DEMO_SHEET, IGX_DEMO_HEAD, [0, 1, 2, 3], rows);
  return { n: rows.length, miss: miss };
}

// 매일 기록 단계(igx): 스토리 + 계정 일별 + (월요일) 팔로워 분포. 스토리 2시간 트리거도 여기서 챙김
function igxStep_(ss, today, logs) {
  if (!igxChannels_().length) { logs.push([new Date(), '인스타 추가 수집', 0, '건너뜀: META_TOKEN 또는 IG_API 꺼짐']); return; }
  ensureStoryTrigger_();
  const parts = [], miss = [];
  try { const s = igxStories_(ss); parts.push('스토리 ' + s.n + '개(새 ' + s.added + ')'); miss.push.apply(miss, s.miss); } catch (e) { parts.push('스토리 오류: ' + e.message); }
  try { const a = igxAccountDay_(ss, today); parts.push('계정 일별 ' + a.n + '줄'); miss.push.apply(miss, a.miss); } catch (e) { parts.push('계정 일별 오류: ' + e.message); }
  try { const f = igxFollowTypeDays_(ss, today, 3); parts.push('팔로워 구분 ' + f.n + '줄'); miss.push.apply(miss, f.miss); } catch (e) { parts.push('팔로워 구분 오류: ' + e.message); }
  try { const a = igxDayMoreDays_(ss, today, 3); parts.push('계정 일별 추가 ' + a.n + '줄'); miss.push.apply(miss, a.miss); } catch (e) { parts.push('계정 일별 추가 오류: ' + e.message); }
  try { const r = igxReachedDemo_(ss, today); parts.push(r.skip ? '도달·반응 분포는 월요일' : '도달·반응 분포 ' + r.n + '줄'); miss.push.apply(miss, r.miss); } catch (e) { parts.push('도달·반응 분포 오류: ' + e.message); }
  try {
    const m = igxComments_(ss, today, shiftDate_(today, -30), Date.now() + 60 * 1000);
    parts.push(m.perm ? '댓글: 권한 없음(토큰에 instagram_manage_comments 필요)' : '댓글 ' + m.n + '개(게시물 ' + m.posts + '개)');
    const p = PropertiesService.getScriptProperties(), dn = JSON.parse(p.getProperty('BACKFILL_DONE') || '{}');
    if (!m.perm && dn.igCm2 === 'perm') { dn.igCm2 = 0; p.setProperty('BACKFILL_DONE', JSON.stringify(dn)); } // 권한이 생기면 과거 댓글 채우기를 다시 시작
  } catch (e) { parts.push('댓글 오류: ' + String(e.message).slice(0, 100)); }
  try { parts.push('태그된 게시물 ' + igxTags_(ss, today) + '개'); } catch (e) { parts.push(/code (10|200|3)\b/.test(e.message) ? '태그된 게시물: 권한 없음' : '태그된 게시물 오류: ' + String(e.message).slice(0, 100)); }
  try { const d = igxDemographics_(ss, today); parts.push(d.skip ? '분포는 월요일' : '분포 ' + d.n + '줄'); miss.push.apply(miss, d.miss); } catch (e) { parts.push('분포 오류: ' + e.message); }
  logs.push([new Date(), '인스타 추가 수집', 0, parts.join(' · ') + (miss.length ? ' · 받지 못한 지표: ' + Array.from(new Set(miss)).join(', ') : '')]);
}

// 2시간마다(트리거): 스토리만. 새 스토리가 있거나 오류일 때만 로그를 남김(로그 탭이 넘치지 않게)
function storySnapshot() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  try { ensureTriggers_(); } catch (e) {}
  try { logMirror_(); } catch (e) {}
  try { ensureBackfill_(); } catch (e) {}
  try { ensureFbBackfill_(); } catch (e) {}
  try {
    if (!igxChannels_().length) return;
    const s = igxStories_(ss);
    if (s.added || s.miss.length) logRows_(ss, [[new Date(), '인스타 스토리', s.n, '정상 — 새 스토리 ' + s.added + '개' + (s.miss.length ? ' · 받지 못한 지표: ' + s.miss.join(', ') : '')]]);
  } catch (e) {
    logRows_(ss, [[new Date(), '인스타 스토리', 0, '오류: ' + e.message]]);
  }
  try {
    if (PropertiesService.getScriptProperties().getProperty('YT_REFRESH')) {
      const before = JSON.stringify(ytPrivMap_());
      ytaPrivacy_(ss, Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'));
      if (JSON.stringify(ytPrivMap_()) !== before) dropCache_();
    }
  } catch (e) {}
  try { collabStep_(ss); } catch (e) { logRows_(ss, [[new Date(), COLLAB_SHEET, 0, '오류: ' + String(e.message).slice(0, 150)]]); }
  try { postHourly_(ss); } catch (e) { logRows_(ss, [[new Date(), HOURLY_SHEET, 0, '오류: ' + String(e.message).slice(0, 150)]]); }
}
function ensureStoryTrigger_() {
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'storySnapshot')) return;
  ScriptApp.newTrigger('storySnapshot').timeBased().everyHours(1).create();
}

// 편집기·메뉴에서 바로 한 번: 오늘 몫을 지금 받음(처음 켤 때)
function collectInstagramExtras() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const logs = [];
  igxStep_(ss, today, logs);
  logRows_(ss, logs);
  logs.forEach(l => Logger.log(l[3]));
}

// ───────── 유튜브 분석 추가 수집(yta): 브랜드 계정 토큰(YT_REFRESH)으로 ─────────
//  · 「유튜브 채널 일별」  : 날짜별 조회·시청 시간·구독 증감·좋아요·댓글·공유 (처음엔 2024-01부터, 이후 최근 7일 다시 씀 — 집계가 1~3일 늦음)
//  · 「유튜브 시청자」     : 최근 28일 + 지난달들의 연령·성별, 국가, 기기, 구독 여부, 유입 경로(채널 전체)
//  · 「유튜브 영상 분석」  : 영상별 구독 증감·공유·평균 시청률·시청 시간(2024-01~)
//  · 「유튜브 유입 경로」  : 최근 90일 영상별 유입 경로(검색·추천·쇼츠 피드·외부 …)
//  · 「유튜브 검색어」     : 최근 90일 영상별 + 채널 전체(최근 28일) 유튜브 검색어 상위
//  · 「유튜브 시청 지속률」: 최근 90일 영상의 구간별 시청 비율(월요일·처음에만)
//  · 「유튜브 댓글」       : 최근 90일 영상의 댓글 내용(작성자 이름은 저장하지 않음)
//  · 「유튜브 영상 정보」  : 영상별 태그·재생목록(월요일·처음에만)
const YTA_RECENT_DAYS = 90;
const YTA_HIST_START = '2017-01-01';          // 과거 채우기(채널 일별·시청자·영상별 유입) 시작일 — 채널 첫 영상 2017-02
const YTA_ALL_DAYS = 4000;                     // 「모든 영상」 목록을 받을 때 거슬러 갈 날 수
const YTA_MONTHS_PER_RUN = 8;                  // 지난달 시청자 분포 과거 채우기: 한 번에 최대 N달(실행 시간 보호)
const YTA_TRAFFIC = { YT_SEARCH: '유튜브 검색', RELATED_VIDEO: '추천 영상', SUBSCRIBER: '구독 피드·홈', BROWSE: '탐색(홈 등)', SHORTS: '쇼츠 피드',
  EXT_URL: '외부', NO_LINK_OTHER: '직접·알 수 없음', PLAYLIST: '재생목록', YT_CHANNEL: '채널 페이지', NOTIFICATION: '알림', END_SCREEN: '최종 화면',
  ANNOTATION: '카드·주석', YT_OTHER_PAGE: '기타 유튜브', ADVERTISING: '광고', HASHTAGS: '해시태그', SOUND_PAGE: '사운드 페이지', CAMPAIGN_CARD: '캠페인 카드',
  LIVE_REDIRECT: '라이브 이동', RELATED_SHORT: '관련 쇼츠', VIDEO_REMIXES: '리믹스', IMMERSIVE_LIVE: '라이브 피드', PRODUCT_PAGE: '상품 페이지' };

function ytaGet_(url) {
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ytBrandToken_() }, muteHttpExceptions: true });
  const j = JSON.parse(res.getContentText() || '{}');
  if (j.error) throw new Error('HTTP ' + res.getResponseCode() + ' ' + String(j.error.message || '').slice(0, 140));
  return j;
}
// 분석 보고서 → [{열이름: 값}]
function ytaReport_(prm) {
  const q = Object.assign({ ids: 'channel==MINE' }, prm);
  const j = ytaGet_('https://youtubeanalytics.googleapis.com/v2/reports?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&'));
  const head = (j.columnHeaders || []).map(h => h.name);
  return (j.rows || []).map(r => { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return o; });
}
// 최근 N일에 올린 영상 [{id, title, date}] (업로드 재생목록을 최신부터 넘기다 기간을 벗어나면 멈춤)
// ───────── 유튜브 공개 상태(2026-10-20 「일부 공개·비공개는 대시보드·메일에 넣지 말자」) ─────────
// 브랜드 계정 토큰으로 올린 영상 전체의 공개 상태를 「유튜브 공개 상태」 탭에 씀(매일 기록·1시간마다 스토리 실행). 보드·브리핑·오늘 칸은 public만
const YT_PRIV_SHEET = '유튜브 공개 상태';
const YT_PRIV_KO = { public: '공개', unlisted: '일부 공개', private: '비공개' };
function ytaPrivacy_(ss, today) {
  const ids = ytaRecent_(YTA_ALL_DAYS, today).map(v => v.id), now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = ytaGet_('https://www.googleapis.com/youtube/v3/videos?part=status&id=' + ids.slice(i, i + 50).join(','));
    (r.items || []).forEach(x => out.push([x.id, (x.status && x.status.privacyStatus) || '', now]));
  }
  if (!out.length) return 0;
  const sh = ss.getSheetByName(YT_PRIV_SHEET) || ss.insertSheet(YT_PRIV_SHEET);
  sh.clearContents();
  sh.getRange(1, 1, out.length + 1, 3).setValues([['영상 ID', '공개 상태', '확인 시각']].concat(out));
  YT_PRIV_ = null;
  return out.filter(r => r[1] !== 'public').length;
}
let YT_PRIV_ = null;
function ytPrivMap_() {
  if (YT_PRIV_) return YT_PRIV_;
  YT_PRIV_ = {};
  try {
    const sh = SpreadsheetApp.openById(SS_ID).getSheetByName(YT_PRIV_SHEET);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { if (r[0]) YT_PRIV_[String(r[0])] = String(r[1]); });
  } catch (e) {}
  return YT_PRIV_;
}
// 보드 항목이 일부 공개·비공개 유튜브 영상이면 true(상태를 모르면 그대로 둠)
function ytHidden_(it) {
  if (!it || it.c !== '유튜브') return false;
  const m = String(it.u || '').match(/(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/), st = m ? ytPrivMap_()[m[1]] : '';
  return !!st && st !== 'public';
}
function ytaRecent_(days, today) {
  const ch = ytaGet_('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true');
  const up = ch.items[0].contentDetails.relatedPlaylists.uploads;
  const cut = shiftDate_(today, -days), out = [];
  let tok = '';
  for (let page = 0; page < 40; page++) {
    const r = ytaGet_('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=' + up + (tok ? '&pageToken=' + tok : ''));
    let old = false;
    (r.items || []).forEach(x => {
      const d = Utilities.formatDate(new Date(x.contentDetails.videoPublishedAt || x.snippet.publishedAt), TZ, 'yyyy-MM-dd');
      if (d >= cut) out.push({ id: x.contentDetails.videoId, title: String(x.snippet.title || '').slice(0, 60), date: d }); else old = true;
    });
    tok = r.nextPageToken || '';
    if (old || !tok) break;
  }
  return out;
}
let YTA_FAIL_ = {};
function ytaFail_(k) { YTA_FAIL_[k] = (YTA_FAIL_[k] || 0) + 1; }
function ytaFailText_() { const k = Object.keys(YTA_FAIL_); const t = k.length ? ' · 분석 API 실패(건너뜀): ' + k.map(x => x + ' ' + YTA_FAIL_[x] + '건').join(', ') : ''; YTA_FAIL_ = {}; return t; }
const ytaNum_ = v => (v === undefined || v === null || v === '') ? '' : Number(v);

function ytaChannelDaily_(ss, today) {
  const sh = ss.getSheetByName('유튜브 채널 일별');
  const from = (!sh || sh.getLastRow() < 2) ? YT_PERIOD_START : shiftDate_(today, -7);
  const rows = ytaReport_({ startDate: from, endDate: today, dimensions: 'day', sort: 'day',
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares' });
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const out = rows.map(r => [r.day, r.views, r.estimatedMinutesWatched, r.averageViewDuration, r.subscribersGained, r.subscribersLost, r.likes, r.comments, r.shares, now]);
  igxUpsert_(ss, '유튜브 채널 일별', ['날짜', '조회', '시청 시간(분)', '평균 시청(초)', '구독 증가', '구독 감소', '좋아요', '댓글', '공유', '기록 시각'], [0], out);
  return out.length;
}

// 기간 하나의 시청자 분포 행들
const YTA_PLAY = { WATCH: '유튜브 시청 페이지', SHORTS: '쇼츠 피드', BROWSE: '홈·탐색 화면', CHANNEL: '채널 페이지', EMBEDDED: '다른 사이트에 삽입', EXTERNAL_APP: '외부 앱',
  SEARCH: '검색 결과 화면', MOBILE: '모바일(옛 기준)', YT_OTHER: '기타 유튜브' };
function ytaAudienceRows_(label, s, e, now, only) {
  const rows = [], base = only !== 'more', more = only !== 'base';
  // 질의 하나가 실패(분석 API가 가끔 HTTP 500)해도 나머지는 씀. 실패는 YTA_FAIL_에 셈
  const add = (kind, rs, key, val, name) => rs.forEach(r => rows.push([label, kind, name ? name(r[key]) : r[key], ytaNum_(r[val]), now]));
  const q0 = (kind, fn, key, val, name) => { try { add(kind, fn(), key, val, name); } catch (err) { ytaFail_(kind); } };
  const q = (kind, fn, key, val, name) => { if (base) q0(kind, fn, key, val, name); };
  if (more) {
    q0('도시(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'city', metrics: 'views', sort: '-views', maxResults: 25 }), 'city', 'views');
    q0('공유 서비스(공유)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'sharingService', metrics: 'shares', sort: '-shares', maxResults: 25 }), 'sharingService', 'shares');
    q0('재생 위치(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'insightPlaybackLocationType', metrics: 'views' }), 'insightPlaybackLocationType', 'views', x => YTA_PLAY[x] || x);
    q0('OS(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'operatingSystem', metrics: 'views', sort: '-views' }), 'operatingSystem', 'views');
    q0('콘텐츠 유형(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'creatorContentType', metrics: 'views' }), 'creatorContentType', 'views', x => YTA_CTYPE[x] || x);
  }
  q('연령·성별(%)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'ageGroup,gender', metrics: 'viewerPercentage' }).map(r => ({ k: r.ageGroup.replace('age', '') + ' ' + (r.gender === 'female' ? '여' : r.gender === 'male' ? '남' : r.gender), v: r.viewerPercentage })), 'k', 'v');
  q('국가(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'country', metrics: 'views', sort: '-views', maxResults: 15 }), 'country', 'views');
  q('기기(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'deviceType', metrics: 'views' }), 'deviceType', 'views');
  q('구독 여부(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'subscribedStatus', metrics: 'views' }), 'subscribedStatus', 'views', x => x === 'SUBSCRIBED' ? '구독자' : '비구독자');
  q('유입 경로(조회)', () => ytaReport_({ startDate: s, endDate: e, dimensions: 'insightTrafficSourceType', metrics: 'views' }), 'insightTrafficSourceType', 'views', x => YTA_TRAFFIC[x] || x);
  return rows;
}
function ytaAudience_(ss, today, maxMonths) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const head = ['기간', '구분', '항목', '값', '기록 시각'];
  let rows = ytaAudienceRows_('최근 28일', shiftDate_(today, -28), shiftDate_(today, -1), now);
  // 지난달들: 아직 없는 달만, 한 번에 YTA_MONTHS_PER_RUN달까지(최근 달부터)
  const sh = ss.getSheetByName('유튜브 시청자');
  const have = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(r => { have[r[0]] = 1; });
  const months = [];
  for (let d = today.slice(0, 7) + '-01'; ;) {
    d = shiftDate_(d, -1).slice(0, 7) + '-01';
    if (d < YTA_HIST_START) break;
    if (!have[d.slice(0, 7)]) months.push(d);
  }
  months.slice(0, maxMonths).forEach(m => {
    const end = shiftDate_(Utilities.formatDate(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)), 'UTC', 'yyyy-MM-dd'), -1);
    rows = rows.concat(ytaAudienceRows_(m.slice(0, 7), m, end, now));
  });
  // 「최근 28일」은 매일 통째로 바꿈 → 기존 최근 28일 줄을 지우고 씀
  if (sh && sh.getLastRow() > 1) {
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().filter(r => String(r[0]) !== '최근 28일');
    sh.getRange(2, 1, sh.getLastRow() - 1, head.length).clearContent();
    if (v.length) sh.getRange(2, 1, v.length, head.length).setValues(v);
  }
  igxUpsert_(ss, '유튜브 시청자', head, [0, 1, 2], rows);
  return { n: rows.length, months: Math.min(months.length, maxMonths), left: Math.max(0, months.length - maxMonths) };
}

// 영상별 구독 증감·공유·평균 시청률·시청 시간(2024-01~, 80개씩)
function ytaVideoStats_(ss, today) {
  const api = YT_API_ || null;
  let ids = api ? Object.keys(api.videos).filter(id => api.videos[id].date >= YT_PERIOD_START) : [];
  if (!ids.length) ids = ytaRecent_(1100, today).map(v => v.id);
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const out = [];
  for (let i = 0; i < ids.length; i += YT_BATCH) {
    ytaReport_({ startDate: YT_PERIOD_START, endDate: today, dimensions: 'video', filters: 'video==' + ids.slice(i, i + YT_BATCH).join(','), maxResults: 200,
      metrics: 'subscribersGained,subscribersLost,shares,averageViewPercentage,estimatedMinutesWatched' })
      .forEach(r => out.push([r.video, r.subscribersGained, r.subscribersLost, r.shares, r.averageViewPercentage, r.estimatedMinutesWatched, now]));
  }
  igxUpsert_(ss, '유튜브 영상 분석', ['영상 ID', '구독 증가', '구독 감소', '공유', '평균 시청률(%)', '시청 시간(분)', '기록일'], [0], out);
  return out.length;
}

// 영상 하나의 유입 경로·검색어·(선택) 시청 지속률·댓글 행
function ytaVideoRows_(v, yday, wantRet, now) {
  const o = { tr: [], kw: [], ret: [], cm: [] };
  try { ytaReport_({ startDate: v.date, endDate: yday, dimensions: 'insightTrafficSourceType', metrics: 'views,estimatedMinutesWatched', filters: 'video==' + v.id })
    .forEach(r => o.tr.push([v.id, v.title, v.date, YTA_TRAFFIC[r.insightTrafficSourceType] || r.insightTrafficSourceType, r.views, r.estimatedMinutesWatched, now])); } catch (e) { ytaFail_('유입 경로'); }
  try { ytaReport_({ startDate: v.date, endDate: yday, dimensions: 'insightTrafficSourceDetail', metrics: 'views', filters: 'video==' + v.id + ';insightTrafficSourceType==YT_SEARCH', sort: '-views', maxResults: 15 })
    .forEach(r => o.kw.push([v.id, v.title, r.insightTrafficSourceDetail, r.views, now])); } catch (e) { ytaFail_('검색어'); }
  if (wantRet) {
    try { ytaReport_({ startDate: v.date, endDate: yday, dimensions: 'elapsedVideoTimeRatio', metrics: 'audienceWatchRatio,relativeRetentionPerformance', filters: 'video==' + v.id + ';audienceType==ORGANIC' })
      .forEach(r => o.ret.push([v.id, v.title, Math.round(r.elapsedVideoTimeRatio * 100), r.audienceWatchRatio, r.relativeRetentionPerformance, now])); } catch (e) { ytaFail_('시청 지속률'); }
  }
  o.cm = ytaComments_(v.id, now);
  return o;
}
// 영상 하나의 공개 댓글(최상위, 최대 100개). 공개 데이터라 스크립트 계정의 유튜브 서비스로 받음
// (브랜드 계정 토큰으로 부르면 오류 없이 빈 목록이 와서 0개로 쌓였음 — 2026-10-17)
// 댓글 API: 스크립트 속성 YT_API_KEY(공개 데이터용 API 키)가 있으면 키로, 없으면 스크립트 계정의 유튜브 서비스로
// (스크립트 계정으로는 「You do not have permission to call youtube.commentThreads.list」 — 2026-10-20 로그에서 확인, 그래서 키를 씀)
function ytCm_(kind, part, prm) {
  const key = PropertiesService.getScriptProperties().getProperty('YT_API_KEY');
  if (!key) return kind === 'comments' ? YouTube.Comments.list(part, prm) : YouTube.CommentThreads.list(part, prm);
  const q = Object.assign({ part: part, key: key }, prm);
  const res = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/' + kind + '?' + Object.keys(q).map(k => k + '=' + encodeURIComponent(q[k])).join('&'), { muteHttpExceptions: true });
  const j = JSON.parse(res.getContentText() || '{}');
  if (j.error) throw new Error(String(j.error.message || ('HTTP ' + res.getResponseCode())).replace(/key=[^&\s]+/g, 'key=…').slice(0, 120));
  return j;
}
function ytaComments_(vid, now) {
  const out = [];
  try {
    // 최상위 댓글은 100개씩 10쪽(1,000개)까지, 답글은 「유튜브 답글」로(YTA_REPLIES_에 모았다가 ytaFlushReplies_가 씀) (2026-10-20)
    const me = ytaMyChannel_(), when = x => Utilities.formatDate(new Date(x), TZ, 'yyyy-MM-dd HH:mm');
    let tok = '';
    for (let p = 0; p < 10; p++) {
      const c = ytCm_('commentThreads', 'snippet,replies', Object.assign({ videoId: vid, maxResults: 100, textFormat: 'plainText' }, tok ? { pageToken: tok } : {}));
      (c.items || []).forEach(t => { const s = t.snippet.topLevelComment.snippet;
        out.push([t.id, vid, when(s.publishedAt), String(s.textDisplay || '').slice(0, 500), s.likeCount, t.snippet.totalReplyCount, now]);
        let rs = (t.replies && t.replies.comments) || [];
        if (t.snippet.totalReplyCount > rs.length) { try { rs = ytCm_('comments', 'snippet', { parentId: t.id, maxResults: 100, textFormat: 'plainText' }).items || rs; } catch (e) {} }
        rs.forEach(r => { const q = r.snippet;
          YTA_REPLIES_.push([r.id, t.id, vid, when(q.publishedAt), String(q.textDisplay || '').slice(0, 500), q.likeCount, me && q.authorChannelId && q.authorChannelId.value === me ? '예' : '', now]); });
      });
      tok = c.nextPageToken || ''; if (!tok) break;
    }
  } catch (e) { ytaFail_(/disabled/i.test(String(e.message)) ? '댓글 꺼진 영상' : '댓글(' + String(e.message).slice(0, 60) + ')'); } // 댓글을 끈 영상도 건수로 남김(원인 확인용)
  return out;
}
const YTA_TR_HEAD = ['영상 ID', '제목', '게시일', '유입 경로', '조회', '시청 시간(분)', '기록일'];
const YTA_KW_HEAD = ['영상 ID', '제목', '검색어', '조회', '기록일'];
const YTA_RET_HEAD = ['영상 ID', '제목', '구간(%)', '시청 비율', '비슷한 영상 대비', '기록일'];
const YTA_CM_HEAD = ['댓글 ID', '영상 ID', '작성 시각', '내용', '좋아요', '답글 수', '기록일'];
// 첫 열(영상 ID)이 ids에 있는 줄만 새 값으로 바꾸고 나머지(과거 채우기로 받은 영상 등)는 그대로 둠
function ytaReplaceSome_(ss, name, head, ids, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const hd = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), head.length)).getDisplayValues()[0].join('§').replace(/§+$/, '') : '';
  let keep = [];
  if (hd === head.join('§') && sh.getLastRow() > 1) {
    const set = {}; ids.forEach(x => { set[x] = 1; });
    keep = sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().filter(r => !set[String(r[0])]);
  }
  const all = keep.concat(rows);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1);
  if (all.length) { sh.getRange(2, 1, all.length, 1).setNumberFormat('@'); sh.getRange(2, 1, all.length, head.length).setValues(all.map(r => r.map(v => v == null ? '' : v))); }
  return all.length;
}
// 최근 영상: 유입 경로·검색어·(주간) 시청 지속률·댓글. 최근 영상 줄만 새로 쓰고, 그 이전 영상 줄은 그대로 둠
function ytaRecentVideos_(ss, today, weekly) {
  const yday = shiftDate_(today, -1);
  const vids = ytaRecent_(YTA_RECENT_DAYS, today).filter(v => v.date <= yday);
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const tr = [], kw = [], ret = [], cm = [];
  vids.forEach(v => { const o = ytaVideoRows_(v, yday, weekly, now); tr.push.apply(tr, o.tr); kw.push.apply(kw, o.kw); ret.push.apply(ret, o.ret); cm.push.apply(cm, o.cm); });
  const CH = '(채널 전체 최근 28일)';
  try { ytaReport_({ startDate: shiftDate_(today, -28), endDate: yday, dimensions: 'insightTrafficSourceDetail', metrics: 'views', filters: 'insightTrafficSourceType==YT_SEARCH', sort: '-views', maxResults: 25 })
    .forEach(r => kw.push([CH, '', r.insightTrafficSourceDetail, r.views, now])); } catch (e) { ytaFail_('채널 검색어'); }
  const ids = vids.map(v => v.id);
  ytaReplaceSome_(ss, '유튜브 유입 경로', YTA_TR_HEAD, ids, tr);
  ytaReplaceSome_(ss, '유튜브 검색어', YTA_KW_HEAD, ids.concat([CH]), kw);
  if (weekly) ytaReplaceSome_(ss, '유튜브 시청 지속률', YTA_RET_HEAD, ids, ret);
  if (cm.length) igxUpsert_(ss, '유튜브 댓글', YTA_CM_HEAD, [0], cm); ytaFlushReplies_(ss);
  return { vids: vids.length, tr: tr.length, kw: kw.length, ret: ret.length, cm: cm.length };
}

// 영상별 태그·재생목록(월요일·처음)
function ytaVideoInfo_(ss, today) {
  const pl = {};
  let tok = '';
  for (let p = 0; p < 10; p++) {
    const r = ytaGet_('https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50' + (tok ? '&pageToken=' + tok : ''));
    (r.items || []).forEach(x => { pl[x.id] = x.snippet.title; });
    tok = r.nextPageToken || ''; if (!tok) break;
  }
  const inPl = {};
  Object.keys(pl).forEach(id => {
    let t = '';
    for (let p = 0; p < 20; p++) {
      const r = ytaGet_('https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=' + id + (t ? '&pageToken=' + t : ''));
      (r.items || []).forEach(x => { (inPl[x.contentDetails.videoId] = inPl[x.contentDetails.videoId] || []).push(pl[id]); });
      t = r.nextPageToken || ''; if (!t) break;
    }
  });
  const ids = ytaRecent_(YTA_ALL_DAYS, today).map(v => v.id), now = today, out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = ytaGet_('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + ids.slice(i, i + 50).join(','));
    (r.items || []).forEach(x => out.push([x.id, (x.snippet.tags || []).join(', ').slice(0, 500), (inPl[x.id] || []).join(' / '), now]));
  }
  igxUpsert_(ss, '유튜브 영상 정보', ['영상 ID', '태그', '재생목록', '기록일'], [0], out);
  return out.length;
}

// 매일 기록 단계(yta): 가벼운 것만 — 채널 일별·시청자(최근 28일 + 지난달 2개까지)·영상 분석·최근 영상 유입·검색어·댓글
function ytaStep_(ss, today, logs) {
  if (!PropertiesService.getScriptProperties().getProperty('YT_REFRESH')) { logs.push([new Date(), '유튜브 추가 수집', 0, '건너뜀: 브랜드 계정 승인(YT_REFRESH) 없음']); return; }
  ensureWeeklyTrigger_();
  const parts = [];
  const run = (name, fn) => { try { parts.push(name + ' ' + fn()); } catch (e) { parts.push(name + ' 오류: ' + String(e.message).slice(0, 120)); } };
  run('공개 상태', () => '일부 공개·비공개 ' + ytaPrivacy_(ss, today) + '개(보드·메일에서 뺌)');
  run('채널 일별', () => ytaChannelDaily_(ss, today) + '일');
  run('시청자', () => { const a = ytaAudience_(ss, today, 2); return a.n + '줄' + (a.left ? '(지난달 ' + a.left + '개는 주간 수집에서)' : ''); });
  run('영상 분석', () => ytaVideoStats_(ss, today) + '개');
  run('최근 영상', () => { const r = ytaRecentVideos_(ss, today, false); return r.vids + '개(유입 ' + r.tr + '·검색어 ' + r.kw + '·댓글 ' + r.cm + ')'; });
  run('영상별 시청자(최근 30일 영상)', () => { const yday = shiftDate_(today, -1); return ytaVideoAud_(ss, ytaRecent_(30, today).filter(v => v.date <= yday), yday) + '개'; });
  run('노출·최종 화면(보고서 API)', () => ytrStep_(ss, 60 * 1000).text);
  run('유형 일별', () => ytaTypeDaily_(ss, today) + '줄');
  run('영상 추가 지표', () => ytaVideoMore_(ss, today) + '개');
  logs.push([new Date(), '유튜브 추가 수집', 0, parts.join(' · ') + ytaFailText_()]);
}

// ───────── 인스타 게시물 추가 지표·접속 시간대·타 대학(igm) ─────────
//  · 「인스타 게시물 추가」: 게시물별 팔로우 유입·프로필 방문·상호작용, 릴스 평균·총 시청 시간(최근 30일은 매일, 전체는 월요일·처음)
//  · 「인스타 접속 시간대」: 팔로워가 접속한 시간대(월요일·처음, 지원 안 되면 로그에 남김)
//  · 「타대학 일별」·「타대학 게시물」: 타 대학 공개 계정의 팔로워·게시물 수와 최근 게시물 좋아요·댓글(조회수는 API가 주지 않음)
const IGM_BENCH = ['jbnu1947', 'wonkwang_univ', 'woosukuni'];
const IGM_METRICS = {
  REELS: ['total_interactions', 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time', 'profile_activity'],
  FEED: ['total_interactions', 'profile_activity', 'follows', 'profile_visits'], // follows·profile_visits는 메타가 주지 않으면 빈칸
};

function igmMedia_(ss, today, all, deadline) {
  const now = today, rows = [], miss = [], bad = { REELS: [], FEED: [] };
  let stopped = false;
  igxChannels_().forEach(c => {
    const cut = all ? IG_CH[c.ch].from : shiftDate_(today, -30);
    const list = igMedia_(c.conf, c.user, 'id,timestamp,permalink,media_type,media_product_type', 100, cut);
    list.forEach(m => {
      if (stopped || (deadline && Date.now() > deadline)) { stopped = true; return; }
      const kind = m.media_product_type === 'REELS' ? 'REELS' : 'FEED';
      const want = IGM_METRICS[kind].filter(x => bad[kind].indexOf(x) < 0), mm = [];
      const v = want.length ? igxInsights_(c.conf, m.id, want, null, mm) : {};
      mm.forEach(x => { if (bad[kind].indexOf(x) < 0) bad[kind].push(x); if (miss.indexOf(x) < 0) miss.push(x); }); // 한 번 안 되면 같은 유형은 다시 묻지 않음
      const sec = x => x === undefined || x === '' ? '' : Math.round(Number(x) / 100) / 10; // ms → 초
      rows.push([c.ch, String(m.id), Utilities.formatDate(new Date(m.timestamp), TZ, 'yyyy-MM-dd HH:mm'), kind === 'REELS' ? '릴스' : (m.media_type === 'CAROUSEL_ALBUM' ? '캐러셀' : m.media_type === 'VIDEO' ? '영상' : '이미지'),
        m.permalink || '', ytaNum_(v.follows), ytaNum_(v.profile_visits), ytaNum_(v.profile_activity), ytaNum_(v.total_interactions), sec(v.ig_reels_avg_watch_time), sec(v.ig_reels_video_view_total_time), now]);
    });
  });
  if (rows.length) igxUpsert_(ss, '인스타 게시물 추가', ['채널', '게시물 ID', '게시 시각', '유형', '링크', '팔로우 유입', '프로필 방문', '프로필 활동', '상호작용', '릴스 평균 시청(초)', '릴스 총 시청(초)', '기록일'], [0, 1], rows);
  return { n: rows.length, miss: miss, stopped: stopped };
}

function igmOnline_(ss, today) {
  const rows = [];
  igxChannels_().forEach(c => {
    const d = igxGet_(c.conf, c.user + '/insights', { metric: 'online_followers', period: 'lifetime' }).data || [];
    const vals = (d[0] && d[0].values) || [];
    const last = vals[vals.length - 1];
    if (last && last.value) Object.keys(last.value).forEach(h => rows.push([today, c.ch, Number(h), last.value[h]]));
  });
  if (!rows.length) throw new Error('메타가 빈 값을 줌(지원 중단으로 보임)');
  igxUpsert_(ss, '인스타 접속 시간대', ['기록일', '채널', '시(0~23, 메타 기준)', '접속 팔로워'], [0, 1, 2], rows);
  return rows.length;
}

// 타 대학 공개 계정(business_discovery): 팔로워·게시물 수 + 게시물(최신순, since 이전 게시물이 나오거나 maxPage쪽까지)
// 같은 실행 안에서는 한 번만 받음(원본 읽기의 benchOverlay_와 igm 단계가 같이 씀)
const BENCH_API_ = {};
function benchFetch_(u, since, maxPage) {
  const ck = u + '|' + since;
  if (BENCH_API_[ck]) return BENCH_API_[ck];
  const c = igxChannels_().filter(x => x.ch === '인스타그램')[0] || igxChannels_()[0];
  if (!c) throw new Error('META_TOKEN 또는 IG_API 꺼짐');
  const mf = '{id,timestamp,media_type,media_product_type,permalink,caption,like_count,comments_count}';
  let b = null, after = '';
  const media = [];
  for (let page = 0; page < maxPage; page++) {
    const r = igxGet_(c.conf, c.user, { fields: 'business_discovery.username(' + u + '){followers_count,media_count,media' + (after ? '.after(' + after + ')' : '') + '.limit(50)' + mf + '}' }).business_discovery;
    if (!b) b = r;
    const d = (r.media && r.media.data) || [];
    let old = false;
    d.forEach(m => { const date = Utilities.formatDate(new Date(m.timestamp), TZ, 'yyyy-MM-dd'); if (date >= since) media.push({ m: m, date: date }); else old = true; });
    after = !old && d.length && r.media.paging && r.media.paging.cursors ? r.media.paging.cursors.after || '' : '';
    if (!after) break;
  }
  return (BENCH_API_[ck] = { followers: b.followers_count, count: b.media_count, media: media });
}
const benchType_ = m => m.media_product_type === 'REELS' ? '릴스' : (m.media_type === 'CAROUSEL_ALBUM' ? '캐러셀' : m.media_type === 'VIDEO' ? '영상' : '이미지');

// 원본 읽기 때 타 대학(공개 원본, Supermetrics 월요일 갱신) 게시물의 좋아요·댓글을 API 값으로 덮고, 원본에 없는 최근 게시물을 더한다 (2026-10-20)
//  · 그래야 화~일 임시 기록도 값이 바뀌어 「원본 미갱신」으로 빠지지 않음. 조회(릴스 재생)는 API가 주지 않아 원본 값 유지
//  · 게시물 연결은 igMatch_(캡션 앞 30자 + 날짜 ±1일). IG_API = on이고 META_TOKEN이 있을 때만, 실패하면 원본 값 그대로
const BENCH_API_LOG_ = { n: 0, msg: '' };
function benchOverlay_(out, today, cutoff) {
  if (PropertiesService.getScriptProperties().getProperty('IG_API') !== 'on') return;
  const since = cutoff || shiftDate_(today, -BENCH_DAYS), recent = shiftDate_(today, -IG_NEW_DAYS);
  const parts = [];
  let total = 0;
  IGM_BENCH.forEach(u => {
    const chName = BENCH_PREFIX + u;
    const ch = out[chName];
    if (!ch) return; // 원본에 없는 학교는 건드리지 않음
    try {
      const api = benchFetch_(u, since, 6);
      const media = api.media.map(x => ({ id: String(x.m.id), date: x.date, caption: String(x.m.caption || ''), product: String(x.m.media_product_type || ''), m: x.m }));
      const mt = igMatch_(ch, media);
      let upd = 0, add = 0;
      media.forEach(x => {
        const k = mt.byId[x.id];
        if (k) {
          ch[k].likes = Number(x.m.like_count) || 0;
          ch[k].comments = Number(x.m.comments_count) || 0;
          if (x.m.permalink) ch[k].url = x.m.permalink;
          upd++;
        } else if (x.date >= recent) {
          const key = capKey_(x.date, x.caption);
          if (!key || ch[key]) return;
          ch[key] = { date: x.date, title: cut_(x.caption.replace(/\s+/g, ' ').trim(), 80), url: x.m.permalink || '', full: x.caption, desc: '',
            views: '', likes: Number(x.m.like_count) || 0, comments: Number(x.m.comments_count) || 0, shares: '', saves: '', reach: '', engaged: '', avgSec: '',
            lengthSec: '', type: typeLabel_(x.product, String(x.m.media_type || '')) };
          add++;
        }
      });
      total += upd + add;
      parts.push(u + ' 갱신 ' + upd + '·새 ' + add + (mt.amb ? '·겹침 ' + mt.amb : ''));
    } catch (e) { parts.push(u + ' 오류(원본 값 사용): ' + String(e.message).slice(0, 80)); }
  });
  BENCH_API_LOG_.n = total;
  BENCH_API_LOG_.msg = parts.join(' · ');
}

function igmBench_(ss, today) {
  const c = igxChannels_().filter(x => x.ch === '인스타그램')[0] || igxChannels_()[0];
  if (!c) return { acc: 0, posts: 0 };
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const acc = [], posts = [];
  IGM_BENCH.forEach(u => {
    try {
      // 원본 읽기(benchOverlay_)에서 받은 것이 있으면 그 앞 50개를 씀(예전과 같은 범위)
      const hit = Object.keys(BENCH_API_).filter(k => k.indexOf(u + '|') === 0)[0];
      const b = hit ? BENCH_API_[hit] : benchFetch_(u, '2000-01-01', 1);
      acc.push([today, u, b.followers, b.count, now]);
      b.media.slice(0, 50).forEach(x => posts.push([u, String(x.m.id), x.date, benchType_(x.m),
        x.m.permalink || '', String(x.m.caption || '').replace(/\s+/g, ' ').slice(0, 60), ytaNum_(x.m.like_count), ytaNum_(x.m.comments_count), today]));
    } catch (e) { acc.push([today, u, '', '', now + ' 오류: ' + String(e.message).slice(0, 80)]); }
  });
  igxUpsert_(ss, '타대학 일별', ['날짜', '계정', '팔로워', '게시물 수', '기록 시각'], [0, 1], acc);
  if (posts.length) igxUpsert_(ss, '타대학 게시물', ['계정', '게시물 ID', '게시일', '유형', '링크', '캡션 앞부분', '좋아요', '댓글', '기록일'], [0, 1], posts);
  return { acc: acc.length, posts: posts.length };
}

// 매일 기록 단계(igm): 최근 30일 게시물 추가 지표 + 타 대학
function igmStep_(ss, today, logs) {
  if (!igxChannels_().length) { logs.push([new Date(), '인스타 게시물 추가', 0, '건너뜀: META_TOKEN 또는 IG_API 꺼짐']); return; }
  const parts = [], miss = [];
  try { const m = igmMedia_(ss, today, false, Date.now() + 90 * 1000); parts.push('게시물 ' + m.n + '개(최근 30일)'); miss.push.apply(miss, m.miss); } catch (e) { parts.push('게시물 오류: ' + String(e.message).slice(0, 120)); }
  try { const x = igmMediaMore_(ss, today, false, Date.now() + 60 * 1000); parts.push('게시물 세부 ' + x.n + '줄'); miss.push.apply(miss, x.miss); } catch (e) { parts.push('게시물 세부 오류: ' + String(e.message).slice(0, 120)); }
  try { const b = igmBench_(ss, today); parts.push('타 대학 ' + b.acc + '곳·게시물 ' + b.posts + '개'); } catch (e) { parts.push('타 대학 오류: ' + String(e.message).slice(0, 120)); }
  logs.push([new Date(), '인스타 게시물 추가', 0, parts.join(' · ') + (miss.length ? ' · 받지 못한 지표: ' + Array.from(new Set(miss)).join(', ') : '')]);
}

// ───────── 유튜브 보고서 API(ytr): 노출 수·노출 클릭률·최종 화면 클릭 (2026-10-20) ─────────
//  분석 API에는 없는 값이라 보고서 API로 받는다. 처음 한 번 보고서 작업(job)을 등록하면 유튜브가 날짜마다 CSV를 하나씩 만들어 둠
//  (첫 파일은 하루이틀 뒤, 등록 전 30일 치도 만들어 줌. 파일은 60일(과거 치는 30일) 뒤 사라지므로 매일 받아 쌓는다)
//  · 「유튜브 노출」      : 날짜·영상별 썸네일 노출 수·노출 클릭률
//  · 「유튜브 노출 경로」 : 날짜·영상·유입 경로별 노출 수·노출 클릭률(세부 경로·기기·OS는 합침)
//  · 「유튜브 최종 화면」 : 날짜·영상·요소 종류별 최종 화면 노출·클릭
//  노출 클릭률은 유튜브가 준 값 그대로(합칠 때는 노출 가중 평균). 진행: YTR_JOBS(보고서 종류 → job ID), YTR_AFTER_<종류>(마지막으로 받은 파일 생성 시각)
const YTR_API = 'https://youtubereporting.googleapis.com/v1/';
const YTR_TYPES = [
  { re: /^channel_reach_basic_a\d+$/, sheet: '유튜브 노출', keys: ['video_id'], cols: ['video_thumbnail_impressions', 'video_thumbnail_impressions_ctr'],
    head: ['날짜', '영상 ID', '노출', '노출 클릭률', '기록일'] },
  { re: /^channel_reach_combined_a\d+$/, sheet: '유튜브 노출 경로', keys: ['video_id', 'traffic_source_type'], cols: ['video_thumbnail_impressions', 'video_thumbnail_impressions_ctr'],
    head: ['날짜', '영상 ID', '유입 경로', '노출', '노출 클릭률', '기록일'] },
  { re: /^channel_end_screens_a\d+$/, sheet: '유튜브 최종 화면', keys: ['video_id', 'end_screen_element_type'], cols: ['end_screen_element_impressions', 'end_screen_element_clicks'],
    head: ['날짜', '영상 ID', '요소 종류', '노출', '클릭', '기록일'] },
];
const YTR_TRAFFIC = { 0: '직접·알 수 없음', 1: '광고', 3: '탐색(홈 등)', 4: '채널 페이지', 5: '유튜브 검색', 7: '추천 영상', 8: '기타 유튜브', 9: '외부',
  11: '카드·주석', 14: '재생목록', 17: '알림', 18: '재생목록 페이지', 20: '최종 화면', 23: '스토리', 24: '쇼츠 피드', 25: '상품 페이지', 26: '해시태그',
  27: '사운드 페이지', 28: '라이브 이동', 29: '팟캐스트', 30: '리믹스', 31: '라이브 피드', 32: '관련 쇼츠' };
const YTR_END = { 501: '영상', 502: '재생목록', 503: '웹사이트', 504: '채널', 505: '구독', 506: '연결', 507: '크라우드펀딩', 508: '상품', 509: '최근 업로드', 510: '시청자 맞춤' };

function ytrFetch_(url, opt) {
  const res = UrlFetchApp.fetch(url, Object.assign({ headers: { Authorization: 'Bearer ' + ytBrandToken_() }, muteHttpExceptions: true }, opt || {}));
  const code = res.getResponseCode(), t = res.getContentText();
  if (code >= 300) { let m = t; try { m = JSON.parse(t).error.message; } catch (e) {} throw new Error('HTTP ' + code + ' ' + String(m).slice(0, 160)); }
  return t;
}
// 보고서 작업이 없으면 등록. 반환: [{type(설정), typeId, jobId}]
function ytrJobs_() {
  const p = PropertiesService.getScriptProperties();
  const types = (JSON.parse(ytrFetch_(YTR_API + 'reportTypes')).reportTypes || []).map(x => x.id);
  const have = {};
  (JSON.parse(ytrFetch_(YTR_API + 'jobs')).jobs || []).forEach(j => { have[j.reportTypeId] = j.id; });
  const out = [];
  YTR_TYPES.forEach(t => {
    const id = types.filter(x => t.re.test(x)).sort().pop(); // 같은 보고서의 새 판(a1 → a2)이 있으면 새 것
    if (!id) return;
    if (!have[id]) have[id] = JSON.parse(ytrFetch_(YTR_API + 'jobs', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ reportTypeId: id, name: 'sns-board ' + id }) })).id;
    out.push({ type: t, typeId: id, jobId: have[id] });
  });
  p.setProperty('YTR_JOBS', JSON.stringify(out.map(x => [x.typeId, x.jobId])));
  return out;
}
// CSV → 날짜·키별로 합친 행([날짜, 키..., 값..., 기록일])
function ytrRows_(t, csv, now) {
  const a = Utilities.parseCsv(csv);
  if (a.length < 2) return [];
  const h = a[0], at = n => h.indexOf(n);
  const ki = t.keys.map(at), ci = t.cols.map(at), di = at('date');
  if (di < 0 || ki.some(i => i < 0) || ci.some(i => i < 0)) throw new Error(t.sheet + ' 열 구성이 다름: ' + h.join(','));
  const ctr = t.cols[1].indexOf('_ctr') >= 0, g = {};
  a.slice(1).forEach(r => {
    const d = String(r[di]), day = d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
    const k = [day].concat(ki.map(i => r[i])).join('§');
    const o = g[k] || (g[k] = { day: day, keys: ki.map(i => r[i]), v0: 0, v1: 0 });
    const v0 = Number(r[ci[0]]) || 0, v1 = Number(r[ci[1]]) || 0;
    o.v0 += v0; o.v1 += ctr ? v0 * v1 : v1; // 클릭률은 노출 가중 합 → 마지막에 나눔
  });
  return Object.keys(g).map(k => {
    const o = g[k];
    const keys = o.keys.map((x, i) => t.keys[i] === 'traffic_source_type' ? (YTR_TRAFFIC[x] || '코드 ' + x) : t.keys[i] === 'end_screen_element_type' ? (YTR_END[x] || '코드 ' + x) : x);
    return [o.day].concat(keys, [o.v0, ctr ? (o.v0 ? Math.round(o.v1 / o.v0 * 1e6) / 1e6 : '') : o.v1, now]);
  });
}
// 날짜 단위로 바꿔 씀: 같은 날짜 줄이 있으면 지우고(다시 만든 보고서) 끝에 덧붙임. 첫 열은 날짜
function ytrPut_(ss, name, head, rows) {
  if (!rows.length) return 0;
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  const days = {}; rows.forEach(r => { days[r[0]] = 1; });
  if (sh.getLastRow() > 1) {
    const col = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
    for (let i = col.length - 1; i >= 0;) { // 아래에서부터 이어진 묶음째 지움
      if (!days[col[i][0]]) { i--; continue; }
      let j = i; while (j > 0 && days[col[j - 1][0]]) j--;
      sh.deleteRows(j + 2, i - j + 1); i = j - 1;
    }
  }
  const at = sh.getLastRow() + 1;
  sh.getRange(at, 1, rows.length, 2).setNumberFormat('@');
  sh.getRange(at, 1, rows.length, head.length).setValues(rows);
  return rows.length;
}
// 새로 생긴 보고서 파일을 받아 쌓음. budget(ms) 안에서만, 남은 것은 다음 실행에서
function ytrStep_(ss, budget) {
  const p = PropertiesService.getScriptProperties(), end = Date.now() + budget, now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const jobs = ytrJobs_(), parts = [];
  let left = 0;
  jobs.forEach(j => {
    const kAfter = 'YTR_AFTER_' + j.typeId;
    let after = p.getProperty(kAfter) || '', list = [], tok = '';
    for (let i = 0; i < 20; i++) {
      const r = JSON.parse(ytrFetch_(YTR_API + 'jobs/' + j.jobId + '/reports?pageSize=100' + (after ? '&createdAfter=' + encodeURIComponent(after) : '') + (tok ? '&pageToken=' + tok : '')));
      list = list.concat(r.reports || []); tok = r.nextPageToken || ''; if (!tok) break;
    }
    list.sort((a, b) => (a.createTime < b.createTime ? -1 : 1)); // 오래된 파일부터(같은 날짜를 다시 만든 파일이 나중에 덮어쓰게)
    let n = 0, rows = 0;
    for (const r of list) {
      if (Date.now() > end) { left += list.length - n; break; }
      rows += ytrPut_(ss, j.type.sheet, j.type.head, ytrRows_(j.type, ytrFetch_(r.downloadUrl), now));
      p.setProperty(kAfter, r.createTime); n++;
    }
    parts.push(j.type.sheet.replace('유튜브 ', '') + ' 파일 ' + n + '개·' + rows + '줄');
  });
  if (!jobs.length) parts.push('보고서 종류를 찾지 못함');
  return { text: parts.join(', ') + (left ? '(남은 파일 ' + left + '개는 다음에)' : ''), left: left };
}

// ───────── 유튜브 영상별 시청자(구독 여부·연령·성별) (2026-10-20) ─────────
//  · 「유튜브 영상 구독 여부」: 영상별 구독자/비구독자 조회·시청 시간
//  · 「유튜브 영상 시청자」   : 영상별 연령·성별 비율(%) — 조회가 적으면 유튜브가 값을 주지 않음
const YTA_VSUB_HEAD = ['영상 ID', '제목', '게시일', '구분', '조회', '시청 시간(분)', '기록일'];
const YTA_VAGE_HEAD = ['영상 ID', '제목', '게시일', '연령', '성별', '비율(%)', '기록일'];
function ytaVideoAudRows_(v, yday, now) {
  const o = { sub: [], age: [] };
  try { ytaReport_({ startDate: v.date, endDate: yday, dimensions: 'subscribedStatus', metrics: 'views,estimatedMinutesWatched', filters: 'video==' + v.id })
    .forEach(r => o.sub.push([v.id, v.title, v.date, r.subscribedStatus === 'SUBSCRIBED' ? '구독자' : '비구독자', r.views, r.estimatedMinutesWatched, now])); } catch (e) { ytaFail_('영상 구독 여부'); }
  try { ytaReport_({ startDate: v.date, endDate: yday, dimensions: 'ageGroup,gender', metrics: 'viewerPercentage', filters: 'video==' + v.id })
    .forEach(r => o.age.push([v.id, v.title, v.date, String(r.ageGroup).replace('age', ''), r.gender === 'female' ? '여' : r.gender === 'male' ? '남' : r.gender, r.viewerPercentage, now])); } catch (e) { ytaFail_('영상 연령·성별'); }
  if (!o.sub.length) o.sub.push([v.id, v.title, v.date, '(조회 없음)', 0, 0, now]); // 받은 영상 표시(과거 채우기가 다시 묻지 않게)
  return o;
}
function ytaVideoAud_(ss, vids, yday, deadline) {
  const now = shiftDate_(yday, 1), sub = [], age = [], ids = [];
  for (let i = 0; i < vids.length && (!deadline || Date.now() < deadline); i++) {
    const o = ytaVideoAudRows_(vids[i], yday, now); ids.push(vids[i].id); sub.push.apply(sub, o.sub); age.push.apply(age, o.age);
  }
  if (ids.length) { ytaReplaceSome_(ss, '유튜브 영상 구독 여부', YTA_VSUB_HEAD, ids, sub); ytaReplaceSome_(ss, '유튜브 영상 시청자', YTA_VAGE_HEAD, ids, age); }
  return ids.length;
}

// ───────── 인스타 도달·조회의 팔로워/비팔로워 구분 (2026-10-20) ─────────
//  · 「인스타 팔로워 구분」: 채널·날짜별 팔로워/비팔로워 도달·조회(계정 단위. 게시물별 구분은 메타가 주지 않음)
const IGX_FT_SHEET = '인스타 팔로워 구분';
const IGX_FT_HEAD = ['채널', '날짜', '도달 팔로워', '도달 비팔로워', '도달 알 수 없음', '조회 팔로워', '조회 비팔로워', '조회 알 수 없음', '기록 시각'];
function igxFollowType_(c, d, miss) {
  const unix = x => Math.floor(new Date(x + 'T00:00:00+09:00').getTime() / 1000);
  const out = [];
  ['reach', 'views'].forEach(m => {
    const v = { FOLLOWER: '', NON_FOLLOWER: '', UNKNOWN: '' };
    try {
      const r = igxGet_(c.conf, c.user + '/insights', { metric: m, period: 'day', metric_type: 'total_value', breakdown: 'follow_type', since: unix(d), until: unix(shiftDate_(d, 1)) }).data || [];
      ((r[0] && r[0].total_value && r[0].total_value.breakdowns && r[0].total_value.breakdowns[0] && r[0].total_value.breakdowns[0].results) || [])
        .forEach(x => { const k = String((x.dimension_values || [])[0] || 'UNKNOWN').toUpperCase(); v[k in v ? k : 'UNKNOWN'] = (Number(v[k in v ? k : 'UNKNOWN']) || 0) + (Number(x.value) || 0); });
    } catch (e) { if (miss.indexOf(m + '/follow_type') < 0) miss.push(m + '/follow_type'); }
    out.push(v.FOLLOWER, v.NON_FOLLOWER, v.UNKNOWN);
  });
  return out;
}
// 최근 3일(메타가 1~2일 늦게 확정)
function igxFollowTypeDays_(ss, today, days) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), rows = [], miss = [];
  igxChannels_().forEach(c => { for (let i = 1; i <= days; i++) { const d = shiftDate_(today, -i); rows.push([c.ch, d].concat(igxFollowType_(c, d, miss), [now])); } });
  igxUpsert_(ss, IGX_FT_SHEET, IGX_FT_HEAD, [0, 1], rows.filter(r => r.slice(2, 8).some(x => x !== '')));
  return { n: rows.length, miss: miss };
}

// ───────── 인스타 계정 일별 추가·게시물 세부·도달/반응한 사람 분포·댓글·태그된 게시물 (2026-10-20) ─────────
//  · 「인스타 계정 일별 추가」 : 채널·날짜·지표·구분·값(세로로 길게). 좋아요·댓글·공유·저장·답장·상호작용 합계, 팔로우/언팔로우,
//                               조회·도달·상호작용의 콘텐츠 유형별(릴스·게시물·스토리…), 프로필 버튼 누름 종류
//  · 「인스타 게시물 세부」    : 게시물별 프로필 활동 종류(링크·전화·길찾기…), 릴스 건너뛰기 비율·다른 앱 교차 조회(메타가 주는 것만)
//  · 「인스타 도달·반응 분포」 : 이번 달 도달한 사람/반응한 사람의 연령·성별·도시·국가(월요일)
//  · 「인스타 댓글」          : 게시물 댓글·답글 내용(작성자 이름은 저장하지 않음, 우리 계정이 단 답글만 표시) — 토큰에 instagram_manage_comments 필요
//  · 「인스타 태그된 게시물」  : 다른 계정이 우리 계정을 태그한 게시물 — 같은 권한 필요. 권한이 없으면 로그에 남기고 건너뜀
const IG_ALL_FROM = '2010-01-01'; // 「전체」 과거 채우기는 계정 첫 게시물부터
const IGX_MORE_SHEET = '인스타 계정 일별 추가';
const IGX_MORE_HEAD = ['채널', '날짜', '지표', '구분', '값', '기록 시각'];
const IGX_MORE_SUM = ['likes', 'comments', 'shares', 'saves', 'replies', 'total_interactions'];
const IGX_MORE_BRK = [['follows_and_unfollows', 'follow_type'], ['views', 'media_product_type'], ['reach', 'media_product_type'],
  ['total_interactions', 'media_product_type'], ['profile_links_taps', 'contact_button_type']];
const IGX_KO = { likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장', replies: '답장', total_interactions: '상호작용', follows_and_unfollows: '팔로우·언팔로우',
  views: '조회', reach: '도달', profile_links_taps: '프로필 버튼', profile_activity: '프로필 활동', reels_skip_rate: '릴스 건너뛰기 비율', crossposted_views: '교차 게시 조회',
  facebook_views: '페이스북 조회', reached_audience_demographics: '도달한 사람', engaged_audience_demographics: '반응한 사람' };
// 일별 하루치 행. 메타가 안 주는 지표는 miss에(한 번 실패한 것은 bad에 넣어 같은 실행에서 다시 묻지 않음)
function igxDayMore_(c, d, miss, bad, now) {
  const unix = x => Math.floor(new Date(x + 'T00:00:00+09:00').getTime() / 1000);
  const base = { period: 'day', metric_type: 'total_value', since: unix(d), until: unix(shiftDate_(d, 1)) }, rows = [];
  const want = IGX_MORE_SUM.filter(m => bad.indexOf(m) < 0), mm = [];
  if (want.length) {
    const v = igxInsights_(c.conf, c.user, want, base, mm);
    want.forEach(m => { if (v[m] !== undefined && v[m] !== '') rows.push([c.ch, d, IGX_KO[m], '전체', v[m], now]); });
  }
  IGX_MORE_BRK.forEach(x => {
    const k = x.join('/');
    if (bad.indexOf(k) >= 0) return;
    try {
      const r = igxGet_(c.conf, c.user + '/insights', Object.assign({ metric: x[0], breakdown: x[1] }, base)).data || [];
      ((r[0] && r[0].total_value && r[0].total_value.breakdowns && r[0].total_value.breakdowns[0] && r[0].total_value.breakdowns[0].results) || [])
        .forEach(y => {
          let g = String((y.dimension_values || [])[0] || '알 수 없음');
          if (x[0] === 'follows_and_unfollows') g = g === 'FOLLOWER' ? '팔로우' : g === 'NON_FOLLOWER' ? '언팔로우' : g;
          rows.push([c.ch, d, IGX_KO[x[0]], g, Number(y.value) || 0, now]);
        });
    } catch (e) { mm.push(k); }
  });
  mm.forEach(m => { if (bad.indexOf(m) < 0) bad.push(m); if (miss.indexOf(m) < 0) miss.push(m); });
  return rows;
}
function igxDayMoreDays_(ss, today, days) {
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), rows = [], miss = [], bad = [];
  igxChannels_().forEach(c => { for (let i = 1; i <= days; i++) rows.push.apply(rows, igxDayMore_(c, shiftDate_(today, -i), miss, bad, now)); });
  if (rows.length) igxUpsert_(ss, IGX_MORE_SHEET, IGX_MORE_HEAD, [0, 1, 2, 3], rows);
  return { n: rows.length, miss: miss };
}
// 이번 달 도달한 사람·반응한 사람 분포(월요일 또는 탭이 비어 있을 때). 표본이 적으면(반응 100명 미만 등) 메타가 빈 값을 줌
function igxReachedDemo_(ss, today) {
  const name = '인스타 도달·반응 분포', head = ['기록일', '채널', '지표', '구분', '항목', '사람 수'];
  const sh = ss.getSheetByName(name);
  if (sh && sh.getLastRow() > 1 && !isMonday_(today)) return { n: 0, skip: true, miss: [] };
  const rows = [], miss = [], KO = { age: '연령', gender: '성별', city: '도시', country: '국가' };
  igxChannels_().forEach(c => ['reached_audience_demographics', 'engaged_audience_demographics'].forEach(m => ['age', 'gender', 'city', 'country'].forEach(b => {
    try {
      const d = igxGet_(c.conf, c.user + '/insights', { metric: m, period: 'lifetime', timeframe: 'this_month', metric_type: 'total_value', breakdown: b }).data || [];
      ((d[0] && d[0].total_value && d[0].total_value.breakdowns && d[0].total_value.breakdowns[0] && d[0].total_value.breakdowns[0].results) || [])
        .forEach(x => rows.push([today, c.ch, IGX_KO[m], KO[b], String(x.dimension_values[0]), x.value]));
    } catch (e) { if (miss.indexOf(m + '/' + b) < 0) miss.push(m + '/' + b); }
  })));
  if (rows.length) igxUpsert_(ss, name, head, [0, 1, 2, 3, 4], rows);
  return { n: rows.length, miss: miss };
}
// 게시물 세부: 프로필 활동 종류 + 릴스 추가 지표
const IGM_MORE_REELS = ['reels_skip_rate', 'crossposted_views', 'facebook_views'];
// start: 이어서 할 순번(과거 채우기용). 반환 next = 다음 순번, total = 전체 게시물 수
function igmMediaMore_(ss, today, all, deadline, start) {
  const rows = [], miss = [], bad = [], list = [];
  igxChannels_().forEach(c => igMedia_(c.conf, c.user, 'id,timestamp,media_product_type', 100, all ? IG_ALL_FROM : shiftDate_(today, -30)).forEach(m => list.push({ c: c, m: m })));
  let i = start || 0;
  for (; i < list.length; i++) {
    if (deadline && Date.now() > deadline) break;
    {
      const c = list[i].c, m = list[i].m, id = String(m.id);
      if (bad.indexOf('profile_activity/action_type') < 0) {
        try {
          const r = igxGet_(c.conf, id + '/insights', { metric: 'profile_activity', breakdown: 'action_type', metric_type: 'total_value' }).data || [];
          ((r[0] && r[0].total_value && r[0].total_value.breakdowns && r[0].total_value.breakdowns[0] && r[0].total_value.breakdowns[0].results) || [])
            .forEach(y => rows.push([c.ch, id, IGX_KO.profile_activity, String((y.dimension_values || [])[0] || ''), Number(y.value) || 0, today]));
        } catch (e) { bad.push('profile_activity/action_type'); miss.push('profile_activity/action_type'); }
      }
      if (m.media_product_type === 'REELS') {
        const want = IGM_MORE_REELS.filter(x => bad.indexOf(x) < 0), mm = [];
        const v = want.length ? igxInsights_(c.conf, id, want, null, mm) : {};
        want.forEach(x => { if (v[x] !== undefined && v[x] !== '') rows.push([c.ch, id, IGX_KO[x], '전체', v[x], today]); });
        mm.forEach(x => { if (bad.indexOf(x) < 0) bad.push(x); if (miss.indexOf(x) < 0) miss.push(x); });
      }
    }
  }
  if (rows.length) igxUpsert_(ss, '인스타 게시물 세부', ['채널', '게시물 ID', '지표', '구분', '값', '기록일'], [0, 1, 2, 3], rows);
  return { n: rows.length, miss: miss, stopped: i < list.length, next: i, total: list.length };
}
// 댓글·답글: 최근 N일 게시물(all이면 전체). 권한이 없으면 첫 실패에서 멈추고 'perm' 표시
const IGC_HEAD = ['채널', '댓글 ID', '상위 댓글 ID', '게시물 ID', '작성 시각', '내용', '좋아요', '답글 수', '우리 계정 답글', '기록일'];
// from: 이 날 이후 게시물(없으면 채널 시작일부터), start: 이어서 할 순번. 반환 next·total
function igxComments_(ss, today, from, deadline, start) {
  const rows = [], list = [];
  let perm = false, posts = 0;
  const ts = x => Utilities.formatDate(new Date(x), TZ, 'yyyy-MM-dd HH:mm');
  igxChannels_().forEach(c => igMedia_(c.conf, c.user, 'id,timestamp,comments_count', 100, from || IG_CH[c.ch].from).filter(m => Number(m.comments_count) > 0).forEach(m => list.push({ c: c, m: m })));
  let i = start || 0;
  for (; i < list.length; i++) {
    if (deadline && Date.now() > deadline) break;
    {
      const c = list[i].c, m = list[i].m;
      let after = '';
      try {
        for (let p = 0; p < 10; p++) {
          const j = igxGet_(c.conf, m.id + '/comments', Object.assign({ fields: 'id,text,timestamp,like_count,replies.limit(50){id,text,timestamp,like_count,from}', limit: 50 }, after ? { after: after } : {}));
          (j.data || []).forEach(x => {
            const rp = (x.replies && x.replies.data) || [];
            rows.push([c.ch, String(x.id), '', String(m.id), ts(x.timestamp), String(x.text || '').slice(0, 500), Number(x.like_count) || 0, rp.length, rp.some(y => y.from && String(y.from.id) === String(c.user)) ? '예' : '', today]);
            rp.forEach(y => rows.push([c.ch, String(y.id), String(x.id), String(m.id), ts(y.timestamp), String(y.text || '').slice(0, 500), Number(y.like_count) || 0, '', y.from && String(y.from.id) === String(c.user) ? '예' : '', today]));
          });
          after = j.paging && j.paging.next && j.paging.cursors ? j.paging.cursors.after : '';
          if (!after) break;
        }
        posts++;
      } catch (e) {
        if (/code (10|200|3|190)\b/.test(e.message)) { perm = true; break; }
      }
    }
  }
  if (rows.length) igxUpsert_(ss, '인스타 댓글', IGC_HEAD, [0, 1], rows);
  return { n: rows.length, posts: posts, perm: perm, stopped: !perm && i < list.length, next: i, total: list.length };
}
function igxTags_(ss, today) {
  const rows = [];
  igxChannels_().forEach(c => {
    let after = '';
    for (let p = 0; p < 100; p++) {
      const j = igxGet_(c.conf, c.user + '/tags', Object.assign({ fields: 'id,username,timestamp,media_type,media_product_type,permalink,caption,like_count,comments_count', limit: 50 }, after ? { after: after } : {}));
      (j.data || []).forEach(m => rows.push([c.ch, String(m.id), m.username || '', Utilities.formatDate(new Date(m.timestamp), TZ, 'yyyy-MM-dd HH:mm'),
        m.media_product_type === 'REELS' ? '릴스' : (m.media_type === 'CAROUSEL_ALBUM' ? '캐러셀' : m.media_type === 'VIDEO' ? '영상' : '이미지'),
        m.permalink || '', String(m.caption || '').replace(/\s+/g, ' ').slice(0, 300), ytaNum_(m.like_count), ytaNum_(m.comments_count), today]));
      after = j.paging && j.paging.next && j.paging.cursors ? j.paging.cursors.after : '';
      if (!after) break;
    }
  });
  if (rows.length) igxUpsert_(ss, '인스타 태그된 게시물', ['채널', '게시물 ID', '올린 계정', '게시 시각', '유형', '링크', '캡션 앞부분', '좋아요', '댓글', '기록일'], [0, 1], rows);
  return rows.length;
}

// ───────── 유튜브 추가: 콘텐츠 유형 일별·영상 추가 지표·재생목록·유입 세부·답글 (2026-10-20) ─────────
//  · 「유튜브 유형 일별」   : 날짜·콘텐츠 유형(쇼츠·일반 영상·라이브)별 조회·시청 시간·구독 증가·좋아요·공유
//  · 「유튜브 영상 추가 지표」: 영상별 재생목록 추가·제거, 싫어요, 카드 노출·클릭
//  · 「유튜브 재생목록」     : 재생목록별 조회·시작 수·시청 시간(시리즈 성과)
//  · 「유튜브 유입 세부」    : 최근 90일 영상별 어떤 외부 사이트·어떤 추천 영상·어떤 재생목록에서 왔나(상위 10개씩, 월요일)
//  · 「유튜브 답글」        : 댓글에 달린 답글(작성자 이름은 저장하지 않음, 우리 채널 답글만 표시) — 댓글 응답률 계산용
const YTA_CTYPE = { SHORTS: '쇼츠', VIDEO_ON_DEMAND: '일반 영상', LIVE_STREAM: '라이브', STORY: '스토리', UNSPECIFIED: '알 수 없음' };
function ytaTypeDaily_(ss, today) {
  const name = '유튜브 유형 일별', sh = ss.getSheetByName(name);
  const from = (!sh || sh.getLastRow() < 2) ? YTA_HIST_START : shiftDate_(today, -7);
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const rows = ytaReport_({ startDate: from, endDate: today, dimensions: 'day,creatorContentType', sort: 'day',
    metrics: 'views,estimatedMinutesWatched,subscribersGained,likes,shares' })
    .map(r => [r.day, YTA_CTYPE[r.creatorContentType] || r.creatorContentType, r.views, r.estimatedMinutesWatched, r.subscribersGained, r.likes, r.shares, now]);
  igxUpsert_(ss, name, ['날짜', '콘텐츠 유형', '조회', '시청 시간(분)', '구독 증가', '좋아요', '공유', '기록 시각'], [0, 1], rows);
  return rows.length;
}
function ytaVideoMore_(ss, today) {
  const api = YT_API_ || null;
  let ids = api ? Object.keys(api.videos).filter(id => api.videos[id].date >= YT_PERIOD_START) : [];
  if (!ids.length) ids = ytaRecent_(1100, today).map(v => v.id);
  const o = {};
  for (let i = 0; i < ids.length; i += YT_BATCH) {
    const f = { startDate: YT_PERIOD_START, endDate: today, dimensions: 'video', filters: 'video==' + ids.slice(i, i + YT_BATCH).join(','), maxResults: 200 };
    try { ytaReport_(Object.assign({ metrics: 'videosAddedToPlaylists,videosRemovedFromPlaylists,dislikes' }, f)).forEach(r => { o[r.video] = Object.assign(o[r.video] || {}, r); }); } catch (e) { ytaFail_('재생목록 추가·싫어요'); }
    try { ytaReport_(Object.assign({ metrics: 'cardImpressions,cardClicks' }, f)).forEach(r => { o[r.video] = Object.assign(o[r.video] || {}, r); }); } catch (e) { ytaFail_('카드'); }
  }
  const now = shiftDate_(today, 0);
  const rows = Object.keys(o).map(id => { const r = o[id]; return [id, ytaNum_(r.videosAddedToPlaylists), ytaNum_(r.videosRemovedFromPlaylists), ytaNum_(r.dislikes), ytaNum_(r.cardImpressions), ytaNum_(r.cardClicks), now]; });
  if (rows.length) igxUpsert_(ss, '유튜브 영상 추가 지표', ['영상 ID', '재생목록 추가', '재생목록 제거', '싫어요', '카드 노출', '카드 클릭', '기록일'], [0], rows);
  return rows.length;
}
// 2017~2023 영상: 「유튜브 영상 분석」·「유튜브 영상 추가 지표」에 같은 형식으로 덧붙임(기간은 2017-01부터)
function ytaVideoOld_(ss, today) {
  const ids = ytaRecent_(YTA_ALL_DAYS, today).filter(v => v.date < YT_PERIOD_START).map(v => v.id);
  const a = [], o = {};
  for (let i = 0; i < ids.length; i += YT_BATCH) {
    const f = { startDate: YTA_HIST_START, endDate: today, dimensions: 'video', filters: 'video==' + ids.slice(i, i + YT_BATCH).join(','), maxResults: 200 };
    try { ytaReport_(Object.assign({ metrics: 'subscribersGained,subscribersLost,shares,averageViewPercentage,estimatedMinutesWatched' }, f))
      .forEach(r => a.push([r.video, r.subscribersGained, r.subscribersLost, r.shares, r.averageViewPercentage, r.estimatedMinutesWatched, today])); } catch (e) { ytaFail_('과거 영상 분석'); }
    try { ytaReport_(Object.assign({ metrics: 'videosAddedToPlaylists,videosRemovedFromPlaylists,dislikes' }, f)).forEach(r => { o[r.video] = Object.assign(o[r.video] || {}, r); }); } catch (e) { ytaFail_('과거 재생목록 추가·싫어요'); }
    try { ytaReport_(Object.assign({ metrics: 'cardImpressions,cardClicks' }, f)).forEach(r => { o[r.video] = Object.assign(o[r.video] || {}, r); }); } catch (e) { ytaFail_('과거 카드'); }
  }
  if (a.length) igxUpsert_(ss, '유튜브 영상 분석', ['영상 ID', '구독 증가', '구독 감소', '공유', '평균 시청률(%)', '시청 시간(분)', '기록일'], [0], a);
  const b = Object.keys(o).map(id => { const r = o[id]; return [id, ytaNum_(r.videosAddedToPlaylists), ytaNum_(r.videosRemovedFromPlaylists), ytaNum_(r.dislikes), ytaNum_(r.cardImpressions), ytaNum_(r.cardClicks), today]; });
  if (b.length) igxUpsert_(ss, '유튜브 영상 추가 지표', ['영상 ID', '재생목록 추가', '재생목록 제거', '싫어요', '카드 노출', '카드 클릭', '기록일'], [0], b);
  return a.length;
}
function ytaPlaylists_(ss, today) {
  const pl = {};
  let tok = '';
  for (let p = 0; p < 10; p++) {
    const r = ytaGet_('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50' + (tok ? '&pageToken=' + tok : ''));
    (r.items || []).forEach(x => { pl[x.id] = { t: x.snippet.title, n: x.contentDetails.itemCount, d: Utilities.formatDate(new Date(x.snippet.publishedAt), TZ, 'yyyy-MM-dd') }; });
    tok = r.nextPageToken || ''; if (!tok) break;
  }
  const f = { startDate: YTA_HIST_START, endDate: today, dimensions: 'playlist', filters: 'isCurated==1', maxResults: 200, sort: '-playlistViews' };
  let st = [];
  const tries = ['playlistViews,playlistStarts,playlistEstimatedMinutesWatched,playlistAverageViewDuration,viewsPerPlaylistStart,averageTimeInPlaylist', 'playlistViews,playlistStarts,playlistEstimatedMinutesWatched', 'views,estimatedMinutesWatched'];
  for (const m of tries) { try { st = ytaReport_(Object.assign({}, f, { metrics: m, sort: '-' + m.split(',')[0] })); break; } catch (e) { if (m === tries[tries.length - 1]) throw e; } }
  const rows = st.map(r => [String(r.playlist), (pl[r.playlist] || {}).t || '', (pl[r.playlist] || {}).d || '', ytaNum_((pl[r.playlist] || {}).n),
    ytaNum_(r.playlistViews != null ? r.playlistViews : r.views), ytaNum_(r.playlistStarts), ytaNum_(r.playlistEstimatedMinutesWatched != null ? r.playlistEstimatedMinutesWatched : r.estimatedMinutesWatched),
    ytaNum_(r.playlistAverageViewDuration), ytaNum_(r.viewsPerPlaylistStart), ytaNum_(r.averageTimeInPlaylist), today]);
  igxUpsert_(ss, '유튜브 재생목록', ['재생목록 ID', '이름', '만든 날', '영상 수', '조회', '시작 수', '시청 시간(분)', '평균 시청(초)', '시작당 조회', '목록 안 평균 시간(분)', '기록일'], [0], rows);
  return rows.length;
}
function ytaTrafficDetail_(ss, today) {
  const yday = shiftDate_(today, -1), now = today, rows = [];
  const vids = ytaRecent_(YTA_RECENT_DAYS, today).filter(v => v.date <= yday);
  vids.forEach(v => ['EXT_URL', 'RELATED_VIDEO', 'PLAYLIST', 'NOTIFICATION'].forEach(t => {
    try { ytaReport_({ startDate: v.date, endDate: yday, dimensions: 'insightTrafficSourceDetail', metrics: 'views', filters: 'video==' + v.id + ';insightTrafficSourceType==' + t, sort: '-views', maxResults: 10 })
      .forEach(r => rows.push([v.id, v.title, YTA_TRAFFIC[t] || t, r.insightTrafficSourceDetail, r.views, now])); } catch (e) { ytaFail_('유입 세부'); }
  }));
  ytaReplaceSome_(ss, '유튜브 유입 세부', ['영상 ID', '제목', '유입 경로', '세부', '조회', '기록일'], vids.map(v => v.id), rows);
  return rows.length;
}
// 답글: ytaComments_가 모아 둔 것을 씀
let YTA_REPLIES_ = [], YTA_MYCH_ = null;
function ytaMyChannel_() {
  if (YTA_MYCH_ == null) { try { YTA_MYCH_ = ytaGet_('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true').items[0].id; } catch (e) { YTA_MYCH_ = ''; } }
  return YTA_MYCH_;
}
function ytaFlushReplies_(ss) {
  if (!YTA_REPLIES_.length) return 0;
  const n = YTA_REPLIES_.length;
  igxUpsert_(ss, '유튜브 답글', ['답글 ID', '상위 댓글 ID', '영상 ID', '작성 시각', '내용', '좋아요', '우리 채널 답글', '기록일'], [0], YTA_REPLIES_);
  YTA_REPLIES_ = [];
  return n;
}

// 주간 수집(월요일 10시 트리거, 메뉴로도 실행): 무거운 것 — 시청 지속률·태그·재생목록·지난달 시청자 분포·인스타 전체 게시물·접속 시간대
// 매일 기록과 따로 돌려 한 실행이 6분 한도를 넘지 않게 함. 시간이 모자라면 남은 것은 다음 주에(또는 다시 실행하면) 이어서
function weeklyExtras() {
  const t0 = Date.now(), deadline = t0 + 5 * 60 * 1000;
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const parts = [];
  const run = (name, fn) => { if (Date.now() > deadline - 60 * 1000) { parts.push(name + ' 다음에'); return; } try { parts.push(name + ' ' + fn()); } catch (e) { parts.push(name + ' 오류: ' + String(e.message).slice(0, 120)); } };
  if (PropertiesService.getScriptProperties().getProperty('YT_REFRESH')) {
    run('시청 지속률', () => ytaRecentVideos_(ss, today, true).ret + '줄');
    run('태그·재생목록', () => ytaVideoInfo_(ss, today) + '개');
    run('재생목록 성과', () => ytaPlaylists_(ss, today) + '개');
    run('유입 세부', () => ytaTrafficDetail_(ss, today) + '줄');
    run('영상별 시청자(최근 90일 영상)', () => { const yday = shiftDate_(today, -1); return ytaVideoAud_(ss, ytaRecent_(YTA_RECENT_DAYS, today).filter(v => v.date <= yday), yday, deadline - 60 * 1000) + '개'; });
    run('지난달 시청자', () => { const a = ytaAudience_(ss, today, YTA_MONTHS_PER_RUN); return a.months + '달' + (a.left ? '(남은 ' + a.left + '달)' : ''); });
  }
  if (igxChannels_().length) {
    run('인스타 접속 시간대', () => igmOnline_(ss, today) + '줄');
    run('인스타 전체 게시물', () => { const m = igmMedia_(ss, today, true, deadline); return m.n + '개' + (m.stopped ? '(시간 한도로 일부 — 다시 실행하면 이어서)' : '') + (m.miss.length ? '(받지 못한 지표: ' + m.miss.join(', ') + ')' : ''); });
  }
  logRows_(ss, [[new Date(), '주간 추가 수집', 0, parts.join(' · ') + ytaFailText_() + ' — ' + Math.round((Date.now() - t0) / 1000) + '초']]);
  Logger.log(parts.join(' · '));
}
function ensureWeeklyTrigger_() {
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'weeklyExtras')) return;
  ScriptApp.newTrigger('weeklyExtras').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(10).inTimezone(TZ).create();
}
// 편집기·메뉴에서 바로 한 번: 매일 몫(유튜브·인스타 추가)
function collectMoreNow() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const logs = [];
  ytaStep_(ss, today, logs);
  igmStep_(ss, today, logs);
  logRows_(ss, logs);
  logs.forEach(l => Logger.log(l[3]));
}

// ───────── 과거 채우기(backfillExtras): 메뉴로 여러 번 실행, 한 번에 5분까지 하고 다음 실행에서 이어서 ─────────
//  ① 유튜브 시청자 분포: 아직 없는 지난달(2024-01~)
//  ② 유튜브 2024-01 이후 영상의 유입 경로·검색어·시청 지속률·댓글(최근 90일 영상은 매일·주간 수집이 맡음)
//  ③ 인스타 계정 일별 도달·조회·프로필 방문·링크 클릭·참여 계정(하루씩, API가 주는 데까지 — 보통 2년 안팎)
// 진행 상황은 스크립트 속성 BACKFILL_DONE(끝난 항목)·BACKFILL_IG_DAY(인스타 다음에 받을 날짜)에 둠
function backfillExtras() {
  try { ensureTriggers_(); } catch (e) {}
  try { logMirror_(); } catch (e) {}
  try { const pp = PropertiesService.getScriptProperties(); if (COLLAB_SEED.some(r => String(pp.getProperty('COLLAB_SEEDED') || '').indexOf(igShort_(r[0])) < 0)) { const s1 = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID); logRows_(s1, [[new Date(), COLLAB_SHEET, collabStep_(s1), '처음 채움(담당자가 알려 준 게시물)']]); } } catch (e) {}
  const t0 = Date.now(), deadline = t0 + 5 * 60 * 1000;
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const p = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), yday = shiftDate_(today, -1);
  const done = JSON.parse(p.getProperty('BACKFILL_DONE') || '{}');
  const parts = [];
  const left = () => deadline - Date.now();

  // ① 시청자 분포(달마다 5질의)
  if (!done.aud2 && p.getProperty('YT_REFRESH')) {
    let n = 0, rest = 0;
    while (left() > 90 * 1000) { const a = ytaAudience_(ss, today, 1); n += a.months; rest = a.left; if (!a.months || !rest) break; }
    if (!rest) done.aud2 = 1;
    parts.push('유튜브 시청자 ' + n + '달 추가' + (rest ? '(남은 ' + rest + '달)' : '(완료)'));
  }
  // ② 영상별 유입 경로·검색어·지속률·댓글
  if (!done.vid2 && p.getProperty('YT_REFRESH') && left() > 90 * 1000) {
    const sh = ss.getSheetByName('유튜브 유입 경로');
    const have = {};
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(r => { have[r[0]] = 1; });
    const cut = shiftDate_(today, -YTA_RECENT_DAYS);
    const todo = ytaRecent_(YTA_ALL_DAYS, today).filter(v => v.date >= YTA_HIST_START && v.date < cut && !have[v.id]);
    const now = today, tr = [], kw = [], ret = [], cm = [], ids = [];
    for (let i = 0; i < todo.length && left() > 60 * 1000; i++) {
      const o = ytaVideoRows_(todo[i], yday, true, now);
      ids.push(todo[i].id);
      tr.push.apply(tr, o.tr.length ? o.tr : [[todo[i].id, todo[i].title, todo[i].date, '(조회 없음)', 0, 0, now]]); // 조회가 없는 영상도 「받음」 표시
      kw.push.apply(kw, o.kw); ret.push.apply(ret, o.ret); cm.push.apply(cm, o.cm);
    }
    if (ids.length) {
      ytaReplaceSome_(ss, '유튜브 유입 경로', YTA_TR_HEAD, ids, tr);
      ytaReplaceSome_(ss, '유튜브 검색어', YTA_KW_HEAD, ids, kw);
      ytaReplaceSome_(ss, '유튜브 시청 지속률', YTA_RET_HEAD, ids, ret);
      if (cm.length) igxUpsert_(ss, '유튜브 댓글', YTA_CM_HEAD, [0], cm); ytaFlushReplies_(ss);
    }
    const rest = todo.length - ids.length;
    if (!rest) done.vid2 = 1;
    parts.push('유튜브 과거 영상 ' + ids.length + '개(유입 ' + tr.length + '·검색어 ' + kw.length + '·지속률 ' + ret.length + '·댓글 ' + cm.length + ')' + (rest ? '(남은 ' + rest + '개)' : '(완료)'));
  }
  // ③ 인스타 계정 일별(하루씩 거꾸로)
  if (!done.ig && left() > 60 * 1000) {
    const chans = igxChannels_();
    if (chans.length) {
      const unix = d => Math.floor(new Date(d + 'T00:00:00+09:00').getTime() / 1000);
      let d = p.getProperty('BACKFILL_IG_DAY') || shiftDate_(today, -2);
      const floor = shiftDate_(today, -760), rows = [], now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
      let n = 0, empty = 0, stop = false;
      while (!stop && d >= floor && left() > 30 * 1000) {
        let got = false;
        chans.forEach(c => {
          const v = igxInsights_(c.conf, c.user, IGX_DAY_M, { period: 'day', metric_type: 'total_value', since: unix(d), until: unix(shiftDate_(d, 1)) }, []);
          if (IGX_DAY_M.some(m => v[m] !== undefined && v[m] !== '')) { got = true; rows.push([c.ch, d, '', '', '', ''].concat(IGX_DAY_M.map(m => v[m] === undefined ? '' : v[m])).concat([now])); }
        });
        n++; empty = got ? 0 : empty + 1;
        if (empty >= 7) stop = true; // 7일 내리 빈 값이면 API 보관 기간 끝으로 봄
        d = shiftDate_(d, -1);
      }
      if (rows.length) igxAccountMerge_(ss, rows);
      p.setProperty('BACKFILL_IG_DAY', d);
      if (stop || d < floor) done.ig = 1;
      parts.push('인스타 계정 일별 ' + n + '일 거슬러 ' + rows.length + '줄' + (done.ig ? '(완료 — ' + shiftDate_(d, 1 + (stop ? 7 : 0)) + '까지 받음)' : '(다음은 ' + d + '부터)'));
    } else { done.ig = 1; parts.push('인스타 건너뜀(IG_API 꺼짐)'); }
  }
  // ④ 유튜브 댓글: 2024-01 이후 모든 영상을 처음부터 한 번 더(예전 방식은 0개로 쌓였음). 진행은 BACKFILL_CM_I(다음 순번)
  if (!done.cm2 && left() > 45 * 1000) {
    const vids = ytaRecent_(1100, today).filter(v => v.date >= YT_PERIOD_START);
    let i = Number(p.getProperty('BACKFILL_CM2_I') || 0); // 2차(원인 확인용으로 처음부터 다시)
    const cm = [];
    for (; i < vids.length && left() > 30 * 1000; i++) Array.prototype.push.apply(cm, ytaComments_(vids[i].id, today));
    if (cm.length) igxUpsert_(ss, '유튜브 댓글', YTA_CM_HEAD, [0], cm); ytaFlushReplies_(ss);
    p.setProperty('BACKFILL_CM2_I', String(i));
    if (i >= vids.length) done.cm2 = 1;
    parts.push('유튜브 댓글 ' + cm.length + '개' + (done.cm2 ? '(완료)' : '(영상 ' + (vids.length - i) + '개 남음)'));
  }
  // ⑤ 유튜브 채널 일별 2017~2023(매일 수집은 2024-01부터)
  if (!done.chOld && p.getProperty('YT_REFRESH') && left() > 45 * 1000) {
    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    const rows = ytaReport_({ startDate: YTA_HIST_START, endDate: shiftDate_(YT_PERIOD_START, -1), dimensions: 'day', sort: 'day',
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares' })
      .map(r => [r.day, r.views, r.estimatedMinutesWatched, r.averageViewDuration, r.subscribersGained, r.subscribersLost, r.likes, r.comments, r.shares, now]);
    igxUpsert_(ss, '유튜브 채널 일별', ['날짜', '조회', '시청 시간(분)', '평균 시청(초)', '구독 증가', '구독 감소', '좋아요', '댓글', '공유', '기록 시각'], [0], rows);
    done.chOld = 1;
    parts.push('유튜브 채널 일별 2017~2023 ' + rows.length + '일');
  }
  // ⑥ 인스타 2024-12-27 이전 게시물(원본 시트 자동 수집 전): 조회·도달·좋아요·댓글·저장·공유를 「인스타 과거 게시물(API)」 탭에
  if (!done.igHist && left() > 60 * 1000) {
    const c = igxChannels_().filter(x => x.ch === '인스타그램')[0];
    if (!c) { done.igHist = 1; parts.push('인스타 과거 게시물 건너뜀(IG_API 꺼짐)'); }
    else {
      const head = ['게시물 ID', '게시 시각', '유형', '링크', '캡션 앞부분', '조회', '도달', '좋아요', '댓글', '저장', '공유', '상호작용', '기록일'];
      const sh = ss.getSheetByName('인스타 과거 게시물(API)');
      const have = {};
      if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(r => { have[r[0]] = 1; });
      const list = igMedia_(c.conf, c.user, 'id,caption,timestamp,permalink,media_type,media_product_type,like_count,comments_count', 100, '2010-01-01')
        .filter(m => Utilities.formatDate(new Date(m.timestamp), TZ, 'yyyy-MM-dd') < IG_CH['인스타그램'].from && !have[String(m.id)]);
      const rows = [], miss = [];
      let i = 0;
      for (; i < list.length && left() > 40 * 1000; i++) {
        const m = list[i];
        const v = igxInsights_(c.conf, m.id, ['views', 'reach', 'saved', 'shares', 'total_interactions'], null, miss);
        rows.push([String(m.id), Utilities.formatDate(new Date(m.timestamp), TZ, 'yyyy-MM-dd HH:mm'),
          m.media_product_type === 'REELS' ? '릴스' : (m.media_type === 'CAROUSEL_ALBUM' ? '캐러셀' : m.media_type === 'VIDEO' ? '영상' : '이미지'),
          m.permalink || '', String(m.caption || '').replace(/\s+/g, ' ').slice(0, 60),
          ytaNum_(v.views), ytaNum_(v.reach), Number(m.like_count) || 0, Number(m.comments_count) || 0, ytaNum_(v.saved), ytaNum_(v.shares), ytaNum_(v.total_interactions), today]);
      }
      if (rows.length) igxUpsert_(ss, '인스타 과거 게시물(API)', head, [0], rows);
      if (i >= list.length) done.igHist = 1;
      parts.push('인스타 과거 게시물 ' + rows.length + '개' + (done.igHist ? '(완료)' : '(남은 ' + (list.length - i) + '개)') + (miss.length ? '(받지 못한 지표: ' + Array.from(new Set(miss)).join(', ') + ')' : ''));
    }
  }
  // ⑦ 유튜브 보고서 API 파일 중 매일 수집에서 시간이 모자라 남은 것
  if (!done.ytr && p.getProperty('YT_REFRESH') && left() > 60 * 1000) {
    try {
      const r = ytrStep_(ss, left() - 45 * 1000);
      if (!r.left) done.ytr = 1;
      parts.push('유튜브 노출 ' + r.text);
    } catch (e) { done.ytr = 1; parts.push('유튜브 노출 오류(매일 수집에서 다시 시도): ' + String(e.message).slice(0, 120)); }
  }
  // ⑧ 모든 영상(2017~)의 구독 여부·연령·성별(최근 90일 영상은 매일·주간 수집이 맡음)
  if (!done.vidAud2 && p.getProperty('YT_REFRESH') && left() > 60 * 1000) {
    const sh = ss.getSheetByName('유튜브 영상 구독 여부');
    const have = {};
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(r => { have[r[0]] = 1; });
    const todo = ytaRecent_(YTA_ALL_DAYS, today).filter(v => v.date >= YTA_HIST_START && v.date <= yday && !have[v.id]);
    const n = ytaVideoAud_(ss, todo, yday, deadline - 45 * 1000);
    if (n >= todo.length) done.vidAud2 = 1;
    parts.push('유튜브 영상별 시청자 ' + n + '개' + (done.vidAud2 ? '(완료)' : '(남은 ' + (todo.length - n) + '개)'));
  }
  // ⑨ 인스타 팔로워/비팔로워 도달·조회(하루씩 거꾸로, API가 주는 데까지)
  if (!done.igFt && left() > 60 * 1000) {
    const chans = igxChannels_();
    if (chans.length) {
      let d = p.getProperty('BACKFILL_IG_FT_DAY') || shiftDate_(today, -4);
      const floor = shiftDate_(today, -760), rows = [], miss = [], now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
      let n = 0, empty = 0, stop = false;
      while (!stop && d >= floor && left() > 30 * 1000) {
        let got = false;
        chans.forEach(c => { const v = igxFollowType_(c, d, miss); if (v.some(x => x !== '')) { got = true; rows.push([c.ch, d].concat(v, [now])); } });
        n++; empty = got ? 0 : empty + 1;
        if (empty >= 7) stop = true;
        d = shiftDate_(d, -1);
      }
      if (rows.length) igxUpsert_(ss, IGX_FT_SHEET, IGX_FT_HEAD, [0, 1], rows);
      p.setProperty('BACKFILL_IG_FT_DAY', d);
      if (stop || d < floor) done.igFt = 1;
      parts.push('인스타 팔로워 구분 ' + n + '일 거슬러 ' + rows.length + '줄' + (done.igFt ? '(완료)' : '(다음은 ' + d + '부터)') + (miss.length ? '(받지 못한 지표: ' + miss.join(', ') + ')' : ''));
    } else { done.igFt = 1; parts.push('인스타 팔로워 구분 건너뜀(IG_API 꺼짐)'); }
  }
  // ⑩ 유튜브 시청자 분포의 새 구분(도시·공유 서비스·재생 위치·OS·콘텐츠 유형) — 지난달부터 거꾸로
  if (!done.aud3 && p.getProperty('YT_REFRESH') && left() > 60 * 1000) {
    let m = p.getProperty('BACKFILL_AUD3_M') || shiftDate_(today.slice(0, 7) + '-01', -1).slice(0, 7) + '-01', n = 0, rows = [];
    const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
    while (m >= YTA_HIST_START.slice(0, 7) + '-01' && left() > 45 * 1000) {
      const end = shiftDate_(Utilities.formatDate(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)), 'UTC', 'yyyy-MM-dd'), -1);
      rows = rows.concat(ytaAudienceRows_(m.slice(0, 7), m, end, now, 'more')); n++;
      m = shiftDate_(m, -1).slice(0, 7) + '-01';
    }
    if (rows.length) igxUpsert_(ss, '유튜브 시청자', ['기간', '구분', '항목', '값', '기록 시각'], [0, 1, 2], rows);
    p.setProperty('BACKFILL_AUD3_M', m);
    if (m < YTA_HIST_START.slice(0, 7) + '-01') done.aud3 = 1;
    parts.push('유튜브 시청자 새 구분 ' + n + '달' + (done.aud3 ? '(완료)' : '(다음은 ' + m.slice(0, 7) + ')'));
  }
  // ⑪ 유튜브 답글·1,000개까지 댓글: 모든 영상(2017~, 진행 BACKFILL_REP_I)
  if (!done.rep2 && p.getProperty('YT_API_KEY') && left() > 45 * 1000) { // 키가 없으면 권한 오류로 0개만 쌓이므로 키를 넣을 때까지 기다림
    const vids = ytaRecent_(YTA_ALL_DAYS, today).filter(v => v.date >= YTA_HIST_START);
    let i = Number(p.getProperty('BACKFILL_REP_I') || 0);
    const cm = [];
    for (; i < vids.length && left() > 30 * 1000; i++) Array.prototype.push.apply(cm, ytaComments_(vids[i].id, today));
    if (cm.length) igxUpsert_(ss, '유튜브 댓글', YTA_CM_HEAD, [0], cm);
    const nr = ytaFlushReplies_(ss);
    p.setProperty('BACKFILL_REP_I', String(i));
    if (i >= vids.length) done.rep2 = 1;
    parts.push('유튜브 댓글·답글 ' + cm.length + '·' + nr + '개' + (done.rep2 ? '(완료)' : '(영상 ' + (vids.length - i) + '개 남음)'));
  }
  // ⑫ 인스타 계정 일별 추가(하루씩 거꾸로)
  if (!done.igMore && left() > 60 * 1000) {
    const chans = igxChannels_();
    if (chans.length) {
      let d = p.getProperty('BACKFILL_IG_MORE_DAY') || shiftDate_(today, -4);
      const floor = shiftDate_(today, -760), rows = [], miss = [], bad = [], now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
      let n = 0, empty = 0, stop = false;
      while (!stop && d >= floor && left() > 30 * 1000) {
        let got = false;
        chans.forEach(c => { const r = igxDayMore_(c, d, miss, bad, now); if (r.length) { got = true; rows.push.apply(rows, r); } });
        n++; empty = got ? 0 : empty + 1;
        if (empty >= 7) stop = true;
        d = shiftDate_(d, -1);
      }
      if (rows.length) igxUpsert_(ss, IGX_MORE_SHEET, IGX_MORE_HEAD, [0, 1, 2, 3], rows);
      p.setProperty('BACKFILL_IG_MORE_DAY', d);
      if (stop || d < floor) done.igMore = 1;
      parts.push('인스타 계정 일별 추가 ' + n + '일 거슬러 ' + rows.length + '줄' + (done.igMore ? '(완료)' : '(다음은 ' + d + '부터)') + (miss.length ? '(받지 못한 지표: ' + miss.join(', ') + ')' : ''));
    } else { done.igMore = 1; }
  }
  // ⑬ 인스타 전체 게시물 세부(진행 BACKFILL_IGPM_I)
  if (!done.igPm2 && left() > 60 * 1000) {
    if (igxChannels_().length) {
      const r = igmMediaMore_(ss, today, true, deadline - 40 * 1000, Number(p.getProperty('BACKFILL_IGPM2_I') || 0));
      p.setProperty('BACKFILL_IGPM2_I', String(r.next));
      if (!r.stopped) done.igPm2 = 1;
      parts.push('인스타 게시물 세부 ' + r.n + '줄' + (done.igPm2 ? '(완료)' : '(게시물 ' + (r.total - r.next) + '개 남음)') + (r.miss.length ? '(받지 못한 지표: ' + r.miss.join(', ') + ')' : ''));
    } else { done.igPm2 = 1; }
  }
  // ⑭ 인스타 전체 게시물 댓글(진행 BACKFILL_IGC_I). 권한이 없으면 'perm'으로 멈추고, 매일 수집에서 권한이 확인되면 다시 시작
  if (!done.igCm2 && left() > 60 * 1000) {
    if (igxChannels_().length) {
      const r = igxComments_(ss, today, IG_ALL_FROM, deadline - 40 * 1000, Number(p.getProperty('BACKFILL_IGC2_I') || 0));
      if (r.perm) { done.igCm2 = 'perm'; parts.push('인스타 댓글: 권한 없음(토큰에 instagram_manage_comments를 넣으면 자동으로 다시 시작)'); }
      else {
        p.setProperty('BACKFILL_IGC2_I', String(r.next));
        if (!r.stopped) done.igCm2 = 1;
        parts.push('인스타 댓글 ' + r.n + '개' + (done.igCm2 ? '(완료)' : '(게시물 ' + (r.total - r.next) + '개 남음)'));
      }
    } else { done.igCm2 = 1; }
  }
  // ⑮ 2017~2023 영상의 영상 분석·추가 지표(매일 수집은 2024-01 이후 영상만)
  if (!done.vidOld && p.getProperty('YT_REFRESH') && left() > 60 * 1000) {
    const n = ytaVideoOld_(ss, today);
    done.vidOld = 1;
    parts.push('유튜브 2017~2023 영상 분석 ' + n + '개');
  }
  p.setProperty('BACKFILL_DONE', JSON.stringify(done));
  const all = done.aud2 && done.vid2 && done.ig && done.cm2 && done.chOld && done.igHist && done.ytr && done.vidAud2 && done.igFt && done.aud3 && done.rep2 && done.igMore && done.igPm2 && done.igCm2 && done.vidOld;
  const nextAt = backfillNext_();
  const tail = all ? ' · 전부 끝남' : nextAt ? ' · 오늘 밤 0시에 이어서(낮에는 쉼)' : ' · 1분 뒤 자동으로 이어서';
  logRows_(ss, [[new Date(), '과거 채우기', 0, parts.join(' · ') + ytaFailText_() + ' — ' + Math.round((Date.now() - t0) / 1000) + '초' + tail]]);
  Logger.log(parts.join(' · ') + tail);
  // 끝나지 않았으면 1분 뒤 자기 자신을 다시 예약(한 번만 실행하면 끝까지 감). 끝났으면 예약을 지움
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backfillExtras').forEach(t => ScriptApp.deleteTrigger(t));
  // 같은 단계가 계속 실패해도 무한히 돌지 않게 하룻밤 80번에서 멈춤(날짜가 바뀌면 다시 셈)
  const rd = p.getProperty('BACKFILL_RUNS_DAY') === today ? Number(p.getProperty('BACKFILL_RUNS') || 0) : 0, runs = rd + 1;
  p.setProperty('BACKFILL_RUNS', String(all ? 0 : runs)); p.setProperty('BACKFILL_RUNS_DAY', today);
  if (!all && nextAt) ScriptApp.newTrigger('backfillExtras').timeBased().at(nextAt).create();
  else if (!all && runs < 80) ScriptApp.newTrigger('backfillExtras').timeBased().after(60 * 1000).create();
  else if (!all) logRows_(ss, [[new Date(), '과거 채우기', 0, '오늘 밤 자동 반복 80번에서 멈춤 — 실행 로그의 오류를 확인하세요(다음 날 밤 다시 시작)']]);
  if (!all && !nextAt && runs >= 80) { const d = shiftDate_(today, 1); ScriptApp.newTrigger('backfillExtras').timeBased().at(new Date(d + 'T00:05:00+09:00')).create(); }
}
// 과거 채우기에 아직 안 끝난 항목이 있는데 예약이 없으면 1분 뒤로 예약(새 항목을 추가해 배포했을 때 사람이 누르지 않아도 시작)
function ensureBackfill_() {
  const d = JSON.parse(PropertiesService.getScriptProperties().getProperty('BACKFILL_DONE') || '{}');
  if (d.aud2 && d.vid2 && d.ig && d.cm2 && d.chOld && d.igHist && d.ytr && d.vidAud2 && d.igFt && d.aud3 && d.rep2 && d.igMore && d.igPm2 && d.igCm2 && d.vidOld) return;
  if (ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'backfillExtras')) return;
  const at = backfillNext_();
  if (at) ScriptApp.newTrigger('backfillExtras').timeBased().at(at).create(); else ScriptApp.newTrigger('backfillExtras').timeBased().after(60 * 1000).create();
}
// 과거 채우기 다음 시각: 0~6시면 null(1분 뒤 바로), 7시 이후면 다음 날 0시 5분
function backfillNext_() {
  const now = new Date(), h = Number(Utilities.formatDate(now, TZ, 'H'));
  if (h < 7) return null;
  return new Date(shiftDate_(Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), 1) + 'T00:05:00+09:00');
}
// 「인스타 계정 일별」에 줄을 합쳐 씀(같은 채널·날짜면 빈칸이 아닌 값만 덮어씀)
function igxAccountMerge_(ss, rows) {
  const sh = ss.getSheetByName(IGX_DAY_SHEET);
  const old = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, IGX_DAY_HEAD.length).getValues().forEach(r => { old[r[0] + '§' + (r[1] instanceof Date ? fmtDate_(r[1]) : r[1])] = r; });
  const out = rows.map(r => {
    const base = old[r[0] + '§' + r[1]];
    return base ? r.map((v, i) => (v === '' || v == null) ? (base[i] instanceof Date ? fmtDate_(base[i]) : base[i]) : v) : r;
  });
  igxUpsert_(ss, IGX_DAY_SHEET, IGX_DAY_HEAD, [0, 1], out);
}

// ───────── 밤 10시 성과 브리핑 메일 (2026-10-19) ─────────
// 매일 22:00(KST) 오늘 올린 게시물(인스타·hong·유튜브)의 지금 값을 API로 받아 담당자 메일로 보냄. PC가 꺼져 있어도 동작
//  · 받는 주소: 스크립트 속성 BRIEF_TO(공개 저장소라 코드에 넣지 않음). 없으면 보내지 않고 실행 로그에만 남김
//  · 처음 한 번: 편집기에서 setupNightBrief 실행(메일 보내기 권한 승인 + 22시 트리거) → testNightBrief로 지금 한 통
//  · 비교: 「당일 22시 기록」 탭에 매일 값을 쌓아 「올린 날 밤 기준 평소」(같은 채널·형식 5개 이상)를 만들고,
//    그 전에는 보드 데이터의 「평소 최종 조회」(같은 채널·형식 최근 1년 중간값, 게시 14일 이상) 대비로 보여 줌
const BRIEF_SHEET = '당일 22시 기록';
const BRIEF_HEAD = ['기록일', '채널', '게시물 ID', '형식', '게시 시각', '경과(시간)', '조회', '좋아요', '댓글', '공유', '저장', '도달', '기록 시각'];
const BRIEF_MIN = 5;                           // 「올린 날 밤 기준 평소」를 쓰려면 같은 채널·형식 기록이 이만큼 있어야 함

function setupNightBrief() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'nightBrief').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('nightBrief').timeBased().everyDays(1).atHour(22).nearMinute(0).inTimezone(TZ).create();
  MailApp.getRemainingDailyQuota(); // 메일 권한을 이 실행에서 승인받게 함
  Logger.log('22시 트리거 등록. 받는 주소(BRIEF_TO): ' + (PropertiesService.getScriptProperties().getProperty('BRIEF_TO') ? '있음' : '없음 — 프로젝트 설정 → 스크립트 속성에 BRIEF_TO 추가'));
}
function testNightBrief() { nightBrief(true); }

function nightBrief(test) {
  test = test === true;
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const now = new Date(), today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), stamp = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm');
  const notes = [];
  let posts = [];
  try { posts = posts.concat(briefInstagram_(today, notes)); } catch (e) { notes.push('인스타 확인 실패: ' + String(e.message).slice(0, 100)); }
  try { posts = posts.concat(briefYouTube_(today)); } catch (e) { notes.push('유튜브 확인 실패: ' + String(e.message).slice(0, 100)); }
  posts.forEach(x => { x.hours = Math.max(0, (now - x.at) / 3600000); });
  posts.sort((a, b) => a.at - b.at);
  let stories = [];
  try { igxStories_(ss); stories = briefStories_(ss, today); } catch (e) { notes.push('스토리 확인 실패: ' + String(e.message).slice(0, 100)); }
  let D = null;
  try { const j = cacheGet_(); D = j ? JSON.parse(j) : null; } catch (e) { D = null; }
  // 캐시가 비어 있으면(6시간 지남·캐시 밀려남) 보드 데이터를 바로 만들어 평소 값을 계산 — 없으면 평소 칸이 모두 「기준 없음」 (2026-10-20)
  if (!D) { try { D = buildDashboardData_(); } catch (e) { notes.push('평소 값 계산 실패: ' + String(e.message).slice(0, 80)); } }
  // 시트 읽기·쓰기는 시트가 바쁘면(다른 기록 실행 중) 타임아웃이 날 수 있어 실패해도 메일은 보냄 — 쓰기는 메일 뒤에 한 번 더 시도
  let night = {};
  try { night = briefNightBase_(ss, today); } catch (e) { notes.push('올린 날 밤 기록 읽기 실패'); }
  let extra = {};
  try { extra = briefExtraBase_(ss, D, today); } catch (e) { notes.push('팔로우·시청 평소 읽기 실패'); }
  posts.forEach(x => { x.night = night[x.ch + '|' + x.type] || null; x.usual = briefUsual_(D, x.ch, x.type, today); x.ex = extra[x.ch + '|' + (x.ch === 'hong._.video' && /릴스/.test(x.type) ? '릴스' : x.type)] || null; });
  const recent = posts.length ? [] : briefRecent_(D, today);
  const to = String(PropertiesService.getScriptProperties().getProperty('BRIEF_TO') || '').trim();
  const subject = '[SNS 브리핑] ' + briefDay_(today) + ' 오늘 올린 콘텐츠 ' + posts.length + '개' + (test ? ' (테스트)' : '');
  if (to) MailApp.sendEmail({ to: to, subject: subject, htmlBody: briefHtml_(posts, stories, recent, notes, today, stamp), name: 'SNS 성과 보드' });
  let saved = '';
  if (posts.length) {
    const rows = posts.map(x => [today, x.ch, x.id, x.type, Utilities.formatDate(x.at, TZ, 'yyyy-MM-dd HH:mm'), Math.round(x.hours * 10) / 10,
      x.views, x.likes, x.comments, x.shares, x.saves, x.reach, stamp]);
    for (let i = 0; i < 2 && saved !== 'ok'; i++) {
      try { igxUpsert_(ss, BRIEF_SHEET, BRIEF_HEAD, [0, 2], rows); saved = 'ok'; } catch (e) { saved = String(e.message).slice(0, 80); if (!i) Utilities.sleep(20000); }
    }
  }
  const msg = (to ? '보냄' : '보내지 않음: 스크립트 속성 BRIEF_TO 없음') + ' · 게시물 ' + posts.length + ' · 스토리 ' + stories.length
    + (saved && saved !== 'ok' ? ' · 「' + BRIEF_SHEET + '」 기록 실패: ' + saved : '') + (notes.length ? ' · ' + notes.join(' · ') : '');
  try { logRows_(ss, [[new Date(), '밤 브리핑', posts.length, msg]]); } catch (e) { Logger.log(msg); }
}

// 인스타(jjuniv·hong): 최신 게시물 25개 중 오늘 올린 것 + 지표
function briefInstagram_(today, notes, from) {
  from = from || today;
  const out = [];
  igxChannels_().forEach(c => {
    const list = igxGet_(c.conf, c.user + '/media', { fields: 'id,caption,timestamp,permalink,media_type,media_product_type,like_count,comments_count', limit: 25 }).data || [];
    list.filter(x => { const d = Utilities.formatDate(new Date(x.timestamp), TZ, 'yyyy-MM-dd'); return d >= from && d <= today; }).forEach(x => {
      const miss = [];
      const reel = x.media_product_type === 'REELS';
      const v = igxInsights_(c.conf, x.id, ['views', 'reach', 'saved', 'shares'].concat(reel ? ['ig_reels_avg_watch_time', 'profile_activity'] : ['follows', 'profile_activity']), null, miss);
      const msg = '일부 지표 없음: ' + miss.join(',');
      if (miss.length && notes.indexOf(msg) < 0) notes.push(msg);
      const g = k => v[k] === undefined ? '' : v[k];
      out.push({ ch: c.ch, id: String(x.id), at: new Date(x.timestamp), type: typeLabel_(x.media_product_type, x.media_type), title: String(x.caption || ''), url: x.permalink || '',
        views: g('views'), likes: Number(x.like_count) || 0, comments: Number(x.comments_count) || 0, shares: g('shares'), saves: g('saved'), reach: g('reach'),
        follows: g('follows'), pact: g('profile_activity'), avgw: v.ig_reels_avg_watch_time === undefined || v.ig_reels_avg_watch_time === '' ? '' : Math.round(Number(v.ig_reels_avg_watch_time) / 100) / 10 });
    });
  });
  return out;
}
// 유튜브: 업로드 목록에서 오늘 올린 영상 + 통계(브랜드 계정 토큰). 공유·저장·도달은 없음
function briefYouTube_(today, from) {
  from = from || today;
  const ids = ytaRecent_(from === today ? 1 : 2, today).filter(v => v.date >= from && v.date <= today).map(v => v.id);
  if (!ids.length) return [];
  const r = ytaGet_('https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails,status&id=' + ids.join(','));
  return (r.items || []).filter(x => x.status && x.status.privacyStatus === 'public').map(x => {
    const st = x.statistics || {}, sec = isoDur_(x.contentDetails && x.contentDetails.duration);
    return { ch: '유튜브', id: x.id, at: new Date(x.snippet.publishedAt), type: lengthBucket_(sec), title: String(x.snippet.title || ''), url: 'https://youtu.be/' + x.id,
      views: Number(st.viewCount) || 0, likes: Number(st.likeCount) || 0, comments: Number(st.commentCount) || 0, shares: '', saves: '', reach: '', follows: '', pact: '', avgw: '' };
  });
}
// 오늘 올린 스토리(「인스타 스토리」 탭, 방금 갱신한 값)
function briefStories_(ss, today) {
  const sh = ss.getSheetByName(IGX_STORY_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  const n = v => Number(String(v).replace(/,/g, '')) || 0;
  return sh.getRange(2, 1, sh.getLastRow() - 1, IGX_STORY_HEAD.length).getDisplayValues()
    .filter(r => String(r[2]).slice(0, 10) === today)
    .map(r => ({ ch: r[0], at: String(r[2]).slice(11, 16), views: n(r[5]), reach: n(r[6]), exits: n(r[14]) }));
}
// 「당일 22시 기록」의 지난 기록 → 채널|형식별 조회 중간값(기록 BRIEF_MIN개 이상만)
function briefNightBase_(ss, today) {
  const sh = ss.getSheetByName(BRIEF_SHEET), by = {}, out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues().forEach(r => {
    if (r[0] >= today || r[6] === '') return;
    const k = r[1] + '|' + r[3]; (by[k] = by[k] || []).push(Number(String(r[6]).replace(/,/g, '')) || 0);
  });
  Object.keys(by).forEach(k => { if (by[k].length >= BRIEF_MIN) out[k] = { med: briefMed_(by[k]), n: by[k].length }; });
  return out;
}
// 「인스타 게시물 추가」 탭 → 채널|형식별 평소(최근 1년·게시 14일 이상): 도달 1천 명당 팔로우(fpk)·프로필 활동(apk), 릴스 평균 시청(avgw, 초)
function briefExtraBase_(ss, D, today) {
  const sh = ss.getSheetByName('인스타 게시물 추가'), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  const norm = u => String(u || '').split('?')[0].replace(/\/+$/, '');
  const reach = {};
  ((D && D.items) || []).forEach(it => { if (it.u && it.r > 0) reach[norm(it.u)] = it.r; });
  const from = shiftDate_(today, -365), to = shiftDate_(today, -14), by = {};
  const n = v => { const x = Number(String(v).replace(/,/g, '')); return v === '' || isNaN(x) ? null : x; };
  sh.getRange(2, 1, sh.getLastRow() - 1, 12).getDisplayValues().forEach(r => {
    const d = String(r[2]).slice(0, 10); if (d < from || d > to) return;
    const k = r[0] + '|' + r[3], b = by[k] = by[k] || { fpk: [], apk: [], avgw: [] }, rc = reach[norm(r[4])];
    if (rc && n(r[5]) != null) b.fpk.push(n(r[5]) / rc * 1000);
    if (rc && n(r[7]) != null) b.apk.push(n(r[7]) / rc * 1000);
    if (n(r[9]) != null && n(r[9]) > 0) b.avgw.push(n(r[9]));
  });
  Object.keys(by).forEach(k => { const o = out[k] = {}; ['fpk', 'apk', 'avgw'].forEach(m => { if (by[k][m].length >= BRIEF_MIN) o[m] = briefMed_(by[k][m]); }); });
  return out;
}
// 보드 데이터: 같은 채널·형식, 최근 1년·게시 14일 이상 게시물(광고 제외)의 최종 조회 중간값 + 저장률·공유율(인스타, 도달 대비)·좋아요율(조회 대비) 중간값
// hong은 예전 공개 원본의 「릴스/영상」과 API의 「릴스」를 같은 형식으로 봄
function briefUsual_(D, ch, type, today) {
  if (!D || !D.items) return null;
  const from = shiftDate_(today, -365), to = shiftDate_(today, -14);
  const same = t => t === type || (ch === 'hong._.video' && /릴스/.test(t) && /릴스/.test(type));
  const its = D.items.filter(it => it.c === ch && same(it.t) && !it.ad && it.d >= from && it.d <= to);
  const last = its.map(it => { const h = briefLastRow_(it); return h ? { it: it, h: h } : null; }).filter(Boolean);
  if (last.length < BRIEF_MIN) return null;
  const rate = (f, g) => { const v = last.map(x => { const a = f(x), b = g(x); return a != null && b > 0 ? a / b : null; }).filter(x => x != null); return v.length >= BRIEF_MIN ? briefMed_(v) : null; };
  return { med: briefMed_(last.map(x => x.h[0])), n: last.length,
    like: rate(x => x.h[1], x => x.h[0]), save: rate(x => x.h[4], x => x.it.r), share: rate(x => x.h[3], x => x.it.r),
    react: rate(x => briefReactOf_(ch, x.h[1], x.h[2], x.h[3], x.h[4], x.it.r, x.h[0]), () => 1) };
}
// 반응률(분석법 보고서 2026-10-17: 채널·형식을 넘는 비교는 조회가 아니라 비율로, 인스타는 도달 분모)
//  · 인스타 = (좋아요+댓글+공유+저장) ÷ 도달 · 유튜브·hong = (좋아요+댓글) ÷ 조회(유튜브는 공유·저장·도달이 없고, hong 예전 기록에도 없음)
//  · 비율이라 올린 지 몇 시간인지에 덜 흔들림 → 오늘 올린 게시물끼리 순위를 매기는 기준
function briefReactOf_(ch, l, c, sh, sv, reach, views) {
  const n = v => Number(v) || 0;
  if (ch === '인스타그램') return Number(reach) > 0 ? (n(l) + n(c) + n(sh) + n(sv)) / Number(reach) : null;
  return Number(views) > 0 ? (n(l) + n(c)) / Number(views) : null;
}
function briefReactCmp_(x) {
  const v = briefReactOf_(x.ch, x.likes, x.comments, x.shares, x.saves, x.reach, x.views), b = x.usual && x.usual.react;
  return v != null && b > 0 ? { r: v / b, v: v, base: b } : null;
}
const briefDen_ = ch => ch === '인스타그램' ? '도달 대비' : '조회 대비';
function briefLastRow_(it) { for (let i = (it.h || []).length - 1; i >= 0; i--) if (it.h[i] && it.h[i][0] != null) return it.h[i]; return null; }
function briefLast_(it) { const h = briefLastRow_(it); return h ? h[0] : null; }
// 오늘 올린 게 없을 때: 최근 3일 게시물(보드 데이터 = 오늘 아침 기록 값)
function briefRecent_(D, today) {
  if (!D || !D.items) return [];
  const from = shiftDate_(today, -3), own = ['인스타그램', '유튜브', 'hong._.video'];
  return D.items.filter(it => own.indexOf(it.c) >= 0 && it.t !== '스토리' && it.d >= from && it.d < today)
    .map(it => ({ ch: it.c, d: it.d, title: String(it.n || ''), views: briefLast_(it) }))
    .sort((a, b) => a.d < b.d ? 1 : -1);
}
function briefMed_(a) { const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function briefDay_(d) { const t = new Date(d + 'T12:00:00+09:00'); return Number(d.slice(5, 7)) + '/' + Number(d.slice(8, 10)) + '(' + '일월화수목금토'[Number(Utilities.formatDate(t, TZ, 'u')) % 7] + ')'; }
function briefNum_(v) { if (v === '' || v == null) return '–'; v = Number(v); return v >= 10000 ? (Math.round(v / 1000) / 10) + '만' : Math.round(v).toLocaleString('ko-KR'); }
function briefPct_(v) { return v == null ? '–' : (Math.round(v * 1000) / 10) + '%'; }
function briefEsc_(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
// 캡션 첫 줄(원문 그대로, 길면 말줄임)
function briefTitle_(s, n) { n = n || 60; const t = String(s || '').split('\n').map(x => x.trim()).filter(Boolean)[0] || '(캡션 없음)'; return t.length > n ? t.slice(0, n) + '…' : t; }
function briefAgo_(h) { const m = Math.round(h * 60); return m < 60 ? m + '분 지남' : Math.floor(m / 60) + '시간 ' + (m % 60) + '분 지남'; }

// ─ 메일 디자인(2026-10-19 3차): 막대 대신 「판정 칩」 — 2배를 넘으면 막대가 꽉 차서 얼마나 좋은지 안 보였음
//  판정: 평소의 0.7배 미만 낮음 · 1.3배 미만 평소 수준 · 2배 미만 잘 됨 · 5배 미만 아주 잘 됨 · 그 이상 대박(분석법 보고서의 vidIQ식 배수 단계)
const BR = { fg: '#191f28', sub: '#4e5968', mu: '#8b95a1', line: '#e5e8eb', soft: '#f2f4f6', up: '#0078ad', upSoft: '#e6f2f8', down: '#f26b2a', downTx: '#c2410c', downSoft: '#fdeee6', navy: '#005494' };
const BR_CH = { '인스타그램': ['인스타', '#d6336c'], '유튜브': ['유튜브', '#1864ab'], 'hong._.video': ['hong', '#0ca678'] };
const BR_TIER = [[0.7, '평소보다 낮음', '#c2410c', '#fdeee6'], [1.3, '평소 수준', '#4e5968', '#f2f4f6'], [2, '잘 됨', '#0078ad', '#e6f2f8'], [5, '아주 잘 됨', '#ffffff', '#0078ad'], [Infinity, '대박', '#ffffff', '#005494']];
function briefTier_(r) { return BR_TIER.filter(t => r < t[0])[0]; }
function briefRatioText_(r) { return r >= 2 ? (Math.round(r * 10) / 10) + '배' : Math.round(r * 100) + '%'; }
function briefChipTier_(r, grow) {
  const t = grow ? [0, '아직 느는 중', BR.sub, BR.soft] : briefTier_(r);
  return '<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap;background:' + t[3] + ';color:' + t[2] + '">' + t[1] + '</span>';
}
// 이 게시물 조회수가 평소의 몇 배인지. 올린 날 밤 기록이 쌓였으면 그것, 아니면 다 늘어난 평소 조회수(fin)
function briefRatio_(x) {
  if (x.views === '' || x.views == null) return null;
  if (x.night && x.night.med > 0) return { r: x.views / x.night.med, base: x.night.med, kind: 'night' };
  if (x.usual && x.usual.med > 0) return { r: x.views / x.usual.med, base: x.usual.med, kind: 'fin' };
  return null;
}
function briefKind_(x) { const t = String(x.type || ''); return x.ch === '유튜브' ? (t ? t + ' 영상' : '영상') : x.ch === 'hong._.video' ? 'hong 릴스' : t === '이미지' ? '사진' : (t || '게시물'); }
function briefChip_(ch, type) {
  const c = BR_CH[ch] || [ch, BR.sub];
  return '<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:' + c[1] + ';margin-right:6px"></span><span style="font-size:12px;font-weight:700;color:' + c[1] + '">' + briefEsc_(c[0]) + '</span>'
    + (type ? '<span style="font-size:12px;color:' + BR.mu + '"> · ' + briefEsc_(type) + '</span>' : '');
}
function briefTile_(label, value, sub) {
  return '<td width="50%" style="padding:6px" valign="top"><div style="background:#fff;border:1px solid ' + BR.line + ';border-radius:14px;padding:14px 16px">'
    + '<div style="font-size:12px;color:' + BR.mu + ';white-space:nowrap;overflow:hidden">' + label + '</div>'
    + '<div style="font-size:24px;font-weight:800;color:' + BR.fg + ';line-height:1.3">' + value + '</div>'
    + '<div style="font-size:12px;color:' + BR.mu + ';white-space:nowrap;overflow:hidden">' + (sub || '&nbsp;') + '</div></div></td>';
}
// 게시물 한 개의 비교 항목: [이름, 이 게시물 값, 평소 값, 표시 함수, 아직 느는 중 여부]
function briefMetrics_(x) {
  const u = x.usual || {}, e = x.ex || {}, rv = (a, b, k) => a !== '' && a != null && Number(b) > 0 ? Number(a) / Number(b) * (k || 1) : null;
  const per = v => v == null ? '–' : (Math.round(v * 10) / 10) + '명';
  const out = [];
  if (x.cmp) out.push(['조회수', Number(x.views), x.cmp.base, briefNum_, x.cmp.kind === 'fin' && x.cmp.r < 1]);
  out.push(['반응률', briefReactOf_(x.ch, x.likes, x.comments, x.shares, x.saves, x.reach, x.views), u.react, briefPct_]);
  if (x.ch !== '유튜브') {
    out.push(['공유율', rv(x.shares, x.reach), u.share, briefPct_]);
    out.push(['저장률', rv(x.saves, x.reach), u.save, briefPct_]);
  }
  out.push(['좋아요율', rv(x.likes, x.views), u.like, briefPct_]);
  if (x.ch !== '유튜브') {
    out.push(['도달 1천 명당 팔로우', rv(x.follows, x.reach, 1000), e.fpk, per]);
    out.push(['도달 1천 명당 프로필 활동', rv(x.pact, x.reach, 1000), e.apk, per]);
    if (x.avgw !== '' && x.avgw != null) out.push(['릴스 평균 시청', Number(x.avgw), e.avgw, v => v == null ? '–' : (Math.round(v * 10) / 10) + '초']);
  }
  return out.filter(m => m[1] != null && !isNaN(m[1])).map(m => ({ name: m[0], v: m[1], base: m[2], fmt: m[3], grow: !!m[4], r: m[2] > 0 ? m[1] / m[2] : null }));
}
function briefHtml_(posts, stories, recent, notes, today, stamp) {
  const wrap = s => '<div style="background:' + BR.soft + ';padding:20px 12px"><div style="font-family:\'Noto Sans KR\',\'Apple SD Gothic Neo\',sans-serif;max-width:560px;margin:0 auto;color:' + BR.fg + ';line-height:1.7">' + s + '</div></div>';
  const card = s => '<div style="background:#fff;border:1px solid ' + BR.line + ';border-radius:16px;padding:16px 18px;margin:0 0 12px">' + s + '</div>';
  const h2 = (t, sub) => '<div style="margin:18px 4px 8px"><div style="font-size:16px;font-weight:800">' + t + '</div>' + (sub ? '<div style="font-size:12px;color:' + BR.mu + '">' + sub + '</div>' : '') + '</div>';
  const tbl = s => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + s + '</table>';
  posts.forEach(x => {
    x.cmp = briefRatio_(x); x.rc = briefReactCmp_(x); x.ms = briefMetrics_(x);
    const judged = x.ms.filter(m => m.r != null && !m.grow && m.name !== '조회수' && m.name !== '반응률'); // 강점·약점은 반응률을 이루는 세부 지표에서
    x.best = judged.slice().sort((a, b) => b.r - a.r)[0] || null;
    x.worst = judged.slice().sort((a, b) => a.r - b.r)[0] || null;
  });
  posts = posts.slice().sort((a, b) => (b.rc ? 1 : 0) - (a.rc ? 1 : 0) || (a.rc && b.rc ? b.rc.r - a.rc.r : 0) || (Number(b.views) || 0) - (Number(a.views) || 0));
  const withRc = posts.filter(x => x.rc), goodRc = withRc.filter(x => x.rc.r >= 1.3).length;
  const sumV = posts.reduce((a, x) => a + (Number(x.views) || 0), 0), sumF = posts.reduce((a, x) => a + (Number(x.follows) || 0), 0), hasF = posts.some(x => x.follows !== '' && x.follows != null);
  const top = withRc[0];
  let h = '';
  // 머리: 오늘의 한 줄
  h += '<div style="background:' + BR.up + ';background:linear-gradient(135deg,' + BR.up + ',' + BR.navy + ');border-radius:18px;padding:20px 22px;color:#fff;margin-bottom:6px">'
    + '<div style="font-size:12px;opacity:.85">SNS 밤 브리핑 · ' + stamp.slice(11) + ' 기준</div>'
    + '<div style="font-size:22px;font-weight:800;line-height:1.4">' + briefDay_(today) + ' 오늘 올린 콘텐츠 ' + posts.length + '개</div>'
    + (top ? '<div style="font-size:14px;opacity:.95;line-height:1.6;margin-top:4px">반응 1등 「' + briefEsc_(briefTitle_(top.title, 18)) + '」' + (top.best && top.best.r >= 1.3 ? '<br>' + top.best.name + ' 평소의 ' + briefRatioText_(top.best.r) : '') + '</div>' : '') + '</div>';
  // 오늘의 반응 순위(맨 위): 줄마다 한 가지만 — 1줄 순위·채널·판정 칩, 2줄 제목(두 줄까지), 3줄 반응률·강점
  if (withRc.length) {
    let g = '';
    withRc.forEach((x, i) => {
      const bd = i ? 'border-top:1px solid ' + BR.line + ';' : '';
      const strong = x.best && x.best.r >= 1.3 ? ' · 강점 <b style="color:' + BR.up + '">' + x.best.name + '</b> 평소의 ' + briefRatioText_(x.best.r) : '';
      g += '<tr><td style="' + bd + 'padding:12px 0 2px;line-height:1.5"><span style="font-size:15px;font-weight:800;margin-right:8px">' + (i + 1) + '</span>' + briefChip_(x.ch, x.type) + '</td>'
        + '<td style="' + bd + 'padding:12px 0 2px;text-align:right;line-height:1.5">' + briefChipTier_(x.rc.r) + '</td></tr>'
        + '<tr><td colspan="2" style="padding:4px 0 0;font-size:14px;font-weight:700;line-height:1.5">' + briefEsc_(briefTitle_(x.title, 40)) + '</td></tr>'
        + '<tr><td colspan="2" style="padding:4px 0 12px;font-size:12px;color:' + BR.sub + ';line-height:1.5">반응률 평소의 <b style="color:' + BR.fg + '">' + briefRatioText_(x.rc.r) + '</b>' + strong + '</td></tr>';
    });
    h += h2('오늘의 반응 순위', '반응률로 매긴 순위 · 비율이라 올린 지 얼마 안 돼도 견줄 수 있어요');
    h += card(tbl(g) + '<div style="margin-top:4px;padding-top:12px;border-top:1px solid ' + BR.line + ';font-size:11px;color:' + BR.mu + ';line-height:2.4">'
      + BR_TIER.map((t, i) => '<span style="white-space:nowrap;margin-right:10px"><span style="display:inline-block;padding:0 8px;border-radius:999px;line-height:1.8;background:' + t[3] + ';color:' + t[2] + ';font-weight:700">' + t[1] + '</span> '
        + (i === 0 ? '0.7배 미만' : i === 4 ? '5배 이상' : BR_TIER[i - 1][0] + '~' + t[0] + '배') + '</span>').join(' ') + '</div>');
  }
  // 숫자 타일
  const sv = stories.reduce((a, s) => a + s.views, 0);
  h += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 -6px"><tr>'
    + briefTile_('오늘 게시물 조회수 합계', briefNum_(sumV), '게시물 ' + posts.length + '개')
    + briefTile_('반응률 잘 됨 이상', withRc.length ? goodRc + ' / ' + withRc.length : '–', '평소의 1.3배 이상') + '</tr><tr>'
    + briefTile_('오늘 게시물로 새 팔로우', hasF ? briefNum_(sumF) + '명' : '–', hasF ? '인스타·hong 피드 게시물' : '릴스는 메타가 주지 않음')
    + briefTile_('오늘 스토리 조회수', stories.length ? briefNum_(sv) : '–', '스토리 ' + stories.length + '개') + '</tr></table>';
  // 게시물별 카드
  if (posts.length) h += h2('게시물별 자세히', '반응 좋은 순 · 지표마다 같은 형식의 평소와 견줘요');
  const stat = (k, v) => '<td width="20%" style="padding:3px" valign="top"><div style="background:' + BR.soft + ';border-radius:10px;padding:6px 8px;text-align:center"><div style="font-size:11px;color:' + BR.mu + '">' + k + '</div><div style="font-size:14px;font-weight:800">' + v + '</div></div></td>';
  posts.forEach(x => {
    const c = BR_CH[x.ch] || [x.ch, BR.sub];
    let s = '<div style="border-left:4px solid ' + c[1] + ';padding-left:12px;margin-left:-6px">' + briefChip_(x.ch, x.type)
      + '<div style="font-size:16px;font-weight:800;margin:2px 0 0;line-height:1.5">' + briefEsc_(briefTitle_(x.title)) + '</div>'
      + '<div style="font-size:12px;color:' + BR.mu + '">' + Utilities.formatDate(x.at, TZ, 'HH:mm') + ' 올림 · ' + briefAgo_(x.hours) + '</div></div>';
    // 한 줄 요약
    const hasBest = x.best && x.best.r >= 1.3, hasWorst = x.worst && x.worst !== x.best && x.worst.r < 0.7;
    if (hasBest || hasWorst) {
      const line = (lab, m, col) => '<tr><td style="font-size:12px;color:' + BR.mu + ';width:36px;padding:2px 0">' + lab + '</td><td style="font-size:13px;padding:2px 0"><b style="color:' + col + '">' + m.name + '</b> 평소의 ' + briefRatioText_(m.r) + '</td><td style="text-align:right;padding:2px 0">' + briefChipTier_(m.r) + '</td></tr>';
      s += '<div style="background:' + BR.soft + ';border-radius:12px;padding:10px 12px;margin-top:10px">' + tbl((hasBest ? line('강점', x.best, BR.up) : '') + (hasWorst ? line('약점', x.worst, BR.downTx) : '')) + '</div>';
    }
    // 원래 숫자
    s += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:10px -3px 0"><tr>' + stat('조회수', briefNum_(x.views)) + stat('좋아요', briefNum_(x.likes)) + stat('댓글', briefNum_(x.comments))
      + (x.ch !== '유튜브' ? stat('공유', briefNum_(x.shares)) + stat('저장', briefNum_(x.saves)) : '<td></td><td></td>') + '</tr></table>';
    // 지표별 평소 비교 표
    let t = '<tr><td style="font-size:11px;color:' + BR.mu + ';padding:8px 0 4px">지표</td><td style="font-size:11px;color:' + BR.mu + ';text-align:right;padding:8px 6px 4px">이 게시물</td><td style="font-size:11px;color:' + BR.mu + ';text-align:right;padding:8px 6px 4px">평소</td><td style="font-size:11px;color:' + BR.mu + ';text-align:right;padding:8px 0 4px">판정</td></tr>';
    x.ms.forEach(m => {
      t += '<tr><td style="font-size:13px;padding:6px 0;border-top:1px solid ' + BR.line + '">' + m.name + '</td>'
        + '<td style="font-size:13px;font-weight:800;text-align:right;padding:6px;border-top:1px solid ' + BR.line + ';white-space:nowrap">' + m.fmt(m.v) + '</td>'
        + '<td style="font-size:13px;color:' + BR.mu + ';text-align:right;padding:6px;border-top:1px solid ' + BR.line + ';white-space:nowrap">' + (m.base > 0 ? m.fmt(m.base) : '–') + '</td>'
        + '<td style="text-align:right;padding:6px 0;border-top:1px solid ' + BR.line + '">' + (m.r != null ? briefChipTier_(m.r, m.grow) : '<span style="font-size:12px;color:' + BR.mu + '">기준 없음</span>') + '</td></tr>';
    });
    s += '<div style="margin-top:6px">' + tbl(t) + '</div>';
    if (x.cmp && x.cmp.kind === 'fin' && x.cmp.r < 1) s += '<div style="font-size:11px;color:' + BR.mu + '">조회수 평소 = 조회가 다 늘어난 게시물 값이라, 올린 지 ' + Math.max(1, Math.round(x.hours)) + '시간인 지금은 낮게 나와요</div>';
    if (x.url) s += '<div style="margin-top:10px"><a href="' + briefEsc_(x.url) + '" style="color:' + BR.up + ';font-size:13px;font-weight:700;text-decoration:none">게시물 열기 ›</a></div>';
    h += card(s);
  });
  if (!posts.length) {
    let s = '<div style="font-size:16px;font-weight:800">오늘 올린 콘텐츠 없음</div>';
    if (recent.length) {
      s += '<div style="font-size:12px;color:' + BR.mu + ';margin:4px 0 6px">최근 3일 게시물 · 오늘 아침 기록</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px">';
      recent.slice(0, 10).forEach(r => { s += '<tr><td style="padding:4px 0;border-top:1px solid ' + BR.line + '">' + Number(r.d.slice(5, 7)) + '/' + Number(r.d.slice(8)) + ' ' + briefChip_(r.ch, '') + ' ' + briefEsc_(briefTitle_(r.title, 22)) + '</td><td style="padding:4px 0;border-top:1px solid ' + BR.line + ';text-align:right;font-weight:700;white-space:nowrap">조회수 ' + briefNum_(r.views) + '</td></tr>'; });
      s += '</table>';
    } else s += '<div style="font-size:12px;color:' + BR.mu + '">최근 3일에도 올린 게시물이 없어요</div>';
    h += card(s);
  }
  if (stories.length) {
    const sum = k => stories.reduce((a, s) => a + s[k], 0), rc = sum('reach'), ex = sum('exits');
    h += h2('스토리', '');
    h += card('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 -3px"><tr>' + stat('오늘 스토리', stories.length + '개') + stat('조회수', briefNum_(sum('views'))) + stat('도달', briefNum_(rc)) + '</tr></table>'
      + (rc > 0 ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-top:8px"><tr><td style="color:' + BR.sub + '">중간에 나간 비율 · 도달 대비</td><td style="text-align:right;font-weight:800">' + briefPct_(ex / rc) + '</td></tr></table>' : ''));
  }
  if (posts.some(x => x.ch === '유튜브')) notes.push('유튜브 시청 시간·구독 증감·유입 경로는 분석 API가 1~2일 늦게 줘서 오늘 메일에는 없어요 · 보드 유튜브 탭에서 확인');
  if (notes.length) h += '<div style="font-size:12px;color:' + BR.mu + ';margin:4px 4px 12px">' + notes.map(briefEsc_).join('<br>') + '</div>';
  h += '<div style="text-align:center;margin:18px 0 6px"><a href="' + BOARD_URL + '" style="display:inline-block;background:' + BR.up + ';color:#fff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:800;font-size:14px">성과 보드에서 자세히 보기</a></div>';
  h += '<div style="font-size:11px;color:' + BR.mu + ';text-align:center;line-height:1.6">반응률 = 인스타는 좋아요·댓글·공유·저장 ÷ 도달, 유튜브·hong은 좋아요·댓글 ÷ 조회수<br>평소 = 최근 1년 같은 형식 게시물을 그 값 순으로 줄 세웠을 때 가운데 값 · 광고 제외</div>';
  return wrap(h);
}

// ───────── 보드 분석 데이터(part, 2026-10-20): API로 쌓은 탭을 보드가 필요할 때 따로 받음 ─────────
// doGet ?part=yt(유튜브 채널 일별·영상별 분석·유입 경로·시청자·채널 검색어) | ig(인스타 계정 일별·게시물 추가 지표·팔로워 분포·스토리)
//       | yv&v=<영상 ID>(그 영상의 시청 지속 곡선·검색어). 기본 응답(약 1MB)에 넣지 않아 첫 화면이 느려지지 않음
//  · JSONP 콜백은 __sbData 또는 __sbP + 숫자(동시에 여러 개 부를 수 있게). 캐시는 part마다 따로, 매일 기록 때 비움
const PART_CB = /^__sbP\d{1,6}$/;
const PART_TABS = { yt: 1, ig: 1, yv: 1, today: 1 };
function buildPart_(part, e) {
  const ss = SpreadsheetApp.openById(SS_ID);
  if (part === 'yt') return partYt_(ss);
  if (part === 'ig') return partIg_(ss);
  if (part === 'yv') return partYv_(ss, String((e && e.parameter && e.parameter.v) || '').replace(/[^\w-]/g, '').slice(0, 20));
  if (part === 'today') return partToday_(ss);
  return { error: 'part' };
}
function partRows_(ss, name, cols) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues();
}
const partN_ = v => v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
const partD_ = v => v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').slice(0, 10);
function partYt_(ss) {
  // 채널 일별 [날짜, 조회, 시청 시간(분), 평균 시청(초), 구독 증가, 구독 감소, 좋아요, 댓글, 공유]
  const day = partRows_(ss, '유튜브 채널 일별', 9).map(r => [partD_(r[0])].concat(r.slice(1, 9).map(partN_))).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r[0]))
    .sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  // 영상별 {영상 ID: [구독 증가, 구독 감소, 공유, 평균 시청률(%), 시청 시간(분)]}
  const vid = {};
  partRows_(ss, '유튜브 영상 분석', 6).forEach(r => { const id = String(r[0]).trim(); if (id) vid[id] = r.slice(1, 6).map(partN_); });
  // 영상별 유입 경로 {영상 ID: [[경로 번호, 조회, 시청 시간(분)], …]}, 경로 이름은 srcN
  const srcN = [], si = {}, src = {};
  partRows_(ss, '유튜브 유입 경로', 6).forEach(r => {
    const id = String(r[0]).trim(), s = String(r[3]).trim(), v = partN_(r[4]);
    if (!id || !s || !v) return;
    if (!(s in si)) { si[s] = srcN.length; srcN.push(s); }
    (src[id] = src[id] || []).push([si[s], v, partN_(r[5])]);
  });
  // 시청자: 최근 28일 + 최근 24달 [기간, 구분, 항목, 값]
  const cut = shiftDate_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), -740).slice(0, 7);
  const aud = partRows_(ss, '유튜브 시청자', 4).map(r => [r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, 'yyyy-MM') : String(r[0]).trim(), String(r[1]).trim(), String(r[2]).trim(), partN_(r[3])])
    .filter(r => r[3] != null && (r[0] === '최근 28일' || r[0] >= cut));
  // 채널 전체 검색어(최근 28일)
  const kw = partRows_(ss, '유튜브 검색어', 4).filter(r => String(r[0]).indexOf('(채널 전체') === 0).map(r => [String(r[2]), partN_(r[3])]).filter(r => r[1]).sort((a, b) => b[1] - a[1]).slice(0, 30);
  // 노출·노출 클릭률(보고서 API): 날짜별 [날짜, 노출, 클릭률] · 영상별 {ID: [노출, 클릭률]}. 클릭률은 노출 가중, 값이 %로 오면 0~1로 바꿈
  const imD = {}, imV = {};
  let ctrMax = 0;
  partRows_(ss, '유튜브 노출', 4).forEach(r => {
    const d = partD_(r[0]), id = String(r[1]).trim(), n = partN_(r[2]), c = partN_(r[3]) || 0;
    if (!n || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (c > ctrMax) ctrMax = c;
    const a = imD[d] = imD[d] || [0, 0], b = imV[id] = imV[id] || [0, 0];
    a[0] += n; a[1] += n * c; b[0] += n; b[1] += n * c;
  });
  const cu = ctrMax > 1 ? 100 : 1;
  const imp = Object.keys(imD).sort().map(d => [d, imD[d][0], imD[d][1] / imD[d][0] / cu]);
  const vimp = {};
  Object.keys(imV).forEach(id => { vimp[id] = [imV[id][0], imV[id][1] / imV[id][0] / cu]; });
  // 형식별 일별 [날짜, 형식, 조회, 시청 시간(분), 구독 증가]
  const ctype = partRows_(ss, '유튜브 유형 일별', 5).map(r => [partD_(r[0]), String(r[1]).trim(), partN_(r[2]), partN_(r[3]), partN_(r[4])])
    .filter(r => r[1] && r[2] != null && /^\d{4}-\d{2}-\d{2}$/.test(r[0])).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  // 재생목록 조회 상위 [이름, 영상 수, 조회, 시청 시간(분), 평균 시청(초)]
  const pl = partRows_(ss, '유튜브 재생목록', 8).map(r => [String(r[1]), partN_(r[3]), partN_(r[4]), partN_(r[6]), partN_(r[7])]).filter(r => r[2]).sort((a, b) => b[2] - a[2]).slice(0, 12);
  // 영상 추가 지표 {ID: [재생목록 추가, 재생목록 제거, 싫어요, 카드 노출, 카드 클릭]}
  const vx = {};
  partRows_(ss, '유튜브 영상 추가 지표', 6).forEach(r => { const id = String(r[0]).trim(); if (id) vx[id] = r.slice(1, 6).map(partN_); });
  // 댓글 {ID: [받아 둔 댓글 수, 우리 채널이 답한 댓글 수]}
  const cm = {}, cmV = {};
  partRows_(ss, '유튜브 댓글', 2).forEach(r => { const id = String(r[1]).trim(); if (!id) return; cmV[String(r[0])] = id; (cm[id] = cm[id] || [0, 0])[0]++; });
  const ans = {};
  partRows_(ss, '유튜브 답글', 7).forEach(r => { if (String(r[6]).trim() && !ans[r[1]] && cmV[r[1]]) { ans[r[1]] = 1; cm[cmV[r[1]]][1]++; } });
  return { day: day, vid: vid, srcN: srcN, src: src, aud: aud, kw: kw, imp: imp, vimp: vimp, ctype: ctype, pl: pl, vx: vx, cm: cm };
}
function partIg_(ss) {
  // 계정 일별 [채널, 날짜, 팔로워, 새 팔로워, 도달, 조회, 프로필 방문, 링크 클릭, 참여 계정]
  const day = partRows_(ss, IGX_DAY_SHEET, IGX_DAY_HEAD.length).map(r => [String(r[0]).trim(), partD_(r[1]), partN_(r[2]), partN_(r[5]), partN_(r[6]), partN_(r[7]), partN_(r[8]), partN_(r[9]), partN_(r[10])])
    .filter(r => r[0] && /^\d{4}-\d{2}-\d{2}$/.test(r[1])).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  // 게시물 추가 지표 {게시물 주소: [팔로우 유입, 프로필 방문, 프로필 활동, 상호작용, 릴스 평균 시청(초), 릴스 총 시청(초)]}
  const post = {};
  partRows_(ss, '인스타 게시물 추가', 11).forEach(r => { const u = String(r[4]).split('?')[0].replace(/\/+$/, ''); if (u) post[u] = r.slice(5, 11).map(partN_); });
  // 팔로워 분포: 채널마다 가장 최근 기록일만 [채널, 구분, 항목, 팔로워 수]
  const dm = partRows_(ss, IGX_DEMO_SHEET, 5).map(r => [partD_(r[0]), String(r[1]).trim(), String(r[2]).trim(), String(r[3]).trim(), partN_(r[4])]);
  const lastD = {}; dm.forEach(r => { if (!lastD[r[1]] || r[0] > lastD[r[1]]) lastD[r[1]] = r[0]; });
  const demo = dm.filter(r => r[0] === lastD[r[1]] && r[4] != null).map(r => r.slice(1));
  // 스토리 [채널, 게시 시각, 유형, 조회, 도달, 답장, 공유, 상호작용, 팔로우, 프로필 방문, 탭 다음, 탭 이전, 나가기, 다음 스토리]
  const story = partRows_(ss, IGX_STORY_SHEET, 16).map(r => [String(r[0]).trim(), r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'yyyy-MM-dd HH:mm') : String(r[2]), String(r[3])].concat(r.slice(5, 16).map(partN_)))
    .filter(r => r[0]).sort((a, b) => a[1] < b[1] ? 1 : -1);
  // 팔로워 구분 [채널, 날짜, 도달 팔로워, 도달 비팔로워, 도달 알 수 없음, 조회 팔로워, 조회 비팔로워, 조회 알 수 없음]
  const ft = partRows_(ss, '인스타 팔로워 구분', 8).map(r => [String(r[0]).trim(), partD_(r[1])].concat(r.slice(2, 8).map(partN_)))
    .filter(r => r[0] && /^\d{4}-\d{2}-\d{2}$/.test(r[1])).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  // 팔로우·언팔로우 일별 [채널, 날짜, 팔로우, 언팔로우]
  const fu = {};
  partRows_(ss, IGX_MORE_SHEET, 5).forEach(r => {
    if (String(r[2]).trim() !== '팔로우·언팔로우') return;
    const k = String(r[0]).trim() + '|' + partD_(r[1]), o = fu[k] = fu[k] || [String(r[0]).trim(), partD_(r[1]), null, null];
    if (String(r[3]).trim() === '팔로우') o[2] = partN_(r[4]); else if (String(r[3]).trim() === '언팔로우') o[3] = partN_(r[4]);
  });
  const fol = Object.keys(fu).map(k => fu[k]).sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  // 도달·반응한 사람 분포: 채널마다 최근 기록일 [채널, 지표, 구분, 항목, 사람 수]
  const rdAll = partRows_(ss, '인스타 도달·반응 분포', 6).map(r => [partD_(r[0]), String(r[1]).trim(), String(r[2]).trim(), String(r[3]).trim(), String(r[4]).trim(), partN_(r[5])]);
  const rdD = {}; rdAll.forEach(r => { if (!rdD[r[1]] || r[0] > rdD[r[1]]) rdD[r[1]] = r[0]; });
  const reachDemo = rdAll.filter(r => r[0] === rdD[r[1]] && r[5] != null).map(r => r.slice(1));
  // 게시물 ID → 주소(「인스타 게시물 추가」·「인스타 과거 게시물(API)」)
  const url = {};
  partRows_(ss, '인스타 과거 게시물(API)', 4).forEach(r => { if (r[0] && r[3]) url[String(r[0])] = String(r[3]).split('?')[0].replace(/\/+$/, ''); });
  partRows_(ss, '인스타 게시물 추가', 5).forEach(r => { if (r[1] && r[4]) url[String(r[1])] = String(r[4]).split('?')[0].replace(/\/+$/, ''); });
  // 게시물 세부 {주소: [[지표, 구분, 값], …]}
  const pm = {};
  partRows_(ss, '인스타 게시물 세부', 5).forEach(r => { const u = url[String(r[1])]; const v = partN_(r[4]); if (u && v != null) (pm[u] = pm[u] || []).push([String(r[2]), String(r[3]), v]); });
  // 댓글 {주소: [댓글 수, 우리가 답한 댓글 수]} + 최근 30일 답하지 않은 댓글(내용·좋아요·주소만, 작성자 정보는 받지 않음)
  const cmt = {}, todo = [], cut30 = shiftDate_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), -30);
  partRows_(ss, '인스타 댓글', 9).forEach(r => {
    if (String(r[2]).trim()) return; // 답글 줄
    const u = url[String(r[3])] || '', key = u || String(r[3]), o = cmt[key] = cmt[key] || [0, 0], ok = !!String(r[8]).trim();
    o[0]++; if (ok) o[1]++;
    const at = r[4] instanceof Date ? Utilities.formatDate(r[4], TZ, 'yyyy-MM-dd HH:mm') : String(r[4]);
    if (!ok && at.slice(0, 10) >= cut30) todo.push([String(r[0]).trim(), at, String(r[5]).slice(0, 140), partN_(r[6]), u]);
  });
  todo.sort((a, b) => a[1] < b[1] ? 1 : -1);
  // 상대 계정이 올린 공동작업 [주소, 올린 계정, 조회(사람이 적음), 게시일, 캡션, 좋아요, 댓글]
  const collab = partRows_(ss, COLLAB_SHEET, COLLAB_HEAD.length).filter(r => r[0] && r[1]).map(r => [String(r[0]).trim(), String(r[1]).trim().replace(/^@/, ''), partN_(r[2]), partD_(r[4]), String(r[5] || ''), partN_(r[6]), partN_(r[7])])
    .sort((a, b) => a[3] < b[3] ? 1 : -1);
  return { day: day, post: post, demo: demo, demoD: lastD, story: story, ft: ft, fol: fol, reachDemo: reachDemo, reachD: rdD, pm: pm, cmt: cmt, todo: todo.slice(0, 40), collab: collab };
}
// 영상 하나: 시청 지속 곡선 [[구간(%), 시청 비율, 비슷한 영상 대비]]·검색어 [[검색어, 조회]] — 줄이 많아 그 영상 줄만 찾아 읽음
function partYv_(ss, id) {
  if (!id) return { error: 'v' };
  // col: 영상 ID가 있는 열(1부터). 찾은 줄의 처음~끝만 읽고 그 영상 줄만 남김
  const pick = (name, cols, col) => {
    col = col || 1;
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return [];
    const hit = sh.getRange(2, col, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findAll().map(r => r.getRow());
    if (!hit.length) return [];
    const a = Math.min.apply(null, hit), b = Math.max.apply(null, hit);
    return sh.getRange(a, 1, b - a + 1, cols).getValues().filter(r => String(r[col - 1]) === id);
  };
  const ret = pick('유튜브 시청 지속률', 5).map(r => [partN_(r[2]), partN_(r[3]), partN_(r[4])]).filter(r => r[0] != null && r[1] != null).sort((x, y) => x[0] - y[0]);
  const kw = pick('유튜브 검색어', 4).map(r => [String(r[2]), partN_(r[3])]).filter(r => r[1]).sort((x, y) => y[1] - x[1]).slice(0, 15);
  const sub = pick('유튜브 영상 구독 여부', 6).map(r => [String(r[3]), partN_(r[4]), partN_(r[5])]).filter(r => r[1] != null);
  const age = pick('유튜브 영상 시청자', 6).map(r => [String(r[3]), String(r[4]), partN_(r[5])]).filter(r => r[2] != null);
  const im = pick('유튜브 노출', 4, 2).map(r => [partD_(r[0]), partN_(r[2]), partN_(r[3])]).filter(r => r[1]).sort((x, y) => x[0] < y[0] ? -1 : 1);
  const agg = (rows, ki, ai, bi) => { const o = {}; rows.forEach(r => { const k = String(r[ki]), x = o[k] = o[k] || [k, 0, 0]; x[1] += partN_(r[ai]) || 0; x[2] += partN_(r[bi]) || 0; }); return Object.keys(o).map(k => o[k]).sort((x, y) => y[1] - x[1]); };
  // 노출 경로: [경로, 노출, 노출×클릭률 합] → 클릭률은 화면에서 나눔
  const isrc = agg(pick('유튜브 노출 경로', 5, 2).map(r => [r[2], r[3], (partN_(r[3]) || 0) * (partN_(r[4]) || 0)]), 0, 1, 2);
  const end = agg(pick('유튜브 최종 화면', 5, 2), 2, 3, 4);
  const cm = pick('유튜브 댓글', 6, 2).map(r => [r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'yyyy-MM-dd') : String(r[2]).slice(0, 10), String(r[3]).slice(0, 140), partN_(r[4]) || 0, partN_(r[5]) || 0])
    .sort((x, y) => y[2] - x[2]).slice(0, 5);
  return { v: id, ret: ret, kw: kw, sub: sub, age: age, im: im, isrc: isrc, end: end, cm: cm };
}
// ───────── 게시물 시간별(2026-10-20): 1시간마다 어제·오늘 올린 게시물의 지금 값을 쌓음 ─────────
// 보드 「오늘」의 올린 뒤 시간별 조회 곡선과 「평소 같은 시간」(같은 채널·형식 지난 게시물이 올린 지 같은 시간에 받은 조회 중간값) 비교에 씀
const HOURLY_SHEET = '게시물 시간별';
const HOURLY_HEAD = ['기록 시각', '채널', '게시물 ID', '형식', '게시 시각', '경과(시간)', '조회', '좋아요', '댓글', '공유', '저장', '도달'];
function postHourly_(ss) {
  const now = new Date(), today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), yday = shiftDate_(today, -1), notes = [];
  let posts = [];
  try { posts = posts.concat(briefInstagram_(today, notes, yday)); } catch (e) {}
  try { posts = posts.concat(briefYouTube_(today, yday)); } catch (e) {}
  if (!posts.length) return 0;
  const stamp = Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm');
  const rows = posts.map(x => [stamp, x.ch, String(x.id), x.type, Utilities.formatDate(x.at, TZ, 'yyyy-MM-dd HH:mm'), Math.round((now - x.at) / 360000) / 10, x.views, x.likes, x.comments, x.shares, x.saves, x.reach]);
  let sh = ss.getSheetByName(HOURLY_SHEET);
  if (!sh) { sh = ss.insertSheet(HOURLY_SHEET); sh.getRange(1, 1, 1, HOURLY_HEAD.length).setValues([HOURLY_HEAD]); sh.setFrozenRows(1); }
  const at = sh.getLastRow() + 1;
  sh.getRange(at, 3, rows.length, 1).setNumberFormat('@'); // 인스타 게시물 ID는 17자리 넘어 숫자로 바뀌면 끝자리가 틀어짐
  sh.getRange(at, 1, rows.length, HOURLY_HEAD.length).setValues(rows);
  return rows.length;
}
// 오늘 게시물의 시간별 [경과(시간), 조회] · 지난 게시물로 만든 평소 {채널|형식|경과 시간(반올림): 조회 중간값}(게시물 3개 이상)
function hourlyFor_(ss, ids) {
  const hist = {}, pool = {}, base = {};
  const sh = ss.getSheetByName(HOURLY_SHEET);
  if (!sh || sh.getLastRow() < 2) return { hist: hist, base: base };
  const num = v => { const x = Number(String(v).replace(/,/g, '')); return v === '' || isNaN(x) ? null : x; };
  sh.getRange(2, 1, sh.getLastRow() - 1, 7).getDisplayValues().forEach(r => {
    const id = String(r[2]), h = num(r[5]), v = num(r[6]);
    if (h == null || v == null || h < 0) return;
    if (ids[id]) (hist[id] = hist[id] || []).push([h, v]);
    else if (h <= 48) { const k = r[1] + '|' + r[3] + '|' + Math.round(h); (pool[k] = pool[k] || []).push(v); }
  });
  Object.keys(pool).forEach(k => { if (pool[k].length >= 3) base[k] = briefMed_(pool[k]); });
  Object.keys(hist).forEach(id => hist[id].sort((a, b) => a[0] - b[0]));
  return { hist: hist, base: base };
}
// ───────── 오늘 지금(2026-10-20): ?part=today ─────────
// 어제·오늘 올린 게시물(인스타·hong·유튜브)의 지금 값과 계정 숫자를 API로 바로 받음. 캐시 10분(TODAY_TTL), 보드가 화면을 연 동안 10분마다 다시 받음
const TODAY_TTL = 600;
function partToday_(ss) {
  const now = new Date(), today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), yday = shiftDate_(today, -1), notes = [];
  let posts = [];
  try { posts = posts.concat(briefInstagram_(today, notes, yday)); } catch (e) { notes.push('인스타 확인 실패'); }
  try { posts = posts.concat(briefYouTube_(today, yday)); } catch (e) { notes.push('유튜브 확인 실패'); }
  const n = v => v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
  const p = posts.map(x => ({ c: x.ch, id: x.id, at: Utilities.formatDate(x.at, TZ, "yyyy-MM-dd'T'HH:mm"), t: x.type, n: briefTitle_(x.title, 80), u: x.url,
    v: n(x.views), l: n(x.likes), cm: n(x.comments), sh: n(x.shares), sv: n(x.saves), r: n(x.reach), f: n(x.follows), pa: n(x.pact), aw: n(x.avgw) }));
  // 계정: 인스타 팔로워 지금 vs 「인스타 계정 일별」 오늘 아침(없으면 그 전) 기록, 유튜브 구독자·전체 조회 지금
  const acct = [];
  try { igxChannels_().forEach(c => { const u = igxGet_(c.conf, c.user, { fields: 'followers_count' }); acct.push({ c: c.ch, fol: n(u.followers_count) }); }); } catch (e) { notes.push('인스타 팔로워 확인 실패'); }
  try {
    const base = {};
    partRows_(ss, IGX_DAY_SHEET, 12).forEach(r => { const c = String(r[0]).trim(), d = partD_(r[1]), v = n(r[2]); if (v == null || d > today) return; if (!base[c] || d >= base[c].d) base[c] = { d: d, v: v, at: r[11] instanceof Date ? Utilities.formatDate(r[11], TZ, 'yyyy-MM-dd HH:mm') : String(r[11]) }; });
    acct.forEach(a => { const b = base[a.c]; if (b) { a.base = b.v; a.baseAt = b.at || b.d; } });
  } catch (e) {}
  try { const y = ytaGet_('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true').items[0].statistics; acct.push({ c: '유튜브', subs: n(y.subscriberCount), views: n(y.viewCount) }); } catch (e) { notes.push('유튜브 구독자 확인 실패'); }
  let hr = { hist: {}, base: {} };
  try { const ids = {}; p.forEach(x => { ids[String(x.id)] = 1; }); hr = hourlyFor_(ss, ids); } catch (e) {}
  return { ts: now.getTime(), at: Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'), today: today, posts: p, acct: acct, story: briefStories_(ss, today), hist: hr.hist, hbase: hr.base, notes: notes };
}

// ───────── 상대 계정이 올린 공동작업 게시물(2026-10-21) ─────────
// API는 올린 계정에만 인사이트를 줌(collabCheck: 우리 토큰으로 요청하면 code 100 Unsupported get request).
// 그래서 사람이 「공동작업(상대 게시)」 탭에 게시물 주소·올린 계정을 적으면, 1시간마다 business_discovery로 공개 숫자(좋아요·댓글)·게시일·캡션을 채움.
// 조회는 앱 인사이트에서 보고 사람이 적음. 보드는 인스타 화면에 따로 보여 주고 우리 게시물의 평소 계산에는 넣지 않음
const COLLAB_SHEET = '공동작업(상대 게시)';
const COLLAB_HEAD = ['게시물 주소', '올린 계정', '조회(앱에서 보고 적기)', '메모', '게시일', '캡션 앞부분', '좋아요', '댓글', '받은 시각'];
// 담당자가 대화로 알려 준 게시물(2026-10-21). 게시물마다 한 번만 넣고(COLLAB_SEEDED = 넣은 짧은 코드 목록), 그 뒤 수정·삭제는 탭에서
const COLLAB_SEED = [["https://www.instagram.com/p/Dd8bnHhk_cF/", "jeonbuk1994", 445600, "앱 인사이트 조회 2026-10-21 0시 기준"],
  ["https://www.instagram.com/p/DWVkHDCkc9T/", "jumfesta", "", "JUMF 공동작업(2026-10-21 담당자 알려 줌)"],
  ["https://www.instagram.com/p/DZoYIqHkaZ-/", "", "", "2026-10-21 담당자 알려 줌"],
  ["https://www.instagram.com/p/DaRk21FkWpB/", "", "", "2026-10-21 담당자 알려 줌"],
  ["https://www.instagram.com/p/DbNVeWiESYA/", "", "", "2026-10-21 담당자 알려 줌"]];
const igShort_ = u => (String(u || '').match(/\/(?:p|reel|reels|tv)\/([^/?#]+)/) || [])[1] || '';
function collabStep_(ss) {
  let sh = ss.getSheetByName(COLLAB_SHEET);
  if (!sh) { sh = ss.insertSheet(COLLAB_SHEET); sh.getRange(1, 1, 1, COLLAB_HEAD.length).setValues([COLLAB_HEAD]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, 4).setBackground('#fff4d6'); }
  const pp = PropertiesService.getScriptProperties();
  let done = []; try { done = JSON.parse(pp.getProperty('COLLAB_SEEDED') || '[]'); } catch (e) { done = []; } if (!Array.isArray(done)) done = [igShort_(COLLAB_SEED[0][0])];
  const todoS = COLLAB_SEED.filter(r => done.indexOf(igShort_(r[0])) < 0);
  if (todoS.length) { const have = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => igShort_(r[0])) : []; const add = todoS.filter(r => have.indexOf(igShort_(r[0])) < 0); if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add); pp.setProperty('COLLAB_SEEDED', JSON.stringify(done.concat(todoS.map(r => igShort_(r[0]))))); }
  if (sh.getLastRow() < 2) return 0;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, COLLAB_HEAD.length).getValues();
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), byAcc = {};
  // 올린 계정이 빈 줄은 탭에 나온 모든 계정(없으면 COLLAB_ACCOUNTS)의 게시물에서 찾아 B열을 채움
  const accs = {}; rows.forEach(r => { const u = String(r[1]).trim().replace(/^@/, ''); if (u) accs[u] = 1; });
  String(pp.getProperty('COLLAB_ACCOUNTS') || '').split(',').map(x => x.trim()).filter(Boolean).forEach(u => { accs[u] = 1; });
  rows.forEach((r, i) => { const u = String(r[1]).trim().replace(/^@/, ''), k = igShort_(r[0]); if (!k) return; (u ? [u] : Object.keys(accs)).forEach(a => (byAcc[a] = byAcc[a] || []).push([i, k, !u])); });
  let n = 0;
  Object.keys(byAcc).forEach(u => {
    let media = [];
    try { media = benchFetch_(u, '2018-01-01', 6).media; } catch (e) { byAcc[u].forEach(x => { rows[x[0]][8] = '못 받음: ' + String(e.message).slice(0, 60); }); return; }
    const idx = {}; media.forEach(x => { idx[igShort_(x.m.permalink)] = x; });
    byAcc[u].forEach(x => {
      const m = idx[x[1]], r = rows[x[0]];
      if (!m) { if (!x[2] || !r[6]) r[8] = (x[2] ? '올린 계정을 B열에 적어 주세요(아는 계정에서 못 찾음)' : '최근 300개 안에 없음') + ' · ' + now; return; }
      if (x[2]) r[1] = u;
      r[4] = m.date; r[5] = String(m.m.caption || '').split('\n')[0].slice(0, 80); r[6] = Number(m.m.like_count) || 0; r[7] = Number(m.m.comments_count) || 0; r[8] = now; n++;
    });
  });
  sh.getRange(2, 2, rows.length, 1).setValues(rows.map(r => [r[1]]));
  sh.getRange(2, 5, rows.length, 5).setValues(rows.map(r => r.slice(4, 9)));
  // 채운 결과를 실행 로그에 남김(확인용 시트로 바로 보이게). 계정·찾음 여부가 바뀌거나 날짜가 바뀔 때만
  const st = rows.map(r => igShort_(r[0]) + ' @' + (String(r[1]).trim() || '?') + ' ' + (r[6] !== '' && r[6] != null ? '좋아요 ' + r[6] + '·댓글 ' + r[7] : String(r[8]).split(' · ')[0]));
  const key = now.slice(0, 10) + '|' + rows.map(r => igShort_(r[0]) + String(r[1]).trim() + (r[6] !== '' && r[6] != null ? 1 : 0)).join(',');
  if (key !== pp.getProperty('COLLAB_LOGKEY')) { pp.setProperty('COLLAB_LOGKEY', key); logRows_(ss, [[new Date(), COLLAB_SHEET, n, st.join(' / ').slice(0, 480)]]); }
  return n;
}
// 편집기에서 바로 채우기: 탭을 채우고 결과를 실행 로그·확인용 시트에 바로 남김
function collabNow() {
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  // 손으로 돌릴 때는 시작 목록 중 탭에 없는 줄을 다시 넣음(이미 있는 줄은 건드리지 않음)
  PropertiesService.getScriptProperties().deleteProperty('COLLAB_LOGKEY');
  PropertiesService.getScriptProperties().deleteProperty('COLLAB_SEEDED');
  const n = collabStep_(ss);
  const sh = ss.getSheetByName(COLLAB_SHEET);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, COLLAB_HEAD.length).getValues().forEach(r => Logger.log([r[0], r[1], '좋아요 ' + r[6], '댓글 ' + r[7], r[8]].join(' · ')));
  Logger.log('채운 게시물 ' + n + '개');
  logMirror_(true);
}
// ───────── 공동작업 게시물 확인(2026-10-21): 편집기에서 collabCheck 실행 → 실행 로그에 결과 ─────────
// ① 우리 게시물 중 공동작업(collaborators) ② 상대 계정이 올리고 우리를 초대한 게시물이 우리 목록에 있는지 ③ 그 게시물 인사이트를 우리 토큰으로 받을 수 있는지
// 상대 계정은 스크립트 속성 COLLAB_ACCOUNTS(쉼표로 여러 개, 없으면 jeonbuk1994)
function collabCheck() {
  const L = [], p = PropertiesService.getScriptProperties();
  const partners = String(p.getProperty('COLLAB_ACCOUNTS') || 'jeonbuk1994').split(',').map(x => x.trim()).filter(Boolean);
  igxChannels_().forEach(c => {
    const mine = igxGet_(c.conf, c.user + '/media', { fields: 'id,permalink,timestamp', limit: 50 }).data || [];
    const ids = {}; mine.forEach(x => { ids[String(x.id)] = 1; });
    let n = 0;
    mine.forEach(x => { try { const k = igxGet_(c.conf, x.id + '/collaborators', {}).data || []; if (k.length) { n++; if (n <= 5) L.push(c.ch + ' 우리가 올린 공동작업 ' + x.permalink + ' · 함께: ' + k.map(y => y.username).join(', ')); } } catch (e) { if (!n) L.push(c.ch + ' collaborators 실패: ' + e.message); n = -999; } });
    L.push(c.ch + ' 최근 50개 중 공동작업 ' + Math.max(0, n) + '개');
    partners.forEach(u => {
      try {
        const b = igxGet_(c.conf, c.user, { fields: 'business_discovery.username(' + u + '){media.limit(30){id,permalink,timestamp,like_count,comments_count}}' }).business_discovery;
        const ms = (b && b.media && b.media.data) || [];
        L.push(c.ch + ' ← ' + u + ' 최근 게시물 ' + ms.length + '개 · 우리 목록에도 있는 것 ' + ms.filter(m => ids[String(m.id)]).length + '개');
        ms.slice(0, 30).forEach(m => {
          let ins = '';
          try { const v = igxGet_(c.conf, m.id + '/insights', { metric: 'views,reach' }).data || []; ins = '인사이트 됨 ' + v.map(d => d.name + ' ' + (d.values ? d.values[0].value : d.total_value && d.total_value.value)).join(' · '); }
          catch (e) { ins = '인사이트 안 됨(' + String(e.message).slice(0, 60) + ')'; }
          if (ids[String(m.id)] || /됨 /.test(ins)) L.push('  ' + m.permalink + ' · 좋아요 ' + m.like_count + ' · ' + (ids[String(m.id)] ? '우리 목록에 있음 · ' : '') + ins);
        });
        const one = ms[0]; if (one && !L.some(x => x.indexOf(one.permalink) >= 0)) { try { igxGet_(c.conf, one.id + '/insights', { metric: 'views' }); } catch (e) { L.push('  (예시) ' + one.permalink + ' 인사이트: ' + String(e.message).slice(0, 80)); } }
      } catch (e) { L.push(c.ch + ' ← ' + u + ' 조회 실패: ' + e.message); }
    });
  });
  L.forEach(x => Logger.log(x));
  try { logRows_(SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID), [[new Date(), '공동작업 확인', L.length, L.join(' / ').slice(0, 45000)]]); } catch (e) {}
  try { logMirror_(true); } catch (e) {}
}
