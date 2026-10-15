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
    .addItem('지금 스냅샷 기록', 'weeklySnapshot')
    .addItem('분석 탭만 다시 계산', 'buildAll')
    .addItem('태그 다시 계산(분류·제작·참여자)', 'recalcTags')
    .addItem('과거 기록 가져오기(_hist_ 탭)', 'importHistory')
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
  ScriptApp.newTrigger('dailySnapshot')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .nearMinute(0)
    .inTimezone(TZ)
    .create();
}

// ───────── 매일 갱신 (트리거 실행 함수) ─────────
// 월요일 기록은 확정으로 남기고, 화~일 기록은 최신 1개만 남긴다 (스냅샷 탭 용량 유지)
function dailySnapshot() {
  const ss = SpreadsheetApp.getActive();
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  try { dropProvisional_(ss, today); }
  catch (e) {
    const log = ss.getSheetByName(LOG);
    if (log) log.getRange(log.getLastRow() + 1, 1, 1, 4).setValues([[new Date(), '임시 기록 교체', 0, '오류: ' + e.message]]);
  }
  weeklySnapshot();
}

function isMonday_(ymd) { return new Date(ymd + 'T12:00:00+09:00').getDay() === 1; }

// 마지막 기록이 이번 주 임시 기록(월요일 아님 · 최근 7일 안 · 오늘 아님)이면 지운다
function dropProvisional_(ss, today) {
  const snap = ss.getSheetByName(SNAP);
  const last = snap.getLastRow();
  if (last < 2) return;
  const latest = snap.getRange(last, 1).getDisplayValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(latest) || latest === today || isMonday_(latest) || latest <= shiftDate_(today, -7)) return;
  clearDate_(snap, latest);
  const acc = ss.getSheetByName(ACCOUNT);
  if (acc && acc.getLastRow() >= 2) {
    const d = acc.getRange(2, 1, acc.getLastRow() - 1, 1).getDisplayValues();
    for (let i = d.length - 1; i >= 0; i--) if (d[i][0] === latest) acc.deleteRow(i + 2);
  }
  const log = ss.getSheetByName(LOG);
  if (log) log.getRange(log.getLastRow() + 1, 1, 1, 4).setValues([[new Date(), '임시 기록 교체', 0, latest + ' → ' + today]]);
}

// ───────── 주간 기록 (트리거 실행 함수) ─────────
function weeklySnapshot() {
  const ss = SpreadsheetApp.getActive();
  ensureSheets_(ss);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const snap = ss.getSheetByName(SNAP);
  clearDate_(snap, today); // 같은 날 재실행 시 중복 방지

  const rows = [];
  const logs = [];
  const bySrc = [];
  SOURCES.forEach(src => {
    try {
      const byCh = readSource_(src, today);
      bySrc.push(byCh);
      const chs = Object.keys(byCh);
      let total = 0;
      chs.forEach(ch => {
        Object.keys(byCh[ch]).forEach(k => {
          const it = byCh[ch][k];
          rows.push([today, ch, k, it.date, it.title, it.url]
            .concat(METRICS.map(m => it[m]))
            .concat([it.type, it.reach, it.engaged, it.avgSec, it.lengthSec]));
          total++;
        });
      });
      if (!total) throw new Error('읽은 콘텐츠가 0건');
      logs.push([new Date(), src.channel, total, src.bench ? '정상 (계정 ' + chs.length + '개)' : '정상']);
    } catch (e) {
      logs.push([new Date(), src.channel, 0, '오류: ' + e.message]);
    }
  });

  if (rows.length) {
    snap.getRange(snap.getLastRow() + 1, 1, rows.length, SNAP_HEADER.length).setValues(rows);
  }

  accountSnapshot_(ss, today, logs);

  try { saveTags_(ss, bySrc, today); logs.push([new Date(), '태그', bySrc.length, '정상']); }
  catch (e) { logs.push([new Date(), '태그', 0, '오류: ' + e.message]); }

  const log = ss.getSheetByName(LOG);
  log.getRange(log.getLastRow() + 1, 1, logs.length, 4).setValues(logs);

  buildAll();
}

// ───────── 원본 읽기 ─────────
// 반환: { 채널명: { 콘텐츠키: item } }
function readSource_(src, today) {
  const ss = SpreadsheetApp.openById(src.id);
  const sh = ss.getSheetByName(src.sheet || '시트1') || ss.getSheets()[0];
  const rng = sh.getDataRange();
  const values = rng.getValues();
  const disp = src.needDisplay ? rng.getDisplayValues() : null;
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

      const item = { date: date, title: title.replace(/\s+/g, ' ').trim().slice(0, 80), url: url, full: title, desc: idx.desc >= 0 ? String(row[idx.desc] || '') : '' };
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
    const data = (vertical ? v.map(r => r[1]) : v[1])
      .map(x => (typeof x === 'string' && x.length > 40 ? '' : x)); // 오류 문구는 빈칸

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
    logs.push([new Date(), name, 1, '정상']);
  });
}

// ───────── 분석 탭 ─────────
function buildAll() {
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

// ───────── 대시보드용 데이터 API (GitHub Pages에서 JSONP로 읽음) ─────────
const SS_ID = '1WshbvV-foluKpVu79vdZ75BBfH-ycME_nPe0RcJuwr4';
const OWN_CHANNELS = ['인스타그램', '유튜브', 'hong._.video'];
const DASH_METRICS = ['조회수', '좋아요', '댓글', '공유', '저장'];

function doGet(e) {
  const cb = (e && e.parameter && e.parameter.callback) || '';
  const json = JSON.stringify(buildDashboardData_());
  if (cb && /^[A-Za-z_$][\w.$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
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
        n: s_(r[C.title]).slice(0, 70),
        u: /youtube\.com|youtu\.be/.test(url) ? url : '',
        h: dates.map(() => null),
      };
    }
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
      const m = {};
      head.slice(2).forEach((h, j) => { const x = n_(r[j + 2]); if (x !== null && h) m[h] = x; });
      acct.push({ d: d, ch: ch, m: m });
    });
  }

  let hist = null;
  try { hist = loadIgHistory_(ss, items, rawKey, dates); } catch (e) { hist = { error: e.message }; }

  const keys = Object.keys(items);
  const list = keys.map(k => items[k]);
  let extra = { roles: {}, ads: null };
  try { extra = attachTags_(ss, list, keys.map(k => rawKey[k])); } catch (e) { extra.tagError = e.message; }

  return {
    updated: dates[dates.length - 1] || '',
    dates: dates,
    channels: order.map(c => ({ name: c, bench: OWN_CHANNELS.indexOf(c) < 0 })),
    metrics: DASH_METRICS,
    items: list,
    acct: acct,
    roles: extra.roles,
    ads: extra.ads,
    coverage: COVERAGE,
    hist: hist,
    strat: loadStrat_(ss),
    goals: loadGoals_(ss),
    tagError: extra.tagError || '',
  };
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
const ADMAP_SHEET = '광고 매핑';
const ADPLAN_SHEET = '광고 계획';
const TAGFIX_SHEET = '태그 수정';
const ADS_ID = '1KWALIRH1NfizDTtiKa6koega5ECAirOuOCc8pXNU5pE'; // 전주대_구글애즈_캠페인리포트
const COVERAGE = { '유튜브': '2024-01-01', '인스타그램': '2024-12-27', 'hong._.video': '2021-01-01', acct: '지난주(월~일)' };
const ADMAP_SEED = [["2019 전주대학교  CF", "rTFFwv7w5X0", "확인"], ["2020 CF 본편", "d46MRvYKTYM, zQTtrjirNoI, E8XcB6NX-Yg", "추정"], ["2020 CF 본편 건너뛸 수 있는 광고", "d46MRvYKTYM, zQTtrjirNoI, E8XcB6NX-Yg", "추정"], ["하림융합전공 소개_센터장 디스플레이 광고", "atZ_KytBKb0", "추정"], ["동영상광고 2021 C F", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["2021 CF", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["2021 CF_키워드", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["2021 CF_지역", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["입학_2021 CF_지역", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["입학_2021 CF 키워드", "UwbBowD8UwA, EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["10월_CF_성장_취업", "EmABQ1PvB1M, F7FzHL90j0o", "확인"], ["10월_CF_창업", "UwbBowD8UwA", "확인"], ["CF 동영상 창업", "UwbBowD8UwA", "추정"], ["20220811_2022 CF 영상 '신입생'편", "XeFvocm3LEM", "확인"], ["20220721 스킵 불가_2022 CF 티저", "XeFvocm3LEM, AuNPHA1_7Bs", "추정"], ["스킵가능_2022 CF 영상 티저", "XeFvocm3LEM, AuNPHA1_7Bs", "추정"], ["전라북도의 중심, 전주대학교", "_o_ORvqXk-w", "확인"], ["기숙사 소개 영상 광고", "Y-VTucYX-C0", "추정"], ["천원의 아침밥 소개", "8tWIqtvGCAU", "확인"], ["학과 동영상 공모전", "@2022 천하제일", "추정"], ["전주대학교 캠퍼스 스토리", "NjYhL4pFfGM", "확인"], ["2023 ESG 동영상 광고", "7n_vNR4Z8QI", "추정"], ["(디스커버리) 2023 유웨이 온터뷰 광고", "fHn9rzClVaI, b125ICdQy4Y", "확인"], ["천원의 아침밥 - 사장님의 마음", "JfC9Ax3ifrY", "확인"], ["선행릴레이 캠페인 영상", "JocZENhjodk", "확인"], ["브랜드 광고 '시설'편", "HP2hSCEWRd0", "추정"], ["(전주대 HP 방문자/18--24) 개교 60주년 30초 광고", "MODUK0zsLiM", "확인"], ["(전주대 HP 방문자_40-50대) 개교 60주년 30초 광고", "MODUK0zsLiM", "확인"], ["(전주대 HP 방문자_전연령) 개교 60주년 15초 광고", "MODUK0zsLiM", "추정"], ["FPV 드론 영상(18-24세/전국)", "d7sEsLmKhvc", "확인"], ["[도서관] FPV 드론 영상(18-24세/전국)", "lcf3SN9ad-A", "확인"], ["[방송광고/인근지역/18-24] '도서관'편", "b1dxndu1rgo", "확인"], ["[방송광고/인근지역/40-60] '도서관'편", "b1dxndu1rgo", "확인"], ["(18-24) 카카오클라우드센터 유치", "gI0zmwS3Dok", "확인"], ["(18-24/전국) 2025 정시모집 TV 광고", "UyS82wPiEJg", "추정"], ["(45-64/전국) 2025 정시모집 TV 광고", "UyS82wPiEJg", "추정"], ["2025 동영상 광고 - 51초", "LyrHjY20PXs", "추정"], ["2025 동영상 광고 - 숏츠", "axUL_0OPwtg", "추정"], ["2025 농촌봉사활동", "goCPo6bqm8o", "확인"], ["2025 국토대장정", "SML_fJsyBTQ", "추정"], ["[20초 Ver] 새로운 별들의 새로운 시작 '전주대학교'", "el1j8k0C_ek, _C0mUel-abs, bdAIJziubkk, YIa0V8JRiUg", "확인"], ["[20초_B Ver] 새로운 별들의 새로운 시작 '전주대학교'", "el1j8k0C_ek, _C0mUel-abs, bdAIJziubkk, YIa0V8JRiUg", "확인"], ["글로컬대학30 응원 & 릴스 영상", "Gzw0jIEYp6U, Dba7HtkPltg", "확인"], ["자유전공학부 팟캐스트 인터뷰", "TEOyPw5SxdM, F6aAIU-pqXE", "확인"]];

/* 콘텐츠 분류·제작 주체 태깅 규칙 (Apps Script와 대시보드가 같은 규칙을 씀) */
var TAG_CATEGORIES = [
  ['이벤트·참여', /이벤트|𝗘𝗩𝗘𝗡𝗧|EVENT|당첨자|경품|추첨|기프티콘|댓글로|참여 방법|달꾸/i],
  ['홍보대사 모집', /홍보대사\s?(모집|선발)/],
  ['입시·모집', /수시|정시|입시|원서|모집요강|신입생 모집|모집기간|모집 기간|예비\s?신입생|입학정보|입학 상담|편입|추가모집|입학처|모집\s?중|대학입학/],
  ['학사·생활 안내', /수강\s?신청|등록 (기간|일정|안내)|재학생 등록|장학|국가장학금|생활관|기숙사 (신청|입사)|셔틀|직통 버스|버스 운행|천원의 아침밥|아침밥|학사|휴학|복학 신청|전과|만족도 조사|도서관 이용|안내📢|안내 📢|이용 (방법|안내)|운영 안내|신청 안내/],
  ['성과·뉴스', /선정|우승|수상|최우수|S등급|최고 등급|금메달|협약|유치|개발|1위|1등|최초|획득|성과|기록 경신|글로컬|체결|개소|출범식|📰/],
  ['스포츠', /축구|레슬링|씨름|태권도|싸울아비|U-?LEAGUE|유리그|농구|야구|배구|전국체육대회|체전|전북현대|경기 결과|ROUND/i],
  ['행사·축제', /특강|강연|포럼|세미나|컨퍼런스|전시|축제|대동제|중동제|스케치|𝗦𝗞𝗘𝗧𝗖𝗛|SKETCH|학위수여식|입학식|졸업식|기념식|JUMF|페스티벌|공연|패션쇼|FASHION SHOW|선서식|팝업|박람회|부스|토크 콘서트|Major Fair|MAJOR FAIR|가맥|낙화|트리|오리엔테이션|적응력/i],
  ['학과·전공', /[가-힣]+(학과|학부)|과잠|전공|오늘의 강의|복담화|단과대|교수님|약학|간호/],
  ['정보·꿀팁', /꿀팁|팁|알려|방법|가이드|용어|미리 알|재테크|해결|백과|요리|퇴치|공부법|Q&A|FAQ/],
  ['학생 이야기', /인터뷰|브이로그|vlog|후기|탐방|봉사|국토대장정|해외|자기소개|What'?s in my bag|하루|공강|MBTI|데이트|고백|새내기|대학생활|갓생|방학|룸투어|어디서 살|공간|여름 기록|방학 기록|일상|선배|동아리|은하수|UCDC/i],
  ['캠퍼스·계절', /벚꽃|겹벚꽃|유채|철쭉|단풍|가을|봄꽃|눈 내린|눈사람|겨울|캠퍼스|핫스팟|일출|명소|피크닉|전망대|드론|FPV|포토 ?스팟|스타정원|야간 개장|공부하기 좋은|휴식 장소|장소 추천|카페 투어|해 질|Sunset|노을/i],
  ['시즌 인사', /새해|크리스마스|성탄|어버이날|스승의 날|광복절|추석|설날|애도|추모|수능|응원합니다|파이팅|화이팅|종강|개강|중간고사|기말고사|시험 ?기간|시험 (공부|끝)/],
  ['숏폼·예능', /POV|𝗣𝗢𝗩|VS|챌린지|밈|유형|체험왕|스피드 ?게임|소개팅|마음의 소리|드래곤|ㅋㅋ|레전드|몇 초|맞혀|퀴즈|노래|커버|댄스|Dance|𝘿𝙖𝙣𝙘𝙚|ASMR|비밀|토템/i],
  ['브랜드 영상', /새로운 별들|AI를 넘어|AX 시대|빛나는 순간|가장 나다운|나다운 라이프|60년|같이 만드는 가치|세상의 중심|진심을 다합니다|슬로건|캠페인/],
];

// 캡션에서 제작 크레딧 앞부분만 분류에 사용
function categoryText(caption) {
  var c = String(caption || '');
  var cut = c.search(/\n\s*(🎬|📸|🎥|▪️?\s*제작|제작\s*[:|▪])|Created by|🎬\s*by/);
  if (cut > 0) c = c.slice(0, cut);
  return c.slice(0, 220);
}

// opts.lengthSec: 유튜브 영상 길이(초) — 분류가 안 되면 60초 이하는 숏폼으로
function tagCategory(text, channel, opts) {
  var t = String(text || '');
  for (var i = 0; i < TAG_CATEGORIES.length; i++) if (TAG_CATEGORIES[i][1].test(t)) return TAG_CATEGORIES[i][0];
  if (channel === 'hong._.video') return '숏폼·예능';
  if (channel === '유튜브' && opts && opts.lengthSec && opts.lengthSec <= 60) return '숏폼·예능';
  return '기타';
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
      if (!/^[가-힣]{3,4}$/.test(n) || NAME_STOP.test(n) || seen[n]) continue;
      if (STAFF.indexOf(n) >= 0) continue;
      seen[n] = 1; out.push({ n: n, amb: amb });
    }
  }
  return out;
}
function roleOf(name, ambCtx) {
  if (WORKSTUDY.indexOf(name) >= 0) return '근로장학생';
  if (AMBASSADORS.indexOf(name) >= 0 || ambCtx) return '홍보대사';
  return '근로장학생';
}

// channel: 인스타그램 | 유튜브 | hong._.video | (타 대학 계정명)
// m: { views, likes } — 유튜브 광고 추정에 사용
// 반환: { p: 제작 주체, w: [참여자 이름], roles: {이름: 역할} }
function tagProducer(channel, caption, m) {
  var c = String(caption || '');
  var res = { p: '자체 제작', w: [], roles: {} };
  if (channel === 'hong._.video') { res.p = /🎬\s*(by|By)|by\.?\s*@?[\w._]+/.test(c) ? '학생 크리에이터' : '홍보대사'; return res; }
  if (channel !== '인스타그램' && channel !== '유튜브') { res.p = '타 대학'; return res; }
  var credit = creditBlock(c);
  var names = creditNames(c);
  var hasAmb = /홍보대사/.test(credit), hasWork = false;
  names.forEach(function (x) {
    var r = roleOf(x.n, x.amb);
    res.w.push(x.n); res.roles[x.n] = r;
    if (r === '홍보대사') hasAmb = true; else hasWork = true;
  });
  if (hasAmb) res.p = '홍보대사';
  else if (hasWork) res.p = '근로장학생';
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
    sh.getRange(rows.length + 2, 1).setValue('※ 홍보대사·근로장학생 명단. 역할을 바꾸거나 이름을 추가하면 다음 태그 계산부터 반영돼요. 명단에 없는 크레딧 이름은 근로장학생으로 봐요.');
  }
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
  const amb = [], ws = [], st = [];
  v.forEach(r => {
    const n = String(r[0]).trim(), role = String(r[1]).trim();
    if (!/^[가-힣]{2,4}$/.test(n)) return;
    if (role === '홍보대사') amb.push(n); else if (role === '근로장학생') ws.push(n); else if (role === '직원') st.push(n);
  });
  if (amb.length || ws.length) { AMBASSADORS = amb; WORKSTUDY = ws; STAFF = st; }
}

// 원본 item(전체 캡션 포함) → 태그
function tagItem_(channel, it) {
  const ch = channel.indexOf(BENCH_PREFIX) === 0 ? channel.slice(BENCH_PREFIX.length) : channel;
  const cap = it.full || it.title || '';
  const g = tagCategory(ch === '유튜브' ? cap : categoryText(cap), ch, { lengthSec: it.lengthSec });
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
  const ss = SpreadsheetApp.getActive() || SpreadsheetApp.openById(SS_ID);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const bySrc = [];
  SOURCES.forEach(src => { try { bySrc.push(readSource_(src, today)); } catch (e) { Logger.log(src.channel + ' 오류: ' + e.message); } });
  saveTags_(ss, bySrc, today);
}

// 대시보드용: 태그 맵 · 역할 · 수정값
function loadTagData_(ss) {
  loadRoster_(ss);
  const tags = {}, roles = {};
  const sh = ss.getSheetByName(TAG_SHEET);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().forEach(r => {
    const w = String(r[4] || '').split(',').map(x => x.trim()).filter(Boolean);
    tags[r[0] + '§' + r[1]] = { g: String(r[2] || ''), p: String(r[3] || ''), w: w, u: String(r[6] || '') };
    w.forEach(n => { roles[n] = WORKSTUDY.indexOf(n) >= 0 ? '근로장학생' : AMBASSADORS.indexOf(n) >= 0 ? '홍보대사' : (roles[n] || '근로장학생'); });
  });
  // 크레딧 줄에 '홍보대사'가 붙어 자동으로 홍보대사가 된 이름은 그대로 둠
  const fix = {};
  const fs = ss.getSheetByName(TAGFIX_SHEET);
  if (fs && fs.getLastRow() > 1) fs.getRange(2, 1, fs.getLastRow() - 1, 3).getValues().forEach(r => {
    const k = String(r[0]).trim(); if (!k) return;
    fix[k] = { g: String(r[1] || '').trim(), p: String(r[2] || '').trim() };
  });
  return { tags: tags, roles: roles, fix: fix };
}

// 구글애즈 리포트 + 「광고 매핑」
function loadAds_(ss) {
  const out = { end: '', daily: [], camps: [], rows: [], plans: [], v2c: {} };
  let v;
  try { v = SpreadsheetApp.openById(ADS_ID).getSheets()[0].getDataRange().getValues(); } catch (e) { out.error = e.message; return out; }
  const head = v[0].map(String);
  const ix = k => head.indexOf(k);
  const iD = ix('Day'), iC = ix('Campaign'), iI = ix('Impr.'), iCo = ix('Cost'), iK = ix('Clicks');
  if (iD < 0 || iC < 0) { out.error = '광고 리포트 헤더를 못 찾음'; return out; }
  const s_ = x => (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x).trim();
  const n_ = x => Number(String(x).replace(/,/g, '')) || 0;
  const camps = {}, daily = {}, cd = {};
  v.slice(1).forEach(r => {
    const d = s_(r[iD]).slice(0, 10), c = String(r[iC]).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !c) return;
    const imp = n_(r[iI]), cost = n_(r[iCo]), clk = n_(r[iK]);
    const o = camps[c] = camps[c] || { n: c, from: d, to: d, imp: 0, cost: 0, clk: 0, videos: [], conf: '' };
    if (d < o.from) o.from = d; if (d > o.to) o.to = d;
    o.imp += imp; o.cost += cost; o.clk += clk;
    const x = daily[d] = daily[d] || [0, 0]; x[0] += cost; x[1] += imp;
    const y = cd[c + '§' + d] = cd[c + '§' + d] || [c, d, 0, 0, 0]; y[2] += cost; y[3] += imp; y[4] += clk;
    if (d > out.end) out.end = d;
  });
  const ms = ss.getSheetByName(ADMAP_SHEET);
  const map = ms && ms.getLastRow() > 1 ? ms.getRange(2, 1, ms.getLastRow() - 1, 3).getValues() : ADMAP_SEED;
  map.forEach(r => {
    const c = String(r[0]).trim(); if (!c || !camps[c]) return;
    camps[c].videos = String(r[1] || '').split(',').map(x => x.trim()).filter(Boolean);
    camps[c].conf = String(r[2] || '추정').trim() || '추정';
  });
  out.daily = Object.keys(daily).sort().map(d => [d, Math.round(daily[d][0]), Math.round(daily[d][1])]);
  out.camps = Object.keys(camps).map(k => camps[k]).sort((a, b) => a.from < b.from ? -1 : 1)
    .map(c => ({ n: c.n, from: c.from, to: c.to, imp: Math.round(c.imp), cost: Math.round(c.cost), clk: Math.round(c.clk), videos: c.videos, conf: c.conf }));
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
    // it.g·it.p가 미리 있으면(「인스타_과거기록」 탭) 「태그」 탭 자동값보다 우선, 「태그 수정」이 최우선
    it.g = f.g || t.g || it.g || (it.c === 'hong._.video' ? '숏폼·예능' : '기타');
    it.p = f.p || t.p || it.p || (OWN_CHANNELS.indexOf(it.c) >= 0 ? '자체 제작' : '타 대학');
    if (t.w && t.w.length) it.w = t.w;
    if (it.c === '유튜브') {
      const cs = v2c[vid(it.u)];
      const last = it.h.filter(Boolean).pop() || [];
      if (cs) it.ad = { s: cs.some(c => c.conf === '확인') ? '확인' : '추정', k: cs.map(c => c.n) };
      else if ((!A.end || it.d > A.end) && isAdPattern({ views: last[0], likes: last[1] })) it.ad = { s: '패턴', k: [] };
    }
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
  return { roles: T.roles, ads: { end: A.end, daily: A.daily, camps: A.camps, rows: A.rows, plans: A.plans, meta: loadMeta_(ss), error: A.error || '' } };
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
      c: '인스타그램', t: s_(at(r, ix.type)) || '미분류', d: d, n: s_(at(r, ix.title)).slice(0, 70),
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
function loadMeta_(ss) {
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
