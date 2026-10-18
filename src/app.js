(function () {
  // ───────── 기본값 ─────────
  const OWN = ['인스타그램', '유튜브', 'hong._.video'];
  const CH_VAR = { '인스타그램': '--ch-ig', '유튜브': '--ch-yt', 'hong._.video': '--ch-hong' };
  const CH_BADGE = { '인스타그램': '인스타', '유튜브': '유튜브', 'hong._.video': 'hong', 'jbnu1947': '전북대', 'wonkwang_univ': '원광대', 'woosukuni': '우석대' };
  const PROD_CLASS = { '홍보대사': 'p-amb', '광고': 'p-ad', '자체 제작': 'p-own', '학생 크리에이터': 'p-ugc', '학과·기관 협업': 'p-col', '근로장학생': 'p-ws' };
  const PRODS = ['자체 제작', '홍보대사', '근로장학생', '학생 크리에이터', '학과·기관 협업'];
  const RANGES = [['30', '1달'], ['90', '3달'], ['365', '1년'], ['all', '전체']];
  const MN = ['조회', '좋아요', '댓글', '공유', '저장'];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const HIT = 1.5; // 히트 = 평소(같은 채널·같은 형식 최근 1년 중앙값, 형식 표본이 적으면 채널 중앙값)의 1.5배 이상
  const MIN_N = 5; // 표본 적음 기준 — 이보다 적은 그룹은 결론·순위에서 뺀다
  const VIEWS = [['brief', '홈'], ['strategy', '전략'], ['maker', '제작·사람'], ['season', '입시'], ['ads', '광고'], ['explore', '탐색'], ['export', '추출']];
  const TABS = ['전체', '인스타그램', '유튜브', 'hong._.video', '타 대학'];
  const ICONS = {
    brief: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    strategy: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    maker: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.6c2.4.1 4 1.7 4.5 4.4"/>',
    season: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c1.5 1.6 3.4 2.5 5.5 2.5s4-.9 5.5-2.5V11"/><path d="M21.5 9v5"/>',
    ads: '<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/>',
    explore: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    export: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4.5 19.5h15"/>',
  };
  // 본문용 선 아이콘(아래 탭과 같은 굵기) — 이모지·기호 대신
  const svgI = p => '<svg class="lic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const ICO = {
    check: svgI('<path d="M20 6 9 17l-5-5"/>'),
    spark: svgI('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/>'),
    warn: svgI('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.1"/>'),
  };
  const STORE = 'jj-sns-board-v6';
  const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const XLSX_SRI = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';
  let D = null, charts = {};
  const S = { ads: false, view: 'brief', ch: '전체', range: '365', trendCh: '인스타그램', g: null, rankBy: 'views', sort: null, rankShown: 10, tblShown: 30, mx: null, person: null, roleF: '전체', season: null, psort: 'n' };

  const $ = id => document.getElementById(id);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const fmt = n => (n == null || isNaN(n)) ? '–' : Math.round(n).toLocaleString('ko-KR');
  const fmtK = n => {
    if (n == null || isNaN(n)) return '–';
    const a = Math.abs(n);
    if (a >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
    if (a >= 1e5) return Math.round(n / 1e4).toLocaleString('ko-KR') + '만'; // 1,578만
    if (a >= 1e4) return (n / 1e4).toFixed(1).replace(/\.0$/, '') + '만';
    return Math.round(n).toLocaleString('ko-KR');
  };
  const pct = v => (v == null || isNaN(v)) ? '–' : (v * 100).toFixed(1) + '%';
  const pctA = v => (v == null || isNaN(v)) ? '–' : (v * 100).toFixed(Math.abs(v) < 0.01 ? 2 : 1) + '%';
  const pct0 = v => (v == null || isNaN(v)) ? '–' : Math.round(v * 100) + '%';
  // 0.1배 미만은 「0.00배」처럼 보이지 않게 「0.1배 미만」으로
  const xf = v => (v == null || isNaN(v)) ? '–' : v < 0.1 ? '0.1배 미만' : v.toFixed(1) + '배';
  // 평소 대비의 기준 지표: 우리 채널 = 조회, 타 대학 = 좋아요
  const mW = ch => MN[mainM(ch)], vW = () => S.ch === '타 대학' ? '좋아요' : '조회';
  const sgn = v => (v > 0 ? '+' : '');
  // 화면 문장용 조사: 받침이 있으면 a(은·이·을), 없으면 b(는·가·를). 한글이 아니면 b
  const jo = (w, a, b) => { const s = String(w).replace(/[\s)」』'"’”]+$/, ''), c = s.charCodeAt(s.length - 1) - 0xAC00; return w + (c >= 0 && c < 11172 && c % 28 && !(a === '으로' && c % 28 === 8) ? a : b); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
  const median = a => { const s = a.filter(v => v != null && !isNaN(v)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const sum = a => a.reduce((s, v) => s + (v == null || isNaN(v) ? 0 : v), 0);
  const mean = a => { const f = a.filter(v => v != null && !isNaN(v)); return f.length ? sum(f) / f.length : null; };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ view: S.view, ch: S.ch, range: S.range, trendCh: S.trendCh, ads: S.ads })); } catch (e) {} };
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } };
  const mdLabel = d => (+d.slice(5, 7)) + '월 ' + (+d.slice(8, 10)) + '일';
  const md2 = d => (+d.slice(5, 7)) + '/' + (+d.slice(8, 10));
  const dot = d => d.slice(2).replace(/-/g, '.');
  const toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); };

  // ───────── 값 ─────────
  // it.P: 「인스타_과거기록」 탭의 한 번짜리 기록값 (기록일 없음, it.x = 1)
  const last0 = it => { for (let i = it.h.length - 1; i >= 0; i--) if (it.h[i]) return it.h[i]; return it.P || null; };
  // 유튜브는 전체 기간 값(it.L: 조회·좋아요·댓글·공유)이 있으면 그걸 누적 수치로 사용
  const mx2 = (a, b) => a == null ? b : b == null ? a : Math.max(a, b);
  const last = it => { const b = last0(it); if (!it.L) return b; return [mx2(it.L[0], b && b[0]), mx2(it.L[1], b && b[1]), mx2(it.L[2], b && b[2]), mx2(it.L[3], b && b[3]), b ? b[4] : null]; };
  const val = (it, m) => { const v = last(it); return v ? v[m] : null; };
  const weekly = () => D.dates.length > 1;
  const incBetween = (it, j, i, m) => {
    if (i <= 0 || j < 0 || !it.h[i]) return null;
    const cur = it.h[i][m]; if (cur == null) return null;
    const prev = it.h[j];
    // 직전 기록에 없던 게시물: 직전 기록일 이후(당일 포함)에 올린 게시물만 이번 값 전체가 증가분.
    // 그보다 먼저 올렸는데 이번에 처음 수집된 게시물(수집 지연)은 누적값 전체가 한 기간 증가로 잡히므로 셀 수 없음(null)
    if (!prev) return it.d >= D.dates[j] ? cur : null;
    return prev[m] == null ? null : cur - prev[m];
  };
  const incAt = (it, i, m) => incBetween(it, i - 1, i, m);
  const inc = (it, m) => incAt(it, D.dates.length - 1, m);
  const engagement = it => { const v = last(it); if (!v || !(it.r > 0)) return null; return ((v[1] || 0) + (v[2] || 0) + (v[3] || 0) + (v[4] || 0)) / it.r; };
  const completion = it => (it.a > 0 && it.l > 0) ? Math.min(it.a / it.l, 1) : null;
  const likeRate = it => { const v = last(it); return v && v[0] > 0 ? (v[1] || 0) / v[0] : null; };
  const quality = it => it.c === '인스타그램' ? engagement(it) : it.c === '유튜브' ? completion(it) : likeRate(it);
  const qName = ch => ch === '인스타그램' ? '참여율' : ch === '유튜브' ? '시청 완료율' : '좋아요율';
  const mainM = ch => OWN.includes(ch) ? 0 : 1;
  const mainVal = it => val(it, mainM(it.c));
  const isBench = ch => !OWN.includes(ch);
  const chColor = ch => {
    if (CH_VAR[ch]) return css(CH_VAR[ch]);
    const b = benchNames();
    return css(['--ch-b1', '--ch-b2', '--ch-b3'][Math.max(0, b.indexOf(ch)) % 3]);
  };
  const benchNames = () => D.channels.filter(c => c.bench).map(c => c.name);
  const chName = ch => CH_BADGE[ch] || ch;
  // 시안: 증감은 색 + 기호 + 숫자. ±3% 이내는 회색 "비슷해요"
  const FLAT = 0.03;
  const dNum = (d, unit) => d === 0 ? '<span class="flat">변동 없음</span>' : '<span class="' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(d)) + (unit || '') + '</span>';
  const dCls = d => Math.abs(d) < FLAT ? 'flat' : d >= 0 ? 'up' : 'down';
  // 「평소의 N.N배」 옆 색: 화면에 보이는 반올림 값 기준(1.04배가 「1.0배」인데 파랑으로 보이지 않게)
  const xCls = v => v == null ? 'flat' : dCls(Math.round(v * 10) / 10 - 1);
  const dTxt = (d, sp, dig) => Math.abs(d) < FLAT ? '비슷해요' : d >= 1 ? '▲' + (sp ? ' ' : '') + (1 + d).toFixed(1) + '배' : (d >= 0 ? '▲' : '▼') + (sp ? ' ' : '') + Math.abs(dig ? Math.round(d * 1000) / 10 : Math.round(d * 100)) + '%';
  const fmtType = t => t === '1분 이하' ? '쇼츠(1분 이하)' : t;

  // 채널 기준값(최근 1년 중앙값, 광고·스토리 제외) — 성과 지수 = 콘텐츠 값 ÷ 기준값
  const BASE = {};
  function baseOf(ch, m) {
    m = m == null ? mainM(ch) : m;
    const k = ch + '|' + m;
    if (BASE[k]) return BASE[k];
    const its = D.items.filter(it => it.c === ch && it.t !== '스토리' && !it.ad && !it.x && !it.hid && !(it.c === '인스타그램' && it.d < '2024-12-27') && it.d >= addDays(D.updated, -365));
    // 기준값이 0·없음이면(원광대 좋아요 0 수집 등) 1로 대체하지 않고 비교 불가로 둔다
    const bv = median(its.map(it => val(it, m)));
    BASE[k] = { v: bv > 0 ? bv : null, q: median(its.map(quality)) };
    return BASE[k];
  }
  // 과거 기록(it.x)은 기록 시점 값이라 지금 기준값과 비교하지 않음
  // 형식별 기준값: 같은 채널·같은 형식 최근 1년 게시물이 BASE_T_MIN개 이상이면 그 중앙값, 아니면 채널 기준값
  // (캐러셀 조회는 슬라이드 넘김 중복, 쇼츠는 반복 재생으로 조회가 크게 나와 채널 하나의 기준으로 비교하면 히트가 그쪽으로 쏠림)
  const BASE_T_MIN = 15;
  function baseFor(it, m) {
    m = m == null ? mainM(it.c) : m;
    const k = it.c + '|' + m + '|t:' + it.t;
    if (BASE[k]) return BASE[k];
    const its = D.items.filter(x => x.c === it.c && x.t === it.t && x.t !== '스토리' && !x.ad && !x.x && !x.hid && x.d >= addDays(D.updated, -365));
    const bv = its.length >= BASE_T_MIN ? median(its.map(x => val(x, m))) : null;
    BASE[k] = bv > 0 ? { v: bv, by: '형식', n: its.length, q: median(its.map(quality)) } : Object.assign({ by: '채널' }, baseOf(it.c, m));
    return BASE[k];
  }
  // 인스타 자동 수집 시작(2024-12-27) 전 게시물은 값이 26-01-01 기록에 고정돼 있어 지수 계산에서 뺀다
  const frozen = it => it.c === '인스타그램' && it.d < '2024-12-27';
  const ratio = it => { if (it.x || it.hid || frozen(it)) return null; const v = mainVal(it), b = baseFor(it).v; return v == null || !b ? null : v / b; };
  const likeRatio = it => { if (it.x || frozen(it)) return null; const v = val(it, 1), b = baseFor(it, 1).v; return v == null || !b ? null : v / b; };
  // 경과일 편향: 게시 AGE_MIN일 전 게시물은 조회가 덜 쌓여(첫 기록이 현재 값의 인스타 약 0.8, 유튜브 약 0.5) 히트·부진 판정과 히트율에서 뺀다
  const AGE_MIN = 14;
  const young = it => daysBetween(it.d, D.updated) < AGE_MIN;
  const judged = it => ratio(it) != null && !young(it);
  const isHit = it => { const r = ratio(it); return r != null && !young(it) && r >= HIT; };
  const hitRate = L => { const f = L.filter(judged); return f.length ? f.filter(isHit).length / f.length : null; };

  // ───────── 제목·배너 ─────────
  function title(s) {
    const lines = String(s || '').split(/[⠀ㅤᅟ]|\n+|\s{3,}| - - /).map(x => x.replace(/[|｜【】\[\]#]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+/u, '')).filter(Boolean);
    return lines[0] || '(캡션 없음)';
  }
  function badge(ch) { return '<span class="chb" style="--c:' + (ch === 'hong._.video' ? css('--chb-hong') : isBench(ch) ? css('--chb-bench') : chColor(ch)) + '">' + esc(chName(ch)) + '</span>'; }
  // 콘텐츠 표기: [채널] 유형 · 제목
  const TYPE_SHORT = { '릴스/영상': '릴스', '1분 이하': '쇼츠', '1~3분': '1~3분', '3~10분': '3~10분', '10분 초과': '10분 초과', '캐러셀': '캐러셀', '이미지': '이미지', '릴스': '릴스', '스토리': '스토리' };
  const typeShort = t => TYPE_SHORT[t] || t || '';
  function line(it) { const ty = typeShort(it.t); return '<span class="ln">' + badge(it.c) + (ty ? '<span class="ty">' + esc(ty) + '</span>' : '') + '<span class="tx">' + esc(title(it.n)) + '</span></span>'; }
  const ptag = p => '<span class="tag ' + (PROD_CLASS[p] || '') + '">' + esc(p) + '</span>';
  const histTag = it => it.x ? '<span class="tag" title="엑셀로 기록하던 시기의 값(기록 당시 수치)">과거 기록</span>' : '';
  const glab = it => it.g + (it.s ? ' · ' + it.s : '');
  // 비공개·중복 업로드로 보이는 유튜브 영상(it.hid): 평소 대비 대신 표시만
  const HID_TIP = '올린 지 ' + AGE_MIN + '일이 넘었는데 조회 20 이하 · 비공개·일부 공개나 중복 업로드로 보여 평소 계산에서 뺐어요';
  const hidTag = it => it.hid ? '<span class="tag p-guess" title="' + HID_TIP + '">비공개로 보임</span>' : '';
  // 광고 의심(it.sus): 광고 표시는 없지만 좋아요가 유난히 적고 조회가 멈춘 영상 — 표시만, 계산에는 그대로 넣음
  const susTag = it => it.sus ? '<span class="tag p-guess" title="' + esc(it.sus) + '">광고 의심</span>' : '';
  const adtag = it => it.ad ? '<span class="tag ' + (it.ad.s === '확인' ? 'p-ad' : 'p-ad p-guess') + '" title="' + esc(it.ad.s === '패턴' ? '광고 리포트 이후 영상 · 조회 패턴으로 추정' : it.ad.x && !it.ad.k.length && !it.ad.mk ? it.ad.x + ' (캠페인 정보 없음)' : it.ad.mk && !it.ad.k.length ? '메타 광고(게시물 홍보): ' + it.ad.mk.map(metaLabel).join(', ') : '구글애즈 캠페인 연결(' + it.ad.s + '): ' + it.ad.k.join(', ')) + '">광고' + (it.ad.s === '확인' ? '' : ' 추정') + '</span>' : '';

  // ───────── 필터 ─────────
  const since = () => S.range === 'all' ? '' : addDays(D.updated, -Number(S.range));
  function pool(o) {
    o = o || {};
    const f = o.since !== undefined ? o.since : since();
    const u = o.until || '9999';
    const chs = o.channels || OWN;
    return D.items.filter(it => chs.includes(it.c) && it.t !== '스토리' && (!f || it.d >= f) && it.d <= u && (o.ads || S.ads || !it.ad) && (!o.g || it.g === o.g) && (!o.gs || it.s === o.gs));
  }
  function groupBy(L, key) {
    const g = {};
    L.forEach(it => { const k = typeof key === 'function' ? key(it) : it[key]; (g[k] = g[k] || []).push(it); });
    return Object.entries(g).map(([k, arr]) => ({ k, n: arr.length, idx: median(arr.filter(it => !young(it)).map(ratio)), few: arr.length < MIN_N, v: median(arr.map(mainVal)), q: median(arr.map(quality)), hit: hitRate(arr), arr }));
  }

  // ───────── 공통 조각 ─────────
  const secOpen = (h, p, right) => '<div class="gap"></div><section class="sec"><div class="sh"><div><h2>' + h + '</h2>' + (p ? '<p>' + p + '</p>' : '') + '</div>' + (right || '') + '</div>';
  const secClose = '</section>';
  const mName = it => mainM(it.c) === 1 ? '좋아요' : '조회';
  // 올린 날: 오늘 · 어제 · N일 전(30일까지) · 그 뒤로는 날짜
  const whenTxt = d => { const a = daysBetween(d, D.updated); return a <= 0 ? '오늘 올림' : a === 1 ? '어제 올림' : a <= 30 ? a + '일 전 올림' : dot(d); };
  function rankRows(L, opt) {
    opt = opt || {};
    return L.map((it, i) => {
      const r = it.ad ? null : ratio(it), d = r == null ? null : r - 1;
      const yg = !it.ad && r != null && young(it);
      // 기록이 없어 조회 0으로 고정된 예전 게시물(인스타 자동 수집 전·엑셀 기록)은 0 대신 「–」
      const mv = mainVal(it), mvTxt = (it.x || frozen(it)) && !mv ? '<span class="mu" title="조회 기록 없음">–</span>' : fmtK(mv);
      const tag = it.ad ? '광고' : it.hid ? '비공개로 보임' : r == null ? '' : yg ? '조회 모이는 중' : mW(it.c) + ' 평소의 ' + xf(r);
      const right = opt.right ? opt.right(it) : mName(it) + ' <span class="num">' + mvTxt + '</span>' + (tag ? ' · <em class="' + (it.ad || yg || it.hid ? 'flat' : xCls(r)) + '"' + (yg ? ' title="올린 지 ' + AGE_MIN + '일이 안 돼 조회가 아직 쌓이는 중이에요"' : it.hid ? ' title="' + HID_TIP + '"' : '') + '>' + tag + '</em>' : '');
      return '<li class="rk" tabindex="0" data-i="' + i + '"><span class="no">' + (i + 1) + '</span>' +
        '<span class="t"><b>' + line(it) + '</b><span>' + right + ' · <span title="' + esc(dot(it.d)) + '">' + whenTxt(it.d) + '</span></span></span>' +
        '<span class="tg"><span class="tag">' + esc(glab(it)) + '</span>' + ptag(it.p) + adtag(it) + susTag(it) + hidTag(it) + histTag(it) + '</span></li>';
    }).join('') || '<li class="empty">조건에 맞는 콘텐츠가 없어요.</li>';
  }
  function wireRank(el, L) {
    if (!el) return;
    el.querySelectorAll('.rk').forEach(li => {
      const go = () => openDetail(L[+li.dataset.i]);
      li.addEventListener('click', go); li.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    });
  }
  // 순위 정렬: 표본 적음·계산 불가 그룹은 맨 아래
  const rankIdx = r => (r.idx == null || r.few || (r.n != null && r.n < MIN_N)) ? -Infinity : r.idx;
  const byIdx = (a, b) => { const x = rankIdx(a), y = rankIdx(b); return x === y ? (b.n || 0) - (a.n || 0) : y - x; };
  const subN = r => r.n + '개' + (r.hit == null ? '' : ' · 잘 된 ' + pct0(r.hit)); // 막대 아랫줄: 「5개 · 잘 된 60%」
  function bars(el, rows, fmtSub, onClick) {
    const box = $(el); if (!box) return;
    const mx = Math.min(4, Math.max(2, ...rows.map(r => r.idx || 0)));
    box.innerHTML = rows.map(r => {
      const na = r.idx == null, few = na || r.few || (r.n != null && r.n < MIN_N);
      // ±3% 이내는 회색(비슷해요), 막대 면은 글자용보다 밝은 주황(--down-bar)
      const d = na ? 0 : r.idx - 1, k = few ? 'mu' : xCls(r.idx), col = few ? css('--line') : k === 'up' ? css('--up') : k === 'down' ? css('--down-bar') : css('--muted') + '88';
      return '<button class="br' + (few ? ' few' : '') + '" type="button" data-k="' + esc(r.k) + '"><span class="l">' + esc(r.k) + '<small>' + fmtSub(r) + '</small></span>' +
        '<span class="tr"><i style="width:' + (na ? 0 : Math.min(100, r.idx / mx * 100)) + '%;background:' + col + '"></i><span class="mid" style="left:' + (1 / mx * 100) + '%"></span></span>' +
        '<span class="v num ' + k + '"' + (few && !na ? ' title="게시물 ' + MIN_N + '개 미만 · 참고용"' : '') + '>' + (na ? '–' : xf(r.idx)) + (few && !na ? '<em>참고용</em>' : '') + '</span></button>';
    }).join('') || '<div class="empty">데이터가 없어요.</div>';
    if (onClick) box.querySelectorAll('.br').forEach(b => b.addEventListener('click', () => onClick(b.dataset.k)));
  }

  // ───────── 탭·컨트롤 ─────────
  const rangeLabel = () => (RANGES.find(r => r[0] === S.range) || [0, ({ '182': '6달', '1095': '3년' })[S.range] || S.range + '일'])[1];
  const periodPhrase = () => S.range === 'all' ? '전체 기간' : '최근 ' + rangeLabel();
  const rangeOn = () => ({ brief: false, strategy: true, maker: S.ch !== '타 대학', season: false, ads: false, explore: true, export: false })[S.view];
  function buildChrome() {
    // 왼쪽 위 제목: 홈(전체)으로 돌아가며 새로고침(최신 데이터 다시 받기)
    if ($('brandHome') && !$('brandHome').__w) { $('brandHome').__w = 1; $('brandHome').addEventListener('click', e => { e.preventDefault(); S.view = 'brief'; S.ch = '전체'; save(); location.reload(); }); }
    $('tabs').innerHTML = TABS.map(t => '<button class="tt" role="tab" type="button" data-t="' + esc(t) + '">' + esc(t === 'hong._.video' ? 'hong' : t) + '</button>').join('');
    $('tabs').querySelectorAll('.tt').forEach(b => b.addEventListener('click', () => {
      S.ch = b.dataset.t; S.g = null; S.mx = null; S.person = null; S.rankShown = 10; S.tblShown = 30; CS.sel = null;
      if (E) { E.chs = S.ch === '전체' ? OWN.slice() : S.ch === '타 대학' ? benchNames() : [S.ch]; E.types = []; xsave(); }
      render(); window.scrollTo({ top: 0 });
    }));
    $('bnav').innerHTML = '<div class="in">' + VIEWS.map(([k, l]) => '<button type="button" data-v="' + k + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg><span>' + l + '</span></button>').join('') + '</div>';
    $('adTg').addEventListener('click', () => { S.ads = !S.ads; CS.sel = null; render(); toast(S.ads ? '광고 영상까지 포함해서 보여줘요' : '광고 영상을 빼고 보여줘요'); });
    $('bnav').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.view = b.dataset.v; S.g = null; S.mx = null; S.person = null; S.rankShown = 10; S.tblShown = 30; render(); window.scrollTo({ top: 0 }); }));
  }
  function syncChrome() {
    $('tabs').querySelectorAll('.tt').forEach(b => b.setAttribute('aria-selected', b.dataset.t === S.ch));
    $('bnav').querySelectorAll('button').forEach(b => { if (b.dataset.v === S.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    $('st1').textContent = md2(D.updated) + ' 기준'; $('st1').title = mdLabel(D.updated) + ' 기록 기준';
    $('st1').className = 'live';
    $('st2').textContent = weekly() ? '지난 기록 ' + md2(D.dates[D.dates.length - 2]) : '매주 월요일 7시 기록'; $('st2').title = weekly() ? '증가는 ' + mdLabel(D.dates[D.dates.length - 2]) + ' → ' + mdLabel(D.updated) + ' 기록 사이 값이에요' : '';
    if (!TABS.includes(S.ch)) S.ch = '전체';
    $('rangeSeg').hidden = !rangeOn();
    const adOn = !['season', 'export', 'ads'].includes(S.view) && S.ch !== '타 대학' && S.ch !== 'hong._.video' && (S.ch !== '인스타그램' || D.items.some(it => it.c === '인스타그램' && it.ad));
    $('adTg').hidden = !adOn;
    $('adTg').setAttribute('aria-pressed', S.ads);
    $('adTg').textContent = '광고 포함'; $('adTg').title = S.ads ? '광고 영상까지 포함해서 보는 중' : '광고 영상은 빼고 보는 중';
    $('rangeSeg').innerHTML = RANGES.map(([v, l]) => '<button type="button" data-v="' + v + '" aria-pressed="' + (S.range === v) + '">' + l + '</button>').join('');
    $('rangeSeg').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.range = b.dataset.v; S.rankShown = 10; S.mx = null; render(); }));
  }
  // 원본 수집 시작일 — 이전 게시물은 데이터가 없거나(인스타) 그 이후 수치만 있음(유튜브)
  const covFrom = ch => (D.coverage || {})[ch] || null;
  // 인스타 과거 기록(「인스타_과거기록」 탭) — 자동 수집 시작 전 게시물
  const IG_AUTO = '2024-12-27';
  const histOf = ch => (D.hist && D.hist[ch] && D.hist[ch].n) ? D.hist[ch] : null;
  const histNote = () => '인스타 ' + dot(IG_AUTO) + ' 이전은 엑셀 기록 · 2020~22년과 23년 7~12월은 조회 기록 없음';
  function covNote(chs, from) {
    const o = [];
    chs.forEach(ch => { const c = covFrom(ch); if (c && from < c) o.push(ch === '유튜브' ? '유튜브는 ' + dot(c) + ' 이후 조회만 집계' : ch === '인스타그램' ? '인스타는 ' + dot(c) + (histOf(ch) ? ' 이후 게시물만 있음' : ' 이후 게시물만 수집') : ''); });
    if (chs.includes('인스타그램') && histOf('인스타그램') && from < IG_AUTO) o.push(histNote());
    return o.filter(Boolean).join(' · ');
  }
  const adWord = () => S.ads ? '광고 포함' : '광고 제외';
  const viewChannels = () => S.ch === '전체' ? OWN : S.ch === '타 대학' ? benchNames() : [S.ch];
  const scopeLabel = () => S.ch === '전체' ? '우리 채널 전체' : S.ch === '타 대학' ? '타 대학' : chName(S.ch);
  const msgView = (h, p, btn) => { $('view').innerHTML = '<section class="sec"><div class="wait"><b>' + h + '</b><br>' + p + (btn ? '<div style="margin-top:12px"><button type="button" class="btn pri" id="msgBtn">' + btn[0] + '</button></div>' : '') + '</div></section>'; if (btn) $('msgBtn').addEventListener('click', btn[1]); };

  // ═════════ 1. 브리핑 ═════════
  function acctLatest(ch) {
    const a = (D.acct || []).filter(x => x.ch === ch).sort((x, y) => x.d < y.d ? -1 : 1);
    return { cur: a[a.length - 1], prev: a[a.length - 2] };
  }
  function viewBrief() {
    if (S.ch === '타 대학') {
      viewBench();
      $('view').insertAdjacentHTML('afterbegin', benchCmpHtml() + '<div class="gap"></div>');
      $('view').insertAdjacentHTML('beforeend', advHtml());
      wireBenchCmp(); wireAdv(); return;
    }
    const chs = viewChannels();
    const cur = pool({ channels: chs, since: addDays(D.updated, -30) });
    const low = cur.filter(it => judged(it) && ratio(it) < 0.5).sort((a, b) => ratio(a) - ratio(b)).slice(0, 3);
    let html = topHtml(chs) + '<div class="gap"></div>' + weekHtml(chs) + '<div class="gap"></div>' + trendHtml(chs);
    html += '<div class="gap"></div><section class="sec"><div class="sh"><div><h2>점검할 것</h2><p>최근 3달 요약과 평소보다 처진 콘텐츠</p></div></div>' +
      defsHtml() + briefText(chs).replace('style="padding:18px 0 0"', 'style="padding:0 0 18px"') +
      '<h3 class="sub">평소보다 처진 콘텐츠</h3><p class="d">최근 30일 · 올린 지 ' + AGE_MIN + '일 지남 · 조회 평소의 0.5배 미만</p><p class="d">다음 기획 때 제목·첫 장·썸네일 점검</p><ol class="rank" id="bLow">' + (low.length ? rankRows(low) : '<li class="empty">' + ICO.check + ' 처진 콘텐츠가 없어요</li>') + '</ol>' + secClose;
    if (S.ch !== '전체') html += secOpen('최근 3달 분류별 성과', '분류별 조회 평소 대비 중간값 · 누르면 그 분류 콘텐츠') + '<div class="bars" id="bCat"></div>' + secClose;
    html += yearlyHtml(S.ch === '전체' ? OWN : chs);
    if (S.ch === '전체' && benchNames().length) html += '<div class="gap"></div>' + benchCmpHtml();
    html += advHtml();
    $('view').innerHTML = html;
    wireWeek(); wireTrend(); wireBenchCmp(); wireAdv(); wireTop(chs);
    wireRank($('bLow'), low);
    if (S.ch !== '전체') bars('bCat', groupBy(pool({ channels: chs, since: addDays(D.updated, -90) }), 'g').filter(r => r.n >= MIN_N).sort(byIdx), subN, k => { S.view = 'explore'; S.g = k; render(); window.scrollTo({ top: 0 }); });
    wireBrief();
  }
  // 연도별 추이 — 게시일 기준 연간 요약. 인스타 과거 기록(엑셀 기록 시기)까지 포함
  function yearlyHtml(chs) {
    const L = pool({ channels: chs, since: '' });
    if (!L.length) return '';
    const yrs = uniq(L.map(it => it.d.slice(0, 4))).sort().reverse();
    const cy = D.updated.slice(0, 4);
    // 조회 0은 '조회 기록 없음'(원본에서 빠져 0으로 고정된 게시물 등)이라 중앙값에서 뺀다
    const med = (arr, m) => median(arr.map(it => val(it, m)).filter(v => m !== 0 || v > 0));
    const share = (arr, f, n) => { const g = {}; arr.forEach(it => { const k = f(it) || '–'; g[k] = (g[k] || 0) + 1; }); return Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => esc(k) + ' <small>' + Math.round(c / arr.length * 100) + '%</small>').join(' · '); };
    const src = arr => { const x = arr.filter(it => it.x).length; return x === arr.length ? '과거 기록' : x ? '과거 기록 + 자동' : '자동 수집'; };
    const yl = y => y + (y === cy ? '<small class="pt yl">진행 중</small>' : '');
    // 유튜브는 전체 기간 값(L)이 없는 예전 영상이 많은 해는 수집 시작 뒤 조회만 있어 작게 보임 → 「일부」 표시
    const part = a => a.length && chs[0] === '유튜브' && a.filter(it => !it.L).length > a.length / 2 ? ' <small class="mu" title="전체 기간 값이 없는 영상이 많아 ' + dot(D.dates[0]) + ' 이후 조회만 들어 있어요">일부</small>' : '';
    const multi = chs.length > 1;
    let head, rows;
    if (multi) {
      head = '<th>연도</th>' + chs.map(c => '<th class="n">' + badge(c) + ' 게시</th><th class="n">게시물당 좋아요</th>').join('');
      rows = yrs.map(y => '<tr><td>' + yl(y) + '</td>' + chs.map(c => { const a = L.filter(it => it.c === c && it.d.slice(0, 4) === y); return '<td class="n">' + (a.length || '<span class="mu">–</span>') + '</td><td class="n">' + (a.length ? fmtK(med(a, 1)) : '<span class="mu">–</span>') + '</td>'; }).join('') + '</tr>');
    } else {
      const ig = chs[0] === '인스타그램';
      head = '<th>연도</th><th class="n">게시</th><th class="n">게시물당 조회</th><th class="n">게시물당 좋아요</th>' + (ig ? '<th class="n">게시물당 도달</th>' : '') + '<th>많이 올린 형식</th><th>많이 올린 분류</th>' + (ig ? '<th>데이터</th>' : '');
      rows = yrs.map(y => {
        const a = L.filter(it => it.d.slice(0, 4) === y);
        return '<tr><td>' + yl(y) + '</td><td class="n">' + a.length + '</td><td class="n">' + fmtK(med(a, 0)) + part(a) + '</td><td class="n">' + fmtK(med(a, 1)) + '</td>' +
          (ig ? '<td class="n">' + fmtK(median(a.map(it => it.r))) + '</td>' : '') +
          '<td>' + share(a, it => typeShort(it.t), 2) + '</td><td>' + share(a, it => it.g, 2) + '</td>' + (ig ? '<td>' + src(a) + '</td>' : '') + '</tr>';
      });
    }
    // 기준·예외는 용어 칩으로(괄호 문장 대신)
    const Dy = [['게시물당 값', '중간값']];
    if (chs.includes('인스타그램') && histOf('인스타그램')) Dy.push(['인스타 ' + dot(IG_AUTO) + ' 이전', '엑셀 기록 · 기록 당시 수치'], ['조회 기록 없음', '2020~22년 · 23년 7~12월']);
    if (chs.includes('유튜브')) Dy.push(['유튜브 조회', '전체 기간 누적']);
    return secOpen('연도별 추이', '게시일 기준 · ' + adWord()) + '<dl class="defs">' + Dy.map(d => '<div><dt>' + d[0] + '</dt><dd>' + d[1] + '</dd></div>').join('') + '</dl><div class="tw"><table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' + secClose;
  }
  function sparkData(ch) {
    const m = mainM(ch), out = [];
    for (let k = 7; k >= 0; k--) {
      const d = new Date(D.updated + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k);
      const key = d.toISOString().slice(0, 7);
      out.push({ key, v: median(D.items.filter(it => it.c === ch && it.t !== '스토리' && !it.ad && it.d.slice(0, 7) === key).map(it => val(it, m))) });
    }
    return out;
  }
  // 최근 3달 분류별 요약 — 채널마다 따로(유튜브처럼 기준값이 작은 채널이 합계를 끌고 가지 않게)
  // 용어 칩: 이름 + 한 줄 뜻(자세한 기준은 마우스를 올리면)
  function defsHtml() {
    const D4 = [['평소', '같은 채널·형식 최근 1년 조회 중간값', '그 형식 게시물이 ' + BASE_T_MIN + '개 미만이면 채널 전체 중간값 · 광고·스토리 제외'], ['잘 된 게시물', '평소의 1.5배 이상', ''], ['조회 모이는 중', '올린 지 ' + AGE_MIN + '일 안 됨 · 판정 제외', ''], ['게시물 적음', MIN_N + '개 미만 묶음 · 참고용', '']];
    return '<dl class="defs">' + D4.map(d => '<div' + (d[2] ? ' title="' + esc(d[2]) + '"' : '') + '><dt>' + d[0] + '</dt><dd>' + d[1] + '</dd></div>').join('') + '</dl>';
  }
  // 최근 3달 분류별 요약을 채널마다 한 줄 덩어리로(가장 높은 분류 · 가장 약한 분류)
  function insightRows(chs) {
    const own = (chs || OWN).filter(c => OWN.includes(c)), R = [];
    own.forEach(ch => {
      const L = pool({ channels: [ch], since: addDays(D.updated, -90) }).filter(it => ratio(it) != null);
      if (!L.length) return;
      const g = groupBy(L, 'g').filter(r => r.n >= MIN_N && r.idx != null).sort(byIdx);
      if (!g.length) { R.push('<div class="ir"><div class="ir-h">' + badge(ch) + '<span class="mu">한 분류에 ' + MIN_N + '개 이상 모인 게 없어 비교 전이에요</span></div></div>'); return; }
      const t = g[0], w = g.length > 1 ? g[g.length - 1] : null;
      const cell = (lab, r, cls) => '<div class="ir-c"><span class="ir-l">' + lab + '</span><b>' + esc(r.k) + '</b><span class="ir-v"><b class="num ' + cls + '">조회 평소의 ' + xf(r.idx) + '</b> · 게시물 ' + r.n + '개 · 잘 된 비율 ' + pct0(r.hit) + '</span></div>';
      R.push('<div class="ir"><div class="ir-h">' + badge(ch) + '<span class="mu">최근 3달 ' + L.length + '개</span></div><div class="ir-g">' + cell(t.idx >= 1 ? '가장 높은 분류' : '가장 나은 분류', t, t.idx >= 1 ? 'up' : 'flat') + (w ? cell('가장 약한 분류', w, 'down') : '') + '</div></div>');
    });
    const ig = pool({ channels: ['인스타그램'], since: addDays(D.updated, -90) }).filter(it => ratio(it) != null);
    const ft = own.includes('인스타그램') ? groupBy(ig.filter(it => it.r > 0), 't').map(r => ({ k: r.k, n: r.n, rv: median(r.arr.map(it => it.r)) })).filter(r => r.n >= 5 && r.rv > 0).sort((a, b) => b.rv - a.rv) : [];
    if (ft.length >= 2) R.push('<div class="ir"><div class="ir-h">' + badge('인스타그램') + '<span class="mu">형식별 도달(게시물 하나가 닿은 사람 수)</span></div><div class="ir-f">' + ft.map(r => '<span>' + esc(r.k) + ' <b class="num">' + fmtK(r.rv) + '명</b> · ' + r.n + '개</span>').join('') + '</div><p class="ir-n">캐러셀은 슬라이드를 넘길 때마다 조회가 다시 세져서 조회 대신 도달로 견줘요</p></div>');
    return R.length ? R.join('') : '<p class="mu">최근 3달 게시물이 없어요.</p>';
  }
  function insights(chs) {
    const out = [];
    const own = (chs || OWN).filter(c => OWN.includes(c));
    own.forEach(ch => {
      const L = pool({ channels: [ch], since: addDays(D.updated, -90) }).filter(it => ratio(it) != null);
      if (!L.length) return;
      const g = groupBy(L, 'g').filter(r => r.n >= MIN_N && r.idx != null).sort(byIdx);
      if (!g.length) { out.push(chName(ch) + ': 최근 3달에 ' + L.length + '개를 올렸는데, 한 분류에 ' + MIN_N + '개 이상 모인 게 없어 분류끼리 비교하기는 일러요.'); return; }
      const t = g[0], cnt = '(' + t.n + '개 중 잘 된 비율 ' + pct0(t.hit) + ')';
      let s = chName(ch) + ': ' + (t.idx >= 1 ? '「' + t.k + '」 게시물이 조회 평소의 ' + xf(t.idx) + '로 분류 중 가장 높았어요' + cnt + '.' : '조회가 평소를 넘은 분류는 없었어요. 그중 나은 건 「' + t.k + '」로 조회 평소의 ' + xf(t.idx) + '예요' + cnt + '.');
      if (g.length > 1) { const w = g[g.length - 1]; s += ' 가장 약한 건 「' + w.k + '」로 ' + xf(w.idx) + '예요 · ' + w.n + '개.'; }
      out.push(s);
    });
    const ig = pool({ channels: ['인스타그램'], since: addDays(D.updated, -90) }).filter(it => ratio(it) != null);
    // 인스타 형식 비교는 도달 기준 — 캐러셀 조회는 슬라이드 넘김이 중복 집계되어 조회로 비교하면 캐러셀이 부풀려진다
    const ft = own.includes('인스타그램') ? groupBy(ig.filter(it => it.r > 0), 't').map(r => ({ k: r.k, n: r.n, rv: median(r.arr.map(it => it.r)) })).filter(r => r.n >= 5 && r.rv > 0).sort((a, b) => b.rv - a.rv) : [];
    if (ft.length >= 2) out.push('인스타 형식: 게시물 하나가 닿은 사람 수(도달 중간값)로 보면 ' + jo(ft[0].k, '이', '가') + ' ' + ft[ft.length - 1].k + '의 ' + (ft[0].rv / ft[ft.length - 1].rv).toFixed(1) + '배예요(' + ft.map(r => r.k + ' ' + fmtK(r.rv) + '명·' + r.n + '개').join(', ') + '). 캐러셀은 슬라이드를 넘길 때마다 조회가 다시 세져서 조회 대신 도달로 비교해요.');
    if (!out.length) out.push('최근 3달 게시물이 없어요.');
    return out;
  }
  function briefText(chs) {
    const ins = insights(chs);
    return '<div class="brief" style="padding:18px 0 0"><div class="lb">최근 3달 분류별 요약<small>최근 3달 게시물 기준</small></div><div class="irs">' + insightRows(chs) + '</div></div>';
  }
  function wireBrief() {
    const b = $('briefBtn'); if (!b) return;
    b.addEventListener('click', () => { const open = $('briefList').hidden; $('briefList').hidden = !open; b.setAttribute('aria-expanded', open); b.querySelector('.chev').style.transform = open ? 'rotate(90deg)' : ''; });
  }

  // ═════════ 홈 ① 이번 주 현황 — 기록과 기록 사이 실제로 늘어난 조회 (새 게시물 / 기존 게시물) ═════════
  const OKGAP = 10; // 비교 구간으로 쓸 최대 기록 간격(일) — 과거 월 단위 기록은 제외
  // j = 비교 시작 기록(기본은 바로 앞 기록), m = 지표(MN 순서, 기본 조회)
  function weekPart(chs, i, j, m) {
    if (j == null) j = i - 1; m = m || 0;
    if (i <= 0 || j < 0 || j >= i) return null;
    const d0 = D.dates[j], d1 = D.dates[i];
    const ok = chs.filter(c => hasRec(c, i) && hasRec(c, j) && !staleAt(c, i));
    if (!ok.length) return null;
    // 스토리는 24시간 뒤 사라지고 조회가 따로 집계되지 않아 이번 주 증가·목록에서 뺀다
    const its = D.items.filter(it => ok.includes(it.c) && it.t !== '스토리' && (S.ads || !it.ad));
    // 새 게시물 = 직전 기록일 다음 날 이후 게시 + 직전 기록일 당일에 올렸는데 직전 기록에 없던 것
    const isNew = it => it.d <= d1 && (it.d > d0 || (it.d === d0 && !it.h[j]));
    const nw = its.filter(isNew), old = its.filter(it => it.d <= d0 && !isNew(it));
    // 늦게 수집된 예전 게시물(직전 기록에 없고 그보다 먼저 올림): 증가 합계에서 빼고 콘텐츠로만 보여 줌
    const late = old.filter(it => it.h[i] && !it.h[j]);
    const inc0 = it => Math.max(0, incBetween(it, j, i, m) || 0);
    const vn = sum(nw.map(inc0)), vo = sum(old.map(inc0));
    return { d0, d1, days: Math.max(1, daysBetween(d0, d1)), ok, nw, old, late, vn, vo, v: vn + vo, inc0, m };
  }
  // 7일 전에 가장 가까운 앞 기록(같으면 더 긴 쪽, 14일 넘게 떨어진 기록은 안 씀). 매일 기록이 쌓이면 정확히 1주일
  const weekBase = i => { let b = i - 1; for (let j = i - 1; j >= 0; j--) { const g = daysBetween(D.dates[j], D.dates[i]); if (g > 14) break; const gb = daysBetween(D.dates[b], D.dates[i]); if (Math.abs(g - 7) < Math.abs(gb - 7) || (Math.abs(g - 7) === Math.abs(gb - 7) && g > gb)) b = j; } return b; };
  const wLab = p => p.days === 7 ? '최근 1주일' : '최근 ' + p.days + '일';
  // 이번 주 증가에서 고를 지표: 공유·저장은 인스타만 기록
  // 지표 m이 처음 기록된 기록 번호(없으면 -1). hong 공유·저장은 인스타 API를 켠 뒤(2026-10-18 기록)부터
  const MSTART = {};
  const metStart = (ch, m) => { const k = ch + '|' + m; if (!(k in MSTART)) { let st = -1; for (let i = 0; i < D.dates.length && st < 0; i++) if (D.items.some(it => it.c === ch && it.h[i] && it.h[i][m] != null)) st = i; MSTART[k] = st; } return MSTART[k]; };
  const wkMs = chs => [[0, '조회'], [1, '좋아요'], [2, '댓글'], [3, '공유'], [4, '저장']].filter(x => x[0] < 3 || chs.some(c => metStart(c, x[0]) >= 0));
  // 이번 기간 · 직전 기간. 하루 평균 비교(cmp)는 두 기간 모두 셀 수 있는 채널끼리만(한쪽이 원본 미갱신이면 그 채널은 비교에서 뺌)
  function weekModel(chs, m) {
    const n = D.dates.length;
    if (n < 2) return null;
    const i = n - 1, j = weekBase(i), jp = j > 0 ? weekBase(j) : -1;
    const cur = weekPart(chs, i, j, m);
    let prev = jp >= 0 ? weekPart(chs, j, jp, m) : null;
    if (prev && prev.days > 14) prev = null;
    // 직전 기간에 원본이 멈춰 있던 채널(이번 기간은 셈)
    const pd = jp >= 0 ? [D.dates[jp], D.dates[j]] : null;
    const prevStale = pd && daysBetween(pd[0], pd[1]) <= 14 ? chs.filter(c => staleAt(c, j) && cur && cur.ok.includes(c)) : [];
    let cmp = null;
    if (cur && prev) {
      const both = cur.ok.filter(c => prev.ok.includes(c));
      if (both.length) {
        const a = both.length === cur.ok.length ? cur : weekPart(both, i, j, m), b = both.length === prev.ok.length ? prev : weekPart(both, j, jp, m);
        if (a && b && b.v > 0) cmp = { d: (a.v / a.days) / (b.v / b.days) - 1, days: b.days, chs: both, partial: both.length < cur.ok.length };
      }
    }
    return { cur, prev, prevStale, cmp, pd };
  }
  // 비교 문구: 「직전 4일 대비 ▲ 52%」 · 직전 기간이 원본 미갱신이면 회색 안내(이유는 종 알림)
  const cmpTitle = w => '하루 평균 비교 · 직전 ' + w.cmp.days + '일 = ' + md2(w.prev.d0) + ' → ' + md2(w.prev.d1) + (w.cmp.partial ? ' · 직전 기간 원본 미갱신인 ' + w.cur.ok.filter(c => !w.cmp.chs.includes(c)).map(chName).join('·') + ' 제외' : '');
  function cmpLine(w, sp) {
    if (w && w.cmp) return '직전 ' + w.cmp.days + '일 대비 <b class="num ' + dCls(w.cmp.d) + '" title="' + esc(cmpTitle(w)) + '">' + dTxt(w.cmp.d, sp) + '</b>';
    if (w && w.prevStale && w.prevStale.length) return '<span class="flat" title="' + esc(w.prevStale.map(chName).join('·') + ' 원본이 ' + md2(w.pd[0]) + ' → ' + md2(w.pd[1]) + ' 사이 갱신되지 않아 비교할 수 없어요') + '">직전 기간 원본 미갱신</span>';
    return '';
  }
  // 같은 시점 비교: it.ag = [[조회, 경과일] | null] × (게시 1·3·7일 뒤 기록, 실제 경과일은 1~10일로 들쭉날쭉).
  // 비교는 실제 경과일 e 기준: 같은 채널·같은 형식 게시물이 올린 지 e±1일에 받은 조회의 중간값(형식 표본 5개 미만이면 채널 전체 = 형식 섞인 비교)
  const AGB = {};
  const agName = e => e <= 1 ? '첫날' : e === 7 ? '1주일' : e + '일간'; // 「첫날 조회 평소의 0.8배」 · 「5일간 조회 평소의 1.2배」
  function agAt(ch, t, e) {
    const k = ch + '|' + (t || '') + '|' + e;
    if (!(k in AGB)) {
      const lo = Math.max(1, e - 1), hi = e + 1;
      const pick = f => { const out = []; D.items.forEach(it => { if (it.c !== ch || it.t === '스토리' || it.ad || it.hid || !it.ag || !f(it)) return; let bx = null; it.ag.forEach(x => { if (x && x[0] > 0 && x[1] >= lo && x[1] <= hi && (!bx || Math.abs(x[1] - e) < Math.abs(bx[1] - e))) bx = x; }); if (bx) out.push(bx[0]); }); return out; };
      let a = t ? pick(it => it.t === t) : [], mixed = false;
      if (a.length < MIN_N) { a = pick(() => true); mixed = !!t; }
      AGB[k] = a.length >= MIN_N ? { m: median(a), n: a.length, mixed, lo, hi } : null;
    }
    return AGB[k];
  }
  // 비교 자료 설명(마우스 올림)
  const paceTip = p => p.base ? '같은 날수 비교 자료가 아직 적어 평소 게시물의 최종 조회 중간값 ' + fmtK(p.v0) + '과 비교 · 조회가 덜 쌓여 낮게 보여요'
    : (p.b.mixed ? '형식 섞인 비교 · 같은 형식 게시물이 적어 채널 전체 · ' : '같은 형식 게시물이 ') + '올린 지 ' + p.b.lo + '~' + p.b.hi + '일에 받은 조회 중간값 ' + fmtK(p.b.m) + ' 대비 · ' + p.b.n + '개';
  function ageLine(it) {
    const p = paceOf(it);
    if (!p || p.base) return ''; // 비교할 자료가 없으면 빈 칸(줄에서 빠짐)
    return '<em class="' + xCls(p.r) + '" title="' + esc(paceTip(p)) + '">' + agName(p.e) + ' 조회 평소의 ' + xf(p.r) + '</em>';
  }
  // ═════════ 홈 맨 위 — 핵심 숫자 한 줄 + 자동 요약 ═════════
  // 개편 1단계: KPI 카드 스파크라인(축·격자 없는 단색 선 + 옅은 면, Stripe·Apple 트렌드 방식)
  function spark(vals, lbl) {
    // 값이 없는 칸은 빼고 남은 점으로 카드 폭 전체에 펼친다
    const v = vals.filter(x => x != null && !isNaN(x)), ok = v;
    if (ok.length < 3) return '';
    const lo = Math.min(...ok), hi = Math.max(...ok), W = 100, H = 28, n = v.length - 1;
    const pts = v.map((x, i) => x == null ? null : [(i / n) * W, H - 3 - (hi === lo ? 0.5 : (x - lo) / (hi - lo)) * (H - 6)]).filter(Boolean);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    return '<svg class="kspark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="' + esc(lbl || '') + '"><path class="a" d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' 28 L' + pts[0][0].toFixed(1) + ' 28 Z"/><path class="l" d="' + d + '"/></svg>';
  }
  // 기록 사이 하루 평균 조회 증가(최근 7개 구간, 월 단위 과거 기록 구간은 비움)
  function viewSeries(chs) { const out = []; for (let i = Math.max(1, D.dates.length - 7); i < D.dates.length; i++) { const p = weekPart(chs, i); out.push(p && p.days <= OKGAP ? p.v / p.days : null); } return out; }
  // 최근 6달 월별 값: 'n' 게시 수, 'hit' 히트율
  function monthly(chs, kind) {
    const out = [];
    for (let k = 5; k >= 0; k--) {
      const d = new Date(D.updated + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k);
      const key = d.toISOString().slice(0, 7), arr = D.items.filter(it => chs.includes(it.c) && it.t !== '스토리' && !it.ad && it.d.slice(0, 7) === key);
      out.push(kind === 'n' ? arr.length : hitRate(arr));
    }
    return out;
  }
  function kpiTile(label, value, sub, cls, sp, key) {
    return '<div class="kpi-t' + (key ? ' go" data-kpi="' + key + '" role="button" tabindex="0" aria-label="' + esc(String(label).replace(/<[^>]+>/g, '')) + ' 자세히 보기' : '') + '"><div class="kpi-l">' + label + (key ? '<span class="kgo" aria-hidden="true">›</span>' : '') + '</div><div class="kpi-v num' + (cls ? ' ' + cls : '') + '">' + value + '</div>' + (sub ? '<div class="kpi-s">' + sub + '</div>' : '') + (sp || '') + '</div>';
  }
  function acctTile(ch) {
    const a = acctLatest(ch), stale = D.acctStale && D.acctStale[ch];
    // 스파크라인: 인스타 팔로워는 일별(D.fol, 최근 30일)이 있으면 그것, 없으면 계정 지표 기록들. 유튜브는 기록마다 구독 순증
    const A = (D.acct || []).filter(x => x.ch === ch).sort((x, y) => x.d < y.d ? -1 : 1);
    const F = (D.fol || []).filter(r => r[1] === ch && r[0] >= addDays(D.updated, -30));
    if (ch === '인스타그램') {
      const f = a.cur && a.cur.m['Profile followers']; if (f == null) return '';
      const p = a.prev && a.prev.m['Profile followers'];
      const wk = (D.fol || []).filter(r => r[1] === ch && r[0] <= addDays(D.updated, -7)).pop();
      const pv = wk ? wk[2] : p, lbl = wk ? '지난주 대비 ' : (a.prev ? daysBetween(a.prev.d, D.updated) + '일 전 대비 ' : '');
      return kpiTile('인스타 팔로워', fmt(f) + '<small>명</small>', stale ? '<span class="warn">팔로워 수 미갱신</span>' : pv != null ? lbl + dNum(f - pv, '명') : '', '', spark(F.length >= 3 ? F.map(r => r[2]) : A.map(x => x.m['Profile followers']), F.length >= 3 ? '최근 30일 팔로워 수' : '기록별 팔로워 수'), 'fol');
    }
    if (ch === '유튜브') {
      const g = a.cur && a.cur.m['Gained subscribers']; if (g == null) return '';
      const n = g - (a.cur.m['Lost subscribers'] || 0);
      return kpiTile('유튜브 구독자 증감', sgn(n) + fmt(n) + '<small>명</small>', stale ? '<span class="warn">구독자 수 미갱신</span>' : '새 구독 ' + fmt(g) + ' · 취소 ' + fmt(g - n), n >= 0 ? 'up' : 'down', spark(A.map(x => x.m['Gained subscribers'] == null ? null : x.m['Gained subscribers'] - (x.m['Lost subscribers'] || 0)), '기록별 구독자 순증'), 'sub');
    }
    return '';
  }
  // 이 게시물 값 vs 평소(같은 형식 최근 1년 중간값) 막대 하나 — 채운 막대 = 이 게시물, 세로 눈금 = 평소
  function baseCmp(it, tile) {
    const v = mainVal(it), b = baseFor(it).v, w = mW(it.c);
    if (v == null || !b) return '';
    const mx = Math.max(v, b) || 1, up = v >= b, pc = x => Math.max(1.5, x / mx * 100).toFixed(1) + '%';
    return '<div class="cmp3' + (tile ? '' : ' s2-c') + (up ? '' : ' dn') + '"' + (tile ? ' title="평소 = 같은 형식 최근 1년 중간값"' : '') + '><div class="c3h">' + (tile ? w + ' · 같은 형식 평소와' : w + ' · 평소 = 같은 형식 ' + typeShort(it.t) + ' 최근 1년 중간값') + '</div><div class="c3k"><span>이 게시물 <b class="num">' + fmtK(v) + '</b></span><span class="c3mk">평소 <b class="num">' + fmtK(b) + '</b></span></div><div class="c3x"><i style="width:' + pc(v) + '"></i><s style="left:' + pc(b) + '"></s></div></div>';
  }
  function kpiHtml(chs) {
    const w = weekModel(chs), p = w && w.cur;
    const c30all = pool({ channels: chs, since: addDays(D.updated, -30) }), c30 = c30all.filter(judged), hits = c30.filter(isHit);
    const md = d => (+d.slice(5, 7)) + '/' + (+d.slice(8, 10));
    const t = [];
    if (p) {
      const chg = cmpLine(w, 1);
      t.push(kpiTile(wLab(p) + ' 늘어난 조회', '+' + fmtK(p.v), (chg || md(p.d0) + '–' + md(p.d1)), '', spark(viewSeries(chs), '최근 기록 기간별 하루 평균 조회 증가'), 'wk'));
    }
    t.push(kpiTile('최근 30일 잘 된 비율', c30.length ? pct0(hitRate(c30)) : '–', c30.length ? '<span title="올린 지 ' + AGE_MIN + '일이 지난 ' + c30.length + '개 중 ' + hits.length + '개가 평소의 1.5배 이상">' + c30.length + '개 중 ' + hits.length + '개 잘 됨' + (c30.length < MIN_N ? ' · 게시물 적음' : '') + '</span>' : '판정할 게시물 없음', c30.length && c30.length < MIN_N ? 'flat' : '', spark(monthly(chs, 'hit'), '최근 6달 월별 잘 된 비율'), 'hit'));
    chs.filter(c => c === '인스타그램' || c === '유튜브').forEach(c => { const x = acctTile(c); if (x) t.push(x); });
    const by = chs.length > 1 ? chs.map(c => chName(c) + ' ' + c30all.filter(it => it.c === c).length).join(' · ') : '';
    // 그 전 30일(같은 길이)과 비교 — 달력 지난달은 이번 달이 덜 지나 공정하지 않음
    const p30 = pool({ channels: chs, since: addDays(D.updated, -60), until: addDays(D.updated, -31) }).length, dn = c30all.length - p30;
    const cmp = p30 ? '직전 30일 대비 ' + dNum(dn, '개') : '';
    t.push(kpiTile('최근 30일 올린 게시물', c30all.length + '개', cmp || by, '', spark(monthly(chs, 'n'), '최근 6달 월별 게시 수'), 'posts'));
    // 카드가 홀수면 한 칸이 혼자 길어지므로 「최근 30일 가장 잘 된 게시물」로 짝을 맞춘다
    const best = c30.slice().sort((a, b) => ratio(b) - ratio(a))[0];
    if (t.length % 2 && best) { window.__best = best; t.push('<div class="kpi-t best" role="button" tabindex="0" aria-label="최근 30일 가장 잘 된 게시물 상세 보기"><div class="kpi-l">30일 최고 게시물</div><div class="kpi-v num up"><small>' + mW(best.c) + ' 평소의 </small>' + xf(ratio(best)) + '</div><div class="kpi-s"><span class="bt">' + badge(best.c) + esc(title(best.n)) + '</span></div>' + baseCmp(best, 1) + '</div>'); }
    return '<div class="kpi-row n' + t.length + '">' + t.join('') + '</div>';
  }
  // 홈 요약: 문장 대신 덩어리 2개(조회 흐름 / 최근 30일 1위·꼴찌). 숫자는 오른쪽에 모아 괄호 없이
  function homeSummary(chs) {
    const w = weekModel(chs), p = w && w.cur, B = [];
    window.__sum = [];
    const row = (lab, it, val, cls) => { const i = window.__sum.push(it) - 1; return '<button type="button" class="s2-r" data-si="' + i + '"><span class="s2-l">' + lab + '</span><span class="s2-t">' + badge(it.c) + esc(title(it.n)) + '</span><b class="num ' + (cls || '') + '">' + val + '</b></button>'; };
    if (p) {
      const old = p.old.filter(it => p.inc0(it) > 0).sort((a, b) => p.inc0(b) - p.inc0(a));
      const cl = cmpLine(w, 1);
      B.push('<div class="s2"><div class="s2-h"><span>' + wLab(p) + ' 늘어난 조회</span><b class="num">+' + fmtK(p.v) + '</b></div>' +
        '<div class="s2-f">' + (p.nw.length ? '<span>새 게시물 ' + p.nw.length + '개 <b class="num">+' + fmtK(p.vn) + '</b></span><span>예전 게시물 <b class="num">+' + fmtK(p.vo) + '</b></span>' : '<span>새 게시물 없이 예전 게시물에서만 늘었어요</span>') +
        (cl ? '<span>하루 평균 ' + cl + '</span>' : '') + '</div>' +
        (old[0] ? row('가장 많이 늘어난 게시물', old[0], '+' + fmtK(p.inc0(old[0])), 'up') : '') + '</div>');
    }
    const c30 = pool({ channels: chs, since: addDays(D.updated, -30) }).filter(judged).sort((a, b) => ratio(b) - ratio(a));
    if (c30.length) {
      const top = c30[0], low = c30[c30.length - 1];
      B.push('<div class="s2"><div class="s2-h"><span>최근 30일 게시물 ' + c30.length + '개 중</span></div>' +
        row('가장 잘 된', top, mW(top.c) + ' 평소의 ' + xf(ratio(top)), 'up') + baseCmp(top) + (c30.length > 1 ? row('가장 처진', low, mW(low.c) + ' 평소의 ' + xf(ratio(low)), 'down') + baseCmp(low) : '') + '</div>');
    }
    return B.length ? '<div class="sum2">' + B.join('') + '</div>' : '';
  }
  function topHtml(chs) {
    return '<section class="sec top-sec"><div class="sh"><div><h2>' + (S.ch === '전체' ? '이번 주 한눈에' : chName(S.ch) + ' 이번 주') + '</h2><p>' + mdLabel(D.updated) + ' 기록 기준 · ' + adWord() + '</p></div>' +
      '<div class="top-act"><button type="button" class="btn sm" id="repCopy">주간 보고 복사</button><button type="button" class="btn sm" id="repPrint">인쇄·PDF</button></div></div>' +
      kpiHtml(chs) + raceHtml(chs) + homeSummary(chs) + '</section>';
  }
  // 주간 보고: 카톡·메일에 붙일 글(맨 위 숫자 + 요약 + 많이 큰 콘텐츠 + 데이터 주의)
  function reportText(chs) {
    const w = weekModel(chs), p = w && w.cur, L = [];
    const plain = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    L.push('[전주대 SNS 주간 현황] ' + D.updated + ' 기록 기준 · ' + adWord());
    L.push('');
    if (p) L.push('■ 늘어난 조회 +' + fmtK(p.v) + ' (' + dot(p.d0) + ' → ' + dot(p.d1) + ', ' + p.days + '일' + (p.nw.length ? ', 새 게시물 ' + p.nw.length + '개' : '') + ')');
    const c30 = pool({ channels: chs, since: addDays(D.updated, -30) }), cj = c30.filter(judged);
    if (cj.length) L.push('■ 최근 30일 잘 된 비율 ' + pct0(hitRate(cj)) + ' (' + cj.length + '개 중 ' + cj.filter(isHit).length + '개가 평소의 1.5배 이상)');
    L.push('■ 최근 30일 올린 게시물 ' + c30.length + '개' + (chs.length > 1 ? ' (' + chs.map(c => chName(c) + ' ' + c30.filter(it => it.c === c).length).join(', ') + ')' : ''));
    chs.forEach(c => {
      if (D.acctStale && D.acctStale[c]) return;
      const a = acctLatest(c);
      if (c === '인스타그램' && a.cur && a.cur.m['Profile followers'] != null) L.push('■ 인스타 팔로워 ' + fmt(a.cur.m['Profile followers']) + '명');
      if (c === '유튜브' && a.cur && a.cur.m['Gained subscribers'] != null) { const n = a.cur.m['Gained subscribers'] - (a.cur.m['Lost subscribers'] || 0); L.push('■ 유튜브 구독자 ' + sgn(n) + fmt(n) + '명 (지난주 새 구독 − 취소)'); }
    });
    // 요약 줄(화면의 덩어리 카드와 같은 내용을 글로)
    const sm = [], wm = weekModel(chs), pc = wm && wm.cur;
    if (pc) { let x = '- ' + wLab(pc) + ' 조회 +' + fmtK(pc.v) + (pc.nw.length ? ' · 새 게시물 ' + pc.nw.length + '개 +' + fmtK(pc.vn) + ' · 예전 게시물 +' + fmtK(pc.vo) : ''); if (wm.cmp) x += ' · 하루 평균 직전 ' + wm.cmp.days + '일 대비 ' + plain(dTxt(wm.cmp.d, 1)) + (wm.cmp.partial ? '(' + pc.ok.filter(c => !wm.cmp.chs.includes(c)).map(chName).join('·') + ' 제외)' : ''); else if (wm.prevStale.length) x += ' · 직전 기간은 ' + wm.prevStale.map(chName).join('·') + ' 원본 미갱신이라 비교 안 함'; sm.push(x); }
    if (pc && pc.late.length) sm.push('- 늦게 수집된 예전 게시물 ' + pc.late.length + '개는 누적값이 한 번에 잡혀 증가 합계에서 뺐어요');
    const cs = pool({ channels: chs, since: addDays(D.updated, -30) }).filter(judged).sort((a, b) => ratio(b) - ratio(a));
    if (cs.length) { sm.push('- 최근 30일 가장 잘 된 게시물: [' + chName(cs[0].c) + '] ' + title(cs[0].n) + ' · ' + mW(cs[0].c) + ' 평소의 ' + xf(ratio(cs[0]))); if (cs.length > 1) { const lw = cs[cs.length - 1]; sm.push('- 가장 처진 게시물: [' + chName(lw.c) + '] ' + title(lw.n) + ' · ' + mW(lw.c) + ' 평소의 ' + xf(ratio(lw))); } }
    if (sm.length) { L.push(''); sm.forEach(x => L.push(x)); }
    if (p) {
      const old = p.old.filter(it => p.inc0(it) > 0).sort((a, b) => p.inc0(b) - p.inc0(a)).slice(0, 5);
      if (old.length) { L.push(''); L.push('이번 주 많이 늘어난 콘텐츠'); old.forEach((it, i) => L.push((i + 1) + '. [' + chName(it.c) + '] ' + title(it.n) + ' +' + fmtK(p.inc0(it)))); }
    }
    const st = chs.concat(S.ch === '전체' ? benchNames() : []).filter(c => D.stale && D.stale[c]);
    const as = chs.filter(c => D.acctStale && D.acctStale[c]);
    if (st.length || as.length) { L.push(''); L.push('※ 원본 데이터가 새로 안 들어온 곳: ' + st.concat(as.map(c => chName(c) + ' 계정 지표')).map(c => c.indexOf(' ') > 0 ? c : chName(c)).join(', ') + ' — 이번 증가 합계에서 뺐어요'); }
    L.push('※ 평소 = 같은 채널·같은 형식으로 최근 1년 올린 게시물 조회의 중간값 · 잘 된 게시물 = 평소의 1.5배 이상 · 올린 지 ' + AGE_MIN + '일이 안 된 게시물은 판정에서 빼요');
    return L.join('\n');
  }
  function copyText(s) {
    const ok = () => toast('주간 보고를 복사했어요'), bad = () => { const t = document.createElement('textarea'); t.value = s; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('복사하지 못했어요'); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(ok, bad); else bad();
  }
  // 최근 게시물이 평소보다 빠른가(YouTube Realtime 방식) — 지금 조회(올린 지 e일) 또는 기록된 1·3·7일 뒤 값 중 가장 늦은 것 ÷ 같은 형식의 같은 날수 중간값
  function paceOf(it) {
    const age = daysBetween(it.d, D.updated), v = mainVal(it), cand = [];
    if (age >= 1 && v > 0) cand.push([v, age]);
    (it.ag || []).slice().reverse().forEach(x => { if (x && x[0] > 0 && x[1] >= 1 && x[1] !== age) cand.push(x); });
    for (const [x, e] of cand) { const b = agAt(it.c, it.t, e); if (b && b.m > 0) return { r: x / b.m, e, b }; }
    // 같은 날수 비교 자료가 없으면: 지금까지 조회 ÷ 같은 형식 평소 게시물의 최종 조회(「평소 최종 조회 대비」로 따로 표시)
    const b = baseFor(it);
    return b && b.v > 0 && v != null ? { r: v / b.v, base: 1, v0: b.v } : null;
  }
  function raceHtml(chs) {
    const L = D.items.filter(it => chs.includes(it.c) && OWN.includes(it.c) && it.t !== '스토리' && (S.ads || !it.ad) && daysBetween(it.d, D.updated) <= 14).sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : 0).slice(0, 4);
    window.__race = L;
    if (!L.length) return '';
    const MX = 3;
    return '<div class="race"><div class="race-h"><h3>최근 게시물, 평소보다 잘 크고 있나요?</h3><span>올린 지 같은 날수의 조회를 같은 형식 게시물과 비교</span></div><ol class="race-l">' + L.map((it, i) => {
      const p = paceOf(it), r = p ? p.r : null;
      const cls = r == null ? 'na' : p.base ? 'base' : r >= HIT ? 'hit' : r >= 1 ? 'up' : 'down';
      return '<li data-r="' + i + '" tabindex="0" role="button" aria-label="' + esc(title(it.n)) + ' 상세 보기"><div class="race-t">' + badge(it.c) + '<span>' + esc(title(it.n)) + '</span></div>' +
        '<div class="race-b"><span class="bl"><i class="' + cls + '" style="width:' + (r == null ? 0 : Math.min(100, r / MX * 100)) + '%"></i><em style="left:' + (100 / MX) + '%"></em><em class="h" style="left:' + (HIT / MX * 100) + '%"></em></span>' +
        '<b class="num ' + (r == null || p.base ? 'flat' : xCls(r)) + '"' + (p ? ' title="' + esc(paceTip(p)) + '"' : '') + '>' + (r == null ? '비교 전' : '조회 평소의 ' + xf(r)) + '</b></div>' +
        '<small>' + whenTxt(it.d) + ' · 조회 ' + fmtK(mainVal(it)) + (r == null ? '' : p.base ? ' · 평소 최종 조회 대비' : ' · ' + agName(p.e) + ' 조회 비교' + (p.b.mixed ? ' · 같은 형식 자료가 적어 채널 전체와 비교' : '')) + '</small></li>';
    }).join('') + '</ol><div class="race-k"><span><em></em>평소만큼</span><span><em class="h"></em>잘 된 기준 1.5배</span><span>끝 3배</span></div></div>';
  }
  function wireRace() {
    const L = window.__race || [];
    document.querySelectorAll('.race-l li[data-r]').forEach(li => { const go = () => openDetail(L[+li.dataset.r]); li.addEventListener('click', go); li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
  }
  function wireTop(chs) {
    wireRace();
    document.querySelectorAll('.s2-r[data-si]').forEach(b => b.addEventListener('click', () => { const it = (window.__sum || [])[+b.dataset.si]; if (it) openDetail(it); }));
    document.querySelectorAll('.kpi-t[data-kpi]').forEach(b => { const go = () => openKpi(b.dataset.kpi, chs); b.addEventListener('click', go); b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); });
    const bt = document.querySelector('.kpi-t.best'); if (bt && window.__best) { const go = () => openDetail(window.__best); bt.addEventListener('click', go); bt.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } }); }
    const c = $('repCopy'), p = $('repPrint');
    if (c) c.addEventListener('click', () => copyText(reportText(chs)));
    if (p) p.addEventListener('click', () => window.print());
  }
  function dayChg(w) {
    if (!w.cur) return '';
    if (w.cmp) return '<span class="mu" title="' + esc(cmpTitle(w)) + '">직전 ' + w.cmp.days + '일 대비</span> <b class="' + dCls(w.cmp.d) + '">' + dTxt(w.cmp.d, 1) + '</b>';
    if (w.prev && w.prev.v === 0) return '<span class="mu">그 전 기간 0</span>';
    return cmpLine(w);
  }
  function wkBar(p, col) {
    if (!p || !p.v) return '<div class="wk-bar"></div>';
    return '<div class="wk-bar"><i style="width:' + (p.vn / p.v * 100) + '%;background:' + col + '"></i><i style="width:' + (p.vo / p.v * 100) + '%;background:' + col + '55"></i></div>';
  }
  function wkCard(label, chs, col, foot, wide) {
    const m = S.wkM || 0;
    const st = m >= 3 ? Math.max(...chs.map(c => metStart(c, m))) : 0, jb = weekBase(D.dates.length - 1);
    const none = msg => '<div class="wk-card' + (wide ? ' wide' : '') + '"><div class="wk-h">' + label + '</div><div class="wk-v mu">–</div><div class="wk-s mu">' + msg + '</div>' + (foot ? '<div class="wk-f">' + foot + '</div>' : '') + '</div>';
    if (st < 0) return none('이 채널은 ' + MN[m] + ' 기록 없음');
    // 시작 기록보다 늦게 받기 시작한 지표: 예전 게시물 증가를 셀 수 없음
    if (st > jb) return none(jo(MN[m], '은', '는') + ' ' + md2(D.dates[st]) + ' 기록부터 받아요 · 1주일 증가는 다음 주부터 나와요');
    const w = weekModel(chs, m);
    if (!w || !w.cur) return '<div class="wk-card' + (wide ? ' wide' : '') + '"><div class="wk-h">' + label + '</div><div class="wk-v mu">–</div><div class="wk-s mu">' + (chs.every(c => staleAt(c, D.dates.length - 1)) ? '원본 미갱신 · 이번 기간 셀 수 없음' : '두 기록 모두 있는 데이터 없음') + '</div>' + (foot ? '<div class="wk-f">' + foot + '</div>' : '') + '</div>';
    const p = w.cur;
    return '<div class="wk-card' + (wide ? ' wide' : '') + '" style="--c:' + col + '"><div class="wk-h">' + label + '</div>' +
      '<div class="wk-v num">+' + fmtK(p.v) + '<small>' + MN[m] + '</small></div>' + ((x => x ? '<div class="wk-s">' + x + '</div>' : '')(dayChg(w))) +
      wkBar(p, col) + '<div class="wk-l"><span><i style="background:' + col + '"></i>' + (p.nw.length ? '새 게시물 ' + p.nw.length + '개 <b class="num">' + fmtK(p.vn) + '</b>' : '새 게시물 없음') + '</span><span><i style="background:' + col + '55"></i>기존 게시물 <b class="num">' + fmtK(p.vo) + '</b></span></div>' +
      (foot ? '<div class="wk-f">' + foot + '</div>' : '') + '</div>';
  }
  function chFoot(ch) {
    if (D.acctStale && D.acctStale[ch]) return '계정 지표 <span class="warn">미갱신</span>';
    if (ch === '인스타그램') { const a = acctLatest(ch); const f = a.cur && a.cur.m['Profile followers']; if (f == null) return ''; const p = a.prev && a.prev.m['Profile followers']; return '팔로워 <b>' + fmt(f) + '명</b>' + (p != null ? ' ' + dNum(f - p, '명') : ''); }
    if (ch === '유튜브') { const a = acctLatest(ch); const g = a.cur && a.cur.m['Gained subscribers']; if (g == null) return ''; const l = a.cur.m['Lost subscribers'] || 0; return '구독 순증 <b class="' + (g - l >= 0 ? 'up' : 'down') + '">' + sgn(g - l) + fmt(g - l) + '명</b>'; }
    const c = pool({ channels: [ch], since: addDays(D.updated, -30) }); return '최근 30일 게시물 <b>' + c.length + '개</b>';
  }
  function weekHtml(chs) {
    const m = wkMs(chs).some(x => x[0] === (S.wkM || 0)) ? (S.wkM || 0) : 0;
    S.wkM = m; DY.m = m + 3; window.__wkChs = chs;
    const w = weekModel(chs, m);
    if (!w || !w.cur) return '<section class="sec"><div class="sh"><div><h2>이번 주 현황</h2><p>기록이 2번 이상 쌓이면 기록 사이에 늘어난 조회가 나와요.</p></div></div></section>';
    const p = w.cur;
    const c30 = pool({ channels: chs, since: addDays(D.updated, -30) }).filter(judged), hits = c30.filter(isHit);
    let h = '<section class="sec" id="wkSec"><div class="sh"><div><h2>' + (chs.length > 1 ? '채널별 증가' : '이번 주 증가') + '</h2><p>' + md2(p.d0) + ' → ' + md2(p.d1) + ' 늘어난 ' + MN[m] + ' · ' + adWord() + (chs.some(c => staleAt(c, D.dates.length - 1)) ? ' · 원본 미갱신 ' + chs.filter(c => staleAt(c, D.dates.length - 1)).map(chName).join('·') + ' 제외' : '') + '</p></div><div class="seg" id="wkBy" aria-label="볼 지표">' + wkMs(chs).map(x => '<button type="button" data-v="' + x[0] + '" aria-pressed="' + (m === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div>';
    if (chs.length > 1) {
      // 우리 채널 합계는 맨 위 핵심 숫자에 있으니 채널 카드만
      h += '<div class="wk-grid"><div class="wk-row">' + chs.map(ch => wkCard(badge(ch), [ch], chColor(ch), chFoot(ch))).join('') + '</div></div>';
    } else {
      h += '<div class="wk-grid one">' + wkCard(badge(chs[0]), chs, chColor(chs[0]), chFoot(chs[0]) + ' · <span title="최근 30일 · 올린 지 ' + AGE_MIN + '일 지난 게시물">잘 된 게시물 <b>' + hits.length + '</b>/' + c30.length + '개</span>', true) + '</div>';
    }
    h += dailyHtml(chs);
    const mv = it => (m ? val(it, m) : mainVal(it)) || 0, nw = p.nw.slice().sort((a, b) => mv(b) - mv(a));
    const old = p.old.filter(it => p.inc0(it) > 0).sort((a, b) => p.inc0(b) - p.inc0(a)).slice(0, 5);
    // 새로 올린 콘텐츠가 없으면 빈 칸을 두지 않고 '많이 늘어난 콘텐츠' 하나만 넓게
    const oldBox = '<div><h3>' + (nw.length ? '많이 늘어난 기존 콘텐츠' : '이번 주 많이 늘어난 콘텐츠') + '</h3><p class="d">' + (nw.length ? '예전에 올렸는데 이번 주에도 ' + MN[m] + ' 늘어난 콘텐츠' : '이번 기간에 새로 올린 콘텐츠는 없어요 · 예전 콘텐츠 중 ' + MN[m] + ' 많이 늘어난 순') + '</p><ol class="rank' + (nw.length ? '' : ' wide') + '" id="wkOld">' +
      (old.length ? rankRows(old, { right: it => '이번 주 ' + MN[m] + ' <em class="up">+' + fmtK(p.inc0(it)) + '</em>' }) : '<li class="empty">이번 기간에 늘어난 콘텐츠가 없어요</li>') + '</ol></div>';
    h += nw.length ? '<div class="two wk-lists"><div><h3>이번 주 올린 콘텐츠 <small>' + nw.length + '개</small></h3><p class="d">' + MN[m] + ' 많은 순</p><ol class="rank" id="wkNew">' +
      rankRows(nw.slice(0, 8), { right: it => [MN[m] + ' <span class="num">' + fmtK(mv(it)) + '</span>', m ? '' : ageLine(it)].filter(Boolean).join(' · ') }) + '</ol></div>' + oldBox + '</div>' : '<div class="wk-lists">' + oldBox + '</div>';
    w.lists = { nw: nw.slice(0, 8), old };
    window.__wk = w;
    return h + '</section>';
  }
  // 일별 증가 — 「일별 합계」 탭(채널별 합계를 평일마다 기록)에서 하루 사이 늘어난 값
  const DY = { m: 3 };
  const DY_M = [[3, '조회'], [4, '좋아요'], [5, '댓글'], [6, '공유'], [7, '저장']];
  function dailyModel(chs) {
    const rows = (D.daily || []).filter(r => chs.includes(r[1]));
    const by = {}; rows.forEach(r => { (by[r[1]] = by[r[1]] || {})[r[0]] = r; });
    const dates = uniq(rows.map(r => r[0])).sort();
    const pts = [];
    for (let i = 1; i < dates.length; i++) {
      const a = dates[i - 1], b = dates[i], gap = daysBetween(a, b);
      if (gap > 4) continue; // 예전 월 단위 기록 사이는 제외
      const v = {}; let any = false;
      chs.forEach(c => { const x = by[c] && by[c][a], y = by[c] && by[c][b]; if (x && y && x[DY.m] != null && y[DY.m] != null) { v[c] = Math.max(0, y[DY.m] - x[DY.m]); any = true; } else v[c] = null; });
      if (any) pts.push({ d: b, from: a, gap, v });
    }
    return pts.slice(-30);
  }
  function dailyHtml(chs) {
    const pts = dailyModel(chs);
    const head = '<div class="dy"><div class="dy-h"><h3>일별 증가</h3></div>';
    if (!pts.length) return ''; // 일별 기록이 이틀치 쌓이기 전에는 칸을 숨긴다
    window.__dy = { pts, chs };
    return head + '<div class="dy-chart"><canvas id="dyC"></canvas></div><p class="note" title="주말에는 원본이 갱신되지 않아 월요일 막대에 금~월이 함께 들어가요">새 글과 기존 글의 하루 ' + (DY_M.find(x => x[0] === DY.m) || DY_M[0])[1] + ' 증가 합계</p></div>';
  }
  function wireDaily() {
    const box = document.querySelector('.dy'); if (!box) return;
    box.querySelectorAll('[data-dym]').forEach(b => b.addEventListener('click', () => { DY.m = +b.dataset.dym; box.outerHTML = dailyHtml(window.__dy ? window.__dy.chs : viewChannels()); wireDaily(); }));
    const M = window.__dy; if (!M || !$('dyC')) return;
    draw('dyC', { type: 'bar', data: { labels: M.pts.map(p => p.gap > 1 ? md2(p.from) + '~' + (p.from.slice(5, 7) === p.d.slice(5, 7) ? +p.d.slice(8, 10) : md2(p.d)) : md2(p.d)), datasets: M.chs.map(c => ({ label: chName(c), data: M.pts.map(p => p.v[c]), backgroundColor: chColor(c), stack: 's', borderRadius: 3, maxBarThickness: 30 })) },
      options: chartOpts({ layout: { padding: { top: 8 } }, plugins: { legend: { display: M.chs.length > 1, position: 'bottom' }, tooltip: { displayColors: true, callbacks: { title: c => { const p = M.pts[c[0].dataIndex]; return dot(p.from) + ' → ' + dot(p.d) + (p.gap > 1 ? ' (' + p.gap + '일)' : ''); }, label: c => c.dataset.label + ' +' + fmtK(c.raw) } } },
        scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 13 }, color: css('--muted') } }, y: { stacked: true, display: true, position: 'right', grid: { color: css('--line') }, border: { display: false }, ticks: { maxTicksLimit: 4, font: { size: 13 }, color: css('--muted'), callback: v => fmtK(v) } } } }) });
  }
  function wireWeek() {
    wireDaily();
    document.querySelectorAll('#wkBy button').forEach(b => b.addEventListener('click', () => { S.wkM = +b.dataset.v; const el = $('wkSec'); if (el) { el.outerHTML = weekHtml(window.__wkChs || viewChannels()); wireWeek(); } }));
    const w = window.__wk; if (!w || !w.lists) return; wireRank($('wkNew'), w.lists.nw); wireRank($('wkOld'), w.lists.old); }

  // ═════════ 홈 ② 콘텐츠 성적 추이 — 채널별로 따로, 중앙값 ═════════
  const TR = { m: 'per', p: '1y', u: 'auto', more: false };
  const TR_CORE = 4; // 지표 버튼은 앞의 4개만 보이고 나머지는 '더보기'
  const TR_M = [['per', '게시물당 조회'], ['ratio', '조회 평소 대비'], ['hit', '잘 된 비율'], ['posts', '게시 수'], ['like', '게시물당 좋아요'], ['cmt', '게시물당 댓글'], ['share', '게시물당 공유'], ['save', '게시물당 저장'], ['reach', '게시물당 도달']];
  // 게시물 값 꺼내기: 조회·좋아요·댓글·공유·저장(누적 기록) · 도달(it.r, 인스타)
  const TR_GET = { per: it => mainVal(it), like: it => val(it, 1), cmt: it => val(it, 2), share: it => val(it, 3), save: it => val(it, 4), reach: it => it.r };
  const TR_SUM = ['like', 'cmt', 'share', 'save', 'reach']; // 「우리 채널 전체」 칸에서는 이 지표를 합계로
  const TR_P = [['1m', '1달', 30], ['3m', '3달', 91], ['6m', '6달', 182], ['1y', '1년', 365], ['3y', '3년', 1095], ['all', '전체', null]];
  const TR_U = [['day', '일'], ['week', '주'], ['month', '월'], ['quarter', '분기'], ['year', '연']];
  const TR_AUTO = { '1m': 'day', '3m': 'week', '6m': 'month', '1y': 'month', '3y': 'quarter', all: 'year' };
  const trUnit = () => TR.u === 'auto' ? TR_AUTO[TR.p] : TR.u;
  function trKey(d, u) { return u === 'day' ? d : u === 'week' ? isoWeek(d) : u === 'year' ? d.slice(0, 4) : u === 'quarter' ? d.slice(0, 4) + '-Q' + (((+d.slice(5, 7)) + 2) / 3 | 0) : d.slice(0, 7); }
  function trLabel(k, u) { return u === 'day' || u === 'week' ? (+k.slice(5, 7)) + '/' + (+k.slice(8, 10)) + (u === 'week' ? '주' : '') : u === 'year' ? k : u === 'quarter' ? k.slice(2, 4) + '년 ' + k.slice(6) + '분기' : k.slice(2, 4) + '.' + k.slice(5, 7); }
  const trStart = (k, u) => u === 'day' || u === 'week' ? k : u === 'year' ? k + '-01-01' : u === 'quarter' ? k.slice(0, 4) + '-' + String((+k.slice(6) - 1) * 3 + 1).padStart(2, '0') + '-01' : k + '-01';
  function trBuckets(from, to, u) {
    if (u === 'day' || u === 'week') { const out = []; let d = u === 'week' ? isoWeek(from) : from; while (d <= to) { out.push(d); d = addDays(d, u === 'week' ? 7 : 1); } return out; }
    const out = []; let d = from.slice(0, 7) + '-01';
    while (d <= to) { const k = trKey(d, u); if (!out.length || out[out.length - 1] !== k) out.push(k); d = monthStart(d, 1); }
    return out;
  }
  function trVal(arr) {
    if (TR.m === 'posts') return arr.length;
    if (!arr.length) return null;
    if (TR_GET[TR.m]) return median(arr.map(TR_GET[TR.m]));
    if (TR.m === 'ratio') return median(arr.map(ratio));
    return hitRate(arr);
  }
  const trFmt = v => v == null ? '–' : TR.m === 'ratio' ? xf(v) : TR.m === 'hit' ? pct0(v) : TR.m === 'posts' ? fmt(v) + '개' : fmtK(v);
  // 그래프 칸: 전체 탭 = 우리 채널 전체 · 인스타 · 홍비디오 · 타 대학 (2×2), 채널 탭 = 그 채널 하나
  function trPanels(chs) {
    if (S.ch !== '전체') return chs.map(ch => ({ kind: 'own', ch, chs: [ch] }));
    const P = [{ kind: 'all', chs: OWN, label: '우리 채널 전체' }, { kind: 'own', ch: '인스타그램', chs: ['인스타그램'] }, { kind: 'own', ch: 'hong._.video', chs: ['hong._.video'] }];
    if (benchNames().length) P.push({ kind: 'bench', chs: ['인스타그램'].concat(benchNames()), label: '타 대학' });
    return P;
  }
  // 타 대학은 조회가 릴스만 공개돼 좋아요 기준 (우리 인스타도 같은 기준으로 같이 그림)
  const likeHidden = ch => { const a = D.items.filter(it => it.c === ch && it.t !== '스토리').map(it => val(it, 1)); return a.length >= 3 && median(a) === 0; };
  function trValP(p, arr, ch) {
    if (p.kind === 'own') return trVal(arr);
    if (p.kind === 'all') { if (TR.m === 'per') return arr.length ? median(arr.map(ratio)) : null; if (TR_SUM.includes(TR.m)) { const xs = arr.map(TR_GET[TR.m]).filter(v => v != null); return xs.length ? sum(xs) : null; } return trVal(arr); }
    if (TR.m === 'posts') return arr.length;
    if (['share', 'save', 'reach'].includes(TR.m)) return ch === '인스타그램' ? trVal(arr) : null; // 타 대학은 공유·저장·도달 비공개
    if (TR.m === 'cmt') return arr.length ? median(arr.map(it => val(it, 2))) : null;
    if (!arr.length || likeHidden(ch)) return null;
    if (TR.m === 'ratio') return median(arr.map(likeRatio));
    if (TR.m === 'hit') { const r = arr.map(likeRatio).filter(x => x != null); return r.length ? r.filter(x => x >= HIT).length / r.length : null; }
    return median(arr.map(it => val(it, 1)));
  }
  const trMetricP = p => p.kind === 'all' && TR.m === 'per' ? 'ratio' : p.kind === 'bench' && TR.m === 'per' ? 'like' : TR.m;
  const trFmtP = (p, v) => { const m = trMetricP(p); return v == null ? '–' : m === 'ratio' ? xf(v) : m === 'hit' ? pct0(v) : m === 'posts' ? fmt(v) + '개' : fmtK(v); };
  function trModel(chs) {
    const per = TR_P.find(p => p[0] === TR.p), u = trUnit();
    const P = trPanels(chs);
    const allChs = uniq(P.flatMap(p => p.kind === 'bench' ? [] : p.chs));
    const first = D.items.filter(it => allChs.includes(it.c)).map(it => it.d).sort()[0] || D.updated;
    const from = per[2] ? addDays(D.updated, -per[2] + 1) : first;
    let keys = trBuckets(from < first ? first : from, D.updated, u);
    // 기간 시작이 구간 중간이면 그 구간은 빼서(잘린 구간) 끝까지 다 찬 구간만 그림
    if (per[2] && keys.length > 1 && trStart(keys[0], u) < from) keys = keys.slice(1);
    const since0 = trStart(keys[0], u);
    const curK = trKey(D.updated, u);
    return P.map(p => {
      const L = pool({ channels: p.chs, since: since0, until: D.updated });
      const grp = arr => { const g = {}; arr.forEach(it => { const k = trKey(it.d, u); (g[k] = g[k] || []).push(it); }); return g; };
      const series = (p.kind === 'bench' ? p.chs : [null]).map(ch => {
        const arr = ch ? L.filter(it => it.c === ch) : L, g = grp(arr);
        const f0 = D.items.filter(it => ch ? it.c === ch : p.chs.includes(it.c)).map(it => it.d).sort()[0];
        const k0 = f0 ? trKey(f0, u) : '9999'; // 데이터 시작 전 구간은 0이 아니라 빈칸
        return { ch, g, data: keys.map(k => k < k0 ? null : trValP(p, g[k] || [], ch)) };
      });
      const main = p.kind === 'bench' ? series[0] : series[0]; // 큰 숫자: 타 대학 칸은 우리 인스타 값
      const done = keys.map((k, i) => main.data[i]).filter((v, i) => keys[i] !== curK && v != null);
      const rf = p.kind === 'bench' ? likeRatio : ratio;
      const top = (p.kind === 'bench' ? L.filter(it => it.c !== '인스타그램' && !likeHidden(it.c)) : L).filter(it => rf(it) != null).sort((a, b) => rf(b) - rf(a)).slice(0, 2);
      return Object.assign({}, p, { keys, series, last: done[done.length - 1], prev: done[done.length - 2], top, rf, curK, n: L.length });
    });
  }
  function trendHtml(chs) {
    const M = trModel(chs); window.__tr = M; window.__trChs = chs;
    const u = trUnit(), mName = TR_M.find(m => m[0] === TR.m)[1];
    const medTip = TR_GET[TR.m] || TR.m === 'ratio' ? jo(mName, '은', '는') + ' 중간값이라 잘 된 게시물 한두 개에 흔들리지 않아요' : '';
    const notes = [adWord(), '흐린 막대 = 진행 중'];
    const per = TR_P.find(p => p[0] === TR.p);
    const ownChs = uniq(M.filter(p => p.kind !== 'bench').flatMap(p => p.chs));
    const cn = covNote(ownChs, per[2] ? addDays(D.updated, -per[2] + 1) : '0000');
    if (ownChs.includes('유튜브') && (TR.p === '3y' || TR.p === 'all') && ['per', 'like'].includes(TR.m)) notes.push('유튜브 긴 영상은 예전 연도가 유리');
    let h = '<section class="sec" id="trSec"><div class="sh"><div><h2' + (medTip ? ' title="' + esc(medTip) + '"' : '') + '>채널 현황</h2><p>' + esc(notes.join(' · ')) + (cn ? '<br><span class="warn">' + ICO.warn + ' ' + esc(cn) + '</span>' : '') + '</p></div></div>' +
      '<div class="tr-ctl"><div class="chips">' + TR_M.filter((m, i) => i < TR_CORE || TR.more || m[0] === TR.m).map(m => '<button class="chip" type="button" data-trm="' + m[0] + '" aria-pressed="' + (TR.m === m[0]) + '">' + m[1] + '</button>').join('') +
        '<button class="chip more-chip" type="button" data-trmore="1" aria-expanded="' + TR.more + '">' + (TR.more ? '접기' : '지표 더보기 ' + (TR_M.length - TR_CORE)) + '</button></div>' +
      '<div class="tr-pu"><div class="seg">' + TR_P.map(p => '<button type="button" data-trp="' + p[0] + '" aria-pressed="' + (TR.p === p[0]) + '">' + p[1] + '</button>').join('') + '</div>' +
      '<div class="seg">' + TR_U.map(x => '<button type="button" data-tru="' + x[0] + '" aria-pressed="' + (u === x[0]) + '">' + x[1] + '</button>').join('') + '</div></div></div>' +
      '<div class="tr-grid' + (M.length === 1 ? ' one' : M.length === 4 ? ' two' : '') + '">';
    const LASTW = { day: '어제', week: '지난주', month: '지난달', quarter: '지난 분기', year: '작년' }[u], PREVW = { day: '전날', week: '전주', month: '전달', quarter: '전 분기', year: '전년' }[u];
    M.forEach((s, i) => {
      const d = s.last != null && s.prev ? (s.last - s.prev) / Math.abs(s.prev) : null;
      const head = s.kind === 'own' ? badge(s.ch) : '<b class="tr-l">' + esc(s.label) + '</b>';
      const empty = s.series.every(x => x.data.every(v => v == null));
      // 카드 설명은 한 줄: 「게시물당 조회 · 지난달 · 전달 대비」 — 긴 설명은 마우스 올림
      const cap = empty ? '이 채널은 ' + mName.replace('게시물당 ', '') + ' 데이터 없음' : s.kind === 'all' ? (trMetricP(s) === 'ratio' && TR.m !== 'ratio' ? '<span title="채널마다 조회 규모가 달라 평소 대비로 합쳐요">평소 대비로 합침</span>' : TR_SUM.includes(TR.m) ? '세 채널 합계' : '세 채널 합쳐서') + ' · ' + LASTW
        : s.kind === 'bench' ? (['share', 'save', 'reach'].includes(TR.m) ? '<span title="공유·저장·도달은 타 대학이 비공개라 우리 인스타만 보여요">우리 인스타만</span>' : TR.m === 'cmt' || TR.m === 'posts' ? '큰 숫자는 우리 인스타' : '<span title="타 대학은 릴스만 조회가 공개돼 좋아요로 비교해요">게시물당 좋아요 · 큰 숫자는 우리 인스타</span>') : esc(mName) + ' · ' + LASTW + ' · ' + PREVW + ' 대비';
      h += '<div class="tr-card"><div class="tr-h">' + head + '<span class="tr-v num">' + trFmtP(s, s.last) + '</span>' +
        (d == null ? '' : '<span class="tr-d ' + dCls(d) + '">' + dTxt(d) + '</span>') + '</div>' +
        '<div class="tr-cap">' + cap + '</div>' +
        (s.kind === 'bench' ? '<div class="tr-lg">' + s.series.map(x => '<span><i style="background:' + chColor(x.ch) + '"></i>' + esc(x.ch === '인스타그램' ? '우리 인스타' : chName(x.ch)) + (likeHidden(x.ch) && TR.m !== 'posts' ? ' <small>비공개</small>' : '') + '</span>').join('') + '</div>' : '') +
        (empty ? '<div class="tr-chart tr-empty">데이터 없음</div>' : '<div class="tr-chart"><canvas id="trC' + i + '"></canvas></div>') +
        (s.top.length ? '<div class="tr-top"><span>이 기간 잘 된 게시물</span>' + s.top.map((it, j) => '<button type="button" data-trt="' + i + ':' + j + '">' + (s.kind === 'own' ? '' : esc(chName(it.c)) + ' · ') + esc(title(it.n)) + ' <b>' + xf(s.rf(it)) + '</b></button>').join('') + '</div>' : '') +
        '</div>';
    });
    return h + '</div></section>';
  }
  function wireTrend() {
    const sec = $('trSec'), M = window.__tr; if (!sec || !M) return;
    const re = () => { sec.outerHTML = trendHtml(window.__trChs); wireTrend(); };
    sec.querySelectorAll('[data-trm]').forEach(b => b.addEventListener('click', () => { TR.m = b.dataset.trm; re(); }));
    sec.querySelectorAll('[data-trmore]').forEach(b => b.addEventListener('click', () => { TR.more = !TR.more; re(); }));
    sec.querySelectorAll('[data-trp]').forEach(b => b.addEventListener('click', () => { TR.p = b.dataset.trp; TR.u = 'auto'; re(); }));
    sec.querySelectorAll('[data-tru]').forEach(b => b.addEventListener('click', () => { TR.u = b.dataset.tru; re(); }));
    sec.querySelectorAll('[data-trt]').forEach(b => b.addEventListener('click', () => { const [i, j] = b.dataset.trt.split(':').map(Number); openDetail(M[i].top[j]); }));
    const u = trUnit();
    M.forEach((s, i) => {
      const multi = s.series.length > 1;
      const ds = s.series.map(x => {
        const col = s.kind === 'all' ? css('--jj') : chColor(x.ch || s.ch);
        return { label: x.ch ? chName(x.ch) : s.label || chName(s.ch), data: x.data, backgroundColor: s.keys.map(k => k === s.curK ? col + '55' : col), borderRadius: 3, maxBarThickness: multi ? 12 : 34, minBarLength: 2, categoryPercentage: multi ? 0.8 : 0.8, barPercentage: multi ? 0.9 : 0.9 };
      });
      draw('trC' + i, { type: 'bar', data: { labels: s.keys.map(k => trLabel(k, u)), datasets: ds },
        options: chartOpts({ layout: { padding: { top: 8 } }, plugins: { tooltip: { displayColors: multi, callbacks: { title: c => trLabel(s.keys[c[0].dataIndex], u) + (s.keys[c[0].dataIndex] === s.curK ? ' (진행 중)' : ''), label: c => (multi ? c.dataset.label + ' ' : '') + trFmtP(s, c.raw) + ' · 게시 ' + ((s.series[c.datasetIndex].g[s.keys[c.dataIndex]] || []).length) + '개' } } },
          scales: { x: { ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkip: true, font: { size: 13, weight: '500' }, color: css('--muted') } },
            y: { display: true, position: 'right', grid: { color: css('--line') }, border: { display: false }, ticks: { maxTicksLimit: 4, font: { size: 13 }, color: css('--muted'), callback: v => { const m = trMetricP(s); return m === 'ratio' ? v + '배' : m === 'hit' ? Math.round(v * 100) + '%' : fmtK(v); } } } } }) });
    });
  }

  // ═════════ 홈 ③ 타 대학 비교 ═════════
  const BC = { p: 182 };
  function benchRows(days) {
    const f = addDays(D.updated, -days + 1);
    return ['인스타그램'].concat(benchNames()).map(ch => {
      const L = D.items.filter(it => it.c === ch && it.t !== '스토리' && it.d >= f && !it.ad);
      const likes = L.map(it => val(it, 1)).filter(v => v != null);
      const hidden = L.length >= 3 && median(likes) === 0;
      const reels = L.filter(it => /릴스/.test(it.t)).map(it => val(it, 0)).filter(v => v > 0);
      // 주당 게시: 기간 시작이 그 채널 수집 시작보다 앞이면 수집 시작일부터 센다
      const first = D.items.filter(it => it.c === ch).map(it => it.d).sort()[0];
      const span = Math.max(7, first && first > f ? daysBetween(first, D.updated) + 1 : days);
      return { ch, n: L.length, wk: L.length / (span / 7), like: hidden || !likes.length ? null : median(likes), hidden, reel: reels.length ? median(reels) : null, nr: reels.length };
    });
  }
  function benchCmpHtml() {
    const R = benchRows(BC.p);
    const firstB = D.items.filter(it => isBench(it.c)).map(it => it.d).sort()[0];
    const blk = (ttl, key, f, why) => {
      const mx = Math.max(...R.map(r => r[key] || 0)) || 1;
      return '<div class="bc-b"><h3>' + ttl + '</h3>' + R.map(r => '<div class="bc-r' + (r.ch === '인스타그램' ? ' ours' : '') + '"><span class="bc-n">' + badge(r.ch) + '</span>' +
        '<span class="bc-t">' + (r[key] == null ? '' : '<i style="width:' + Math.max(2, r[key] / mx * 100) + '%;background:' + chColor(r.ch) + '"></i>') + '</span>' +
        '<span class="bc-v num">' + (r[key] == null ? '<span class="mu">' + why(r) + '</span>' : f(r)) + '</span></div>').join('') + '</div>';
    };
    return '<section class="sec" id="bcSec"><div class="sh"><div><h2>타 대학 비교</h2><p>인스타그램 · 최근 ' + ({ 91: 3, 182: 6, 365: 12 })[BC.p] + '개월 게시물 · 게시물당 값은 중간값' + (firstB ? ' · 타 대학 데이터는 ' + dot(firstB) + '부터' : '') + '</p></div>' +
      '<div class="seg">' + [[91, '3개월'], [182, '6개월'], [365, '12개월']].map(p => '<button type="button" data-bcp="' + p[0] + '" aria-pressed="' + (BC.p === p[0]) + '">' + p[1] + '</button>').join('') + '</div></div>' +
      '<div class="bc-grid">' + blk('게시물당 좋아요', 'like', r => fmtK(r.like), r => r.hidden ? '비공개' : '데이터 없음') +
      blk('릴스 조회', 'reel', r => fmtK(r.reel), () => '데이터 없음') +
      blk('주당 게시', 'wk', r => '주 ' + r.wk.toFixed(1) + '개', () => '–') + '</div>' +
      '<p class="note">타 대학은 릴스만 조회가 공개돼요' + (S.ch === '전체' ? ' · 자세한 비교는 위 「타 대학」 탭' : '') + '</p></section>';
  }
  function wireBenchCmp() {
    const sec = $('bcSec'); if (!sec) return;
    sec.querySelectorAll('[data-bcp]').forEach(b => b.addEventListener('click', () => { BC.p = +b.dataset.bcp; sec.outerHTML = benchCmpHtml(); wireBenchCmp(); }));
  }
  // 예전 「현황」 차트는 「직접 골라 보기」로 접어 둠
  const advHtml = () => '<div class="gap"></div><div class="adv' + (S.adv ? ' open' : '') + '" id="advBox"><button type="button" class="adv-h" aria-expanded="' + !!S.adv + '" aria-controls="advBody"><span><b>직접 골라 보기</b><small>지표 · 계열 · 기간 · 단위를 바꿔 가며 보는 차트와 표</small></span><span class="chev">›</span></button><div id="advBody"' + (S.adv ? '' : ' hidden') + '>' + chartHtml() + '</div></div>';
  function wireAdv() {
    const d = $('advBox'); if (!d) return;
    const h = d.querySelector('.adv-h'), body = $('advBody');
    const go = () => { if (S.adv && !d.dataset.w) { d.dataset.w = '1'; wireChart(); } };
    h.addEventListener('click', () => {
      S.adv = !S.adv; d.classList.toggle('open', S.adv); body.hidden = !S.adv; h.setAttribute('aria-expanded', S.adv); go();
      if (S.adv) setTimeout(() => h.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });
    go();
  }

  // ═════════ 채널 현황 차트 (토스형) ═════════
  const CS = { metric: 'views', period: '1y', unit: 'auto', type: 'line', split: false, mode: 'post', sel: null, series: ['sum', '인스타그램', '유튜브', 'hong._.video', 'bench'] };
  // 전체 탭 그래프 계열: 합계(우리 채널) · 채널별 · 타 대학 묶음
  const serDefs = () => [
    { id: 'sum', label: '합계', chs: OWN, color: css('--fg') },
    { id: '인스타그램', label: '인스타그램', chs: ['인스타그램'], color: css('--ch-ig') },
    { id: '유튜브', label: '유튜브', chs: ['유튜브'], color: css('--ch-yt') },
    { id: 'hong._.video', label: 'hong', chs: ['hong._.video'], color: css('--ch-hong') },
    { id: 'bench', label: '타 대학', chs: benchNames(), color: css('--ch-b1') },
  ];
  const multiMode = () => S.ch === '전체' && !benchMode();
  const selSer = () => { const s = serDefs().filter(d => CS.series.includes(d.id)); return s.length ? s : serDefs().slice(0, 1); };
  const uniq = a => [...new Set(a)];
  const PERIODS = [['1m', '1달', 30], ['3m', '3달', 91], ['6m', '6달', 182], ['1y', '1년', 365], ['3y', '3년', 1095], ['all', '전체', null]];
  const AUTO_UNIT = { '1m': 'day', '3m': 'week', '6m': 'week', '1y': 'month', '3y': 'month', all: 'month' };
  const UNITS = [['day', '일'], ['week', '주'], ['month', '월']];
  const benchMode = () => S.ch === '타 대학';
  const chartScope = () => benchMode() ? ['인스타그램'].concat(benchNames()) : viewChannels();
  function metricDefs() {
    const chs = chartScope(), b = benchMode();
    const L = [];
    if (!b) L.push(['views', '조회', 'sum', 0]);
    L.push(['likes', '좋아요', 'sum', 1], ['comments', '댓글', 'sum', 2]);
    if (!b && chs.includes('인스타그램')) L.push(['shares', '공유', 'sum', 3], ['saves', '저장', 'sum', 4]);
    L.push(['posts', '게시 수', 'count'], ['per', b ? '게시물당 좋아요' : '게시물당 조회', 'med'], ['ratio', b ? '좋아요 평소 대비' : '조회 평소 대비', 'ratio'], ['hit', '잘 된 비율', 'hit']);
    if (b) { const i = L.findIndex(x => x[0] === 'per'); L.unshift(L.splice(i, 1)[0]); }
    return L;
  }
  function mval(def, arr) {
    const b = benchMode(), t = def[2];
    if (t === 'sum') { const xs = arr.map(it => val(it, def[3])); return !arr.length || xs.some(v => v != null) ? sum(xs) : null; }
    if (t === 'count') return arr.length;
    if (t === 'med') return median(arr.map(it => b ? val(it, 1) : val(it, 0)));
    const rs = arr.map(b ? likeRatio : ratio).filter(x => x != null);
    if (t === 'ratio') return median(rs);
    return rs.length ? rs.filter(x => x >= HIT).length / rs.length : null;
  }
  const mfmt = (def, v) => v == null ? '–' : def[2] === 'ratio' ? xf(v) : def[2] === 'hit' ? pct0(v) : def[2] === 'count' ? fmt(v) + '개' : fmtK(v);
  function cbuckets(from, to, unit) {
    const out = [];
    if (unit === 'day') { let d = from; while (d <= to) { out.push({ k: d, from: d, to: d, label: (+d.slice(5, 7)) + '/' + (+d.slice(8, 10)) }); d = addDays(d, 1); } }
    else if (unit === 'week') { let d = isoWeek(from); while (d <= to) { out.push({ k: d, from: d, to: addDays(d, 6), label: (+d.slice(5, 7)) + '/' + (+d.slice(8, 10)) }); d = addDays(d, 7); } }
    else { let d = from.slice(0, 7) + '-01'; while (d <= to) { const nx = monthStart(d, 1); out.push({ k: d.slice(0, 7), from: d, to: addDays(nx, -1), label: d.slice(2, 4) + '.' + d.slice(5, 7) }); d = nx; } }
    return out;
  }
  function chartModel() {
    const defs = metricDefs();
    if (!defs.find(d => d[0] === CS.metric)) CS.metric = defs[0][0];
    const def = defs.find(d => d[0] === CS.metric);
    const multi = multiMode(), SD = multi ? selSer() : null;
    const chs = multi ? uniq(SD.flatMap(s => s.chs)) : chartScope();
    const hasSum = multi && SD.some(s => s.id === 'sum');
    const bigChs = multi ? (hasSum ? OWN : chs) : chs;
    const growth = CS.mode === 'growth' && weekly() && def[2] === 'sum';
    const split = benchMode() || (multi && SD.length > 1);
    const tag = s => ({ ch: null, id: s.id, label: s.label, color: s.color });
    if (growth) {
      const idx = D.dates.map((d, i) => i).slice(1);
      // 기록 간격이 4일~119일로 달라 막대는 '하루 평균 증가'로 그린다(합계는 그대로)
      const bk = idx.map(i => { const days = Math.max(1, daysBetween(D.dates[i - 1], D.dates[i])); return { k: D.dates[i], from: D.dates[i - 1], to: D.dates[i], days, label: mdLabel(D.dates[i]) + ' (' + days + '일)', i }; });
      const its = D.items.filter(it => chs.includes(it.c) && (S.ads || !it.ad));
      const ser = (cs) => bk.map(b => { const ok = cs.filter(c => hasRec(c, b.i) && hasRec(c, b.i - 1) && !staleAt(c, b.i)); return ok.length ? sum(its.filter(it => ok.includes(it.c)).map(it => Math.max(0, incAt(it, b.i, def[3]) || 0))) : null; });
      const perDay = cs => { const raw = ser(cs); return { raw, data: raw.map((v, j) => v == null ? null : v / bk[j].days) }; };
      const series = multi ? SD.map(s => Object.assign(tag(s), perDay(s.chs))) : split ? chs.map(c => Object.assign({ ch: c }, perDay([c]))) : [Object.assign({ ch: null }, perDay(chs))];
      // 늦게 기록을 시작한 채널(hong = 2026-10-08부터)은 값이 생긴 기간부터 그림
      let j0 = bk.findIndex((b, j) => series.some(s => s.data[j] != null)); if (j0 < 0) j0 = 0;
      const bk2 = bk.slice(j0); series.forEach(s => { s.data = s.data.slice(j0); s.raw = s.raw.slice(j0); });
      const tot = multi ? sum(ser(bigChs).slice(j0)) : sum(series.flatMap(s => s.raw).filter(v => v != null));
      return { def, defs, chs, growth, split, hasSum, bk: bk2, series, big: tot, prev: null, from: bk2.length ? bk2[0].from : D.dates[0], to: D.updated, items: [] };
    }
    const per = PERIODS.find(p => p[0] === CS.period) || PERIODS[3];
    const to = D.updated;
    const first = D.items.filter(it => chs.includes(it.c)).map(it => it.d).sort()[0] || to;
    const from = per[2] ? addDays(to, -per[2] + 1) : first;
    const unit = CS.unit !== 'auto' ? CS.unit : benchMode() && ['6m', '1y'].includes(per[0]) ? 'month' : AUTO_UNIT[per[0]];
    let bk = cbuckets(from < first && !per[2] ? first : from, to, unit);
    if (per[2] && bk.length > 1 && bk[0].from < from) bk = bk.slice(1); // 잘린 첫 구간은 빼기
    const items = pool({ channels: chs, since: from, until: to });
    const pos = {}; bk.forEach((b, i) => { pos[b.k] = i; });
    const keyOf = it => unit === 'day' ? it.d : unit === 'week' ? isoWeek(it.d) : it.d.slice(0, 7);
    const ser = cs => { const arrs = bk.map(() => []); items.forEach(it => { if (!cs.includes(it.c)) return; const i = pos[keyOf(it)]; if (i != null) arrs[i].push(it); }); return arrs; };
    const fill = a => a.map(x => x.length ? mval(def, x) : def[2] === 'count' ? 0 : null);
    const series = multi ? SD.map(s => { const a = ser(s.chs); return Object.assign(tag(s), { arrs: a, data: fill(a) }); })
      : split ? chs.map(c => { const a = ser([c]); return { ch: c, arrs: a, data: fill(a) }; })
      : [(() => { const a = ser(chs); return { ch: null, arrs: a, data: fill(a) }; })()];
    const big = split && benchMode() ? mval(def, items.filter(it => it.c === '인스타그램')) : mval(def, items.filter(it => bigChs.includes(it.c)));
    let prev = null;
    if (per[2]) { const pf = addDays(from, -per[2]), pt = addDays(from, -1); const pi = pool({ channels: split && benchMode() ? ['인스타그램'] : bigChs, since: pf, until: pt }); if (pi.length) prev = mval(def, pi); }
    return { def, defs, chs, growth, split, hasSum, bk, series, big, prev, from, to, unit, per, items, keyOf };
  }
  function chartHtml() {
    const M = chartModel(); window.__cm = M;
    const d = M.prev ? (M.big - M.prev) / Math.abs(M.prev) : null;
    const cls = d == null ? 'flat' : d >= 0 ? 'up' : 'down';
    const SD = multiMode() ? selSer() : null;
    const ttl = SD ? (M.hasSum ? '우리 채널 전체 현황' : SD.map(x => x.label).join(' · ') + (SD.length > 1 ? ' 합산' : ' 현황')) : (S.ch === '타 대학' ? '타 대학 비교' : chName(S.ch)) + ' 현황';
    const benchNote = SD && SD.some(x => x.id === 'bench') && !M.hasSum && ['views', 'per'].includes(M.def[0]) ? ' · 타 대학 조회는 릴스만 공개돼 릴스 기준' : SD && SD.some(x => x.id === 'bench') && ['views', 'per'].includes(M.def[0]) ? ' · 큰 숫자는 우리 채널 합계 · 타 대학 조회는 릴스 기준' : SD && M.hasSum && SD.length > 1 ? ' · 큰 숫자는 우리 채널 합계' : '';
    const pl = (PERIODS.find(p => p[0] === CS.period) || PERIODS[3]);
    const sub = M.growth ? '기록 사이에 늘어난 ' + M.def[1] + '(막대는 하루 평균 · 괄호는 기간 일수) · ' + adWord() : (pl[0] === 'all' ? '전체' : '최근 ' + pl[1]) + ' 게시물의 ' + (M.def[2] === 'sum' ? '현재 누적 ' : '') + M.def[1] + ' · ' + adWord() + (benchMode() ? ' · 큰 숫자는 우리 인스타 기준' : '') + (benchNote || '');
    const canGrowth = weekly() && M.def[2] === 'sum';
    let h = '<section class="sec" id="chartSec"><div class="cs-head"><div><div class="cs-t">' + esc(ttl) + '</div>' +
      '<div class="cs-big num">' + mfmt(M.def, M.big) + '</div>' +
      '<div class="cs-chg num ' + cls + '">' + (d == null ? '<span style="color:var(--muted);font-weight:600">' + (M.growth ? mdLabel(M.from) + ' 이후 합계' : '비교할 이전 기간 없음') + '</span>' : '<span class="' + dCls(d) + '">' + dTxt(d, 1, 1) + '</span> <span style="color:var(--muted);font-weight:600">이전 같은 기간 대비</span>') + '</div>' +
      '<div class="cs-sub">' + esc(sub) + (M.growth ? '' : ' · 점선은 아직 끝나지 않은 기간') + (M.growth ? '' : (n => n ? '<br><span class="warn">' + ICO.warn + ' ' + esc(n) + '</span>' : '')(covNote(M.chs, M.from))) + '</div></div>' +
      '<button type="button" class="btn sm" id="csXls">엑셀로 받기</button></div>' +
      '<div class="chips cs-m">' + M.defs.map(df => '<button class="chip" type="button" data-m="' + df[0] + '" aria-pressed="' + (CS.metric === df[0]) + '">' + df[1] + '</button>').join('') + '</div>' +
      (SD ? '<div class="cs-ser" role="group" aria-label="그래프에 표시할 계열">' + serDefs().map(x => '<button type="button" class="tg2 ser" data-ser="' + esc(x.id) + '" aria-pressed="' + CS.series.includes(x.id) + '" style="--c:' + x.color + '"><i></i>' + esc(x.label) + '</button>').join('') + '<span class="hint">눌러서 켜고 끄기</span></div>' : '') +
      '<div class="cs-chart"><canvas id="csCanvas"></canvas></div>' +
      '<div class="cs-per">' +
        (M.growth ? '<div class="pp"><span class="hint">기록 ' + (M.bk.length + 1) + '회' + (M.from > D.dates[0] ? ' · ' + mdLabel(M.from) + '부터 셀 수 있어요' : '') + ' · 과거 기록은 월 단위라 간격이 달라요</span></div>' : '<div class="pp">' + PERIODS.map(p => '<button type="button" data-p="' + p[0] + '" aria-pressed="' + (CS.period === p[0]) + '">' + p[1] + '</button>').join('') + '</div>') +
        '<div class="pp">' +
          (M.growth ? '' : UNITS.map(u => '<button type="button" data-u="' + u[0] + '" aria-pressed="' + (M.unit === u[0]) + '">' + u[1] + '</button>').join('') + '<span class="sep"></span>') +
          '<button type="button" data-ty="line" aria-pressed="' + (CS.type === 'line' && !(M.growth && M.bk.length < 3)) + '">선</button><button type="button" data-ty="bar" aria-pressed="' + (CS.type === 'bar' || (M.growth && M.bk.length < 3)) + '">막대</button>' +
        '</div></div>' +
      '<div class="cs-mode"><button type="button" class="tg2" data-mo="post" aria-pressed="' + !M.growth + '">게시일 기준</button>' +
        '<button type="button" class="tg2" data-mo="growth" aria-pressed="' + M.growth + '"' + (canGrowth ? '' : ' disabled') + '>기록 사이 증가</button>' +
        '<span class="hint">' + (weekly() ? (M.def[2] === 'sum' ? '기록과 기록 사이에 실제로 늘어난 수치예요 · 막대에 마우스를 올리면 기간이 보여요' : '기록 사이 증가는 합계 지표(조회·좋아요 등)에서만 볼 수 있어요') : '기록 사이 증가는 기록이 2회 이상 쌓이면 열려요') + '</span></div>' +
      tblHtml(M) +
      '<div id="csPick">' + pickHtml(M) + '</div></section>';
    return h;
  }
  const TBL_MAX = 24;
  function tblHtml(M) {
    if (!M.bk.length || !M.series.length) return '';
    const st = Math.max(0, M.bk.length - TBL_MAX), idx = M.bk.map((b, i) => i).slice(st);
    const tot = M.def[2] === 'sum' || M.def[2] === 'count';
    const selI = CS.sel == null ? -1 : M.bk.findIndex(b => b.k === CS.sel);
    const rows = M.series.slice().sort((a, b) => (b.id === 'sum') - (a.id === 'sum'));
    const nm = s => s.id === 'sum' && M.series.some(x => x.id === 'bench') ? '우리 채널 합계' : s.label || (s.ch ? chName(s.ch) + (benchMode() && s.ch === '인스타그램' ? '(우리)' : '') : M.def[1]);
    const col = s => s.color || (s.ch ? chColor(s.ch) : css('--up'));
    const rng = b => b.from === b.to ? dot(b.from) : dot(b.from) + ' ~ ' + dot(b.to > M.to ? M.to : b.to);
    const cnt = M.growth ? null : (s, i) => s.arrs && s.arrs[i] ? s.arrs[i].length : null;
    let h = '<div class="cs-tw tw" id="csTw"><table class="cs-tbl"><thead><tr><th>' + esc(M.def[1]) + '</th>' +
      idx.map(i => '<th class="num' + (i === selI ? ' on' : '') + (M.growth ? '' : ' ck') + '" data-bi="' + i + '" title="' + esc(rng(M.bk[i])) + '">' + esc(M.bk[i].label) + (!M.growth && i === M.bk.length - 1 ? '<sup class="pt">진행 중</sup>' : '') + '</th>').join('') +
      (tot ? '<th class="num tot">' + (st ? '전체 합계' : '합계') + '</th>' : '') + '</tr></thead><tbody>';
    rows.forEach(s => {
      h += '<tr' + (s.id === 'sum' ? ' class="sumr"' : '') + '><td><i class="dotc" style="background:' + col(s) + '"></i>' + esc(nm(s)) + '</td>' +
        idx.map(i => { const v = (M.growth && s.raw ? s.raw : s.data)[i], c = cnt && rows.length === 1 ? cnt(s, i) : null; return '<td class="num' + (i === selI ? ' on' : '') + '">' + (v == null ? '<span class="mu">–</span>' : mfmt(M.def, v)) + (c != null && M.def[2] !== 'count' ? '<small>' + c + '개</small>' : '') + '</td>'; }).join('') +
        (tot ? '<td class="num tot">' + mfmt(M.def, sum((M.growth && s.raw ? s.raw : s.data).filter(v => v != null))) + '</td>' : '') + '</tr>';
    });
    h += '</tbody></table></div>';
    const notes = [];
    if (st) notes.push('최근 ' + TBL_MAX + '개 기간만 보여요 · 전체는 「엑셀로 받기」');
    if (M.def[2] === 'sum' && !M.growth) notes.push('각 칸은 그 기간에 올린 게시물의 현재 누적값');
    if (M.growth) notes.push('표는 기간 전체 증가, 그래프는 하루 평균 증가');
    return h + (notes.length ? '<p class="note cs-tn">' + esc(notes.join(' · ')) + '</p>' : '');
  }
  function pickHtml(M) {
    if (M.growth) return '';
    const i = CS.sel == null ? -1 : M.bk.findIndex(b => b.k === CS.sel);
    if (i < 0) return '<p class="hint" style="margin:10px 2px 0">그래프나 표의 기간 이름을 누르면 그 기간에 올린 게시물이 아래에 나와요.</p>';
    const b = M.bk[i];
    const arr = uniq(M.series.flatMap(s => s.arrs[i])).sort((x, y) => (mainVal(y) || 0) - (mainVal(x) || 0));
    const rng = b.from === b.to ? dot(b.from) : dot(b.from) + ' ~ ' + dot(b.to > M.to ? M.to : b.to);
    return '<div class="cpick"><div><b>' + rng + '</b> · 게시 ' + arr.length + '개 · ' + M.def[1] + ' ' + mfmt(M.def, mval(M.def, arr)) + '</div><button type="button" class="btn" id="csPickX">이 기간 엑셀로</button></div>' +
      '<ol class="rank" id="csList">' + rankRows(arr.slice(0, 5)) + '</ol>' + (arr.length > 5 ? '<p class="note">상위 5개만 보여요 · 전체는 「이 기간 엑셀로」</p>' : '');
  }
  function rerenderChart() { const el = $('chartSec'); if (!el) return; el.outerHTML = chartHtml(); wireChart(); }
  function toExport(from, to, group, chs) {
    E = Object.assign(defaultE(), { from, to, q: '', chs: chs.slice(), group, sortK: group === 'content' ? 'views' : '', sortDir: group === 'content' ? 'desc' : 'asc' });
    xsave(); S.view = 'export'; render(); window.scrollTo({ top: 0 });
  }
  function wireChart() {
    const M = window.__cm, sec = $('chartSec'); if (!sec) return;
    sec.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => { CS.metric = b.dataset.m; CS.sel = null; rerenderChart(); }));
    sec.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
      CS.period = b.dataset.p; CS.unit = 'auto'; CS.sel = null;
      if (benchMode()) { S.range = { '1m': '30', '3m': '90', '6m': '182', '1y': '365', '3y': '1095', all: 'all' }[CS.period]; render(); } else rerenderChart();
    }));
    sec.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => { CS.unit = b.dataset.u; CS.sel = null; rerenderChart(); }));
    sec.querySelectorAll('[data-ty]').forEach(b => b.addEventListener('click', () => { CS.type = b.dataset.ty; rerenderChart(); }));
    sec.querySelectorAll('[data-ser]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.ser; const n = CS.series.includes(id) ? CS.series.filter(x => x !== id) : CS.series.concat([id]); if (!n.length) { toast('하나 이상은 켜 두어야 해요'); return; } CS.series = serDefs().map(x => x.id).filter(x => n.includes(x)); CS.sel = null; rerenderChart(); }));
    sec.querySelectorAll('[data-mo]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; CS.mode = b.dataset.mo; CS.sel = null; rerenderChart(); }));
    $('csXls').addEventListener('click', () => toExport(M.from, M.to, M.growth ? 'channel' : M.unit === 'day' ? 'day' : M.unit, M.chs));
    if ($('csPickX')) { const b = M.bk.find(x => x.k === CS.sel); $('csPickX').addEventListener('click', () => toExport(b.from, b.to > M.to ? M.to : b.to, 'content', M.chs)); }
    if ($('csList')) { const i = M.bk.findIndex(b => b.k === CS.sel); wireRank($('csList'), uniq(M.series.flatMap(s => s.arrs[i])).sort((x, y) => (mainVal(y) || 0) - (mainVal(x) || 0)).slice(0, 5)); }
    const tw = $('csTw');
    if (tw) {
      tw.scrollLeft = tw.scrollWidth;
      const sc = () => tw.classList.toggle('scrolled', tw.scrollLeft > 2); sc(); tw.addEventListener('scroll', sc, { passive: true });
      if (!M.growth) tw.querySelectorAll('th[data-bi]').forEach(th => th.addEventListener('click', () => { const k = M.bk[+th.dataset.bi].k; CS.sel = CS.sel === k ? null : k; rerenderChart(); }));
    }
    // 그리기
    const d = M.prev ? (M.big - M.prev) / Math.abs(M.prev) : 0;
    const main = d >= 0 ? css('--up') : css('--down');
    const labels = M.bk.map(b => b.label);
    // 기간이 1~2개뿐이면(늦게 기록을 시작한 채널) 선 대신 막대
    const TY = M.growth && M.bk.length < 3 ? 'bar' : CS.type;
    const selI = CS.sel == null ? -1 : M.bk.findIndex(b => b.k === CS.sel);
    const ds = M.series.map(s => {
      const col = s.color || (s.ch ? chColor(s.ch) : main);
      const bi = s.ch && isBench(s.ch) ? benchNames().indexOf(s.ch) : s.id === 'bench' ? 0 : -1, dash = bi < 0 ? undefined : [undefined, [6, 3], [2, 2]][bi % 3];
      const o = { label: s.label || (s.ch ? chName(s.ch) + (benchMode() && s.ch === '인스타그램' ? '(우리)' : '') : M.def[1]), data: s.data, borderColor: col, borderDash: dash, spanGaps: true, order: s.id === 'sum' ? 0 : bi >= 0 ? 2 : 1 };
      if (TY === 'bar') Object.assign(o, { backgroundColor: M.split ? col : s.data.map((v, i) => i === selI ? css('--fg') : col), borderRadius: 3, maxBarThickness: 28, stack: M.split && !M.hasSum && M.def[2] !== 'ratio' && M.def[2] !== 'hit' && M.def[2] !== 'med' ? 's' : undefined });
      else Object.assign(o, { segment: { borderDash: c => !M.growth && c.p1DataIndex === labels.length - 1 ? [4, 4] : dash }, borderWidth: s.id === 'sum' ? 3 : bi >= 0 ? 1.5 : 2, cubicInterpolationMode: 'monotone', pointRadius: labels.length <= 14 ? 3 : 0, pointHoverRadius: 5, pointBackgroundColor: col,
        fill: !M.split, backgroundColor: ctx => { const ch = ctx.chart; if (!ch.chartArea) return 'transparent'; const g = ch.ctx.createLinearGradient(0, ch.chartArea.top, 0, ch.chartArea.bottom); g.addColorStop(0, col + '40'); g.addColorStop(1, col + '00'); return g; } });
      return o;
    });
    const allV = M.series.length === 1 ? M.series[0].data.filter(v => v != null) : [];
    const avg = allV.length ? mean(allV) : null;
    // 개편 1단계: 집계 기준이 바뀐 날 세로 점선(2025-03-31 쇼츠 조회 = 재생 시작, 2025-04 인스타 Views 전환)
    const BRK = M.growth ? [] : [['유튜브', '2025-03-31', '쇼츠 조회 집계 변경'], ['인스타그램', '2025-04-01', '인스타 조회(Views) 전환']]
      .filter(b => M.chs.includes(b[0])).map(b => ({ i: M.bk.findIndex(k => k.from <= b[1] && b[1] <= k.to), t: b[2] })).filter(b => b.i > 0);
    const breaks = { id: 'breaks', afterDatasetsDraw(c) {
      if (!BRK.length) return;
      const x = c.ctx, a = c.chartArea; x.save();
      BRK.forEach((b, k) => { const px = c.scales.x.getPixelForValue(b.i); if (px < a.left || px > a.right) return; x.setLineDash([4, 4]); x.strokeStyle = css('--muted'); x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, a.top); x.lineTo(px, a.bottom); x.stroke(); x.setLineDash([]); x.font = '600 12px ' + css('--font'); x.fillStyle = css('--muted'); const rt = px > (a.left + a.right) / 2; x.textAlign = rt ? 'right' : 'left'; x.fillText(b.t, px + (rt ? -4 : 4), a.top + 10 + k * 14); });
      x.restore(); } };
    draw('csCanvas', { type: TY === 'bar' ? 'bar' : 'line', data: { labels, datasets: ds },
      options: chartOpts({ layout: { padding: { top: 12, right: M.split && TY !== 'bar' ? 58 : 4 } }, interaction: { mode: 'index', intersect: false },
        onClick: (e, els, ch) => { const pts = ch.getElementsAtEventForMode(e, 'index', { intersect: false }, false); if (!pts.length || M.growth) return; const k = M.bk[pts[0].index].k; CS.sel = CS.sel === k ? null : k; $('csPick').innerHTML = pickHtml(M); if ($('csPickX')) { const b = M.bk.find(x => x.k === CS.sel); $('csPickX').addEventListener('click', () => toExport(b.from, b.to > M.to ? M.to : b.to, 'content', M.chs)); } if ($('csList')) wireRank($('csList'), uniq(M.series.flatMap(s => s.arrs[pts[0].index])).sort((x, y) => (mainVal(y) || 0) - (mainVal(x) || 0)).slice(0, 5)); if (TY === 'bar') rerenderChart(); },
        plugins: { legend: { display: M.split && !multiMode() && TY === 'bar', position: 'bottom' }, tooltip: { displayColors: M.split, callbacks: { title: it => { const b = M.bk[it[0].dataIndex]; return b.from === b.to ? b.from : b.from + ' ~ ' + b.to; }, label: c => (M.split ? c.dataset.label + ' ' : '') + mfmt(M.def, c.raw) + (M.growth ? '/일 · 기간 합계 ' + mfmt(M.def, (M.series[c.datasetIndex].raw || [])[c.dataIndex]) : '') + (!M.growth && M.series[c.datasetIndex].arrs ? ' · 게시 ' + M.series[c.datasetIndex].arrs[c.dataIndex].length + '개' : '') } } },
        scales: { x: { stacked: TY === 'bar' && !!ds[0].stack, ticks: { maxTicksLimit: 7, maxRotation: 0, autoSkip: true, font: { size: 13, weight: '500' }, color: css('--muted') } },
          y: { stacked: TY === 'bar' && !!ds[0].stack, display: true, position: 'right', grid: { color: css('--line') }, border: { display: false }, ticks: { maxTicksLimit: 4, font: { size: 13 }, color: css('--muted'), callback: v => M.def[2] === 'ratio' ? v + '배' : M.def[2] === 'hit' ? Math.round(v * 100) + '%' : fmtK(v) }, beginAtZero: true } } }),
      plugins: [breaks].concat(M.split && TY !== 'bar' ? [endLabels] : []).concat(avg == null ? [] : [{ id: 'avg', afterDatasetsDraw(c) { const y = c.scales.y.getPixelForValue(avg), a = c.chartArea; if (y < a.top || y > a.bottom) return; const x = c.ctx; x.save(); x.setLineDash([4, 4]); x.strokeStyle = css('--muted'); x.lineWidth = 1; x.beginPath(); x.moveTo(a.left, y); x.lineTo(a.right, y); x.stroke(); x.setLineDash([]); x.font = '600 13px ' + css('--font'); x.fillStyle = css('--muted'); x.textAlign = 'left'; x.fillText('평균 ' + mfmt(M.def, avg), a.left + 4, y - 5); x.restore(); } }]) });
  }

  // ═════════ 2. 콘텐츠 전략 ═════════
  // ═════════ 전략: 처방 · 조건 · 편성 · 실행 기록 · 목표 · 롱테일 · 수명 ═════════
  const CH_ALIAS = { '인스타': '인스타그램', '인스타그램': '인스타그램', 'instagram': '인스타그램', '유튜브': '유튜브', 'youtube': '유튜브', 'hong': 'hong._.video', '홍비디오': 'hong._.video', 'hong._.video': 'hong._.video' };
  const chKey = s => CH_ALIAS[String(s || '').trim().toLowerCase()] || CH_ALIAS[String(s || '').trim()] || null;
  const ownIn = chs => chs.filter(c => OWN.includes(c));
  const dow = d => new Date(d + 'T00:00:00Z').getUTCDay();

  // 1) 처방 카드
  function prescribe(chs) {
    const s365 = addDays(D.updated, -365), s60 = addDays(D.updated, -60);
    const L = pool({ channels: chs, since: s365 }).filter(it => ratio(it) != null);
    const hbCh = {}; chs.forEach(c => { hbCh[c] = hitRate(L.filter(it => it.c === c)) || 0; });
    const combos = groupBy(L, it => it.c + '|' + it.g + '|' + it.t).filter(r => r.n >= MIN_N && r.idx != null);
    combos.forEach(r => { const p = r.k.split('|'); r.c = p[0]; r.g = p[1]; r.t = p[2]; r.recent = r.arr.filter(it => it.d >= s60).length; r.exp = r.n * 60 / 365; r.hb = hbCh[r.c]; });
    const more = combos.filter(r => r.idx >= 1.25 && (r.hit || 0) >= r.hb && r.recent <= Math.max(1, Math.floor(r.exp))).sort((a, b) => b.idx * (0.5 + (b.hit || 0)) - a.idx * (0.5 + (a.hit || 0))).slice(0, 3);
    const less = combos.filter(r => r.idx <= 0.8 && r.recent >= Math.max(3, Math.ceil(r.exp * 1.2))).sort((a, b) => a.idx - b.idx).slice(0, 2);
    less.forEach(r => { r.alt = combos.filter(x => x.c === r.c && x.g === r.g && x.t !== r.t && x.n >= MIN_N && x.idx > Math.max(1, r.idx * 1.3)).sort((a, b) => b.idx - a.idx)[0] || null; });
    const a0 = addDays(D.updated, -365 - 7), a1 = addDays(D.updated, -365 + 45);
    const again = D.items.filter(it => chs.includes(it.c) && it.t !== '스토리' && it.d >= a0 && it.d <= a1 && !it.ad && isHit(it)).sort((a, b) => ratio(b) - ratio(a)).slice(0, 3);
    return { more, less, again };
  }
  function rxHtml(P) {
    const card = (kind, lab, head, body, key) => '<div class="rx ' + kind + '"><div class="rx-k">' + lab + '</div><div class="rx-h">' + head + '</div><div class="rx-p">' + body + '</div>' + (key ? '<button type="button" class="rx-b" data-rx="' + esc(key) + '">콘텐츠 보기</button>' : '') + '</div>';
    const combo = r => badge(r.c) + '<span>' + esc(r.g) + ' × ' + esc(fmtType(r.t)) + '</span>';
    const cards = [];
    // 카드 본문은 숫자 행으로(이름 왼쪽 · 숫자 오른쪽)
    const rows = R => '<div class="rx-rows">' + R.map(x => '<div><span>' + x[0] + '</span><b class="num' + (x[2] ? ' ' + x[2] : '') + '">' + x[1] + '</b></div>').join('') + '</div>';
    P.more.forEach(r => cards.push(card('more', '더 만들기', combo(r), rows([['최근 1년 조회 평소 대비', xf(r.idx) + ' · ' + r.n + '개', 'up'], ['잘 된 비율', pct0(r.hit) + ' · 채널 ' + pct0(r.hb)], ['최근 2달 게시', r.recent + '개']]) + '<small class="rx-n">→ 다음 기획에 이 조합을 하나 넣어 보세요.</small>', 'c:' + r.k)));
    P.less.forEach(r => cards.push(card('less', '줄이거나 바꾸기', combo(r), rows([['최근 1년 조회 평소 대비', xf(r.idx) + ' · ' + r.n + '개', 'down'], ['최근 2달 게시', r.recent + '개']]) + '<small class="rx-n">→ ' + (r.alt ? '같은 주제를 <b>' + esc(jo(fmtType(r.alt.t), '으로', '로')) + '</b> 만들면 조회 평소의 ' + xf(r.alt.idx) + ' · ' + r.alt.n + '개였어요. 형식을 바꿔 보세요.' : '횟수를 줄이고, 그 시간에 「더 만들기」 쪽을 만들어 보세요.') + '</small>', 'c:' + r.k)));
    if (P.again.length) cards.push(card('again', '작년 이맘때 잘 된 콘텐츠', '<span>올해 버전으로 다시 만들어 볼 후보</span>', '<ul class="rx-l">' + P.again.map(it => '<li><div class="rx-t">' + badge(it.c) + esc(title(it.n)) + '</div><div class="rx-m">' + mName(it) + ' <span class="num">' + fmtK(mainVal(it)) + '</span> · <b>평소의 ' + xf(ratio(it)) + '</b> · ' + whenTxt(it.d) + '</div></li>').join('') + '</ul><small class="rx-n">→ 작년 이맘때부터 6주 사이에 잘 된 게시물이에요. 곧 같은 시기가 오니 올해 버전으로 준비해 보세요.</small>', 'a:again'));
    if (!cards.length) return '<div class="wait">지금은 따로 권할 만한 게 없어요. 같은 주제·형식 게시물이 ' + MIN_N + '개 이상 쌓이면 「더 만들기」·「줄이거나 바꾸기」를 알려 드려요.</div>';
    return '<div class="rxs">' + cards.join('') + '</div><div id="rxList"></div>';
  }
  function rxItems(key, P, chs) {
    if (key === 'a:again') return P.again;
    const [c, g, t] = key.slice(2).split('|');
    return pool({ channels: chs, since: addDays(D.updated, -365) }).filter(it => it.c === c && it.g === g && it.t === t).sort((a, b) => (ratio(b) || 0) - (ratio(a) || 0)).slice(0, 15);
  }

  // 2) 잘 되는 조건
  // 4번째 값 = 적용 범위(그 범위 게시물끼리만 비교). 정의는 2026-10-17 유튜브 제목·인스타 캡션 분석과 그 검증 문서 기준
  const isLong = it => it.c === '유튜브' && it.t !== '1분 이하';
  const firstCut = it => String(it.n || '').split(/\s*[|｜]\s*/)[0]; // 제목 첫 마디(| 앞)
  // 연도·학번·학년·회차(EP·DAY_n)는 숫자로 치지 않음(TripLog DAY_n 착시)
  const numIn = s => /\d/.test(s.replace(/20\d{2}(학년도)?|\d{2}\s*학번|\d\s*학년|EP\.?\s*\d+|DAY[_\s]?\d+|\d+\s*화/gi, ''));
  const FEATS = [
    // 유튜브는 기간에 따라 방향이 엇갈려 판정 보류 → 인스타만
    ['질문형 제목', it => /[?？]/.test(title(it.n)), '제목에 ? 포함', it => it.c !== '유튜브'],
    ['제목에 숫자', it => numIn(title(it.n)), '연도·학번·회차 제외'],
    ['학교명 제목', it => /전주대|JJ/i.test(it.n || ''), '제목에 전주대·JJ', isLong],
    ['안내·모집형 첫 마디', it => /안내|모집|전형|공청회|선발|접수|개설|운행/.test(firstCut(it)), '첫 마디에 안내·모집·전형 등', isLong],
    ['검색되는 단어', it => /수강신청|사범대|기숙사|축제|브이로그|과잠|간호학과|국토대장정|아침밥|국가장학금|태권도|대동제|시범단/.test(it.n || ''), '수강신청·기숙사·과잠 같은 검색어', isLong],
    ['첫 줄에 학교명', it => /전주대/.test(title(it.n)), '캡션 첫 줄에 전주대', it => it.c === '인스타그램'],
    ['캡션에 이모지', it => /\p{Extended_Pictographic}/u.test(it.n || '')],
    ['이벤트 게시물', it => /이벤트|EVENT|𝗘𝗩𝗘𝗡𝗧|경품|추첨/i.test(it.n || '')],
    ['학생이 만든 콘텐츠', it => ['홍보대사', '근로장학생', '학생 크리에이터'].includes(it.p), '홍보대사·근로·학생'],
    ['홍보대사 제작', it => it.p === '홍보대사'],
    ['학과·기관 협업', it => it.p === '학과·기관 협업'],
    ['주말 게시', it => [0, 6].includes(dow(it.d)), '토·일'],
    // 효과는 인스타 릴스에서만 확인(캐러셀·유튜브는 차이 없음)
    ['짧은 제목', it => title(it.n).length <= 15, '릴스 첫 줄 15자 이하', it => it.c === '인스타그램' && it.t === '릴스'],
  ];
  function rulesFor(ch) {
    const L = pool({ channels: [ch], since: addDays(D.updated, -730) }).filter(it => ratio(it) != null);
    if (L.length < 30) return [];
    const out = [];
    const test = (label, f0, kind, sub, scope) => {
      const S0 = scope ? L.filter(scope) : L, f = scope ? it => scope(it) && f0(it) : f0;
      const a = S0.filter(f0), b = S0.filter(it => !f0(it));
      if (Math.min(a.length, b.length) < Math.max(8, S0.length * 0.08)) return;
      const ma = median(a.map(ratio)), mb = median(b.map(ratio));
      if (!ma || !mb) return;
      const eff = ma / mb;
      if (eff >= 1.25 || eff <= 0.8) out.push({ label, sub, kind, ma, mb, na: a.length, nb: b.length, eff, ha: hitRate(a), hb: hitRate(b), f });
    };
    const types = groupBy(L, 't').filter(r => r.n >= 6);
    types.forEach(r => test(fmtType(r.k), it => it.t === r.k, '형식'));
    FEATS.forEach(([l, f, sub, scope]) => test(l, f, '조건', sub, scope));
    const wd = [1, 2, 3, 4, 5, 6, 0].map(k => ({ k, arr: L.filter(it => dow(it.d) === k) })).filter(x => x.arr.length >= 6).map(x => ({ k: x.k, m: median(x.arr.map(ratio)) }));
    const bw = wd.sort((a, b) => b.m - a.m)[0];
    if (bw) test(WD[bw.k] + '요일 게시', it => dow(it.d) === bw.k, '요일');
    return out.sort((a, b) => Math.abs(Math.log(b.eff)) - Math.abs(Math.log(a.eff))).slice(0, 6);
  }
  function rulesHtml(chs) {
    const blocks = ownIn(chs).map(ch => {
      const R = rulesFor(ch);
      if (!R.length) return '<div class="rl"><div class="rl-h">' + badge(ch) + '</div><p class="note">최근 2년 게시물이 30개가 안 되거나, 조건에 따라 뚜렷한 차이가 나지 않았어요.</p></div>';
      return '<div class="rl"><div class="rl-h">' + badge(ch) + '<small>최근 2년 · 해당 게시물 vs 나머지 · 중간값</small></div><ul>' + R.map(r => {
        const up = r.eff >= 1, mxv = Math.max(r.ma, r.mb, 1.5);
        // 두 줄 미니 막대(이 조건 / 나머지), 숫자는 오른쪽
        const bar = (lab, n, v, h, on) => '<div class="cmpb"><span class="cl">' + lab + ' <small>' + n + '개</small></span><span class="ct"><i class="' + (on ? (up ? 'up' : 'down') : '') + '" style="width:' + Math.min(100, v / mxv * 100).toFixed(1) + '%"></i></span><span class="cv num">' + xf(v) + '<small>잘 된 ' + pct0(h) + '</small></span></div>';
        return '<li class="' + (up ? 'up' : 'down') + '"><span class="ic2">' + (up ? '▲' : '▼') + '</span><span><b>' + esc(r.label) + '</b> <em class="' + (up ? 'up' : 'down') + '">' + (up ? '더 잘 됨' : '덜 됨') + '</em>' + (r.sub ? '<small class="rl-s">' + esc(r.sub) + '</small>' : '') + '<div class="cmps">' + bar('이 조건', r.na, r.ma, r.ha, true) + bar('나머지', r.nb, r.mb, r.hb, false) + '</div></span></li>';
      }).join('') + '</ul></div>';
    });
    return '<div class="rls">' + blocks.join('') + '</div><p class="note">「이런 게시물일 때 더 잘 됐다」는 뜻이지, 그게 이유라는 뜻은 아니에요. 다음 달 기획에서 한두 번 시도해 보고 스냅샷 시트 「전략 기록」 탭에 적으면 효과를 채점해 드려요.</p>';
  }

  // 3) 다음 달 편성 제안
  function nextPlan(chs) {
    const nm = monthStart(D.updated, 1), mm = nm.slice(5, 7), ny = nm.slice(0, 4);
    return ownIn(chs).map(ch => {
      const L6 = pool({ channels: [ch], since: addDays(D.updated, -182), ads: true });
      const L1 = pool({ channels: [ch], since: addDays(D.updated, -365) });
      const byT = groupBy(L1, 't');
      // 인스타는 형식 비교를 도달로 한다(캐러셀 조회는 슬라이드 넘김 중복 집계)
      const igR = ch === '인스타그램', rBase = igR ? median(L1.filter(it => it.r > 0).map(it => it.r)) : null;
      const types = [...new Set(L6.map(it => it.t))];
      const rows = types.map(t => {
        const per = L6.filter(it => it.t === t).length / 6;
        const r = byT.find(x => x.k === t);
        const rr = igR && r ? r.arr.filter(it => it.r > 0).map(it => it.r) : null;
        const idx = igR ? (rr && rr.length >= 5 && rBase ? median(rr) / rBase : null) : (r && r.n >= 5 ? r.idx : null);
        // 판정 · 근거를 짧게: 「늘리기 · 조회 평소의 1.3배」
        const basis = (igR ? '도달 평소의 ' : '조회 평소의 ') + xf(idx), few = r && r.n < 5 ? ' · 참고용' : '';
        let rec = Math.round(per), vd = '유지', bs = idx != null && idx > 0.8 && idx < 1.2 ? basis : '최근 6달 하던 만큼';
        if (idx != null && idx >= 1.2) { rec = Math.max(rec + 1, Math.round(per * 1.3)); vd = '늘리기'; bs = basis; }
        else if (idx != null && idx <= 0.8 && rec > 0) { rec = Math.max(0, Math.min(rec - 1, Math.round(per * 0.7))); vd = '줄이기'; bs = basis; }
        return { t, per, rec, vd, bs: bs + few, why: vd + ' · ' + bs + few, idx };
      }).filter(r => r.per >= 0.3 || r.rec > 0).sort((a, b) => b.rec - a.rec);
      const past = D.items.filter(it => it.c === ch && it.t !== '스토리' && !it.ad && it.d.slice(5, 7) === mm && it.d.slice(0, 4) < ny && ratio(it) != null);
      const topics = groupBy(past, 'g').filter(r => r.n >= MIN_N && r.idx >= 1.1).sort(byIdx).slice(0, 4);
      const yrs = [...new Set(past.map(it => it.d.slice(0, 4)))].sort();
      const best = past.slice().sort((a, b) => ratio(b) - ratio(a)).slice(0, 3);
      return { ch, nm, rows, topics, yrs, best };
    });
  }
  function planHtml(P) {
    if (!P.length) return '';
    const m = +P[0].nm.slice(5, 7);
    return '<div class="pls">' + P.map(p => '<div class="pl"><div class="rl-h">' + badge(p.ch) + '<small>' + m + '월 권장 · 합계 ' + sum(p.rows.map(r => r.rec)) + '개</small></div>' +
      // 형식마다 한 줄: 형식 · 판정 칩 · 「월 4.7 → 5개」, 근거는 아랫줄 작은 글씨
      '<div class="plr-h"><span>형식</span><span>월평균 → 권장</span></div>' +
      p.rows.map(r => '<div class="plr"><div class="plr-m"><b>' + esc(fmtType(r.t)) + '</b><span class="vd ' + (r.vd === '늘리기' ? 'up' : r.vd === '줄이기' ? 'down' : '') + '">' + r.vd + (r.vd === '늘리기' ? ' ▲' : r.vd === '줄이기' ? ' ▼' : '') + '</span><span class="num">월 ' + r.per.toFixed(1) + ' → <b>' + r.rec + '</b>개</span></div><small>' + esc(r.bs) + '</small></div>').join('') +
      (p.topics.length ? '<div class="pl-t"><b>지난 ' + m + '월에 잘 된 주제</b> <small>' + yrSpan(p.yrs) + ' · 조회 평소 대비 · 올해도 후보</small><div class="chips">' + p.topics.map(t => '<span class="chip" aria-pressed="true">' + esc(t.k) + ' ' + xf(t.idx) + '</span>').join('') + '</div></div>' : '<p class="note">' + (p.yrs.length ? yrSpan(p.yrs) + ' ' + m + '월엔 뚜렷하게 잘 된 주제가 없었어요.' : '지난 ' + m + '월 데이터가 없어요.') + '</p>') +
      (p.best.length ? '<div class="pl-b"><div class="pl-bh">지난 ' + m + '월 가장 잘 된 게시물</div><ul class="rx-l">' + p.best.map(it => '<li><div class="rx-t">' + esc(title(it.n)) + '</div><div class="rx-m">' + mName(it) + ' <span class="num">' + fmtK(mainVal(it)) + '</span> · <b>평소의 ' + xf(ratio(it)) + '</b> · ' + whenTxt(it.d) + '</div></li>').join('') + '</ul></div>' : '') + '</div>').join('') + '</div>' +
      '<div style="margin-top:12px"><button type="button" class="btn" id="planCopy" title="형식별 권장 개수 · 이유 · 잘 된 주제를 글로 복사">회의용으로 복사</button></div>';
  }
  const yrSpan = y => y.length > 1 ? y[0] + '~' + y[y.length - 1] + '년' : y[0] + '년';
  function planText(P) {
    const m = +P[0].nm.slice(5, 7);
    return P.map(p => '[' + chName(p.ch) + '] ' + m + '월 권장 ' + sum(p.rows.map(r => r.rec)) + '개\n' + p.rows.map(r => '- ' + fmtType(r.t) + ' ' + r.rec + '개 (' + r.why + ')').join('\n') +
      (p.topics.length ? '\n- 지난 ' + m + '월 잘 된 주제(올해도 후보): ' + p.topics.map(t => t.k + '(조회 평소의 ' + xf(t.idx) + ')').join(', ') : '')).join('\n\n') + '\n\n※ 평소 = 같은 채널·같은 형식 최근 1년 게시물 조회의 중간값 · 1.2배 이상인 형식은 늘리고 0.8배 이하인 형식은 줄였어요(인스타는 도달로 비교)';
  }

  // 4) 실행 기록 (스냅샷 시트 「전략 기록」)
  function scoreStrat(s) {
    const c = chKey(s.ch);
    const chs = c ? [c] : OWN;
    const to = s.to && s.to >= s.from ? s.to : D.updated;
    const match = it => chs.includes(it.c) && it.t !== '스토리' && !it.ad && (!s.g || String(it.g).includes(s.g)) && (!s.t || typeShort(it.t) === s.t || it.t === s.t || fmtType(it.t) === s.t) && (!s.kw || String(it.n || '').toLowerCase().includes(String(s.kw).toLowerCase()));
    const L = D.items.filter(it => match(it) && it.d >= s.from && it.d <= to);
    const len = Math.max(14, daysBetween(s.from, to));
    const B = D.items.filter(it => match(it) && it.d >= addDays(s.from, -len) && it.d < s.from);
    const m = median(L.map(ratio)), mb = median(B.map(ratio));
    const running = to >= D.updated && (!s.to || s.to >= D.updated);
    let v = ['info', '게시물 기다리는 중'];
    if (L.length >= MIN_N && m != null) v = m >= 1.2 && (mb == null || m >= mb * 1.1) ? ['good', '효과 있었어요'] : m <= 0.9 ? ['bad', '효과 약했어요'] : ['info', '평소와 비슷해요'];
    else if (L.length) v = ['info', '게시 ' + L.length + '개 · ' + MIN_N + '개부터 판정'];
    return { L, B, m, mb, hit: hitRate(L), v, running, chs };
  }
  function stratHtml() {
    const ST = (D.strat || []).filter(s => s.from && s.what);
    if (!ST.length) return '<p class="note">채점할 기록이 아직 없어요 · 오른쪽 위 알림 참고</p>';
    const rows = ST.slice().sort((a, b) => a.from < b.from ? 1 : -1).map((s, i) => {
      const r = scoreStrat(s);
      return '<tr class="click" data-si="' + i + '"><td class="w"><b>' + esc(s.what) + '</b><br><small class="hint">' + [s.ch ? chName(chKey(s.ch) || s.ch) : '전체', s.g, s.t, s.kw ? '“' + s.kw + '”' : ''].filter(Boolean).map(esc).join(' · ') + '</small></td><td>' + dot(s.from) + ' ~ ' + (s.to ? dot(s.to) : '') + (r.running ? ' <span class="tag p-own">진행 중</span>' : '') + '</td><td class="n">' + r.L.length + '</td><td class="n"><b>' + xf(r.m) + '</b></td><td class="n">' + xf(r.mb) + '</td><td class="n">' + pct0(r.hit) + '</td><td><span class="tag ' + (r.v[0] === 'good' ? 'p-own' : r.v[0] === 'bad' ? 'st-bad' : '') + '">' + esc(r.v[1]) + '</span></td></tr>';
    });
    return '<div class="tw"><table class="tbl" id="stTbl"><thead><tr><th>시도</th><th>기간</th><th class="n">게시</th><th class="n">조회 평소 대비</th><th class="n">시작 전 같은 기간</th><th class="n">잘 된 비율</th><th>판정</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div><p class="note">조건(채널·분류·형식·키워드)에 맞는 게시물이 평소의 몇 배였는지(중간값) 봐요 · 평소의 1.2배 이상이고 시작 전 같은 기간보다 1.1배 넘게 높으면 「효과 있었어요」, 0.9배 이하면 「효과 약했어요」 · 게시물이 3개 이상이면 판정해요 · 줄을 누르면 해당 게시물이 나와요</p><div id="stList"></div>';
  }

  // 5) 이번 달 목표 (스냅샷 시트 「채널 목표」)
  const GOAL_M = { '게시 수': 'n', '게시물': 'n', '조회수': 'views', '조회': 'views', '히트율': 'hit', '잘 된 비율': 'hit', '평균 조회': 'avg', '팔로워 순증': 'fol', '구독 순증': 'fol', '팔로워': 'fol' };
  function goalActual(ch, metric, ym) {
    const L = D.items.filter(it => it.c === ch && it.t !== '스토리' && it.d.slice(0, 7) === ym && (S.ads || !it.ad));
    if (metric === 'n') return L.length;
    if (metric === 'views') return sum(L.map(it => val(it, 0)));
    if (metric === 'avg') return L.length ? sum(L.map(it => val(it, 0))) / L.length : null;
    if (metric === 'hit') { const h = hitRate(L); return h == null ? null : h * 100; }
    if (metric === 'fol') {
      const a = (D.acct || []).filter(x => x.ch === ch).sort((x, y) => x.d < y.d ? -1 : 1);
      if (ch === '유튜브') return sum(a.filter(x => x.d.slice(0, 7) === ym).map(x => (x.m['Gained subscribers'] || 0) - (x.m['Lost subscribers'] || 0)));
      const inM = a.filter(x => x.d.slice(0, 7) === ym && x.m['Profile followers'] != null), before = a.filter(x => x.d.slice(0, 7) < ym && x.m['Profile followers'] != null).pop();
      const first = before || inM[0], lastA = inM[inM.length - 1];
      return first && lastA && first !== lastA ? lastA.m['Profile followers'] - first.m['Profile followers'] : null;
    }
    return null;
  }
  function goalsHtml() {
    const ym = D.updated.slice(0, 7);
    const G = (D.goals || []).filter(g => g.target != null && chKey(g.ch) && GOAL_M[g.metric] && (!g.ym || g.ym === ym));
    if (!G.length) return '';
    const dim = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate(), day = +D.updated.slice(8, 10);
    const pace = day / dim;
    return '<div class="gls">' + G.map(g => {
      const c = chKey(g.ch), mk = GOAL_M[g.metric], a = goalActual(c, mk, ym);
      const r = a == null ? null : a / g.target;
      const paced = ['n', 'views', 'fol'].includes(mk);
      const ok = r == null ? null : paced ? r >= pace * 0.95 : r >= 0.95;
      const f = mk === 'hit' ? (v => v == null ? '–' : Math.round(v) + '%') : mk === 'views' || mk === 'avg' ? fmtK : fmt;
      return '<div class="gl"><div class="gl-h">' + badge(c) + esc(g.metric === '히트율' ? '잘 된 비율' : g.metric) + '</div><div class="gl-v"><b>' + f(a) + '</b> / ' + f(g.target) + '</div><div class="pbar wide"><i style="width:' + Math.min(100, (r || 0) * 100) + '%;background:' + (ok == null ? 'var(--muted)' : ok ? 'var(--jj)' : 'var(--down-bar)') + '"></i>' + (paced ? '<em style="left:' + (pace * 100) + '%"></em>' : '') + '</div><small class="' + (ok ? 'up' : 'down') + '">' + (r == null ? '아직 데이터가 없어요' : '목표의 ' + pct0(r) + (paced ? ' · 오늘까지 ' + pct0(pace) + '쯤 와 있으면 돼요' : '') + (ok ? ' · 순조로워요' : ' · 조금 더 속도를 내야 해요')) + '</small>' + (g.memo ? '<small class="hint">' + esc(g.memo) + '</small>' : '') + '</div>';
    }).join('') + '</div><p class="note">' + (+ym.slice(5, 7)) + '월 · ' + day + '일 기록 기준 · 목표는 스냅샷 시트 「채널 목표」 탭에서 바꿀 수 있어요 · 조회는 이번 달 올린 게시물의 현재 누적이에요</p>';
  }

  // 6) 롱테일 — 오래된 게시물이 최근에 얼마나 컸나
  function longtail(ch) {
    const ri = D.dates.map((d, i) => i).filter(i => hasRec(ch, i));
    if (ri.length < 2) return null;
    const iL = ri[ri.length - 1];
    const i0 = ri.find(i => D.dates[i] >= addDays(D.updated, -200));
    if (i0 == null || i0 === iL) return null;
    const its = D.items.filter(it => it.c === ch && it.t !== '스토리' && (S.ads || !it.ad) && it.h[iL] && it.h[i0] && it.h[iL][0] != null && it.h[i0][0] != null);
    const g = new Map(its.map(it => [it, Math.max(0, it.h[iL][0] - it.h[i0][0])]));
    const tot = sum([...g.values()]);
    const old = its.filter(it => daysBetween(it.d, D.dates[i0]) > 365);
    const oldSum = sum(old.map(it => g.get(it)));
    const top = old.filter(it => g.get(it) > 0).sort((a, b) => g.get(b) - g.get(a)).slice(0, 10);
    return { ch, from: D.dates[i0], to: D.dates[iL], days: daysBetween(D.dates[i0], D.dates[iL]), tot, oldSum, n: old.length, top, g };
  }
  function longtailHtml(chs) {
    const R = ownIn(chs).map(longtail).filter(r => r && r.top.length);
    if (!R.length) return '<div class="wait">기록이 2회 이상 쌓인 채널이 없어요.</div>';
    return R.map(r => '<div class="lt"><div class="rl-h">' + badge(r.ch) + '<small>' + dot(r.from) + ' → ' + dot(r.to) + ' · ' + r.days + '일 동안</small></div>' +
      // 두 줄 행 + 비율 막대: 이 기간 늘어난 조회 · 그중 1년 넘은 게시물 몫
      '<div class="s2 lt-s2"><div class="s2-h"><span>이 기간 늘어난 조회</span><b class="num">+' + fmtK(r.tot) + '</b></div>' +
      '<div class="s2-h"><span>그중 1년 넘은 게시물 ' + r.n + '개 몫</span><b class="num">+' + fmtK(r.oldSum) + ' · ' + pct0(r.tot ? r.oldSum / r.tot : null) + '</b></div>' +
      '<div class="mbar"><i style="width:' + (r.tot ? Math.round(r.oldSum / r.tot * 100) : 0) + '%"></i></div></div>' +
      '<ol class="rank" id="lt_' + esc(r.ch).replace(/\W/g, '') + '">' + rankRows(r.top, { right: it => '조회 <span class="num">+' + fmtK(r.g.get(it)) + '</span>' }) + '</ol>' +
      '<p class="note">' + ICO.spark + ' 위 게시물 ' + (r.ch === '유튜브' ? '설명란' : '캡션') + '·고정 댓글에 입학처·최근 영상 링크를 달고, 같은 주제로 새 버전을 만들어 보세요.</p></div>').join('') +
      '<p class="note">오래돼도 조회가 계속 늘면 검색·추천으로 꾸준히 보이고 있을 가능성이 커요.</p>';
  }

  // 7) 수명 곡선 — 게시 후 1달·3달·6달에 현재 누적의 몇 %까지 왔나
  const LIFE_AGES = [[30, '1달'], [90, '3달'], [180, '6달']];
  const lifeGroup = it => it.c === '유튜브' ? (it.t === '1분 이하' ? '쇼츠' : '긴 영상') : typeShort(it.t) === '릴스' ? '릴스' : typeShort(it.t) || '기타';
  // 한 선은 같은 게시물 묶음으로(가장 긴 나이 6달×1.3이 지난 게시물만) — 나이마다 묶음이 다르면 누적 비율이 거꾸로 내려가 보임
  const LIFE_MAX = LIFE_AGES[LIFE_AGES.length - 1][0] * 1.3;
  function lifeCurve(chs) {
    const G = {}, META = {};
    D.items.filter(it => chs.includes(it.c) && it.t !== '스토리' && !it.ad).forEach(it => {
      const pts = [[0, 0]];
      it.h.forEach((x, i) => { if (x && x[0] != null) { const a = daysBetween(it.d, D.dates[i]); if (a >= 0) pts.push([a, x[0]]); } });
      if (pts.length < 3) return;
      const fin = pts[pts.length - 1];
      if (!(fin[1] > 0) || fin[0] < LIFE_MAX) return;
      const key = (chs.length > 1 ? chName(it.c) + ' ' : '') + lifeGroup(it);
      META[key] = { ch: it.c, g: lifeGroup(it) };
      // 세 시점 값이 모두 있는 게시물만(같은 묶음) — 시점마다 묶음이 다르면 선이 거꾸로 내려가 보임
      const vs = LIFE_AGES.map(([A]) => {
        const near = pts.some(p => p[0] > 0 && p[0] >= A * 0.5 && p[0] <= A * 1.6);
        if (!near) return null;
        let k = pts.findIndex(p => p[0] >= A); if (k < 1) return null;
        const [a0, v0] = pts[k - 1], [a1, v1] = pts[k];
        const v = a1 === a0 ? v1 : v0 + (v1 - v0) * (A - a0) / (a1 - a0);
        return Math.min(1, Math.max(0, v / fin[1]));
      });
      if (vs.some(v => v != null)) (G[key] = G[key] || []).push(vs);
    });
    // 한 선 = 같은 게시물 묶음: 그 형식에서 값이 4개 이상 모인 시점들을 고르고, 그 시점 값이 모두 있는 게시물만 씀(빠진 시점은 빈칸)
    return Object.entries(G).map(([k, rows]) => {
      const okA = LIFE_AGES.map((a, j) => rows.filter(v => v[j] != null).length >= 4);
      const co = rows.filter(v => okA.every((o, j) => !o || v[j] != null));
      return { k, ch: META[k].ch, g: META[k].g, med: okA.map((o, j) => o && co.length >= 4 ? median(co.map(v => v[j])) : null), n: okA.map(o => o ? co.length : 0) };
    }).filter(r => r.med.some(x => x != null));
  }

  function viewStrategy() {
    const chs = viewChannels(), ch = chs.length === 1 ? chs[0] : null, L = pool({ channels: chs });
    const types = Object.entries(L.reduce((o, it) => { o[it.t] = (o[it.t] || 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    const order = ['릴스', '캐러셀', '이미지', '1분 이하', '1~3분', '3~10분', '10분 초과', '릴스/영상'];
    types.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const MXB = S.mxBy === 'p' ? 'p' : 'g'; // 개편 1단계: 형식 × 분류 / 형식 × 제작
    const cats = groupBy(L, MXB).sort((a, b) => b.n - a.n);
    const hb = hitRate(L);
    // 잘 된 비율이 없으면(올린 지 얼마 안 돼 판정 전인 게시물만) 「–」 대신 「모이는 중」
    const hrTxt = hr => hr == null ? '<b class="mu">모이는 중</b>' : '<b>' + pct0(hr) + '</b>';
    const cell = arr => {
      if (!arr.length) return { cls: 'none', html: '·' };
      const hr = hitRate(arr);
      if (arr.length < MIN_N) return { cls: 'few', html: hrTxt(hr) + '<small>' + arr.length + '개</small>' };
      const a = Math.min(1, (hr || 0) / 0.6);
      const bg = 'rgba(0,120,173,' + (0.08 + a * 0.82).toFixed(2) + ')';
      return { cls: '', style: 'background:' + bg + ';color:' + (a > 0.45 ? '#fff' : 'var(--fg)'), html: hrTxt(hr) + '<small>' + arr.length + '개</small>' };
    };
    // 형식이 하나뿐이면(hong) 「전체」 열은 첫 열과 같은 값이라 생략
    const one = types.length === 1;
    let mx = '<div class="tw"><table class="mx"><thead><tr><th class="r">' + (MXB === 'p' ? '제작' : '분류') + '</th>' + types.map(t => '<th>' + esc(fmtType(t)) + '</th>').join('') + (one ? '' : '<th>전체</th>') + '</tr></thead><tbody>';
    cats.forEach(r => {
      mx += '<tr><th class="r">' + esc(r.k) + '</th>' + types.map(t => { const arr = r.arr.filter(it => it.t === t); const c = cell(arr); const key = r.k + '|' + t; return '<td class="' + c.cls + (S.mx === key ? ' sel' : '') + '" data-k="' + esc(key) + '" style="' + (c.style || '') + '">' + c.html + '</td>'; }).join('') +
        (one ? '' : '<td class="tot">' + hrTxt(r.hit) + '<small>' + r.n + '개</small></td>') + '</tr>';
    });
    mx += '<tr><th class="r">전체</th>' + types.map(t => { const arr = L.filter(it => it.t === t); return '<td class="tot">' + hrTxt(hitRate(arr)) + '<small>' + arr.length + '개</small></td>'; }).join('') + (one ? '' : '<td class="tot">' + hrTxt(hb) + '<small>' + L.length + '개</small></td>') + '</tr></tbody></table></div>' +
      '<div class="mxleg"><span><i style="background:rgba(0,120,173,.9)"></i>잘 된 비율 높음</span><span><i style="background:rgba(0,120,173,.15)"></i>낮음</span><span><i style="background:var(--tile)"></i>' + MIN_N + '개 미만 · 참고용</span><span>칸을 누르면 해당 콘텐츠가 아래에 나와요</span></div>';
    let sel = '';
    if (S.mx) {
      const [g, t] = S.mx.split('|');
      const arr = L.filter(it => it[MXB] === g && it.t === t).sort((a, b) => (ratio(b) || 0) - (ratio(a) || 0));
      sel = '<div style="margin-top:16px"><h3 class="sub">' + esc(g) + ' × ' + esc(fmtType(t)) + ' — ' + arr.length + '개</h3><ol class="rank" id="mxList">' + rankRows(arr.slice(0, 20)) + '</ol></div>';
    }
    const own = ownIn(chs).length > 0;
    const RX = own ? prescribe(ownIn(chs)) : null, PLAN = own ? nextPlan(chs) : null;
    let top = '';
    if (own) {
      const gh = goalsHtml();
      // 빈 설정 안내는 종 알림으로 옮기고 화면에는 한 줄만(원칙 9)
      top += secOpen('이번 달 목표', gh ? '목표를 얼마나 채웠는지 · 세로선 = 오늘 날짜면 와 있어야 할 위치' : '') + (gh || '<p class="note">목표가 아직 없어요 · 오른쪽 위 알림에서 적는 법을 볼 수 있어요</p>') + secClose;
      top += secOpen('이번 주 처방', (ch ? '' : esc(scopeLabel()) + ' · ') + '잘 되는데 최근 2달 덜 올린 것 · 많이 올렸는데 약한 것') + rxHtml(RX) + secClose;
      top += secOpen('시도한 전략 채점', '「전략 기록」 탭에 적은 시도가 평소보다 잘 됐는지 채점해요') + stratHtml() + secClose;
      top += secOpen('잘 되는 조건', '해당 게시물과 나머지가 1.25배 넘게 차이 나는 조건만 골랐어요') + rulesHtml(chs) + secClose;
      top += secOpen((+monthStart(D.updated, 1).slice(5, 7)) + '월 편성 제안', '최근 6달 올린 양에서 잘 되는 형식은 늘리고 약한 건 줄였어요 · 작년 같은 달 인기 주제도 함께') + planHtml(PLAN) + secClose;
    }
    let html = top + secOpen('무엇을 만들면 잘 되나', (ch ? '' : esc(scopeLabel()) + ' · ') + periodPhrase() + ' 게시물 · 칸의 숫자 = 잘 된 비율 · 진할수록 잘 돼요', '<div class="seg" id="mxBy" aria-label="행 기준">' + [['g', '형식 × 분류'], ['p', '형식 × 제작']].map(o => '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (MXB === o[0]) + '">' + o[1] + '</button>').join('') + '</div>') + '<dl class="defs"><div><dt>잘 된 비율</dt><dd>평소의 1.5배 이상 나온 게시물 비율</dd></div><div><dt>모이는 중</dt><dd>올린 지 ' + AGE_MIN + '일 안 된 게시물만 있는 칸</dd></div></dl>' + mx + sel + secClose;

    // 반응의 종류
    if (ch && OWN.includes(ch)) html += secOpen('콘텐츠 역할 — 반응의 종류', reactNote(ch)) + reactTable(ch, cats) + secClose;
    else if (S.ch === '전체') html += secOpen('콘텐츠 역할 — 반응의 종류', '채널을 고르면 분류별 반응을 볼 수 있어요') + '<div class="chips go-ch">' + [['인스타그램', '저장 · 공유 · 댓글'], ['유튜브', '끝까지 본 비율'], ['hong._.video', '좋아요 · 댓글']].map(c => '<button class="chip" type="button" data-goch="' + c[0] + '">' + badge(c[0]) + '<small>' + c[1] + '</small></button>').join('') + '</div>' + secClose;

    // 저장·공유(타 대학은 좋아요)가 많은 형식·분류
    const RXS = rxSec(chs, L);
    if (RXS) html += RXS.html;

    // 분류별 + 요일별
    html += secOpen('분류별 · 요일별 성과', '조회 평소 대비 중간값 · 세로선 1배보다 길면 평소보다 잘 됨') +
      '<div class="two"><div><h3>분류별</h3><div class="bars" id="byCat"></div></div><div><h3>게시 요일별</h3><div class="chart" id="wdBox"><canvas id="wdChart"></canvas></div><p class="note" id="wdNote"></p></div></div>' + secClose;

    // 수명
    if (own) {
      html += secOpen('오래돼도 계속 크는 콘텐츠', '올린 지 1년 넘었는데 최근 기록 사이 조회가 늘어난 게시물') + longtailHtml(chs) + secClose;
      html += secOpen('콘텐츠 수명 — 조회가 언제까지 붙나', '올린 지 1·3·6달째 지금 조회의 몇 %가 쌓였는지 · 중간값 · 낮을수록 오래 커요') + '<div class="chart tall"><canvas id="lifeChart2"></canvas></div><p class="note" id="lifeNote2"></p>' + secClose;
    }
    $('view').innerHTML = html.replace(/^<div class="gap"><\/div>/, '');
    $('view').querySelectorAll('[data-goch]').forEach(b => b.addEventListener('click', () => { S.ch = b.dataset.goch; render(); window.scrollTo({ top: 0 }); }));
    if ($('mxBy')) $('mxBy').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.mxBy = b.dataset.v; S.mx = null; viewStrategy(); }));
    $('view').querySelectorAll('.mx td[data-k]').forEach(td => { if (td.classList.contains('none')) return; td.addEventListener('click', () => { S.mx = S.mx === td.dataset.k ? null : td.dataset.k; viewStrategy(); if (S.mx) setTimeout(() => { const el = $('mxList'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 30); }); });
    if (S.mx) { const [g, t] = S.mx.split('|'); wireRank($('mxList'), L.filter(it => it[MXB] === g && it.t === t).sort((a, b) => (ratio(b) || 0) - (ratio(a) || 0)).slice(0, 20)); }
    bars('byCat', cats.filter(r => r.n >= MIN_N).sort(byIdx), subN, k => { S.view = 'explore'; S.g = k; render(); window.scrollTo({ top: 0 }); });
    if (RXS) {
      if ($('rxBy')) $('rxBy').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.rxK = b.dataset.v; viewStrategy(); }));
      bars('rxT', RXS.T, RXS.sub);
      // 분류 막대를 누르면 탐색 화면에서 그 분류를 같은 기준 순위로
      bars('rxG', RXS.G, RXS.subG, RXS.bench ? null : g => { S.view = 'explore'; S.g = g; S.gs = null; S.rankBy = RXS.k === 'save' || RXS.k === 'share' ? RXS.k : 'hot'; S.rankShown = 10; render(); window.scrollTo({ top: 0 }); });
    }
    // 요일
    const wd = [1, 2, 3, 4, 5, 6, 0].map(k => { const arr = L.filter(it => new Date(it.d + 'T00:00:00Z').getUTCDay() === k); return { k: WD[k], n: arr.length, idx: median(arr.map(ratio)) }; });
    const wdOk = wd.filter(x => x.n >= MIN_N && x.idx != null).sort((a, b) => b.idx - a.idx), best = wdOk[0], worst = wdOk.length > 1 ? wdOk[wdOk.length - 1] : null;
    $('wdNote').textContent = best ? '가장 좋은 요일 ' + best.k + ' · 조회 평소의 ' + xf(best.idx) + ' · ' + best.n + '개' + (worst ? ' / 가장 낮은 요일 ' + worst.k + ' · ' + xf(worst.idx) + ' · ' + worst.n + '개' : '') + ' · 막대 위 = 조회 평소 대비, 아래 = 게시 수 · 회색 = ' + MIN_N + '개 미만' : '게시물이 적어 요일 비교가 어려워요.';
    // 게시물 MIN_N 미만 요일은 회색, ±3%는 회색. 막대 위는 배수, x축 아래 줄은 게시 수
    const wdCol = x => x.idx == null || x.n < MIN_N ? css('--line') : ({ up: css('--up'), down: css('--down-bar'), flat: css('--muted') + '88' })[xCls(x.idx)];
    draw('wdChart', { type: 'bar', data: { labels: wd.map(x => [x.k, x.n + '개']), datasets: [{ data: wd.map(x => x.idx), backgroundColor: wd.map(wdCol), borderRadius: 3, maxBarThickness: 36 }] },
      options: chartOpts({ scales: { y: { display: false, beginAtZero: true } }, plugins: { tooltip: { callbacks: { title: c => wd[c[0].dataIndex].k + '요일', label: c => '조회 평소의 ' + xf(c.raw) + ' · ' + wd[c.dataIndex].n + '개' + (wd[c.dataIndex].n < MIN_N ? ' · 게시물 적음' : '') } } } }),
      plugins: [{ id: 'lb', afterDatasetsDraw(c) { const x = c.ctx; x.save(); x.font = '600 13px ' + css('--font'); x.fillStyle = css('--muted'); x.textAlign = 'center'; c.getDatasetMeta(0).data.forEach((b, i) => { if (wd[i].idx != null) x.fillText(wd[i].n < MIN_N ? '적음' : xf(wd[i].idx), b.x, b.y - 6); }); x.restore(); } }] });
    if (own) wireStrat(chs, RX, PLAN);
  }
  function wireStrat(chs, RX, PLAN) {
    $('view').querySelectorAll('[data-rx]').forEach(b => b.addEventListener('click', () => {
      const L = rxItems(b.dataset.rx, RX, ownIn(chs));
      $('rxList').innerHTML = '<h3 class="sub" style="margin-top:16px">' + esc(b.closest('.rx').querySelector('.rx-h').innerText) + ' — ' + L.length + '개</h3><ol class="rank" id="rxRank">' + rankRows(L) + '</ol>';
      wireRank($('rxRank'), L); $('rxList').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }));
    const ST = (D.strat || []).filter(s => s.from && s.what).sort((a, b) => a.from < b.from ? 1 : -1);
    $('view').querySelectorAll('#stTbl tr[data-si]').forEach(tr => tr.addEventListener('click', () => {
      const r = scoreStrat(ST[+tr.dataset.si]); const L = r.L.slice().sort((a, b) => (ratio(b) || 0) - (ratio(a) || 0));
      $('stList').innerHTML = L.length ? '<ol class="rank" id="stRank">' + rankRows(L.slice(0, 20)) + '</ol>' : '<p class="note">조건에 맞는 게시물이 아직 없어요.</p>';
      wireRank($('stRank'), L.slice(0, 20));
    }));
    if ($('planCopy')) $('planCopy').addEventListener('click', () => { const t = planText(PLAN); try { navigator.clipboard.writeText(t).then(() => toast('편성 제안을 복사했어요'), () => toast('복사하지 못했어요')); } catch (e) { toast('복사하지 못했어요'); } });
    ownIn(chs).forEach(ch => { const el = $('lt_' + ch.replace(/\W/g, '')); const r = longtail(ch); if (el && r) wireRank(el, r.top); });
    const LC = lifeCurve(ownIn(chs));
    if (!LC.length) { $('lifeNote2').textContent = '기록이 쌓인 기간이 아직 짧아서, 게시물이 언제까지 조회를 모으는지 그리기 어려워요.'; return; }
    // 색 = 채널색, 형식 = 선 모양(릴스·쇼츠 실선, 캐러셀·긴 영상 [6,3], 그 밖 [2,2]) · 범례 대신 선 끝 라벨
    const dashOf = g => /릴스|쇼츠/.test(g) ? undefined : /캐러셀|긴 영상/.test(g) ? [6, 3] : [2, 2];
    const allV = LC.flatMap(r => r.med.filter(v => v != null).map(v => v * 100)), ymin = Math.max(0, Math.floor((Math.min(...allV) - 5) / 25) * 25);
    draw('lifeChart2', { type: 'line', data: { labels: LIFE_AGES.map(a => '게시 후 ' + a[1]), datasets: LC.map(r => ({ label: r.k, data: r.med.map(v => v == null ? null : Math.round(v * 100)), borderColor: chColor(r.ch), backgroundColor: chColor(r.ch), borderDash: dashOf(r.g), borderWidth: 2, pointRadius: 3, cubicInterpolationMode: 'monotone', spanGaps: true })) },
      options: chartOpts({ layout: { padding: { top: 12, right: 84 } }, plugins: { legend: { display: false }, endLabels: { max: 9 }, tooltip: { displayColors: true, callbacks: { label: c => c.dataset.label + ' ' + c.raw + '% · 게시물 ' + LC[c.datasetIndex].n[c.dataIndex] + '개' } } }, scales: { y: { display: true, min: ymin, max: 100, grid: { color: css('--line') }, ticks: { stepSize: 25, callback: v => v + '%' } } } }),
      plugins: [endLabels] });
    const at30 = LC.filter(r => r.med[0] != null).sort((a, b) => b.med[0] - a.med[0]);
    const fin = '→ 빨리 끝나는 형식은 올린 첫 주에 스토리·공유로 밀어 주고, 오래 가는 형식은 검색에 걸리는 제목·설명에 힘을 주세요.';
    $('lifeNote2').textContent = at30.length >= 2 ? jo(at30[0].k, '은', '는') + ' 올린 지 1달 만에 지금 조회의 ' + pct0(at30[0].med[0]) + '가 쌓여 가장 빨리 끝나요 · 게시물 ' + at30[0].n[0] + '개. ' + jo(at30[at30.length - 1].k, '은', '는') + ' 1달째에 ' + pct0(at30[at30.length - 1].med[0]) + '라 가장 오래 커요 · 게시물 ' + at30[at30.length - 1].n[0] + '개. ' + fin
      : at30.length === 1 ? jo(at30[0].k, '은', '는') + ' 올린 지 1달 만에 지금 조회의 ' + pct0(at30[0].med[0]) + '가 쌓여요 · 게시물 ' + at30[0].n[0] + '개' : '올린 지 1달째 기록이 있는 게시물이 적어 값이 모인 시점만 그렸어요 · 한 선은 같은 게시물 묶음';
  }
  function reactNote(ch) {
    if (ch === '인스타그램') return '분류마다 어떤 반응이 많은지 봐요 · 비율은 도달한 사람 대비, 채널 평소보다 높으면 파란색 · 「역할」은 평소보다 1.2배 넘게 앞선 반응 중 가장 큰 것';
    if (ch === '유튜브') return '분류마다 조회·끝까지 본 비율·좋아요율·공유율을 봐요 · 채널 평소보다 높으면 파란색 · 「역할」은 평소보다 1.2배 넘게 앞선 것 중 가장 큰 것';
    return '분류마다 조회·좋아요율·댓글률을 봐요 · 채널 평소보다 높으면 파란색 · 「역할」은 평소보다 1.2배 넘게 앞선 것 중 가장 큰 것';
  }
  // 인스타 도달 배수: 도달 ÷ 같은 형식 최근 1년 도달 중간값(형식 게시물 15개 미만이면 채널 전체) — 이 표의 「도달」 열에만 씀
  const RB = {};
  function reachRatio(it) {
    if (!(it.r > 0) || it.x || it.ad || frozen(it)) return null;
    const k = it.c + '|' + it.t;
    if (!(k in RB)) {
      const pk = f => D.items.filter(x => x.c === it.c && x.t !== '스토리' && !x.ad && !x.x && !frozen(x) && x.r > 0 && x.d >= addDays(D.updated, -365) && f(x)).map(x => x.r);
      let a = pk(x => x.t === it.t); if (a.length < BASE_T_MIN) a = pk(() => true);
      RB[k] = median(a) || null;
    }
    return RB[k] ? it.r / RB[k] : null;
  }
  // 반응 비율: 인스타 = 저장·공유 ÷ 도달, 유튜브·hong = 공유·좋아요 ÷ 조회. 평소 = 같은 채널·같은 형식 최근 1년 중간값(형식 15개 미만이면 채널 전체, 광고·과거 기록 제외)
  // 형식별 막대만 채널 전체 중간값 대비(형식끼리 견주려고) — 도달·타 대학 좋아요도 형식별 막대는 도달·좋아요 값 ÷ 채널 전체 중간값
  // 도달 300·조회 500 미만은 공유 한두 개로 비율이 크게 튀어 뺌. 유튜브 공유는 전체 기간 값(L)에만 있어 L 조회가 지금 조회의 80% 이상일 때만(게시 직후 값에 멈춘 L 제외)
  // 댓글은 대부분 0이라(중간값 0) 비율 비교에서 뺌. 타 대학은 조회·도달·저장·공유가 공개되지 않아 좋아요(각 학교 자기 평소 대비)만
  const RXM = {
    reach: ['도달', '도달 평소 대비', '같은 형식 최근 1년 도달 중간값 대비', '팔로워 밖까지 넓게 닿았어요.'],
    save: ['저장', '저장률', '저장 ÷ 도달', '나중에 다시 보려고 저장한 사람이 많아요.'],
    share: ['공유', '공유율', '공유 ÷ 도달', '친구에게 보내거나 퍼 간 사람이 많아요.'],
    like: ['좋아요', '좋아요율', '좋아요 ÷ 조회', '본 사람 중 좋아요를 누른 비율이 높아요.'],
    blike: ['좋아요', '좋아요 평소 대비', '학교마다 자기 평소 좋아요 대비', ''],
  };
  const rxKeysOf = ch => ch === '인스타그램' ? ['save', 'share', 'reach'] : ch === '유튜브' ? ['share', 'like'] : ch === 'hong._.video' ? ['save', 'share', 'reach', 'like'] : ['blike'];
  const rxDef = (k, ch) => k === 'share' && ch === '유튜브' ? '공유 ÷ 조회' : RXM[k][2];
  function rxRate(it, k) {
    if (it.x || frozen(it) || it.t === '스토리' || !rxKeysOf(it.c).includes(k) || k === 'reach' || k === 'blike') return null;
    const v = last(it); if (!v) return null;
    if (it.c === '인스타그램' || (it.c === 'hong._.video' && k !== 'like')) { if (!(it.r >= 300)) return null; const c = v[k === 'save' ? 4 : 3]; return c == null ? null : c / it.r; }
    if (!(v[0] >= 500)) return null;
    if (k === 'share') return it.L && it.L[3] != null && it.L[0] > 0 && it.L[0] >= v[0] * 0.8 ? it.L[3] / it.L[0] : null;
    return v[1] == null ? null : v[1] / v[0];
  }
  const RXB = {};
  const rxRaw = (it, k) => { if (k === 'reach') return it.r > 0 && !it.x && !frozen(it) && !young(it) ? it.r : null; if (k === 'blike') { const v = last(it); return young(it) || it.ad || !v ? null : v[1]; } return rxRate(it, k); };
  const rxBase = (ch, k, t) => {
    const key = ch + '|' + k + '|' + (t || '');
    if (!(key in RXB)) {
      const pk = f => D.items.filter(x => x.c === ch && !x.ad && x.t !== '스토리' && x.d >= addDays(D.updated, -365) && f(x)).map(x => rxRaw(x, k)).filter(v => v != null);
      let a = t ? pk(x => x.t === t) : pk(() => true); if (t && a.length < BASE_T_MIN) a = pk(() => true);
      RXB[key] = median(a) || null;
    }
    return RXB[key];
  };
  const rxTypeVal = (it, k) => { const v = rxRaw(it, k), b = v == null ? null : rxBase(it.c, k); return b ? v / b : null; };
  // 평소 대비(배). 도달·타 대학 좋아요는 조회처럼 쌓이는 값이라 판정 전(14일 미만) 게시물은 뺌
  const rxVal = (it, k) => {
    if (k === 'reach') return young(it) ? null : reachRatio(it);
    if (k === 'blike') return young(it) || it.ad ? null : ratio(it);
    const v = rxRate(it, k), b = v == null ? null : rxBase(it.c, k, it.t);
    return b ? v / b : null;
  };
  // 전략 화면 「저장·공유가 많은 콘텐츠」: 형식별·분류별(타 대학은 학교 × 형식) 평소 대비 중간값 막대
  function rxSec(chs, L) {
    const bench = !ownIn(chs).length, ch = chs.length === 1 ? chs[0] : null;
    if (!bench && !ch) return null;
    const keys = rxKeysOf(bench ? null : ch);
    if (!keys.includes(S.rxK)) S.rxK = keys[0];
    const k = S.rxK, M = RXM[k];
    const rowsBy = (key, fv) => {
      const g = {};
      L.forEach(it => { if (fv(it, k) == null) return; const gk = key(it); if (gk) (g[gk] = g[gk] || []).push(it); });
      return Object.entries(g).map(([gk, arr]) => ({ k: gk, n: arr.length, idx: median(arr.map(it => fv(it, k))), raw: median(arr.map(it => rxRate(it, k))), few: false })).filter(r => r.n >= MIN_N).sort(byIdx);
    };
    // 형식별 = 채널 전체 대비, 분류별 = 같은 형식 대비. 타 대학은 학교 × 분류(같은 형식 대비)
    const T = rowsBy(it => fmtType(it.t), rxTypeVal), G = bench ? rowsBy(it => it.g ? chName(it.c) + ' · ' + it.g : null, rxVal) : rowsBy(it => it.g, rxVal);
    // 형식별 아랫줄에만 실제 비율(분류별 막대는 같은 형식 대비라 비율을 함께 쓰면 헷갈림)
    const sub = r => r.n + '개' + (r.raw != null ? ' · ' + M[1] + ' ' + pctA(r.raw) : ''), subG = r => r.n + '개';
    const nm = bench ? '학교 × 분류' : '분류', mn = M[1].replace(/ 평소 대비$/, '');
    const best = G[0], worst = G.length > 1 ? G[G.length - 1] : null;
    const head = bench ? '좋아요가 많은 형식·분류' : ch === '인스타그램' || ch === 'hong._.video' ? '저장·공유가 많은 콘텐츠' : ch === '유튜브' ? '공유·좋아요가 많은 콘텐츠' : '좋아요가 많은 콘텐츠';
    const seg = keys.length > 1 ? '<div class="seg" id="rxBy" aria-label="반응 기준">' + keys.map(x => '<button type="button" data-v="' + x + '" aria-pressed="' + (k === x) + '">' + (x === 'reach' ? '도달' : RXM[x][1]) + '</button>').join('') + '</div>' : '';
    const base = bench || k === 'reach' ? null : rxBase(ch, k);
    const html = secOpen(head, periodPhrase() + ' 게시물 · ' + mn + ' 평소 대비 중간값 · 세로선 1배보다 길면 평소보다 많아요', seg) +
      '<dl class="defs"><div><dt>' + M[1] + '</dt><dd>' + rxDef(k, ch) + '</dd></div><div><dt>분류별 막대</dt><dd>' + (bench ? '학교마다 ' : '') + '같은 형식 최근 1년 중간값 대비</dd></div><div><dt>형식별 막대</dt><dd>' + (bench ? '학교마다 ' : '') + '채널 전체 최근 1년 중간값 대비' + (base ? ' · ' + pctA(base) : '') + '</dd></div>' + (bench ? '<div><dt>공개 범위</dt><dd>타 대학은 조회·도달·저장·공유가 공개되지 않아요</dd></div>' : '') + '</dl>' +
      (best ? '<p class="note">' + mn + ' 가장 높은 ' + nm + ' ' + esc(best.k) + ' · 평소의 ' + xf(best.idx) + ' · ' + best.n + '개' + (worst ? ' / 가장 낮은 ' + nm + ' ' + esc(worst.k) + ' · ' + xf(worst.idx) + ' · ' + worst.n + '개' : '') + '</p>' : '') +
      '<div class="two">' + (T.length > 1 ? '<div><h3>형식별</h3><div class="bars" id="rxT"></div></div>' : '') + '<div><h3>' + nm + '별</h3><div class="bars" id="rxG"></div></div></div>' + secClose;
    return { html, T, G, sub, subG, bench, k };
  }
  function reactTable(ch, cats) {
    const all = pool({ channels: [ch], since: addDays(D.updated, -365) });
    // [이름, 값, 표기, 역할 키, 역할 이름, 짧은 머리글]. 인스타 첫 열은 이름 그대로 도달 배수(같은 형식 1년 도달 중간값 대비, 팀 규칙 「캐러셀은 도달로 비교」)
    let cols;
    if (ch === '인스타그램') cols = [
      ['도달 평소 대비', reachRatio, xf, 'reach', '도달형', '도달'],
      ['저장률', it => it.r > 0 ? ((last(it) || [])[4] || 0) / it.r : null, pctA, 'save', '정보형', '저장'],
      ['공유율', it => it.r > 0 ? ((last(it) || [])[3] || 0) / it.r : null, pctA, 'share', '확산형', '공유'],
      ['댓글률', it => it.r > 0 ? ((last(it) || [])[2] || 0) / it.r : null, pctA, 'talk', '대화형', '댓글'],
    ];
    else if (ch === '유튜브') cols = [
      ['조회 평소 대비', it => ratio(it), xf, 'reach', '도달형', '조회'],
      ['시청 완료율', completion, pct, 'save', '몰입형', '끝까지'],
      ['좋아요율', likeRate, pctA, 'share', '호감형', '좋아요'],
      ['공유율', it => rxRate(it, 'share'), pctA, 'talk', '확산형', '공유'],
    ];
    else cols = [
      ['조회 평소 대비', it => ratio(it), xf, 'reach', '도달형', '조회'],
      ['좋아요율', likeRate, pctA, 'share', '호감형', '좋아요'],
      ['댓글률', it => { const v = last(it); return v && v[0] > 0 ? (v[2] || 0) / v[0] : null; }, pctA, 'talk', '대화형', '댓글'],
    ];
    const baseCol = cols.map(c => median(all.map(c[1])) || null);
    const rows = cats.filter(r => r.n >= MIN_N).map(r => {
      const vals = cols.map(c => median(r.arr.map(c[1])));
      const rel = vals.map((v, i) => v != null && baseCol[i] ? v / baseCol[i] : null);
      let bi = -1, bv = 1.2; rel.forEach((x, i) => { if (x != null && x > bv) { bv = x; bi = i; } });
      return { k: r.k, n: r.n, vals, rel, role: bi < 0 ? ['avg', '고른 편'] : [cols[bi][3], cols[bi][4]] };
    });
    if (!rows.length) return '<div class="empty">분류별 게시물이 ' + MIN_N + '개 이상인 분류가 없어요.</div>';
    // 게시 수는 분류 아래 작은 글씨로 합치고 머리글은 짧게(400px에서 잘리지 않게), 긴 이름은 마우스 올림
    return '<div class="tw"><table class="tbl compact rt"><thead><tr><th>분류</th>' + cols.map(c => '<th class="n" title="' + c[0] + '">' + c[5] + '</th>').join('') + '<th>역할</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + esc(r.k) + '<small class="mu" style="display:block">' + r.n + '개</small></td>' + r.vals.map((v, i) => '<td class="n ' + (r.rel[i] != null && r.rel[i] >= 1 ? 'hi' : 'lo') + '">' + cols[i][2](v) + '</td>').join('') + '<td><span class="role ' + r.role[0] + '">' + r.role[1] + '</span></td></tr>').join('') +
      '<tr><td style="color:var(--muted)">채널 평소</td>' + baseCol.map((v, i) => '<td class="n" style="color:var(--muted)">' + cols[i][2](i === 0 ? 1 : v) + '</td>').join('') + '<td></td></tr>' +
      '</tbody></table></div>';
  }

  // ═════════ 3. 제작·홍보대사 ═════════
  const SCORE = v => v == null ? 0 : v >= 1e6 ? 10 : v >= 5e5 ? 5 : v >= 1e5 ? 1 : v >= 1e4 ? 0.1 : -0.1;
  function peopleStats(L) {
    const m = {};
    L.forEach(it => (it.w || []).forEach(n => { (m[n] = m[n] || []).push(it); }));
    return Object.entries(m).map(([n, arr]) => {
      const best = arr.slice().sort((a, b) => (mainVal(b) || 0) - (mainVal(a) || 0))[0];
      return { n, role: (D.roles || {})[n] || '근로장학생', k: arr.length, views: sum(arr.map(it => val(it, 0))), idx: median(arr.map(ratio)), hits: arr.filter(isHit).length, score: Math.round(sum(arr.map(it => SCORE(val(it, 0)))) * 10) / 10, best, arr };
    });
  }
  function viewMaker() {
    if (S.ch === '타 대학') return msgView('타 대학은 제작 주체 정보가 없어요.', '타 대학 비교는 홈에서 볼 수 있어요.', ['타 대학 비교 보기', () => { S.view = 'brief'; render(); }]);
    const chs = viewChannels();
    const L = pool({ channels: chs, ads: true });
    const noAd = L.filter(it => !it.ad), ads = L.filter(it => !!it.ad);
    const prod = groupBy(noAd, 'p').sort(byIdx);
    const own = prod.find(r => r.k === '자체 제작'), amb = prod.find(r => r.k === '홍보대사'), ws = prod.find(r => r.k === '근로장학생');
    let call = '';
    // 한 줄 결론(높은 쪽 먼저) · 게시물 5개 미만 묶음은 결론에서 뺌 · 비교 막대는 위에 이미 있음
    const wsOk = ws && ws.n >= MIN_N && ws.idx != null;
    if (own && amb && own.idx != null && amb.idx != null) { const hi = amb.idx >= own.idx ? ['홍보대사', amb, '자체 제작', own] : ['자체 제작', own, '홍보대사', amb];
      call = periodPhrase() + ' 게시물당 조회 <b>' + hi[0] + ' ' + xf(hi[1].idx) + '</b> · ' + hi[2] + ' ' + xf(hi[3].idx) + (wsOk ? ' · 근로장학생 ' + xf(ws.idx) : '') + '<small>평소 = 같은 형식 게시물 조회의 중간값</small>'; }
    const DEF = { '자체 제작': '캡션에 제작자 이름이 없는 홍보실 제작물', '근로장학생': '크레딧 이름 중 홍보대사 명단에 없는 사람', '광고 영상': '광고를 집행한 게시물 · 유튜브는 구글애즈, 인스타는 메타 · 비교에서 빼고 따로 표시' };
    const shown = prod.map(r => r.k).concat(ads.length ? ['광고 영상'] : []);
    let html = secOpen('제작 주체별 효율', '누가 만든 게시물의 조회가 평소의 몇 배였는지 · 중간값 · 광고 영상은 따로') +
      '<div class="two"><div><div class="bars" id="byProd"></div>' + (call ? '<div class="callout">' + call + '</div>' : '') + '</div><div>' +
      '<div class="tw"><table class="tbl compact"><thead><tr><th>제작</th><th class="n">게시</th><th class="n">잘 된<br>비율</th><th class="n">조회<br>합계</th><th class="n">게시물당<br>조회</th></tr></thead><tbody>' +
      prod.concat(ads.length ? [{ k: '광고 영상', n: ads.length, hit: null, arr: ads, v: median(ads.map(mainVal)) }] : []).map(r => '<tr><td>' + ptag(r.k) + '</td><td class="n">' + r.n + '</td><td class="n">' + pct0(r.hit) + '</td><td class="n">' + fmtK(sum(r.arr.map(mainVal))) + '</td><td class="n">' + fmtK(r.v) + '</td></tr>').join('') +
      '</tbody></table></div><dl class="defs">' + Object.keys(DEF).filter(k => shown.includes(k)).map(k => '<div><dt>' + k + '</dt><dd>' + DEF[k] + '</dd></div>').join('') + '</dl></div></div>' + secClose;
    // 사람별
    let ps = peopleStats(noAd);
    if (S.roleF !== '전체') ps = ps.filter(p => p.role === S.roleF);
    const sk = { n: p => p.k, views: p => p.views, idx: p => p.idx || 0, hits: p => p.hits, score: p => p.score }[S.psort] || (p => p.k);
    ps.sort((a, b) => sk(b) - sk(a));
    const roleChips = ['전체', '홍보대사', '근로장학생', '서포터즈'].map(r => '<button class="chip" type="button" data-r="' + r + '" aria-pressed="' + (S.roleF === r) + '">' + r + '</button>').join('');
    const th = (k, l) => '<th class="n"><button type="button" data-s="' + k + '"' + (S.psort === k ? ' data-dir="desc"' : '') + '>' + l + '</button></th>';
    html += secOpen('사람별 성과', '캡션 크레딧에 적힌 이름 기준 · 팀 콘텐츠는 참여자 모두에게 똑같이 집계해요<span class="tiers"><b>등급 점수 · 게시물 조회별</b><span>100만↑ +10점</span><span>50만↑ +5점</span><span>10만↑ +1점</span><span>1만↑ +0.1점</span><span>1만 미만 −0.1점</span></span>',
      '<button class="btn" type="button" id="pXls">엑셀로 받기</button>') +
      '<div class="chips">' + roleChips + '</div>' +
      '<div class="tw"><table class="tbl" id="pTbl"><thead><tr><th>이름</th><th>역할</th>' + th('n', '참여') + th('views', '조회 합') + th('idx', '조회 평소 대비') + th('hits', '잘 된 게시물') + th('score', '등급 점수') + '<th>최고 콘텐츠</th></tr></thead><tbody>' +
      ps.map(p => '<tr class="click' + (S.person === p.n ? ' on' : '') + '" data-n="' + esc(p.n) + '"><td><b>' + esc(p.n) + '</b></td><td>' + ptag(p.role) + '</td><td class="n">' + p.k + '</td><td class="n">' + fmtK(p.views) + '</td><td class="n ' + (p.idx == null || p.k < MIN_N ? 'mu' : xCls(p.idx)) + '">' + xf(p.idx) + '</td><td class="n">' + p.hits + '</td><td class="n ' + (p.score >= 0 ? 'up' : 'down') + '">' + (p.score > 0 ? '+' : '') + p.score + '</td><td><div class="ellip">' + line(p.best) + '</div></td></tr>' +
        (S.person === p.n ? '<tr><td colspan="8" style="padding:0 0 10px;white-space:normal"><ol class="rank" id="pList">' + rankRows(p.arr.slice().sort((a, b) => b.d < a.d ? -1 : 1).slice(0, 10)) + '</ol>' + (p.arr.length > 10 ? '<p class="note">최근 10개만 보여요. 전체 목록은 「엑셀로 받기」나 「데이터 추출 → 사람」에서 받을 수 있어요.</p>' : '') + '</td></tr>' : '')).join('') +
      (ps.length ? '' : '<tr><td colspan="8" class="empty">' + periodPhrase() + ' 동안 크레딧에 이름이 있는 콘텐츠가 없어요.</td></tr>') +
      '</tbody></table></div><p class="note">이름을 누르면 그 사람이 참여한 콘텐츠가 펼쳐져요. 역할이 틀렸다면 스냅샷 시트 「명단」 탭에서 고칠 수 있어요.</p>' + secClose;
    $('view').innerHTML = html.replace(/^<div class="gap"><\/div>/, '');
    bars('byProd', prod, subN);
    $('view').querySelectorAll('.chips [data-r]').forEach(b => b.addEventListener('click', () => { S.roleF = b.dataset.r; S.person = null; viewMaker(); }));
    $('view').querySelectorAll('#pTbl th button').forEach(b => b.addEventListener('click', () => { S.psort = b.dataset.s; viewMaker(); }));
    $('view').querySelectorAll('#pTbl tr[data-n]').forEach(tr => tr.addEventListener('click', () => { S.person = S.person === tr.dataset.n ? null : tr.dataset.n; viewMaker(); }));
    if (S.person) { const p = ps.find(x => x.n === S.person); if (p) wireRank($('pList'), p.arr.slice().sort((a, b) => b.d < a.d ? -1 : 1).slice(0, 10)); }
    $('pXls').addEventListener('click', () => {
      const head = ['이름', '역할', '참여 콘텐츠', '조회 합', '조회 평소 대비(중간값, 배)', '잘 된 게시물 수', '등급 점수', '최고 콘텐츠', '최고 콘텐츠 조회'];
      const rows = ps.map(p => [p.n, p.role, p.k, p.views, p.idx == null ? null : +p.idx.toFixed(2), p.hits, p.score, title(p.best.n), val(p.best, 0)]);
      const detail = [['이름', '역할', '게시일', '채널', '형식', '분류', '제목', '조회', '좋아요', '댓글', '조회 평소 대비(배)', '등급 점수']];
      ps.forEach(p => p.arr.forEach(it => { const v = last(it) || []; detail.push([p.n, p.role, it.d, chName(it.c), fmtType(it.t), it.g, title(it.n), v[0], v[1], v[2], ratio(it) == null ? null : +ratio(it).toFixed(2), SCORE(v[0])]); }));
      writeXlsx('사람별성과_' + rangeLabel() + '_' + D.updated, [['사람별 성과', [head].concat(rows)], ['참여 콘텐츠', detail], ['조건', [['채널', chs.join(', ')], ['기간', rangeLabel() + ' (게시일 기준)'], ['역할', S.roleF], ['기준 데이터', D.updated], ['등급 점수', '상벌점표 조회 기준: 100만 +10, 50만 +5, 10만 +1, 1만 +0.1, 1만 미만 -0.1']]]]);
    });
  }

  // ═════════ 4. 입시 시즌 ═════════
  function seasons() {
    const ds = D.items.map(it => it.d).sort();
    const y0 = +ds[0].slice(0, 4), y1 = +D.updated.slice(0, 4);
    const out = [];
    for (let y = Math.max(y0, 2019); y <= y1; y++) {
      out.push({ id: y + '수시', name: (y + 1) + '학년도 수시', per: (y % 100) + '.8~9월', label: (y + 1) + '학년도 수시 · ' + y + '.8~9월', from: y + '-08-01', to: y + '-09-30' });
      out.push({ id: y + '정시', name: (y + 1) + '학년도 정시', per: (y % 100) + '.12~' + ((y + 1) % 100) + '.1월', label: (y + 1) + '학년도 정시 · ' + y + '.12~' + (y + 1) + '.1월', from: y + '-12-01', to: (y + 1) + '-01-31' });
    }
    return out.filter(s => s.from <= D.updated && s.to >= ds[0]).reverse();
  }
  function seasonStats(s) {
    const L = pool({ channels: viewChannels(), since: s.from, until: s.to, ads: true });
    const org = L.filter(it => !it.ad), ad = L.filter(it => !!it.ad);
    const adm = org.filter(it => it.g === '입시·모집');
    const rws = (D.ads && D.ads.rows) || [];
    const daily = (D.ads && D.ads.daily) || [];
    const cost = rws.length ? sum(rws.filter(x => x[1] >= s.from && x[1] <= s.to).map(x => x[2])) : sum(daily.filter(x => x[0] >= s.from && x[0] <= s.to).map(x => x[1]));
    const covered = D.ads && D.ads.end >= s.from;
    const camps = ((D.ads && D.ads.camps) || []).filter(c => c.from <= s.to && c.to >= s.from);
    return { L, org, ad, adm, cost, covered, camps, orgV: sum(org.map(it => val(it, 0))), adV: sum(ad.map(it => val(it, 0))), idx: median(org.map(ratio)), hit: hitRate(org), admIdx: median(adm.map(ratio)) };
  }
  function viewSeason() {
    if (S.ch === '타 대학') return msgView('입시 시즌 리포트는 우리 채널 기준이에요.', '타 대학의 입시·모집 콘텐츠 성과는 탐색 → 분류 「입시·모집」에서 볼 수 있어요.', ['탐색에서 보기', () => { S.view = 'explore'; S.g = '입시·모집'; render(); }]);
    const ss = seasons();
    if (!S.season || !ss.find(s => s.id === S.season)) S.season = ss[0] && ss[0].id;
    const s = ss.find(x => x.id === S.season);
    if (!s) { $('view').innerHTML = '<section class="sec"><div class="empty">입시 시즌 데이터가 없어요.</div></section>'; return; }
    const st = seasonStats(s);
    const selHtml = '<select class="selbox" id="seasonSel">' + ss.map(x => '<option value="' + x.id + '"' + (x.id === s.id ? ' selected' : '') + '>' + esc(x.label) + '</option>').join('') + '</select>';
    let html = '<section class="sec"><div class="sh"><div><h2>입시 시즌 리포트</h2><p>수시 8~9월 · 정시 12~1월 · ' + esc(scopeLabel()) + ' · 수치는 ' + mdLabel(D.updated) + ' 기준 누적</p></div>' + selHtml + '</div>' +
      // 홈과 같은 정사각형 KPI 4장(짝수) · 이름·설명은 한 줄, 정의는 마우스 올림
      '<div class="kpi-row n4">' +
        kpiTile('시즌 게시물', st.org.length + '<small>개</small>', '입시·모집 ' + st.adm.length + '개' + (st.admIdx == null ? '' : ' · 조회 평소의 ' + xf(st.admIdx))) +
        kpiTile('<span title="광고 영상 조회 제외">자연 조회</span>', fmtK(st.orgV), '평소의 ' + xf(st.idx) + ' · 잘 된 ' + pct0(st.hit)) +
        kpiTile('<span title="구글애즈 계정 전체 · 동영상·디스플레이 · 위 채널 탭과 관계없음">구글애즈 광고비</span>', st.covered ? fmtK(st.cost) + '<small>원</small>' : '–', st.covered ? (st.adV ? '조회 1회당 ' + fmt(st.cost / st.adV) + '원' : '연결된 광고 영상 없음') : '리포트 ' + dot(D.ads ? D.ads.end : '') + '까지') +
        kpiTile('광고 영상', st.ad.length + '<small>개</small>', '조회 ' + fmtK(st.adV) + (st.covered ? ' · 캠페인 ' + st.camps.length + '개' : '')) +
      '</div></section>';
    const SEA_M = [['idx', '조회 평소 대비', '게시물당 조회 평소 대비'], ['orgV', '자연 조회', '자연 조회'], ['n', '게시 수', '게시 수'], ['hit', '잘 된 비율', '잘 된 비율']];
    if (!SEA_M.some(m => m[0] === S.seaM)) S.seaM = 'idx';
    html += secOpen('해마다 비교', '수시·정시를 연도순으로 놓았어요 · 막대를 누르면 그 시즌을 봐요', '<div class="seg" id="seaM" aria-label="비교할 숫자">' + SEA_M.map(m => '<button type="button" data-m="' + m[0] + '" aria-pressed="' + (S.seaM === m[0]) + '">' + m[1] + '</button>').join('') + '</div>') +
      '<div class="chart"><canvas id="yoyChart"></canvas></div><p class="note">' + (S.seaM === 'orgV' ? '자연 조회는 오래된 시즌일수록 조회가 쌓인 기간이 길어 많아 보여요. 해마다 견주려면 「게시물당 조회 평소 대비」를 보세요.' : S.seaM === 'idx' ? '1배 = 그 채널·형식의 평소 수준. 시즌 게시물이 평소보다 잘 됐는지를 해마다 같은 잣대로 봐요.' : S.seaM === 'hit' ? '시즌 게시물 중 평소의 1.5배 이상 나온 비율이에요.' : '시즌 동안 올린 게시물 수 · 광고 제외') + '</p><p class="note"><span class="lg"><i style="background:var(--jj)"></i>수시</span><span class="lg"><i style="background:var(--ai)"></i>정시</span><span class="mu">* 일부 기간만 모인 시즌</span></p>' + secClose;
    // 주별 차트: 광고 조회가 자연 조회의 5배를 넘으면 한 축에 쌓으면 자연 조회가 안 보이므로 x축을 같이 쓰는 차트 두 개로 위아래로 나눔(이중 축은 쓰지 않음)
    const weeks = []; for (let w = s.from; w <= s.to; w = addDays(w, 7)) weeks.push(w);
    const wkOf = d => weeks.filter(x => x <= d).pop();
    const orgW = weeks.map(x => sum(st.org.filter(it => wkOf(it.d) === x).map(it => val(it, 0)))), adW = weeks.map(x => sum(st.ad.filter(it => wkOf(it.d) === x).map(it => val(it, 0))));
    const seaSplit = sum(adW) > sum(orgW) * 5 && sum(orgW) > 0;
    html += secOpen('주별 게시 콘텐츠 조회', '주마다 올린 콘텐츠의 현재 누적 조회 · ' + (seaSplit ? '위는 자연 조회, 아래는 광고 조회 · 같은 주끼리 위아래로 맞춰 봐요' : '광고 영상과 나머지를 나눠 보여줘요')) +
      (seaSplit ? '<div class="chart" style="height:170px"><canvas id="seaChart"></canvas></div><div class="chart" style="height:150px;margin-top:8px"><canvas id="seaChart2"></canvas></div>' : '<div class="chart tall"><canvas id="seaChart"></canvas></div>') + secClose;
    const admSorted = st.adm.slice().sort((a, b) => (ratio(b) || 0) - (ratio(a) || 0));
    const topSorted = st.org.slice().sort((a, b) => (ratio(b) || 0) - (ratio(a) || 0)).slice(0, 8);
    // 입시·모집 콘텐츠가 없으면 빈 칸 대신 가장 잘 된 목록만 한 열로(KPI에 0개가 이미 나옴)
    html += secOpen('시즌 콘텐츠', '') + (st.adm.length ? '<div class="two"><div><h3>입시·모집 콘텐츠</h3><p class="d">평소보다 잘 된 순</p><ol class="rank" id="sAdm">' + rankRows(admSorted) + '</ol></div>' +
      '<div><h3>시즌 중 가장 잘 된 콘텐츠</h3><p class="d">분류와 관계없이 · 광고 제외</p><ol class="rank" id="sTop">' + rankRows(topSorted) + '</ol></div></div>'
      : '<h3 class="sub">시즌 중 가장 잘 된 콘텐츠</h3><p class="d">분류와 관계없이 · 광고 제외 · 이 시즌엔 입시·모집 분류 콘텐츠가 없어요</p><ol class="rank wide" id="sTop">' + rankRows(topSorted) + '</ol>') + secClose;
    // 시즌 비교 — 게시물도 광고도 없는 시즌 줄(hong 시작 전 등)은 숨김(계산 데이터는 그대로)
    const ssRows = ss.map(x => ({ x, t: seasonStats(x) })), ssShow = ssRows.filter(r => r.t.org.length || r.t.ad.length || r.x.id === s.id), ssHid = ssRows.length - ssShow.length;
    html += secOpen('시즌별 비교', '최근 시즌은 조회가 쌓인 기간이 짧아 적게 보일 수 있어요') +
      '<div class="tw"><table class="tbl"><thead><tr><th>시즌</th><th class="n">게시</th><th class="n">입시<br>콘텐츠</th><th class="n">자연<br>조회</th><th class="n">광고<br>조회</th><th class="n">광고비</th><th class="n" title="게시물당 조회 평소 대비 중간값">평소<br>대비</th><th class="n">잘 된<br>비율</th></tr></thead><tbody>' +
      ssShow.map(({ x, t }) => { const cn = covNote(viewChannels(), x.from); return '<tr class="click' + (x.id === s.id ? ' on' : '') + '" data-s="' + x.id + '"><td class="sn"><b>' + esc(x.name) + '</b>' + (cn ? ' <span class="tag p-guess" title="' + esc(cn) + '">일부</span>' : '') + '<small>' + esc(x.per) + '</small></td><td class="n">' + t.org.length + '</td><td class="n">' + t.adm.length + '</td><td class="n">' + fmtK(t.orgV) + '</td><td class="n">' + (t.ad.length ? fmtK(t.adV) : '<span class="mu" title="연결된 광고 영상 없음">–</span>') + '</td><td class="n">' + (t.covered ? fmtK(t.cost) + '원' : '–') + '</td><td class="n">' + xf(t.idx) + '</td><td class="n">' + pct0(t.hit) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' + (ssHid ? '<p class="note">게시물이 없는 시즌 ' + ssHid + '개는 뺐어요</p>' : '') +
      '<dl class="defs"><div><dt>일부</dt><dd>수집 전 기간이 섞임 · 유튜브 ' + dot(covFrom('유튜브') || '') + '부터 · 인스타 ' + dot(covFrom('인스타그램') || '') + '부터</dd></div><div><dt>광고비</dt><dd>구글애즈 동영상·디스플레이 · ' + dot(D.ads ? D.ads.end : '') + '까지</dd></div><div><dt>광고 조회</dt><dd>캠페인에 연결된 유튜브 영상 조회</dd></div></dl>' + secClose;
    $('view').innerHTML = html;
    $('seasonSel').addEventListener('change', e => { S.season = e.target.value; viewSeason(); });
    $('seaM').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.seaM = b.dataset.m; viewSeason(); }));
    // 해마다 비교 그래프: 수시 = 블루, 정시 = 보라, 고른 시즌만 진하게
    const chron = ss.slice().reverse(); let ys = chron.map(x => { const t = seasonStats(x); return { x, cn: covNote(viewChannels(), x.from), v: S.seaM === 'idx' ? t.idx : S.seaM === 'orgV' ? t.orgV : S.seaM === 'n' ? t.org.length : (t.hit == null ? null : t.hit * 100) }; });
    while (ys.length > 1 && (ys[0].v == null || ys[0].v === 0) && ys[0].x.id !== s.id) ys.shift(); // 값이 없는 앞쪽 시즌(수집 범위 밖)은 그리지 않음
    const ycol = y => { const c = css(/정시$/.test(y.x.id) ? '--ai' : '--jj'); return y.x.id === s.id ? c : c + '59'; };
    const yfmt = v => v == null ? '–' : S.seaM === 'idx' ? xf(v) : S.seaM === 'hit' ? Math.round(v) + '%' : S.seaM === 'n' ? v + '개' : fmtK(v);
    draw('yoyChart', { type: 'bar', data: { labels: ys.map(y => /수시$/.test(y.x.id) ? "'" + y.x.id.slice(2, 4) + (y.cn ? '*' : '') : ''), datasets: [{ data: ys.map(y => y.v), backgroundColor: ys.map(ycol), borderRadius: 3, maxBarThickness: 36 }] },
      options: chartOpts({ onClick: (e, els) => { if (!els.length) return; S.season = ys[els[0].index].x.id; viewSeason(); }, layout: { padding: { top: 20 } },
        plugins: { tooltip: { callbacks: { title: it => ys[it[0].dataIndex].x.label, label: c => SEA_M.find(m => m[0] === S.seaM)[2] + ' ' + yfmt(c.raw) } } },
        scales: { x: { ticks: { autoSkip: false, maxRotation: 0, font: { size: 12 } } }, y: { display: true, grid: { color: css('--line') }, ticks: { maxTicksLimit: 4, callback: v => S.seaM === 'idx' ? (+v).toFixed(1) + '배' : yfmt(v) } } } }),
      plugins: S.seaM !== 'idx' ? [] : [{ id: 'one', afterDatasetsDraw(c) { const y = c.scales.y.getPixelForValue(1), a = c.chartArea; if (y < a.top || y > a.bottom) return; const x = c.ctx; x.save(); x.setLineDash([4, 4]); x.strokeStyle = css('--muted'); x.lineWidth = 1; x.beginPath(); x.moveTo(a.left, y); x.lineTo(a.right, y); x.stroke(); x.setLineDash([]); x.font = '600 12px ' + css('--font'); x.fillStyle = css('--muted'); x.fillText('평소', a.left + 4, y - 5); x.restore(); } }] });
    $('view').querySelectorAll('tr[data-s]').forEach(tr => tr.addEventListener('click', () => { S.season = tr.dataset.s; viewSeason(); window.scrollTo({ top: 0 }); }));
    wireRank($('sAdm'), admSorted); wireRank($('sTop'), topSorted);
    // 주별 차트
    const cnt = weeks.map(x => st.org.filter(it => wkOf(it.d) === x).length), wl = weeks.map(md2);
    const orgDs = { label: '자연 조회', data: orgW, backgroundColor: css('--jj'), borderRadius: 3, stack: 's' }, adDs = { label: '광고 조회', data: adW, backgroundColor: css('--ad'), borderColor: css('--jj'), borderWidth: 1, borderRadius: 3, stack: 's' };
    const tip = { displayColors: true, callbacks: { label: c => c.dataset.label + ' ' + fmt(c.raw), afterBody: it => '게시 ' + cnt[it[0].dataIndex] + '개' } };
    const yAx = { display: true, grid: { color: css('--line') }, ticks: { maxTicksLimit: 4, callback: v => fmtK(v) }, afterFit: a => { a.width = 52; } };
    if (seaSplit) {
      draw('seaChart', { type: 'bar', data: { labels: wl, datasets: [orgDs] }, options: chartOpts({ layout: { padding: { top: 22 } }, plugins: { title: { display: true, text: '자연 조회', align: 'start', color: css('--sub'), font: { size: 13, weight: '700' }, padding: { bottom: 12 } }, tooltip: tip }, scales: { x: { ticks: { display: false } }, y: yAx } }) });
      draw('seaChart2', { type: 'bar', data: { labels: wl, datasets: [adDs] }, options: chartOpts({ layout: { padding: { top: 22 } }, plugins: { title: { display: true, text: '광고 조회', align: 'start', color: css('--sub'), font: { size: 13, weight: '700' }, padding: { bottom: 12 } }, tooltip: tip }, scales: { x: { ticks: { font: { size: 13 } } }, y: yAx } }) });
    } else draw('seaChart', { type: 'bar', data: { labels: wl, datasets: [orgDs, adDs] },
      options: chartOpts({ plugins: { legend: { display: true, position: 'bottom' }, tooltip: tip }, scales: { x: { stacked: true, ticks: { font: { size: 13 } } }, y: Object.assign({ stacked: true }, yAx) } }) });
  }

  // ═════════ 광고 (구글애즈) ═════════
  // D.ads: { end, camps:[{n,from,to,imp,cost,clk,videos,conf}], rows:[[캠페인번호, 날짜, 비용, 노출, 클릭]], plans:[{n,from,to,budget,goal,videos,memo}] }
  const vidOf = u => { const m = /(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : ''; };
  function adRows() {
    const A = D.ads || {};
    if (A.rows && A.rows.length) return A.rows;
    return [];
  }
  function adVideosOf(c) {
    // 캠페인에 연결된 영상(대시보드 콘텐츠)
    return D.items.filter(it => it.ad && it.ad.k && it.ad.k.includes(c.n));
  }
  function adStats(camps, from, to) {
    const A = D.ads || {}, rows = adRows();
    const idx = {}; (A.camps || []).forEach((c, i) => { idx[c.n] = i; });
    const set = new Set(camps.map(c => idx[c.n]));
    let cost = 0, imp = 0, clk = 0;
    if (rows.length) rows.forEach(r => { if (set.has(r[0]) && r[1] >= from && r[1] <= to) { cost += r[2]; imp += r[3]; clk += r[4]; } });
    else camps.forEach(c => { cost += c.cost; imp += c.imp; clk += c.clk; });
    return { cost, imp, clk, ctr: imp ? clk / imp : null, cpm: imp ? cost / imp * 1000 : null, cpc: clk ? cost / clk : null };
  }
  const won = v => v == null || isNaN(v) ? '–' : fmtK(v) + '원';
  const wonF = v => v == null || isNaN(v) ? '–' : fmt(v) + '원';
  const wonL = v => { if (v == null || isNaN(v)) return '–'; const e = Math.floor(v / 1e8), m = Math.round((v % 1e8) / 1e4); return e ? e + '억' + (m ? ' ' + fmt(m) + '만' : '') + '원' : fmt(m) + '만원'; };
  function viewAds() {
    const A = D.ads || {};
    const hasG = !!(A.camps && A.camps.length), hasM = !!(A.meta && A.meta.length);
    if (!hasG && !hasM) return msgView('광고 데이터가 아직 없어요.', '구글애즈 리포트 시트나 「메타 광고」 탭이 연결되면 여기서 광고비·노출·클릭과 광고 콘텐츠 성과를 볼 수 있어요.');
    // 매체는 위 채널 탭으로 정함: 인스타그램 = 메타, 유튜브 = 구글애즈(전체·hong·타 대학도 구글애즈, 한쪽만 있으면 그쪽)
    const pf = !hasG ? 'meta' : !hasM ? 'google' : S.ch === '인스타그램' ? 'meta' : 'google';
    if (S.adPf !== pf) { S.adPf = pf; S.adYear = 'all'; S.adOpen = null; }
    const seg = ''; // 매체 안내는 「계정」 칩에
    if (pf === 'meta') viewMeta(seg); else viewGoogle(seg);
  }
  const usd = v => v == null || isNaN(v) ? '–' : '$' + (Math.abs(v) >= 100 ? fmt(Math.round(v)) : (+v).toFixed(2));
  // 월별 집행: 이중 축 대신 x축을 같이 쓰는 막대 차트 두 개(위 광고비 · 아래 노출). 36달이 넘으면 분기로 묶음
  const adPairHtml = (a, b) => '<div class="chart" style="height:180px"><canvas id="' + a + '"></canvas></div><div class="chart" style="height:150px;margin-top:8px"><canvas id="' + b + '"></canvas></div>';
  function adBuckets(months, cost, imp) {
    if (months.length <= 36) return { labs: months.map(k => k.slice(2, 4) + '.' + k.slice(5, 7)), c: months.map(k => cost[k] || 0), i: months.map(k => imp[k] || 0), unit: '월' };
    const q = k => k.slice(0, 4) + '-Q' + Math.ceil(+k.slice(5, 7) / 3), ks = uniq(months.map(q));
    const agg = o => ks.map(x => sum(months.filter(k => q(k) === x).map(k => o[k] || 0)));
    return { labs: ks.map(x => x.slice(2, 4) + '년 ' + x.slice(6) + '분기'), c: agg(cost), i: agg(imp), unit: '분기' };
  }
  // 축 눈금용 짧은 숫자(쉼표 없이): 6000만 · 1.2억
  const axK = v => Math.abs(v) >= 1e8 ? (v / 1e8).toFixed(1).replace(/\.0$/, '') + '억' : Math.abs(v) >= 1e4 ? Math.round(v / 1e4) + '만' : fmt(v);
  function drawAdPair(a, b, B, costF) {
    const xOpt = show => ({ ticks: { display: show, maxTicksLimit: 8, maxRotation: 0, autoSkip: true, font: { size: 13 } }, grid: { display: false } });
    const yOpt = (f, n) => ({ display: true, position: 'left', grid: { color: css('--line') }, ticks: { callback: f, maxTicksLimit: n, font: { size: 13 } }, afterFit: s => { s.width = 52; } });
    const ttl = t => ({ display: true, text: t, align: 'start', color: css('--sub'), font: { size: 13, weight: '700' }, padding: { bottom: 12 } });
    const hov = { interaction: { mode: 'index', intersect: false } };
    draw(a, { type: 'bar', data: { labels: B.labs, datasets: [{ label: '광고비', data: B.c, backgroundColor: css('--ad'), borderColor: css('--jj'), borderWidth: 1, borderRadius: 3, barPercentage: 1, categoryPercentage: 0.9 }] },
      options: chartOpts(Object.assign({}, hov, { layout: { padding: { top: 22 } }, plugins: { title: ttl(B.unit + '별 광고비'), tooltip: { callbacks: { label: c => '광고비 ' + (B.money ? B.money(c.raw) : costF(c.raw)) } } }, scales: { x: xOpt(false), y: yOpt(costF, 4) } })) });
    draw(b, { type: 'bar', data: { labels: B.labs, datasets: [{ label: '노출', data: B.i, backgroundColor: css('--jj'), borderRadius: 3, barPercentage: 1, categoryPercentage: 0.9 }] },
      options: chartOpts(Object.assign({}, hov, { layout: { padding: { top: 22 } }, plugins: { title: ttl(B.unit + '별 노출'), tooltip: { callbacks: { label: c => '노출 ' + fmtK(c.raw) + '회' } } }, scales: { x: xOpt(true), y: yOpt(axK, 3) } })) });
  }
  const META_RT = { post_engagement: '게시물 참여', link_click: '링크 클릭', visit_instagram_profile: '프로필 방문', video_view: '영상 조회', landing_page_view: '랜딩 페이지 조회', reach: '도달' };
  function viewMeta(seg) {
    const M = D.ads.meta;
    const yr = c => /^\d{4}/.test(c.end) ? c.end.slice(0, 4) : D.updated.slice(0, 4);
    const years = [...new Set(M.map(yr))].sort().reverse();
    if (!S.adYear || (S.adYear !== 'all' && !years.includes(S.adYear))) S.adYear = 'all';
    const camps = M.filter(c => S.adYear === 'all' || yr(c) === S.adYear);
    const T = { spend: sum(camps.map(c => c.spend)), imp: sum(camps.map(c => c.imp)), reach: sum(camps.map(c => c.reach)), clk: sum(camps.map(c => c.clk)) };
    const paid = camps.filter(c => c.spend > 0);
    const posts = [...new Set(camps.flatMap(c => c.posts || []))];
    const ends = M.map(c => c.end).filter(e => /^\d{4}/.test(e)).sort();
    const yChips = '<div class="chips">' + ['all'].concat(years).map(y => '<button class="chip" type="button" data-y="' + y + '" aria-pressed="' + (S.adYear === y) + '">' + (y === 'all' ? '전체' : y + '년') + '</button>').join('') + '</div>';
    const mk = c => /^\d{4}-\d{2}/.test(c.end) ? c.end.slice(0, 7) : D.updated.slice(0, 7);
    // API 캠페인은 mo(월별 [YYYY-MM, 지출, 노출])로 실제 집행한 달에, 수동 보고서 캠페인은 종료월에
    const ks = camps.flatMap(c => c.mo && c.mo.length ? c.mo.map(x => x[0]) : [mk(c)]).sort();
    const months = []; if (ks.length) { let m = ks[0] + '-01'; while (m.slice(0, 7) <= ks[ks.length - 1]) { months.push(m.slice(0, 7)); m = monthStart(m, 1); } }
    const ms = {}, mi = {}; camps.forEach(c => (c.mo && c.mo.length ? c.mo : [[mk(c), c.spend, c.imp]]).forEach(([k, s, i]) => { ms[k] = (ms[k] || 0) + (s || 0); mi[k] = (mi[k] || 0) + (i || 0); }));
    const MB = Object.assign(adBuckets(months, ms, mi), { money: usd });
    let html = seg + '<section class="sec"><div class="sh"><div><h2>광고 성과</h2><p>메타 광고 관리자 · 캠페인 종료일 ' + dot(ends[0]) + ' ~ ' + dot(ends[ends.length - 1]) + (M.some(c => !/^\d{4}/.test(c.end)) ? ' · 진행 중 포함' : '') + ' · 달러 기준</p></div></div>' +
      (M.some(c => c.api)
        ? '<div class="callout">메타 광고 API로 <b>매일 자동</b>으로 받아요(어제까지). 월별 추이는 <b>실제로 집행한 달</b>에 나눠 넣었어요' + (M.some(c => !c.api) ? ' · API 이전 캠페인은 종료월 기준이에요' : '') + '.<small>도달은 캠페인 전체 기간 값이에요. 날짜별 도달은 같은 사람이 겹쳐서 더할 수 없어요.</small></div>'
        : '<div class="callout">보고서는 캠페인별 <b>전체 기간 합계</b>라서 월별 추이는 <b>종료월</b> 기준으로 묶었어요.<small>새 보고서는 광고 관리자에서 같은 형식으로 내보내 스냅샷 시트 「메타 광고」 탭에 붙여넣으면 다음 갱신 때 반영돼요.</small></div>') +
      yChips +
      // 정사각형 KPI 4장 + 바닥 스파크라인(월별) · 설명은 한 줄, 나머지 단가는 아래 칩
      '<div class="kpi-row n4">' +
        kpiTile('광고비', usd(T.spend), '집행 캠페인 ' + paid.length + '개', '', spark(MB.c, MB.unit + '별 광고비')) +
        kpiTile('노출', fmtK(T.imp), '1천 회당 ' + usd(T.imp ? T.spend / T.imp * 1000 : null), '', spark(MB.i, MB.unit + '별 노출')) +
        kpiTile('<span title="캠페인끼리 겹치는 사람도 따로 셌어요">도달 · 캠페인 합</span>', fmtK(T.reach), '캠페인별 도달의 합', '') +
        kpiTile('링크 클릭', fmtK(T.clk), '클릭률 ' + pct(T.imp ? T.clk / T.imp : null), '') +
      '</div><div class="chips ad-chips"><span class="chip" aria-pressed="true">클릭당 ' + usd(T.clk ? T.spend / T.clk : null) + '</span></div></section>';
    html += secOpen('월별 집행', (M.some(c => c.api) ? '집행한 달 기준' : '종료월 기준') + ' · 위는 광고비, 아래는 노출 · 같은 ' + (MB.unit === '월' ? '달' : '분기') + '끼리 위아래로 맞춰 봐요') + adPairHtml('mChart', 'mChart2') + secClose;
    const sk = S.mSort || 'spend';
    const rows = camps.map(c => ({ c, ctr: c.imp ? (c.clk || 0) / c.imp : null, cpc: c.clk ? c.spend / c.clk : null, views: sum((c.posts || []).map(it => val(it, 0))) }));
    const key = { spend: r => r.c.spend || 0, imp: r => r.c.imp || 0, reach: r => r.c.reach || 0, clk: r => r.c.clk || 0, ctr: r => r.ctr || 0, cpc: r => -(r.cpc || 1e12), end: r => r.c.end }[sk];
    rows.sort((a, b) => { const x = key(a), y = key(b); return x < y ? 1 : x > y ? -1 : 0; });
    const th = (k, l) => '<th class="n"><button type="button" data-ms="' + k + '"' + (sk === k ? ' data-dir="desc"' : '') + '>' + l + '</button></th>';
    const st = c => ({ completed: '완료', inactive: '중지', archived: '보관', active: '진행 중' })[c.st] || c.st || '';
    html += secOpen('캠페인별 성과', '이름을 누르면 홍보한 인스타 게시물이 펼쳐져요') +
      '<div class="tw"><table class="tbl" id="mTbl"><thead><tr><th>캠페인</th><th>종료</th>' + th('spend', '광고비') + th('imp', '노출') + th('reach', '도달') + th('clk', '링크 클릭') + th('ctr', '클릭률') + th('cpc', '클릭당') + '<th>목표 결과</th></tr></thead><tbody>' +
      rows.map((r, i) => { const n = (r.c.posts || []).length; return '<tr class="click' + (S.adOpen === r.c.n ? ' on' : '') + '" data-mi="' + i + '"><td><div class="ellip" style="max-width:300px"><b>' + esc(metaLabel(r.c.n)) + '</b></div>' + manTag(r.c) + (n ? '<span class="tag p-own">게시물 ' + n + '개 연결</span>' : /^Instagram 게시물/.test(r.c.n) ? '<span class="tag">게시물 데이터 없음</span>' : '<span class="tag">별도 광고</span>') + ' <span class="tag">' + esc(st(r.c)) + '</span></td><td>' + (/^\d{4}/.test(r.c.end) ? dot(r.c.end) : esc(r.c.end)) + '</td><td class="n">' + usd(r.c.spend) + '</td><td class="n">' + fmtK(r.c.imp) + '</td><td class="n">' + fmtK(r.c.reach) + '</td><td class="n">' + fmtK(r.c.clk) + '</td><td class="n">' + pct(r.ctr) + '</td><td class="n">' + usd(r.cpc) + '</td><td>' + (r.c.res != null ? fmt(r.c.res) + ' ' + esc(META_RT[r.c.rt] || r.c.rt || '') : '–') + '</td></tr>' +
        (S.adOpen === r.c.n ? '<tr><td colspan="9" style="padding:0 0 10px;white-space:normal">' + (n ? '<ol class="rank" id="mPosts">' + rankRows(r.c.posts, { right: it => '조회 <span class="num">' + fmtK(val(it, 0)) + '</span>' }) + '</ol>' : '<p class="note">' + (/^Instagram 게시물/.test(r.c.n) ? '이 게시물은 대시보드 수집 기간(2024년~) 밖이거나 캡션이 바뀌어 찾지 못했어요.' : '게시물 홍보가 아닌 별도 광고예요.') + '</p>') + '</td></tr>' : ''); }).join('') +
      '</tbody></table></div><p class="note">캠페인 이름(게시물 캡션 앞부분)으로 인스타 게시물을 찾아 연결했어요. 연결된 게시물은 「광고」 표시가 붙고 평소 계산에서 빠져요 · 상단 버튼이 「광고 제외」일 때는 목록·합계에서도 빠져요.</p>' + secClose;
    if (posts.length) {
      const top = posts.slice().sort((a, b) => (val(b, 0) || 0) - (val(a, 0) || 0)).slice(0, 15);
      html += secOpen('광고한 인스타 게시물', '메타 광고로 홍보한 게시물 · 조회 많은 순') + '<ol class="rank" id="mTop">' + rankRows(top, { right: it => '조회 <span class="num">' + fmtK(val(it, 0)) + '</span> · 좋아요 ' + fmt(val(it, 1)) }) + '</ol>' + secClose;
      $('view').innerHTML = html; wireRank($('mTop'), top);
    } else $('view').innerHTML = html;
    $('view').querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', () => { S.adYear = b.dataset.y; S.adOpen = null; viewAds(); }));
    $('view').querySelectorAll('[data-ms]').forEach(b => b.addEventListener('click', () => { S.mSort = b.dataset.ms; viewAds(); }));
    $('view').querySelectorAll('#mTbl tr[data-mi]').forEach(tr => tr.addEventListener('click', () => { const n = rows[+tr.dataset.mi].c.n; S.adOpen = S.adOpen === n ? null : n; viewAds(); }));
    if (S.adOpen && $('mPosts')) { const r = rows.find(x => x.c.n === S.adOpen); if (r) wireRank($('mPosts'), r.c.posts); }
    drawAdPair('mChart', 'mChart2', MB, v => '$' + axK(v));
  }
  function viewGoogle(seg) {
    const A = D.ads;
    const years = [...new Set(A.camps.flatMap(c => [c.from.slice(0, 4), c.to.slice(0, 4)]))].sort().reverse();
    if (!S.adYear || (S.adYear !== 'all' && !years.includes(S.adYear))) S.adYear = 'all';
    const from = S.adYear === 'all' ? '2000-01-01' : S.adYear + '-01-01', to = S.adYear === 'all' ? '2999-12-31' : S.adYear + '-12-31';
    const camps = A.camps.filter(c => c.from <= to && c.to >= from);
    const tot = adStats(camps, from, to);
    const vids = D.items.filter(it => it.ad && it.ad.k && it.ad.k.length && camps.some(c => it.ad.k.includes(c.n)));
    const vv = sum(vids.map(it => val(it, 0)));
    const YTc = covFrom('유튜브') || '2000-01-01';
    const lcamps = camps.filter(c => c.videos && c.videos.length && c.from >= YTc);
    const linkedCost = adStats(lcamps, from, to).cost;
    const lv = sum(D.items.filter(it => it.ad && it.ad.k && lcamps.some(c => it.ad.k.includes(c.n))).map(it => val(it, 0)));
    const stale = A.end && daysBetween(A.end, D.updated) > 14;
    const daily = (A.camps || []).filter(c => !c.manual).map(c => c.to).sort().pop() || '';
    const manual = (A.camps || []).filter(c => c.manual);
    const yChips = '<div class="chips">' + ['all'].concat(years).map(y => '<button class="chip" type="button" data-y="' + y + '" aria-pressed="' + (S.adYear === y) + '">' + (y === 'all' ? '전체' : y + '년') + '</button>').join('') + '</div>';
    // 월별 값(KPI 스파크라인 · 월별 집행 차트에 같이 씀)
    const months = [], rr = adRows();
    const first = S.adYear === 'all' ? A.camps[0].from.slice(0, 7) : S.adYear + '-01';
    const last = S.adYear === 'all' ? A.end.slice(0, 7) : (S.adYear + '-12' > A.end.slice(0, 7) ? A.end.slice(0, 7) : S.adYear + '-12');
    for (let m = first + '-01'; m.slice(0, 7) <= last; m = monthStart(m, 1)) months.push(m.slice(0, 7));
    const mc = {}, mi = {}, mk2 = {};
    rr.forEach(r => { const k = r[1].slice(0, 7); mc[k] = (mc[k] || 0) + r[2]; mi[k] = (mi[k] || 0) + r[3]; mk2[k] = (mk2[k] || 0) + (r[4] || 0); });
    if (!rr.length) (A.daily || []).forEach(x => { const k = x[0].slice(0, 7); mc[k] = (mc[k] || 0) + x[1]; mi[k] = (mi[k] || 0) + x[2]; });
    const GB = Object.assign(adBuckets(months, mc, mi), { money: wonF }), GK = adBuckets(months, mk2, mi);
    let html = seg + '<section class="sec"><div class="sh"><div><h2>광고 성과</h2><p>구글애즈 계정 전체 · ' + dot(A.camps[0].from) + ' ~ ' + dot(A.end) + '</p></div></div>' +
      '<dl class="defs"><div><dt>범위</dt><dd>동영상 · 디스플레이 광고</dd></div><div><dt>계정</dt><dd>구글애즈 계정 전체 · 메타는 인스타그램 탭</dd></div></dl>' +
      (manual.length ? '<div class="callout">일별 리포트는 <b>' + dot(daily) + '</b>까지예요. 그 뒤 광고 ' + manual.length + '개는 결과 보고 수치를 <b>캠페인 합계</b>로 넣었어요(「광고 추가 입력」 탭).<small>합계 입력분은 월별 그래프에서 종료월에 모여 보여요. 스냅샷 시트 「구글애즈 리포트」 탭에 일별 보고서를 붙여 넣으면 같은 캠페인은 자동으로 일별 값으로 바뀌어요.</small></div>' : '') +
      
      yChips +
      // 정사각형 KPI 4장 + 바닥 스파크라인 · 설명은 한 줄 비교 하나, 나머지 단가는 아래 칩
      '<div class="kpi-row n4">' +
        kpiTile('광고비', wonL(tot.cost), '캠페인 ' + camps.length + '개', '', spark(GB.c, GB.unit + '별 광고비')) +
        kpiTile('노출', fmtK(tot.imp), '1천 회당 ' + wonF(tot.cpm), '', spark(GB.i, GB.unit + '별 노출')) +
        kpiTile('클릭', fmtK(tot.clk), '클릭률 ' + pct(tot.ctr), '', rr.length ? spark(GK.c, GK.unit + '별 클릭') : '') +
        kpiTile('유튜브 광고 영상 조회', fmtK(vv), '1회당 ' + (lv ? wonF(linkedCost / lv) : '–'), '') +
      '</div><div class="chips ad-chips"><span class="chip" aria-pressed="true">클릭당 ' + wonF(tot.cpc) + '</span><span class="chip" aria-pressed="true">광고 영상 ' + vids.length + '개</span></div></section>';
    html += secOpen('월별 집행', '위는 광고비, 아래는 노출 · 같은 ' + (GB.unit === '월' ? '달' : '분기') + '끼리 위아래로 맞춰 봐요') + adPairHtml('adChart', 'adChart2') + secClose;
    // 계획
    const plans = (A.plans || []).filter(p => p.n);
    if (plans.length) {
      html += secOpen('집행 계획 대비', '스냅샷 시트 「광고 계획」 탭 기준 · 캠페인 이름에 계획 이름이 들어간 캠페인을 합산해요') +
        '<div class="tw"><table class="tbl"><thead><tr><th>계획</th><th>기간</th><th class="n">예산</th><th class="n">집행</th><th>소진율</th><th class="n">기간 경과</th><th class="n">클릭률</th><th>목표</th><th>메모</th></tr></thead><tbody>' +
        plans.map(p => {
          const cs = A.camps.filter(c => c.n.includes(p.n));
          const st = adStats(cs, p.from || '2000-01-01', p.to || '2999-12-31');
          const used = p.budget ? st.cost / p.budget : null;
          const total = p.from && p.to ? daysBetween(p.from, p.to) + 1 : null;
          const el = total ? Math.min(1, Math.max(0, (daysBetween(p.from, D.updated) + 1) / total)) : null;
          return '<tr><td><b>' + esc(p.n) + '</b>' + (cs.length ? '' : ' <span class="tag p-guess">캠페인 없음</span>') + '</td><td>' + (p.from ? dot(p.from) : '') + ' ~ ' + (p.to ? dot(p.to) : '') + '</td><td class="n">' + won(p.budget) + '</td><td class="n">' + won(st.cost) + '</td>' +
            '<td><div class="pbar"><i style="width:' + Math.min(100, (used || 0) * 100) + '%"></i></div><small>' + pct0(used) + '</small></td><td class="n">' + pct0(el) + '</td><td class="n">' + pct(st.ctr) + '</td><td>' + esc(p.goal || '') + '</td><td class="w">' + esc(p.memo || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' + secClose;
    } else {
      // 계획이 없으면 안내 상자 대신 한 줄(적는 법은 종 알림)
      html += secOpen('집행 계획', '') + '<p class="note">시트 「광고 계획」 탭에 적으면 여기 예산 소진율이 보여요 · 적는 법은 오른쪽 위 알림</p>' + secClose;
    }
    // 캠페인 표
    const sk = S.adSort || 'cost';
    const YT0 = covFrom('유튜브') || '2000-01-01';
    const rows = camps.map(c => {
      const st = adStats([c], from, to);
      const vs = adVideosOf(c), views = sum(vs.map(it => val(it, 0)));
      const part = c.from < YT0;
      return { c, st, vs, views, part, cpv: views && !part ? st.cost / views : null };
    });
    const key = { cost: r => r.st.cost, imp: r => r.st.imp, clk: r => r.st.clk, ctr: r => r.st.ctr || 0, cpc: r => -(r.st.cpc || 1e12), views: r => r.views, cpv: r => -(r.cpv || 1e12), from: r => r.c.from }[sk];
    rows.sort((a, b) => key(b) - key(a) || (key(b) > key(a) ? 1 : -1));
    const th = (k, l) => '<th class="n"><button type="button" data-as="' + k + '"' + (sk === k ? ' data-dir="desc"' : '') + '>' + l + '</button></th>';
    const unlinked = rows.filter(r => !r.vs.length).length;
    // 좁은 화면은 표 대신 한 줄 카드 목록, 넓은 화면은 표 · 둘 다 처음 20개만 보이고 「더 보기」(행은 빼지 않고 접기만)
    const mob = window.matchMedia && matchMedia('(max-width:760px)').matches, shownN = S.adShown || 20;
    const vtag = r => r.vs.length ? '<span class="tag ' + (r.c.conf === '확인' ? 'p-own' : 'p-guess') + '">영상 ' + r.vs.length + '개 · ' + esc(r.c.conf || '추정') + '</span>' : '<span class="tag">영상 연결 없음</span>';
    const openRow = r => r.vs.length ? '<ol class="rank" id="adVids">' + rankRows(r.vs, { right: it => '조회 <span class="num">' + fmtK(val(it, 0)) + '</span>' }) + '</ol>' : '<p class="note">연결된 영상이 없어요. 디스플레이·이미지 광고이거나 연결할 영상을 못 찾은 캠페인이에요. 스냅샷 시트 「광고 매핑」 탭에 유튜브 영상 ID를 넣으면 연결돼요.</p>';
    html += secOpen('캠페인별 성과', '이름을 누르면 연결된 영상이 펼쳐져요') + (mob
      ? '<ol class="rank adc" id="adTblM">' + rows.slice(0, shownN).map((r, i) => '<li class="rk" tabindex="0" data-ci="' + i + '"><span class="no">' + (i + 1) + '</span><span class="t"><b class="ln"><span class="tx">' + esc(r.c.n) + '</span></b><span>' + dot(r.c.from) + ' ~ ' + dot(r.c.to) + '</span></span><span class="rv"><b class="num">' + won(r.st.cost) + '</b><small>노출 ' + fmtK(r.st.imp) + ' · 클릭률 ' + pct(r.st.ctr) + '</small></span><span class="tg">' + manTag(r.c) + vtag(r) + '</span></li>' + (S.adOpen === r.c.n ? '<li class="adc-open">' + openRow(r) + '</li>' : '')).join('') + '</ol>'
      : '<div class="tw"><table class="tbl" id="adTbl"><thead><tr><th>캠페인</th><th>기간</th>' + th('cost', '광고비') + th('imp', '노출') + th('clk', '클릭') + th('ctr', '클릭률') + th('cpc', '클릭당') + th('views', '영상 조회') + th('cpv', '<span title="조회 1회당 비용 · 연결된 영상의 현재 조회 기준">조회당</span>') + '</tr></thead><tbody>' +
      rows.slice(0, shownN).map((r, i) => '<tr class="click' + (S.adOpen === r.c.n ? ' on' : '') + '" data-ci="' + i + '"><td><div class="ellip"><b>' + esc(r.c.n) + '</b></div>' + manTag(r.c) + vtag(r) + '</td><td>' + dot(r.c.from) + ' ~ ' + dot(r.c.to) + '</td><td class="n">' + won(r.st.cost) + '</td><td class="n">' + fmtK(r.st.imp) + '</td><td class="n">' + fmtK(r.st.clk) + '</td><td class="n">' + pct(r.st.ctr) + '</td><td class="n">' + wonF(r.st.cpc) + '</td><td class="n">' + (r.vs.length ? fmtK(r.views) + (r.part ? '<sup class="pt">일부</sup>' : '') : '–') + '</td><td class="n">' + (r.cpv ? wonF(r.cpv) : '–') + '</td></tr>' +
        (S.adOpen === r.c.n ? '<tr><td colspan="9" style="padding:0 0 10px;white-space:normal">' + openRow(r) + '</td></tr>' : '')).join('') +
      '</tbody></table></div>') + (rows.length > shownN ? '<button class="more" id="adMore" type="button">더 보기 › ' + (rows.length - shownN) + '개</button>' : '') +
      // 각주 대신 용어 칩
      '<dl class="defs"><div><dt>확인</dt><dd>제목·게시일이 맞는 연결</dd></div><div><dt>추정</dt><dd>시기·조회 흐름으로 짐작한 연결</dd></div>' + (unlinked ? '<div><dt>영상 연결 없음 ' + unlinked + '개</dt><dd>디스플레이·이미지 광고 등</dd></div>' : '') + (rows.some(r => r.part && r.vs.length) ? '<div><dt>일부</dt><dd>' + dot(YT0) + ' 이전 시작 · 조회당 비용 계산 안 함</dd></div>' : '') + '<div><dt>고치기</dt><dd>시트 「광고 매핑」 탭</dd></div></dl>' + secClose;
    // 광고 영상
    const top = vids.slice().sort((a, b) => (val(b, 0) || 0) - (val(a, 0) || 0)).slice(0, 15);
    html += secOpen('광고 영상', '캠페인과 연결된 유튜브 영상 · 조회 많은 순') + '<ol class="rank" id="adTop">' + rankRows(top, { right: it => '조회 <span class="num">' + fmtK(val(it, 0)) + '</span> · <span title="광고 조회에는 좋아요가 거의 붙지 않아요">좋아요 ' + fmt(val(it, 1)) + '</span>' }) + '</ol>' + secClose;
    $('view').innerHTML = html;
    $('view').querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', () => { S.adYear = b.dataset.y; S.adOpen = null; viewAds(); }));
    $('view').querySelectorAll('[data-as]').forEach(b => b.addEventListener('click', () => { S.adSort = b.dataset.as; viewAds(); }));
    $('view').querySelectorAll('#adTbl tr[data-ci], #adTblM li[data-ci]').forEach(tr => { const go = () => { const n = rows[+tr.dataset.ci].c.n; S.adOpen = S.adOpen === n ? null : n; viewAds(); }; tr.addEventListener('click', go); if (tr.tagName === 'LI') tr.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
    if ($('adMore')) $('adMore').addEventListener('click', () => { S.adShown = shownN + 30; viewAds(); });
    if (S.adOpen) { const r = rows.find(x => x.c.n === S.adOpen); if (r && r.vs.length) wireRank($('adVids'), r.vs); }
    wireRank($('adTop'), top);
    drawAdPair('adChart', 'adChart2', GB, axK);
  }

  // ═════════ 5. 타 대학 ═════════
  // 팔로워(D.fol = [[날짜, 계정, 팔로워]]): 그 날짜 또는 바로 전 기록, 없으면 7일 안의 다음 기록
  function folAt(ch, d) {
    const L = (D.fol || []).filter(r => r[1] === ch);
    let b = null; for (const r of L) { if (r[0] <= d) b = r; else { if (!b && daysBetween(d, r[0]) <= 7) b = r; break; } }
    return b ? b[2] : null;
  }
  function folGrowth(ch) {
    const L = (D.fol || []).filter(r => r[1] === ch); if (L.length < 2) return null;
    const z = L[L.length - 1], from = addDays(z[0], -30), a = L.find(r => r[0] >= from) || L[0], days = daysBetween(a[0], z[0]);
    return days >= 7 && a[2] > 0 ? { r: (z[2] - a[2]) / a[2], d: z[2] - a[2], days, now: z[2] } : null;
  }
  function viewBench() {
    const schools = ['인스타그램'].concat(benchNames());
    const f = since();
    const data = schools.map(ch => {
      const all = D.items.filter(it => it.c === ch && it.t !== '스토리');
      const L = all.filter(it => !f || it.d >= f);
      const latest = all.map(it => it.d).sort().pop();
      // 기간 시작이 수집 시작보다 앞이면 수집 시작일부터 센다(타 대학은 2026-04부터 수집)
      const first = all.map(it => it.d).sort()[0];
      const span = Math.max(7, daysBetween(!f || (first && first > f) ? first : f, D.updated));
      const likes = L.map(it => val(it, 1));
      const reels = L.filter(it => /릴스/.test(it.t)).length;
      const cr = median(L.map(it => { const v = last(it); return v && v[1] > 0 ? (v[2] || 0) / v[1] : null; }));
      const cats = groupBy(L, 'g').map(r => ({ k: r.k, n: r.n, idx: median(r.arr.map(likeRatio)) })).sort((a, b) => b.n - a.n);
      const hidden = L.length >= 5 && median(likes) === 0;
      const reelV = median(L.filter(it => /릴스/.test(it.t)).map(it => val(it, 0)).filter(v => v > 0));
      // 팔로워당 반응 = (좋아요 + 댓글) ÷ 게시일 팔로워, 게시물별 값의 중간값(규모가 달라도 견줄 수 있게)
      const erF = hidden ? null : median(L.map(it => { const v = last(it), fo = folAt(ch, it.d); return v && fo > 0 ? ((v[1] || 0) + (v[2] || 0)) / fo : null; }));
      const eng = hidden ? null : sum(L.map(it => { const v = last(it); return v ? (v[1] || 0) + (v[2] || 0) : 0; }));
      return { ch, L, latest, hidden, reelV, n: L.length, perWeek: L.length / (span / 7), like: median(likes), cr, reels: L.length ? reels / L.length : null, cats, erF, eng, gr: folGrowth(ch), fol: folAt(ch, D.updated) };
    });
    let html = secOpen('한눈에 비교', periodPhrase() + ' 게시물 · 타 대학은 릴스만 조회가 공개돼 <b>좋아요</b>로 비교해요 · 규모보다 운영 방식을 보는 용도예요') +
      '<div class="tw"><table class="tbl"><thead><tr><th>계정</th><th>최근 게시</th><th class="n">게시</th><th class="n">주당 게시</th><th class="n">게시물당 좋아요</th><th class="n">릴스 조회 중간값</th><th class="n">댓글/좋아요</th><th class="n">릴스 비중</th></tr></thead><tbody>' +
      data.map(d => '<tr><td>' + badge(d.ch) + ' <span style="color:var(--muted);font-size:var(--fs-xs)">' + esc(d.ch === '인스타그램' ? '우리' : d.ch) + '</span></td><td>' + (d.latest ? (x => x <= 0 ? '오늘' : x <= 30 ? x + '일 전' : dot(d.latest))(daysBetween(d.latest, D.updated)) + (daysBetween(d.latest, D.updated) > 14 ? ' <span class="tag st-warn">수집 지연</span>' : '') + (D.stale && D.stale[d.ch] ? ' <span class="tag st-warn" title="최근 두 기록의 값이 모두 같아요">원본 미갱신</span>' : '') : '–') + '</td><td class="n">' + d.n + '</td><td class="n">' + (d.perWeek ? '주 ' + d.perWeek.toFixed(1) + '개' : '–') + '</td><td class="n">' + (d.hidden ? '<span style="color:var(--muted)">비공개</span>' : fmtK(d.like)) + '</td><td class="n">' + fmtK(d.reelV) + '</td><td class="n">' + (d.hidden ? '–' : pct(d.cr)) + '</td><td class="n">' + pct0(d.reels) + '</td></tr>').join('') +
      '</tbody></table></div>' + secClose;
    // 팔로워로 보정한 비교
    const hasFol = data.some(d => d.fol);
    // 팔로워 자료가 없으면 섹션을 숨기고(자료가 들어오면 그대로 나옴) 준비 안내는 종 알림으로
    if (hasFol) html += secOpen('팔로워 규모를 감안하면', '팔로워 수가 달라도 견줄 수 있게 팔로워 한 명당으로 나눴어요') + (hasFol ?
      '<div class="tw"><table class="tbl"><thead><tr><th>계정</th><th class="n">팔로워</th><th class="n" title="(좋아요+댓글) ÷ 게시일 팔로워, 게시물별 중간값">팔로워당 반응</th><th class="n">최근 30일 팔로워</th></tr></thead><tbody>' +
      data.map(d => '<tr' + (d.ch === '인스타그램' ? ' class="on"' : '') + '><td>' + badge(d.ch) + '</td><td class="n">' + (d.fol ? fmt(d.fol) + '명' : '–') + '</td><td class="n">' + (d.hidden ? '<span class="mu">좋아요 비공개</span>' : pct(d.erF)) + '</td><td class="n">' + (d.gr ? '<span class="' + (d.gr.d > 0 ? 'up' : d.gr.d < 0 ? 'down' : 'flat') + '">' + sgn(d.gr.d) + fmt(d.gr.d) + '명 (' + sgn(d.gr.r) + (Math.abs(d.gr.r) * 100).toFixed(1) + '%)</span>' + (d.gr.days < 28 ? ' <span class="mu">' + d.gr.days + '일치</span>' : '') : '–') + '</td></tr>').join('') +
      '</tbody></table></div><p class="note">팔로워당 반응 = 게시물 하나의 (좋아요 + 댓글) ÷ 그날 팔로워 수, 게시물별 중간값 · 팔로워가 많은 계정일수록 이 값이 낮게 나오는 게 보통이에요</p>' :
      '<div class="wait">타 대학 팔로워 수는 매일 스냅샷 시트 「타대학 일별」 탭에 쌓이고 있어요. 보드로 가져오는 업데이트를 배포하면 팔로워당 반응과 팔로워 증가가 여기에 나와요.</div>') + secClose;
    // 반응 점유율 vs 게시 점유율
    const vis = data.filter(d => !d.hidden && d.n), tn = sum(vis.map(d => d.n)), te = sum(vis.map(d => d.eng || 0));
    if (vis.length > 1 && tn && te) {
      const o = vis.find(d => d.ch === '인스타그램'), ps = o ? o.n / tn : 0, es = o ? (o.eng || 0) / te : 0;
      html += secOpen('올린 양 vs 받은 반응', periodPhrase() + ' · ' + vis.length + '곳 합계에서 각 계정이 차지한 비율' + (data.some(d => d.hidden) ? ' · 좋아요 비공개 계정은 뺐어요' : '')) +
        '<p class="lead-s">우리는 ' + vis.length + '곳 게시물의 <b>' + pct0(ps) + '</b>를 올리고, 좋아요·댓글의 <b>' + pct0(es) + '</b>를 받았어요. ' + (es > ps * 1.1 ? '올린 양보다 반응을 <b class="up">더 많이</b> 받고 있어요.' : es < ps * 0.9 ? '올린 양에 비해 반응이 <b class="down">적은 편</b>이에요.' : '올린 만큼 반응을 받고 있어요.') + '</p>' +
        '<div class="chart" style="height:150px"><canvas id="shareChart"></canvas></div>' + secClose;
      window.__share = vis;
    } else window.__share = null;
    // 분류 구성
    const catsAll = [...new Set(data.flatMap(d => d.cats.map(c => c.k)))];
    const share = data.map(d => { const o = {}; d.cats.forEach(c => { o[c.k] = d.n ? c.n / d.n : 0; }); return o; });
    const topCats = catsAll.map(k => ({ k, s: sum(share.map(o => o[k] || 0)) })).sort((a, b) => b.s - a.s).slice(0, 9).map(x => x.k);
    html += secOpen('무엇을 올리나 — 분류 구성', '계정별 게시물이 어떤 분류로 채워져 있는지') + '<div class="chart tall"><canvas id="mixChart"></canvas></div>' + secClose;
    // 잘 되는 분류 / 기회
    const ours = data[0];
    const opp = [];
    data.slice(1).filter(d => !d.hidden).forEach((d, i) => d.cats.filter(c => c.n >= MIN_N && c.idx >= 1.3).forEach(c => {
      const o = ours.cats.find(x => x.k === c.k);
      const ourShare = o ? o.n / Math.max(1, ours.n) : 0, theirShare = c.n / Math.max(1, d.n);
      if (!o || ourShare < theirShare || (o && o.idx < 1)) opp.push({ ch: d.ch, k: c.k, idx: c.idx, ourShare, theirShare, ourIdx: o ? o.idx : null });
    }));
    opp.sort((a, b) => b.idx - a.idx);
    html += secOpen('타 대학에서 잘 되는 분류', '계정별 평소 좋아요 대비 중간값 · 게시물 3개 이상인 분류만') +
      '<div class="tw"><table class="tbl bcat"><thead><tr><th>계정</th><th>1위</th><th>2위</th><th>3위</th></tr></thead><tbody>' +
      data.map(d => { if (d.hidden) return '<tr><td>' + badge(d.ch) + '</td><td colspan="3" style="color:var(--muted)">좋아요 비공개 · 비교 제외</td></tr>'; const t = d.cats.filter(c => c.n >= MIN_N && c.idx != null).sort((a, b) => b.idx - a.idx).slice(0, 3); return '<tr><td>' + badge(d.ch) + '</td>' + [0, 1, 2].map(i => '<td>' + (t[i] ? esc(t[i].k) + ' <b class="' + xCls(t[i].idx) + '">' + xf(t[i].idx) + '</b> <span style="color:var(--muted)">' + t[i].n + '개</span>' : '–') + '</td>').join('') + '</tr>'; }).join('') +
      '</tbody></table></div>' +
      // 벤치마킹 기회: 기회 하나에 한 줄 + 게시 비중 막대 2개(그 계정 · 우리)
      (opp.length ? '<div class="callout"><b>벤치마킹 기회</b><small>우리는 이 분류를 덜 올리거나 성과가 평소 이하예요</small>' + opp.slice(0, 3).map(o => '<div class="op-r"><span>' + chName(o.ch) + ' · ' + esc(o.k) + '</span><b class="num up">평소의 ' + xf(o.idx) + '</b></div>' +
        '<div class="op-s"><span>게시 비중</span><i><em style="width:' + pct0(o.theirShare) + '"></em></i><small>' + chName(o.ch) + ' ' + pct0(o.theirShare) + '</small><i><em class="o" style="width:' + pct0(o.ourShare) + '"></em></i><small>우리 ' + pct0(o.ourShare) + '</small></div>').join('') + '</div>' : '') + secClose;
    // 벤치마킹 후보
    const cand = data.slice(1).filter(d => !d.hidden).flatMap(d => d.L).filter(it => likeRatio(it) != null).sort((a, b) => likeRatio(b) - likeRatio(a)).slice(0, 10);
    html += secOpen('벤치마킹 후보 콘텐츠', '각 계정에서 평소보다 좋아요가 많이 나온 게시물') + '<ol class="rank" id="bCand">' + rankRows(cand, { right: it => '좋아요 <span class="num">' + fmtK(val(it, 1)) + '</span> · <em class="up">평소의 ' + xf(likeRatio(it)) + '</em>' }) + '</ol>' + secClose;
    $('view').innerHTML = html.replace(/^<div class="gap"><\/div>/, '');
    wireRank($('bCand'), cand);
    if (window.__share) {
      const V = window.__share, tn2 = sum(V.map(d => d.n)), te2 = sum(V.map(d => d.eng || 0));
      draw('shareChart', { type: 'bar', data: { labels: ['게시 수', '좋아요·댓글'], datasets: V.map(d => ({ label: d.ch === '인스타그램' ? '우리 인스타' : chName(d.ch), data: [d.n / tn2, (d.eng || 0) / te2], backgroundColor: chColor(d.ch), borderColor: css('--bg'), borderWidth: { left: 0, right: 2, top: 0, bottom: 0 }, borderSkipped: false, stack: 's', barPercentage: 0.7 })) },
        options: chartOpts({ indexAxis: 'y', layout: { padding: { top: 4 } }, plugins: { legend: { display: true, position: 'bottom' }, tooltip: { displayColors: true, callbacks: { label: c => c.dataset.label + ' ' + pct0(c.raw) } } }, scales: { x: { stacked: true, display: false, max: 1 }, y: { stacked: true, display: true, grid: { display: false }, border: { display: false }, ticks: { color: css('--sub'), font: { size: 13, weight: '700' } } } } }) });
    }
    // 분류 전용 팔레트(상태색·채널색과 겹치지 않음, 갈색·주황 없음)
    const pal = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => css('--cat-' + k));
    draw('mixChart', { type: 'bar', data: { labels: data.map(d => d.ch === '인스타그램' ? '우리 인스타' : chName(d.ch)), datasets: topCats.map((k, i) => ({ label: k, data: share.map(o => o[k] || 0), backgroundColor: pal[i % pal.length], stack: 's' })).concat([{ label: '그 외', data: share.map(o => Math.max(0, 1 - sum(topCats.map(k => o[k] || 0)))), backgroundColor: css('--line'), stack: 's' }]) },
      options: chartOpts({ indexAxis: 'y', layout: { padding: { top: 4 } }, plugins: { legend: { display: true, position: 'bottom' }, tooltip: { displayColors: true, callbacks: { label: c => c.dataset.label + ' ' + pct0(c.raw) } } }, scales: { x: { stacked: true, display: false, max: 1 }, y: { stacked: true, display: true, grid: { display: false }, border: { display: false }, ticks: { color: css('--sub'), font: { size: 13, weight: '700' } } } } }) });
  }

  // ═════════ 6. 콘텐츠 탐색 ═════════
  function viewExplore() {
    const html = '<section class="sec"><div class="sh"><div><h2>콘텐츠 동향</h2><p id="trendSub"></p></div><div class="seg" id="trendCh" hidden></div></div>' +
      '<div class="chips fade" id="gchips"></div><div class="tree" id="tree"></div><div class="legend"><span class="lg-c"><span class="chip" aria-pressed="true">크기 = ' + (S.ch === '타 대학' ? '좋아요' : '조회') + '</span><span class="chip" aria-pressed="true">색 = 평소 대비</span></span><span class="scale" id="scale"></span></div></section>' +
      secOpen('콘텐츠 순위', '<span id="rankSub"></span>') + '<div class="chips" id="rankTabs"></div><ol class="rank" id="rank"></ol><button class="more" id="rankMore" type="button">더 보기 ›</button>' + secClose +
      secOpen('전체 콘텐츠', '행을 누르면 상세 정보가 열려요 · 원하는 조건으로 뽑으려면 하단 「추출」을 쓰세요') + '<div class="tw"><table><thead><tr id="thead"></tr></thead><tbody id="tbody"></tbody></table></div><button class="more" id="tblMore" type="button">더 보기 ›</button>' + secClose;
    $('view').innerHTML = html;
    $('rankMore').addEventListener('click', () => { S.rankShown += 20; renderRank(); });
    $('tblMore').addEventListener('click', () => { S.tblShown += 50; renderTable(); });
    renderTrend(); renderRank(); renderTable();
  }
  const exploreList = (o) => pool(Object.assign({ channels: viewChannels() }, o || {}));
  function renderTrend() {
    const isAll = S.ch === '전체';
    $('trendCh').hidden = !isAll;
    if (isAll) {
      $('trendCh').innerHTML = OWN.map(c => '<button type="button" data-c="' + esc(c) + '" aria-pressed="' + (S.trendCh === c) + '">' + esc(c === 'hong._.video' ? 'hong' : c) + '</button>').join('');
      $('trendCh').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.trendCh = b.dataset.c; S.g = null; renderTrend(); save(); }));
    }
    const chs = isAll ? [S.trendCh] : viewChannels();
    const L = pool({ channels: chs });
    const groups = groupBy(L, 'g').sort((a, b) => b.n - a.n);
    const subs = S.g ? groupBy(L.filter(it => it.g === S.g && it.s), 's').sort((a, b) => b.n - a.n) : [];
    if (!subs.length) S.gs = null;
    const subHtml = subs.length ? '<span class="gsep"></span><button class="chip sub" type="button" data-gs="" aria-pressed="' + (!S.gs) + '">전체</button>' +
      subs.map(r => '<button class="chip sub" type="button" data-gs="' + esc(r.k) + '" aria-pressed="' + (S.gs === r.k) + '">' + esc(r.k) + ' <small>' + r.n + '</small></button>').join('') + '<span class="gsep"></span>' : '';
    $('gchips').innerHTML = '<button class="chip" type="button" data-g="" aria-pressed="' + (!S.g) + '">전체</button>' +
      groups.map(r => { const d = r.idx - 1; return '<button class="chip" type="button" data-g="' + esc(r.k) + '" aria-pressed="' + (S.g === r.k) + '">' + esc(r.k) + (r.idx == null ? '' : '<b class="' + dCls(d) + '">' + dTxt(d) + '</b>') + '</button>' + (S.g === r.k ? subHtml : ''); }).join('');
    const selC = $('gchips').querySelector('.chip[data-g][aria-pressed="true"]'); if (selC && S.g) $('gchips').scrollLeft = Math.max(0, selC.offsetLeft - 16);
    $('gchips').querySelectorAll('.chip[data-g]').forEach(b => b.addEventListener('click', () => { S.g = b.dataset.g || null; S.gs = null; renderTrend(); renderRank(); }));
    $('gchips').querySelectorAll('.chip[data-gs]').forEach(b => b.addEventListener('click', () => { S.gs = b.dataset.gs || null; renderTrend(); renderRank(); }));
    $('trendSub').textContent = (S.g ? S.g + (S.gs ? ' › ' + S.gs : '') + ' · ' : '') + periodPhrase() + ' 게시물 · 분류 옆 숫자는 ' + vW() + ' 평소 대비';
    const items = (S.g ? L.filter(it => it.g === S.g && (!S.gs || it.s === S.gs)) : L).filter(it => mainVal(it) > 0).sort((a, b) => mainVal(b) - mainVal(a)).slice(0, 18);
    const box = $('tree');
    if (!items.length) { box.innerHTML = '<div class="empty">조건에 맞는 콘텐츠가 없어요.</div>'; return; }
    const W = box.clientWidth, H = box.clientHeight;
    const rects = squarify(items.map(it => ({ it, w: mainVal(it) })), 0, 0, W, H);
    box.innerHTML = rects.map((r, i) => {
      const d = (ratio(r.it) || 0) - 1, area = r.w * r.h;
      // 아주 작은 네모는 제목도 숨기고 색만(눌러서 상세), 좁은 네모는 숫자를 두 줄로. 제목 원문은 그대로, 말줄임만
      const cls = (area < 9000 ? (area < 4500 ? 'tm s xs' : 'tm s') : 'tm') + (r.w < 90 ? ' narrow' : '') + (area < 2200 ? ' xxs' : '') + (heatLight(d) ? ' lt' : '');
      const rv = ratio(r.it);
      return '<button type="button" class="' + cls + '" data-i="' + i + '" title="' + esc(title(r.it.n)) + '" style="left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;background:' + heat(d) + '">' +
        '<span class="a">' + esc(title(r.it.n)) + '</span><span class="b num">' + fmtK(mainVal(r.it)) + (rv == null ? '' : '<span class="r"> · ' + xf(rv) + '</span>') + '</span></button>';
    }).join('');
    box.querySelectorAll('.tm').forEach(b => b.addEventListener('click', () => openDetail(rects[+b.dataset.i].it)));
    $('scale').innerHTML = '<span>평소보다 낮음</span>' + [-0.75, -0.4, 0, 1, 3].map(d => '<i style="background:' + heat(d) + '"></i>').join('') + '<span>높음</span>';
  }
  // 색: 높음 = 파랑 단계, 낮음 = 주황 단계(하락색 계열, 갈색·황토 없음), ±3% 이내 = 회색
  const HEAT_UP = [[120, 182, 214], [52, 148, 196], [0, 120, 173], [0, 84, 148]], HEAT_DN = [[253, 186, 140], [249, 146, 92], [234, 108, 52], [194, 65, 12]];
  const heatK = d => d >= 0 ? (d < 0.3 ? 0 : d < 1 ? 1 : d < 3 ? 2 : 3) : (d > -0.25 ? 0 : d > -0.5 ? 1 : d > -0.75 ? 2 : 3);
  const heatLight = d => Math.abs(d) >= FLAT && d < 0 && heatK(d) <= 1; // 밝은 주황 두 단계는 글자를 진하게
  function heat(d) {
    if (Math.abs(d) < FLAT) return 'rgb(156,163,175)';
    return 'rgb(' + (d >= 0 ? HEAT_UP : HEAT_DN)[heatK(d)].join(',') + ')';
  }
  function squarify(nodes, x, y, w, h) {
    const total = nodes.reduce((s, n) => s + n.w, 0), scale = (w * h) / total;
    const items = nodes.map(n => ({ it: n.it, a: n.w * scale }));
    const out = []; let rect = { x, y, w, h }, row = [];
    const worst = (r, side) => { const s = r.reduce((t, n) => t + n.a, 0); const mx = Math.max(...r.map(n => n.a)), mn = Math.min(...r.map(n => n.a)); return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn)); };
    const layout = r => {
      const s = r.reduce((t, n) => t + n.a, 0);
      if (rect.w >= rect.h) { const cw = s / rect.h; let cy = rect.y; r.forEach(n => { const ch = n.a / cw; out.push({ it: n.it, x: Math.round(rect.x), y: Math.round(cy), w: Math.round(cw), h: Math.round(ch) }); cy += ch; }); rect = { x: rect.x + cw, y: rect.y, w: rect.w - cw, h: rect.h }; }
      else { const ch = s / rect.w; let cx = rect.x; r.forEach(n => { const cw = n.a / ch; out.push({ it: n.it, x: Math.round(cx), y: Math.round(rect.y), w: Math.round(cw), h: Math.round(ch) }); cx += cw; }); rect = { x: rect.x, y: rect.y + ch, w: rect.w, h: rect.h - ch }; }
    };
    items.forEach(n => { const side = Math.min(rect.w, rect.h); if (!row.length || worst(row.concat(n), side) <= worst(row, side)) row.push(n); else { layout(row); row = [n]; } });
    if (row.length) layout(row);
    return out;
  }
  function renderRank() {
    const tabs = [['views', '많이 본'], ['hot', '평소보다 잘 된'], ['quality', '반응 좋은', '인스타 = 참여율 · 유튜브 = 끝까지 본 비율 · hong = 좋아요율']];
    if (weekly()) tabs.splice(1, 0, ['week', '급상승', '지난 기록보다 많이 늘어난 순']);
    const vc = viewChannels();
    if (vc.includes('인스타그램') || vc.includes('hong._.video')) tabs.push(['save', '저장 많은', '저장 ÷ 도달 · 인스타·hong']);
    if (vc.includes('인스타그램') || vc.includes('유튜브') || vc.includes('hong._.video')) tabs.push(['share', '공유 많은', '인스타·hong = 공유 ÷ 도달 · 유튜브 = 공유 ÷ 조회']);
    if (S.ch === '타 대학') tabs.push(['talk', '댓글 많은', '댓글 수 많은 순']);
    if (!tabs.some(t => t[0] === S.rankBy)) S.rankBy = 'views';
    $('rankTabs').innerHTML = tabs.map(([k, l, tip]) => '<button class="chip" type="button" data-k="' + k + '" aria-pressed="' + (S.rankBy === k) + '"' + (tip ? ' title="' + tip + '"' : '') + '>' + l + '</button>').join('');
    $('rankTabs').querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => { S.rankBy = b.dataset.k; S.rankShown = 10; renderRank(); }));
    const L = exploreList({ g: S.g || undefined, gs: S.gs || undefined });
    const score = { views: mainVal, hot: ratio, quality, week: it => inc(it, mainM(it.c)), save: it => rxVal(it, 'save'), share: it => rxVal(it, 'share'), talk: it => val(it, 2) || null }[S.rankBy] || mainVal;
    $('rankSub').textContent = { views: (S.ch === '타 대학' ? '좋아요' : '조회') + ' 많은 순', hot: vW() + ' 평소 대비가 높은 순 · 채널 규모와 상관없이 비교해요', quality: '반응 좋은 순 · 인스타 참여율 · 유튜브 끝까지 본 비율 · hong 좋아요율', week: '지난 기록보다 많이 늘어난 순', save: '저장률 평소 대비 높은 순 · 같은 형식 대비 · 도달 300 이상', share: '공유율 평소 대비 높은 순 · 같은 형식 대비 · 도달 300·조회 500 이상', talk: '댓글 많은 순' }[S.rankBy] + (S.g ? ' · ' + S.g : '');
    const sorted = L.filter(it => score(it) != null).sort((a, b) => score(b) - score(a));
    const shown = sorted.slice(0, S.rankShown);
    const rxRight = k => ({ right: it => RXM[k][1] + ' <span class="num">' + pctA(rxRate(it, k)) + '</span> · <em class="' + xCls(rxVal(it, k)) + '">평소의 ' + xf(rxVal(it, k)) + '</em>' });
    $('rank').innerHTML = rankRows(shown, S.rankBy === 'save' || S.rankBy === 'share' ? rxRight(S.rankBy) : S.rankBy === 'talk' ? { right: it => '댓글 <span class="num">' + fmt(val(it, 2)) + '</span>' + (val(it, 1) > 0 ? ' · 좋아요 <span class="num">' + fmtK(val(it, 1)) + '</span>' : '') } : S.rankBy === 'quality' ? { right: it => qName(it.c) + ' <em>' + pct(quality(it)) + '</em>' } : S.rankBy === 'week' ? { right: it => '이번 주 ' + mName(it) + ' <em class="up">+' + fmtK(inc(it, mainM(it.c))) + '</em>' } : null);
    wireRank($('rank'), shown);
    $('rankMore').hidden = S.rankShown >= sorted.length;
  }
  function tcols() {
    const own = S.ch !== '타 대학';
    const c = [
      { k: 'n', l: '콘텐츠', v: it => title(it.n) },
      { k: 'd', l: '게시일', v: it => it.d, f: v => whenTxt(v).replace(' 올림', '') },
      { k: 't', l: '형식', v: it => fmtType(it.t) },
      { k: 'g', l: '분류', v: glab },
      { k: 'p', l: '제작', v: it => it.p },
      // 타 대학은 릴스만 조회가 공개돼 이미지·캐러셀 조회 0은 숫자로 쓰지 않음(좋아요 열은 그대로)
      { k: 'm', l: own ? '조회' : '좋아요', v: mainVal, n: 1, f: (v, it) => (it.x || frozen(it)) && !v ? '<span class="mu" title="조회 기록 없음">–</span>' : fmt(v) },
      { k: 'r', l: vW() + ' 평소 대비', v: it => !!it.ad ? null : ratio(it), n: 1, f: (v, it) => it.hid ? '<span class="mu" title="' + HID_TIP + '">비공개로 보임</span>' : v != null && young(it) ? '조회 모이는 중' : xf(v) },
      { k: 'q', l: S.ch === '인스타그램' ? '도달 대비 반응' : '반응', tip: S.ch === '인스타그램' ? '(좋아요+댓글+공유+저장) ÷ 도달' : '인스타 참여율 · 유튜브 시청 완료율 · hong 좋아요율', v: quality, n: 1, f: pct },
    ];
    if (S.ch === '인스타그램') {
      // 개편 1단계: 형식을 넘나드는 비교는 도달 분모(캐러셀 조회는 장마다 세서 부풀려짐)
      const fl = ((acctLatest('인스타그램').cur || {}).m || {})['Profile followers'];
      const per = k => it => { const x = last(it); return x && it.r > 0 ? (x[k] || 0) / it.r : null; };
      c.push({ k: 'sv', l: '저장률', tip: '저장 ÷ 도달', v: per(4), n: 1, f: pct },
        { k: 'sh', l: '공유율', tip: '공유 ÷ 도달', v: per(3), n: 1, f: pct },
        { k: 'rf', l: '팔로워 대비 도달', tip: '도달 ÷ 현재 팔로워' + (fl ? '(' + fmt(fl) + '명)' : ''), v: it => fl > 0 && it.r > 0 ? it.r / fl : null, n: 1, f: pct0 });
    }
    if (weekly()) c.push({ k: 'w', l: '주간 증가', v: it => inc(it, mainM(it.c)), n: 1, f: v => v == null ? '–' : sgn(v) + fmt(v) });
    // 좁은 화면: 숫자를 오른쪽 원칙에 맞춰 콘텐츠 바로 뒤에 조회·평소 대비(나머지 열은 옆으로 밀면 보임)
    if (window.matchMedia && matchMedia('(max-width:760px)').matches) c.splice(1, 0, ...c.splice(5, 2));
    return c;
  }
  function renderTable() {
    const C = tcols(), sort = S.sort || { k: 'd', dir: 'desc' }, col = C.find(c => c.k === sort.k) || C[0];
    $('thead').innerHTML = C.map(c => '<th class="' + (c.n ? 'n' : '') + '"><button type="button" data-k="' + c.k + '"' + (c.tip ? ' title="' + esc(c.tip) + '"' : '') + (c.k === sort.k ? ' data-dir="' + sort.dir + '"' : '') + '>' + esc(c.l) + '</button></th>').join('');
    $('thead').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { S.sort = { k: b.dataset.k, dir: sort.k === b.dataset.k && sort.dir === 'desc' ? 'asc' : 'desc' }; renderTable(); }));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const L = pool({ channels: viewChannels(), ads: true, g: S.g || undefined }).sort((a, b) => { const x = col.v(a), y = col.v(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x > y ? 1 : x < y ? -1 : 0) * dir; });
    $('tbody').innerHTML = L.slice(0, S.tblShown).map((it, i) => '<tr data-i="' + i + '">' + C.map(c => {
      const v = c.v(it);
      if (c.k === 'p') return '<td>' + ptag(v) + adtag(it) + susTag(it) + hidTag(it) + '</td>';
      if (c.k === 'n') return '<td class="tt2">' + line(it) + '</td>';
      if (c.n) return '<td class="n">' + (c.f ? c.f(v, it) : fmt(v)) + '</td>';
      if (c.f) return '<td title="' + esc(dot(v)) + '">' + c.f(v, it) + '</td>';
      return '<td>' + esc(v) + '</td>';
    }).join('') + '</tr>').join('') || '<tr><td colspan="' + C.length + '" class="empty">조건에 맞는 콘텐츠가 없어요.</td></tr>';
    $('tbody').querySelectorAll('tr[data-i]').forEach(tr => tr.addEventListener('click', () => openDetail(L[+tr.dataset.i])));
    $('tblMore').hidden = S.tblShown >= L.length;
  }

  // ═════════ 7. 데이터 추출 ═════════
  const XSTORE = 'jj-sns-export-v1';
  const today = () => D.updated;
  const monthStart = (d, k) => { const x = new Date(d.slice(0, 7) + '-01T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + k); return x.toISOString().slice(0, 10); };
  function quickRanges() {
    const t = today(), y = +t.slice(0, 4), m = +t.slice(5, 7);
    const sem2y = m >= 3 ? y : y - 1;
    return [
      ['지난달', monthStart(t, -1), addDays(monthStart(t, 0), -1)],
      ['이번 달', monthStart(t, 0), t],
      ['최근 4주', addDays(t, -27), t],
      ['최근 3개월', addDays(t, -90), t],
      ['올해', y + '-01-01', t],
      ['작년', (y - 1) + '-01-01', (y - 1) + '-12-31'],
      ['1학기', (m >= 3 ? y : y - 1) + '-03-01', (m >= 3 ? y : y - 1) + '-08-31', '3~8월'],
      ['2학기', (m >= 9 ? y : y - 1) + '-09-01', addDays(((m >= 9 ? y : y - 1) + 1) + '-03-01', -1), '9~2월'],
      ['수시', (m >= 8 ? y : y - 1) + '-08-01', (m >= 8 ? y : y - 1) + '-09-30', '8~9월'],
      ['정시', (m === 12 ? y : y - 1) + '-12-01', (m === 12 ? y + 1 : y) + '-01-31', '12~1월'],
      ['전체', '2000-01-01', t],
    ].map(r => [r[0], r[1], r[2] > t ? t : r[2], r[3] || '']);
  }
  const GROUPS = [['content', '콘텐츠별'], ['day', '일별'], ['week', '주별'], ['month', '월별'], ['channel', '채널별'], ['category', '분류별'], ['subcat', '세부 분류별'], ['producer', '제작별'], ['person', '사람별'], ['format', '형식별'], ['weekday', '요일별']];
  // 콘텐츠별 열
  const CCOLS = [
    ['title', '제목', it => title(it.n), 's'], ['d', '게시일', it => it.d, 's'], ['c', '채널', it => chName(it.c), 's'], ['t', '형식', it => fmtType(it.t), 's'], ['g', '분류', it => it.g, 's'], ['gs', '세부 분류', it => it.s || '', 's'], ['p', '제작', it => it.p, 's'],
    ['w', '참여자', it => (it.w || []).join(', '), 's'],
    ['views', '조회', it => xv(it, 0), 'n'], ['likes', '좋아요', it => xv(it, 1), 'n'], ['comments', '댓글', it => xv(it, 2), 'n'], ['shares', '공유', it => xv(it, 3), 'n'], ['saves', '저장', it => xv(it, 4), 'n'],
    ['reach', '도달', it => it.r, 'n'], ['eng', '참여율', engagement, 'p'], ['comp', '시청 완료율', completion, 'p'], ['ratio', '조회 평소 대비(배)', it => !!it.ad ? null : ratio(it), 'x'],
    ['hit', '잘 된 게시물', it => isHit(it) && !it.ad ? 'O' : '', 's'], ['ad', '광고', it => it.ad ? (it.ad.s === '패턴' ? '추정(조회 패턴)' : it.ad.s) : '', 's'], ['camp', '광고 캠페인', it => it.ad ? it.ad.k.concat((it.ad.mk || []).map(n => '메타: ' + metaLabel(n))).join(' / ') : '', 's'], ['url', '링크', it => it.u || '', 's'],
  ];
  const GCOLS = [
    ['n', '게시물 수', a => a.length, 'n'], ['vSum', '조회 합', a => sum(a.map(it => xv(it, 0))), 'n'], ['vAvg', '조회 평균', a => mean(a.map(it => xv(it, 0)).filter(v => E.mode === 'inc' || v > 0)), 'n'], ['vMed', '조회 중간값', a => median(a.map(it => xv(it, 0)).filter(v => E.mode === 'inc' || v > 0)), 'n'],
    ['lSum', '좋아요 합', a => sum(a.map(it => xv(it, 1))), 'n'], ['cSum', '댓글 합', a => sum(a.map(it => xv(it, 2))), 'n'], ['sSum', '공유 합', a => sum(a.map(it => xv(it, 3))), 'n'], ['svSum', '저장 합', a => sum(a.map(it => xv(it, 4))), 'n'],
    ['rSum', '도달 합', a => sum(a.map(it => it.r)), 'n'], ['eng', '평균 참여율', a => mean(a.map(engagement)), 'p'], ['comp', '평균 시청 완료율', a => mean(a.map(completion)), 'p'],
    ['rMed', '조회 평소 대비 중간값', a => median(a.filter(it => !it.ad).map(ratio)), 'x'], ['hits', '잘 된 게시물 수', a => a.filter(it => !it.ad && isHit(it)).length, 'n'], ['hitRate', '잘 된 비율', a => hitRate(a.filter(it => !it.ad)), 'p'],
    ['top', '최고 콘텐츠', a => { const b = a.slice().sort((x, y) => (xv(y, mainM(y.c)) || 0) - (xv(x, mainM(x.c)) || 0))[0]; return b ? title(b.n) : ''; }, 's'],
  ];
  const CDEF = ['title', 'd', 'c', 't', 'g', 'p', 'w', 'views', 'likes', 'comments', 'shares', 'saves', 'ratio'];
  const GDEF = ['n', 'vSum', 'vMed', 'lSum', 'rMed', 'hits', 'hitRate', 'top'];
  let E = null;
  function defaultE() {
    const q = quickRanges()[0];
    return { from: q[1], to: q[2], q: '지난달', chs: S.ch === '전체' ? OWN.slice() : S.ch === '타 대학' ? benchNames() : [S.ch], types: [], cats: [], prods: [], person: '', roleF: '전체', text: '', ads: false, mode: 'cum', group: 'channel', ccols: CDEF.slice(), gcols: GDEF.slice(), sortK: '', sortDir: 'desc', limit: 0 };
  }
  const xload = () => { try { return JSON.parse(localStorage.getItem(XSTORE) || 'null'); } catch (e) { return null; } };
  const xsave = () => { try { const o = xload() || {}; o.last = E; localStorage.setItem(XSTORE, JSON.stringify(o)); } catch (e) {} };
  const xpresets = () => (xload() || {}).presets || [];
  const xsavePresets = ps => { try { const o = xload() || {}; o.presets = ps; localStorage.setItem(XSTORE, JSON.stringify(o)); } catch (e) {} };
  const BUILTIN = () => {
    const qr = Object.fromEntries(quickRanges().map(r => [r[0], r]));
    const mk = (name, q, o) => ({ name, e: Object.assign(defaultE(), { from: qr[q][1], to: qr[q][2], q }, o) });
    return [
      mk('지난달 채널별 실적', '지난달', { group: 'channel' }),
      mk('지난달 콘텐츠 목록', '지난달', { group: 'content', sortK: 'd', sortDir: 'asc' }),
      mk('이번 학기 홍보대사 개인별', '2학기', { group: 'person', roleF: '홍보대사', chs: ['인스타그램', '유튜브'], gcols: ['n', 'vSum', 'vMed', 'rMed', 'hits', 'top'], sortK: 'vSum' }),
      mk('최근 3개월 분류별 성과', '최근 3개월', { group: 'category', sortK: 'rMed' }),
      mk('올해 월별 추이', '올해', { group: 'month', sortK: '', sortDir: 'asc' }),
      mk('수시 시즌 콘텐츠', '수시', { group: 'content', ads: true, sortK: 'views' }),
      mk('1년 조회 Top 20', '전체', { from: addDays(today(), -365), group: 'content', sortK: 'views', limit: 20, q: '' }),
    ];
  };
  // 기간 중 증가(스냅샷) 모드
  function snapIdx() {
    const ds = D.dates;
    let i0 = -1, i1 = -1;
    ds.forEach((d, i) => { if (d <= E.from) i0 = i; if (d <= E.to) i1 = i; });
    if (i0 < 0) i0 = 0;
    // 기간 양 끝에서 7일 넘게 떨어진 기록으로 계산하면 기간 밖 증가까지 섞인다(예: 최근 4주인데 6/11 기록부터) → 계산 불가
    const far = i1 > i0 && (daysBetween(D.dates[i0], E.from) > 7 || daysBetween(D.dates[i1], E.to) > 7);
    const why = i1 <= i0 ? '이 기간 안에 기록이 2회 미만이라 늘어난 수치를 계산할 수 없어요' : far ? '기간 앞뒤 가까이(7일 안)에 기록이 없어 계산할 수 없어요 · 가장 가까운 기록 ' + mdLabel(D.dates[i0]) + ', ' + mdLabel(D.dates[i1]) : '';
    return { i0, i1, ok: i1 > i0 && !far, why };
  }
  function xv(it, m) {
    if (E && E.mode === 'inc') {
      const s = snapIdx(); if (!s.ok) return null;
      const b = it.h[s.i1]; if (!b || b[m] == null) return null;
      const a = it.h[s.i0];
      if (!a) return it.d >= D.dates[s.i0] ? b[m] : null;
      return a[m] == null ? null : b[m] - a[m];
    }
    return val(it, m);
  }
  function xfilter() {
    return D.items.filter(it => {
      if (!E.chs.includes(it.c) || it.t === '스토리') return false;
      if (E.mode === 'inc') { if (it.d > E.to) return false; }
      else if (it.d < E.from || it.d > E.to) return false;
      if (!E.ads && it.ad) return false;
      if (E.ads === 'only' && !it.ad) return false;
      if (E.types.length && !E.types.includes(fmtType(it.t))) return false;
      if (E.cats.length && !E.cats.includes(it.g)) return false;
      if (E.prods.length && !E.prods.includes(it.p)) return false;
      if (E.person && !(it.w || []).includes(E.person)) return false;
      if (E.text && !String(it.n || '').toLowerCase().includes(E.text.toLowerCase())) return false;
      return true;
    }).filter(it => E.mode !== 'inc' || xv(it, 0) != null || xv(it, 1) != null);
  }
  const isoWeek = d => { const x = new Date(d + 'T00:00:00Z'); const k = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - k); return x.toISOString().slice(0, 10); };
  function xcompute() {
    const L = xfilter();
    if (E.group === 'content') {
      const cols = CCOLS.filter(c => E.ccols.includes(c[0]));
      let rows = L.map(it => ({ it, cells: cols.map(c => c[2](it)) }));
      const si = cols.findIndex(c => c[0] === E.sortK);
      if (si >= 0) rows.sort((a, b) => cmpDir(a.cells[si], b.cells[si], E.sortDir === 'asc' ? 1 : -1));
      else rows.sort((a, b) => cmpDir(a.it.d, b.it.d, E.sortDir === 'asc' ? 1 : -1));
      if (E.limit) rows = rows.slice(0, E.limit);
      return { L, cols, rows, items: rows.map(r => r.it) };
    }
    const keyFn = { day: it => it.d, month: it => it.d.slice(0, 7), week: it => isoWeek(it.d), channel: it => chName(it.c), category: it => it.g, subcat: glab, producer: it => it.p, format: it => fmtType(it.t), weekday: it => WD[new Date(it.d + 'T00:00:00Z').getUTCDay()] }[E.group];
    const g = {};
    if (E.group === 'person') L.forEach(it => (it.w || []).forEach(n => { if (E.roleF !== '전체' && ((D.roles || {})[n] || '근로장학생') !== E.roleF) return; (g[n] = g[n] || []).push(it); }));
    else L.forEach(it => { const k = keyFn(it); (g[k] = g[k] || []).push(it); });
    const label = { day: '날짜', month: '월', week: '주(월요일 시작)', channel: '채널', category: '분류', subcat: '분류(세부)', producer: '제작', format: '형식', weekday: '요일', person: '이름' }[E.group];
    const cols = [['key', label, null, 's']].concat(E.group === 'person' ? [['role', '역할', null, 's']] : []).concat(GCOLS.filter(c => E.gcols.includes(c[0])));
    let rows = Object.entries(g).map(([k, arr]) => ({ k, arr, cells: cols.map(c => c[0] === 'key' ? k : c[0] === 'role' ? ((D.roles || {})[k] || '근로장학생') : c[2](arr)) }));
    const si = cols.findIndex(c => c[0] === E.sortK);
    if (si >= 0) rows.sort((a, b) => cmpDir(a.cells[si], b.cells[si], E.sortDir === 'asc' ? 1 : -1));
    else rows.sort((a, b) => ['day', 'month', 'week', 'weekday'].includes(E.group) ? (E.group === 'weekday' ? (wdOrder(a.k) - wdOrder(b.k)) : cmp(a.k, b.k)) : b.arr.length - a.arr.length);
    if (E.limit) rows = rows.slice(0, E.limit);
    const total = cols.map(c => c[0] === 'key' ? (E.group === 'person' ? '전체(중복 제외)' : '합계') : c[0] === 'role' ? '' : c[3] === 'n' && /Sum|^n$|hits/.test(c[0]) ? c[2](L) : c[2] ? c[2](L) : '');
    return { L, cols, rows, total, items: L };
  }
  const wdOrder = k => ['월', '화', '수', '목', '금', '토', '일'].indexOf(k);
  const cmp = (a, b) => { if (a == null || a === '') return 1; if (b == null || b === '') return -1; return a > b ? 1 : a < b ? -1 : 0; };
  // 정렬 방향과 상관없이 빈 값은 맨 아래
  const cmpDir = (a, b, dir) => { const ea = a == null || a === '', eb = b == null || b === ''; if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1; return cmp(a, b) * dir; };
  const cellFmt = (v, t) => v == null || v === '' ? (t === 's' ? esc(v || '') : '–') : t === 'n' ? fmt(v) : t === 'p' ? pct(v) : t === 'x' ? xf(v) : esc(v);
  function viewExport() {
    if (!E) E = Object.assign(defaultE(), (xload() || {}).last || {});
    const qr = quickRanges();
    const allChs = OWN.concat(benchNames());
    const avail = D.items.filter(it => E.chs.includes(it.c));
    // 형식 칩은 정해진 순서로(릴스 · 캐러셀 · 이미지 · 쇼츠 · 1~3분 · 3~10분 · 10분 초과 · 릴스/영상)
    const TORD = ['릴스', '캐러셀', '이미지', '1분 이하', '1~3분', '3~10분', '10분 초과', '릴스/영상'];
    const rawT = {}; avail.forEach(it => { rawT[fmtType(it.t)] = it.t; });
    const types = [...new Set(avail.map(it => fmtType(it.t)).filter(t => t !== '스토리'))].sort((a, b) => (TORD.indexOf(rawT[a]) + 1 || 99) - (TORD.indexOf(rawT[b]) + 1 || 99));
    const cats = [...new Set(D.items.map(it => it.g))].sort();
    const people = Object.entries(D.items.reduce((o, it) => { (it.w || []).forEach(n => { o[n] = (o[n] || 0) + 1; }); return o; }, {})).sort((a, b) => b[1] - a[1]);
    // 칩에는 이름만, 범위·뜻은 작은 둘째 줄이나 마우스 올림으로
    const tg = (attr, v, on, label, sub, tip) => '<button type="button" class="tg2" data-' + attr + '="' + esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' + esc(label || v) + (sub ? '<small class="cs">' + esc(sub) + '</small>' : '') + '</button>';
    const typeChip = t => t === '쇼츠(1분 이하)' ? ['쇼츠', '1분 이하'] : t === '릴스/영상' ? [t, 'hong 형식'] : t === '영상' ? [t, '타 대학 형식'] : [t, ''];
    const s = snapIdx();
    const isC = E.group === 'content';
    const colDefs = isC ? CCOLS : GCOLS;
    const colSel = isC ? E.ccols : E.gcols;
    const sortOpts = (isC ? CCOLS.filter(c => E.ccols.includes(c[0])) : [['key', '묶음 이름']].concat(GCOLS.filter(c => E.gcols.includes(c[0]))));
    const presets = xpresets();
    let html = '<section class="sec"><div class="sh"><div><h2>데이터 추출</h2><p>요청받은 기간과 조건을 골라 엑셀로 받아요 · 고른 조건은 이 브라우저에 저장돼요</p></div></div>' +
      '<div class="fx">' +
      '<div class="k">자주 쓰는 요청</div><div class="v preset">' + BUILTIN().map((p, i) => '<button type="button" class="tg2 ghost" data-bi="' + i + '">' + esc(p.name) + '</button>').join('') +
        presets.map((p, i) => '<button type="button" class="tg2" data-pi="' + i + '">★ ' + esc(p.name) + '<span class="x" data-del="' + i + '" title="삭제">✕</span></button>').join('') + '</div>' +
      '<div class="k">기간</div><div class="v"><input class="inp" type="date" id="xFrom" value="' + E.from + '"> ~ <input class="inp" type="date" id="xTo" value="' + E.to + '"></div>' +
      '<div class="k"></div><div class="v">' + qr.map(r => tg('q', r[0], E.q === r[0], r[0], r[3])).join('') + '</div>' +
      '<div class="k">채널</div><div class="v">' + allChs.map(c => tg('ch', c, E.chs.includes(c), chName(c))).join('') + '</div>' +
      '<div class="k">형식</div><div class="v">' + tg('type', '', !E.types.length, '전체') + types.map(t => tg('type', t, E.types.includes(t), typeChip(t)[0], '', typeChip(t)[1])).join('') + '</div>' +
      '<div class="k">분류</div><div class="v">' + tg('cat', '', !E.cats.length, '전체') + cats.map(c => tg('cat', c, E.cats.includes(c))).join('') + '</div>' +
      '<div class="k">제작</div><div class="v">' + tg('prod', '', !E.prods.length, '전체') + PRODS.concat(['타 대학']).map(p => tg('prod', p, E.prods.includes(p))).join('') + '</div>' +
      '<div class="k">사람</div><div class="v"><select class="inp" id="xPerson"><option value="">전체</option>' + people.map(([n, k]) => '<option value="' + esc(n) + '"' + (E.person === n ? ' selected' : '') + '>' + esc(n) + ' (' + ((D.roles || {})[n] || '근로장학생') + ' · ' + k + ')</option>').join('') + '</select>' +
        (E.group === 'person' ? '<span class="hint" style="margin-left:6px">역할</span>' + ['전체', '홍보대사', '근로장학생', '서포터즈'].map(r => tg('role', r, E.roleF === r)).join('') : '') + '</div>' +
      '<div class="k">검색어</div><div class="v"><input class="inp wide" id="xText" placeholder="제목·캡션에 포함된 단어 (예: 축제, 수시)" value="' + esc(E.text) + '"></div>' +
      '<div class="k">광고</div><div class="v">' + tg('ad', 'no', !E.ads, '광고 제외') + tg('ad', 'yes', E.ads === true, '광고 포함') + tg('ad', 'only', E.ads === 'only', '광고만') + '<span class="hint">구글애즈 캠페인에 연결된 유튜브 영상 · 메타 광고로 홍보한 인스타 게시물 기준</span></div>' +
      '<div class="k">수치 기준</div><div class="v">' + tg('mode', 'cum', E.mode === 'cum', '기간 중 올린 게시물의 누적') + '<button type="button" class="tg2" data-mode="inc" aria-pressed="' + (E.mode === 'inc') + '"' + (D.dates.length < 2 ? ' disabled title="주간 기록이 2회 이상 쌓이면 쓸 수 있어요"' : '') + '>기간 동안 늘어난 수치</button>' +
        '<span class="hint">' + (E.mode === 'inc' ? (s.ok ? mdLabel(D.dates[s.i0]) + ' → ' + mdLabel(D.dates[s.i1]) + ' 기록 사이에 늘어난 수치예요 (게시일 무관)' : s.why) : '그 기간에 올린 게시물의 ' + mdLabel(D.updated) + ' 기준 누적 수치') + '</span></div>' +
      '<div class="k">묶음</div><div class="v">' + GROUPS.map(g => tg('group', g[0], E.group === g[0], g[1])).join('') + '</div>' +
      '<div class="k">표시 항목</div><div class="v">' + colDefs.map(c => tg('col', c[0], colSel.includes(c[0]), c[1])).join('') + '</div>' +
      '<div class="k">정렬</div><div class="v"><select class="inp" id="xSort"><option value="">정렬 안 함 · 묶음 순서</option>' + sortOpts.map(c => '<option value="' + c[0] + '"' + (E.sortK === c[0] ? ' selected' : '') + '>' + esc(c[1]) + '</option>').join('') + '</select>' +
        tg('dir', 'desc', E.sortDir === 'desc', '큰 순') + tg('dir', 'asc', E.sortDir === 'asc', '작은 순') +
        '<span class="hint">보여 줄 행</span><select class="inp" id="xLimit">' + [[0, '행 전부'], [10, '상위 10행'], [20, '상위 20행'], [50, '상위 50행'], [100, '상위 100행']].map(o => '<option value="' + o[0] + '"' + (E.limit === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      '</div></section>';
    const R = xcompute();
    const views = sum(R.L.map(it => xv(it, 0))), likes = sum(R.L.map(it => xv(it, 1)));
    html += '<div class="gap"></div><section class="sec"><div class="xsum">' + esc(E.from) + ' ~ ' + esc(E.to) + ' · ' + E.chs.map(chName).join(', ') + ' · 게시물 <b>' + R.L.length + '개</b> · 조회 ' + (E.mode === 'inc' ? '증가 ' : '') + '<b>' + fmtK(views) + '</b> · 좋아요 <b>' + fmtK(likes) + '</b>' +
      '<small>' + xcondText().join(' · ') + '</small></div>' +
      '<div class="xbar"><button type="button" class="btn pri" id="xDown">엑셀 다운로드</button><button type="button" class="btn" id="xCopy">표 복사</button><button type="button" class="btn" id="xSave">이 조건 저장</button><span class="sp"></span><button type="button" class="btn" id="xReset">초기화</button></div>' +
      '<div class="tw"><table class="tbl"><thead><tr>' + R.cols.map(c => '<th class="' + (c[3] !== 's' ? 'n' : '') + '">' + esc(c[1]) + '</th>').join('') + '</tr></thead><tbody>' +
      R.rows.slice(0, 200).map((r, i) => '<tr' + (isC ? ' class="click" data-i="' + i + '"' : '') + '>' + r.cells.map((v, j) => '<td class="' + (R.cols[j][3] !== 's' ? 'n' : (R.cols[j][0] === 'title' || R.cols[j][0] === 'top' ? 'w' : '')) + '">' + cellFmt(v, R.cols[j][3]) + '</td>').join('') + '</tr>').join('') +
      (R.total ? '<tr style="font-weight:700">' + R.total.map((v, j) => '<td class="' + (R.cols[j][3] !== 's' ? 'n' : '') + '">' + cellFmt(v, R.cols[j][3]) + '</td>').join('') + '</tr>' : '') +
      (R.rows.length ? '' : '<tr><td colspan="' + R.cols.length + '" class="empty">' + (E.mode === 'inc' && !s.ok ? esc(s.why) : '조건에 맞는 데이터가 없어요.') + '</td></tr>') +
      '</tbody></table></div>' + (R.rows.length > 200 ? '<p class="note">화면에는 200행까지만 보여요. 엑셀에는 ' + R.rows.length + '행 전부 들어가요.</p>' : '') +
      (E.chs.some(isBench) ? '<dl class="defs"><div><dt>타 대학</dt><dd>릴스만 조회 공개 · 조회 0은 중간값·평균에서 뺌</dd></div></dl>' : '') +
      '<dl class="defs"><div><dt>엑셀 「결과」</dt><dd>이 표</dd></div><div><dt>「포함 콘텐츠」</dt><dd>묶음에 들어간 게시물</dd></div><div><dt>「조건·정의」</dt><dd>고른 조건과 지표 뜻</dd></div></dl></section>';
    $('view').innerHTML = html;
    wireExport(R);
  }
  function xcondText() {
    const o = [];
    if (E.types.length) o.push('형식: ' + E.types.join(', '));
    if (E.cats.length) o.push('분류: ' + E.cats.join(', '));
    if (E.prods.length) o.push('제작: ' + E.prods.join(', '));
    if (E.person) o.push('사람: ' + E.person);
    if (E.text) o.push('검색어: ' + E.text);
    o.push(E.ads === 'only' ? '광고만' : E.ads ? '광고 포함' : '광고 제외');
    o.push(E.mode === 'inc' ? '기간 중 증가' : '게시일 기준 누적');
    o.push('묶음: ' + GROUPS.find(g => g[0] === E.group)[1]);
    return o;
  }
  function wireExport(R) {
    const V = $('view');
    const re = () => { xsave(); viewExport(); };
    const toggle = (arr, v) => arr.includes(v) ? arr.filter(x => x !== v) : arr.concat([v]);
    V.querySelectorAll('[data-bi]').forEach(b => b.addEventListener('click', () => { E = BUILTIN()[+b.dataset.bi].e; re(); toast('「' + b.textContent + '」 조건을 불러왔어요'); }));
    V.querySelectorAll('[data-pi]').forEach(b => b.addEventListener('click', e => {
      const ps = xpresets();
      if (e.target.dataset.del != null) { ps.splice(+e.target.dataset.del, 1); xsavePresets(ps); viewExport(); return; }
      const p = ps[+b.dataset.pi]; if (!p) return;
      E = Object.assign(defaultE(), p.e);
      if (p.e.q) { const r = quickRanges().find(x => x[0] === p.e.q); if (r) { E.from = r[1]; E.to = r[2]; } }
      re();
    }));
    $('xFrom').addEventListener('change', e => { E.from = e.target.value || E.from; E.q = ''; re(); });
    $('xTo').addEventListener('change', e => { E.to = e.target.value || E.to; E.q = ''; re(); });
    V.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { const r = quickRanges().find(x => x[0] === b.dataset.q); E.q = r[0]; E.from = r[1]; E.to = r[2]; re(); }));
    V.querySelectorAll('[data-ch]').forEach(b => b.addEventListener('click', () => { const n = toggle(E.chs, b.dataset.ch); if (n.length) E.chs = n; E.types = []; re(); }));
    V.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { E.types = b.dataset.type ? toggle(E.types, b.dataset.type) : []; re(); }));
    V.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { E.cats = b.dataset.cat ? toggle(E.cats, b.dataset.cat) : []; re(); }));
    V.querySelectorAll('[data-prod]').forEach(b => b.addEventListener('click', () => { E.prods = b.dataset.prod ? toggle(E.prods, b.dataset.prod) : []; re(); }));
    V.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => { E.roleF = b.dataset.role; re(); }));
    V.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; E.mode = b.dataset.mode; re(); }));
    V.querySelectorAll('[data-group]').forEach(b => b.addEventListener('click', () => { E.group = b.dataset.group; E.sortK = ''; re(); }));
    V.querySelectorAll('[data-col]').forEach(b => b.addEventListener('click', () => { if (E.group === 'content') E.ccols = toggle(E.ccols, b.dataset.col); else E.gcols = toggle(E.gcols, b.dataset.col); re(); }));
    V.querySelectorAll('[data-dir]').forEach(b => b.addEventListener('click', () => { E.sortDir = b.dataset.dir; re(); }));
    $('xPerson').addEventListener('change', e => { E.person = e.target.value; re(); });
    $('xSort').addEventListener('change', e => { E.sortK = e.target.value; re(); });
    $('xLimit').addEventListener('change', e => { E.limit = +e.target.value; re(); });
    let tt; $('xText').addEventListener('input', e => { clearTimeout(tt); const v = e.target.value; tt = setTimeout(() => { E.text = v; xsave(); viewExport(); const el = $('xText'); el.focus(); el.setSelectionRange(v.length, v.length); }, 400); });
    V.querySelectorAll('[data-ad]').forEach(b => b.addEventListener('click', () => { E.ads = { no: false, yes: true, only: 'only' }[b.dataset.ad]; re(); }));
    $('xReset').addEventListener('click', () => { E = defaultE(); re(); });
    $('xSave').addEventListener('click', () => {
      const name = xcondName();
      const ps = xpresets(); ps.push({ name, e: JSON.parse(JSON.stringify(E)) }); xsavePresets(ps); viewExport(); toast('「' + name + '」로 저장했어요');
    });
    if (E.group === 'content') V.querySelectorAll('tbody tr[data-i]').forEach(tr => tr.addEventListener('click', () => openDetail(R.rows[+tr.dataset.i].it)));
    $('xCopy').addEventListener('click', () => {
      const tsv = [R.cols.map(c => c[1])].concat(R.rows.map(r => r.cells.map((v, j) => rawCell(v, R.cols[j][3])))).map(r => r.join('\t')).join('\n');
      const done = () => toast('표를 복사했어요. 엑셀·시트에 붙여넣기 하세요');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tsv).then(done, () => fallbackCopy(tsv, done)); else fallbackCopy(tsv, done);
    });
    $('xDown').addEventListener('click', () => {
      const head = R.cols.map(c => c[1]);
      const body = R.rows.map(r => r.cells.map((v, j) => rawCell(v, R.cols[j][3], true)));
      if (R.total) body.push(R.total.map((v, j) => rawCell(v, R.cols[j][3], true)));
      const fmts = R.cols.map(c => c[3]);
      const inc = R.items.map(it => { const v = [0, 1, 2, 3, 4].map(m => xv(it, m)); return [it.d, chName(it.c), fmtType(it.t), it.g, it.p, (it.w || []).join(', '), title(it.n), v[0], v[1], v[2], v[3], v[4], it.r == null ? null : it.r, ratio(it) == null || !!it.ad ? null : +ratio(it).toFixed(2), it.ad ? (it.ad.s === '패턴' ? '추정(조회 패턴)' : it.ad.s) : '', it.ad ? it.ad.k.concat((it.ad.mk || []).map(n => '메타: ' + metaLabel(n))).join(' / ') : '', it.u || '']; });
      const cond = [['항목', '값'], ['기간', E.from + ' ~ ' + E.to + (E.q ? ' (' + E.q + ')' : '')], ['채널', E.chs.map(chName).join(', ')]].concat(xcondText().map(t => { const i = t.indexOf(': '); return i > 0 ? [t.slice(0, i), t.slice(i + 2)] : ['옵션', t]; })).concat([
        ['기준 데이터', D.updated + ' 기록'], ['만든 날', new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10)], [],
        ['정의', ''], ['조회 평소 대비', '같은 채널·같은 형식 최근 1년 게시물 조회 중간값 대비 배수(형식 게시물이 ' + BASE_T_MIN + '개 미만이면 채널 중간값, 광고·스토리 제외). 1.0 = 평소 · 게시 ' + AGE_MIN + '일 전은 조회 모이는 중'], ['잘 된 게시물', '평소 대비 1.5배 이상'], ['참여율', '(좋아요+댓글+공유+저장) ÷ 도달'], ['시청 완료율', '평균 시청 시간 ÷ 영상 길이'],
        ['자체 제작', '캡션에 제작자 이름이 없는 홍보실 제작물'], ['근로장학생', '크레딧 이름이 근로장학생이거나 「명단」에 없는 이름(서포터즈로 적힌 크레딧은 학과·기관 협업)'], ['광고', '구글애즈 캠페인에 연결된 유튜브 영상(확인 = 제목·게시일 일치, 추정 = 시기·조회 패턴). 광고 리포트 이후 영상은 조회 10만 이상 & 1만 조회당 좋아요 3개 미만이면 추정'], ['타 대학', '릴스 외에는 조회가 공개되지 않아 좋아요 기준']]);
      const fname = '전주대SNS_' + E.from.replace(/-/g, '') + '-' + E.to.replace(/-/g, '') + '_' + GROUPS.find(g => g[0] === E.group)[1];
      writeXlsx(fname, [['결과', [head].concat(body), fmts], ['포함 콘텐츠', [['게시일', '채널', '형식', '분류', '제작', '참여자', '제목', '조회', '좋아요', '댓글', '공유', '저장', '도달', '조회 평소 대비(배)', '광고', '광고 캠페인', '링크']].concat(inc)], ['조건·정의', cond]]);
    });
  }
  const xcondName = () => (E.q || (E.from + '~' + E.to)) + ' ' + GROUPS.find(g => g[0] === E.group)[1] + (E.cats.length ? ' · ' + E.cats.join('/') : '') + (E.person ? ' · ' + E.person : '');
  function rawCell(v, t, num) {
    if (v == null || v === '') return num ? null : '';
    if (t === 'p') return num ? +v.toFixed(4) : (v * 100).toFixed(1) + '%';
    if (t === 'x') return num ? +v.toFixed(2) : v.toFixed(2);
    if (t === 'n') return Math.round(v * 100) / 100;
    return v;
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('복사하지 못했어요. 엑셀 다운로드를 써 주세요'); }
    ta.remove();
  }
  // claude.ai 아티팩트 안에서는 downloads 기능으로 저장, 그 외(GitHub Pages)는 브라우저 다운로드
  let dlP = null;
  function dlCap() {
    if (!(window.claude && typeof window.claude.use === 'function')) return Promise.resolve(null);
    if (!dlP) dlP = window.claude.use('downloads').catch(() => null);
    return dlP;
  }
  let xlsxP = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxP) xlsxP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = window.XLSX_URL || XLSX_URL; if (!window.XLSX_URL) { s.integrity = XLSX_SRI; s.crossOrigin = 'anonymous'; } s.onload = () => res(window.XLSX); s.onerror = () => { xlsxP = null; rej(new Error('xlsx')); }; document.head.appendChild(s); });
    return xlsxP;
  }
  // sheets: [[name, aoa, fmts?]]
  function writeXlsx(name, sheets) {
    toast('엑셀 파일을 만드는 중…');
    loadXlsx().then(X => {
      const wb = X.utils.book_new();
      sheets.forEach(([sn, aoa, fmts]) => {
        const ws = X.utils.aoa_to_sheet(aoa);
        const cols = (aoa[0] || []).map((h, j) => { let w = String(h || '').length * 2 + 2; aoa.slice(1, 200).forEach(r => { const v = r[j]; const l = v == null ? 0 : String(v).length * (/[가-힣]/.test(String(v)) ? 2 : 1.1); if (l > w) w = l; }); return { wch: Math.min(60, Math.max(8, Math.round(w))) }; });
        ws['!cols'] = cols;
        if (fmts) {
          const rng = X.utils.decode_range(ws['!ref']);
          for (let r = 1; r <= rng.e.r; r++) fmts.forEach((t, c) => { const cell = ws[X.utils.encode_cell({ r, c })]; if (!cell || cell.t !== 'n') return; cell.z = t === 'p' ? '0.0%' : t === 'x' ? '0.00' : '#,##0'; });
        } else {
          const rng = X.utils.decode_range(ws['!ref']);
          for (let r = 1; r <= rng.e.r; r++) for (let c = 0; c <= rng.e.c; c++) { const cell = ws[X.utils.encode_cell({ r, c })]; if (cell && cell.t === 'n' && Math.abs(cell.v) >= 1000) cell.z = '#,##0'; }
        }
        X.utils.book_append_sheet(wb, ws, sn.slice(0, 31));
      });
      const fname = name + '.xlsx';
      dlCap().then(dl => {
        if (!dl) { X.writeFile(wb, fname); return; }
        const blob = new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })]);
        dl.save({ filename: fname, data: blob }).then(() => toast('저장했어요'), e => { if (e && e.code !== 'declined') toast('저장하지 못했어요 (' + (e.code || '오류') + ')'); });
      });
    }).catch(() => toast('엑셀 도구를 불러오지 못했어요. 「표 복사」를 써 주세요'));
  }

  // ───────── 상세 ─────────
  let lastFocus = null;
  // 성과 진단: 이 콘텐츠의 특징(주제·시기·제작·시리즈·제목 조건·첫날 속도)마다 같은 특징의 과거 게시물이 보통 평소의 몇 배였는지 견줘
  // 1.2배 이상 = 잘 되는 특징, 0.85배 이하 = 약한 특징. 함께 나타난 특징이지 원인 단정은 아님.
  // 타 대학 조사값: context/타채널 벤치마크 분석.md(2026-10-15, 대학·입시 채널 15곳 유튜브 롱폼 · 이런 제목 / 아닌 제목 지수)
  const EXT_TITLE = [
    ['학번·대상을 부른 제목', /새내기|헌내기|학번|고3|고등학생|수험생|신입생|예비\s*대학생|전주대\s*오면|스무\s*살|20살|대학생|\d학년/, 2.73, 0.97, '우리 롱폼도 같은 방향이지만 대부분 2월·3월이라 시기 효과와 섞여 있어요'],
    ['브이로그', /브이로그|vlog/i, 2.42, 1.00],
    ['물음표 제목', /[?？]/, 1.51, 0.97, '우리 채널은 기간에 따라 방향이 엇갈려 판정 보류예요'],
    ['따옴표 대사 제목', /["“”]/, 0.49, 1.03],
    ['순위·꿀팁형 제목', /TOP\s?\d|순위|꿀팁/i, 0.64, 1.00],
  ];
  // 같은 조사에서 잘 된 영상이 모인 소재
  const EXT_TOPIC = [['혜택·돈', /장학|등록금|무료|지원금|혜택|\d+\s?만\s?원/], ['입시 시즌 정보', /수시|정시|입시|전형|면접|실기|원서/], ['재학생의 솔직한 이야기', /재학생|솔직|브이로그|vlog/i], ['축제 연예인 무대', /(축제|대동제).*(연예인|가수|아이돌|공연|무대|라인업|직캠)|(연예인|가수|아이돌|공연|무대|라인업|직캠).*(축제|대동제)/]];
  const gStat = L => { const a = L.filter(judged); return a.length >= MIN_N ? { m: median(a.map(ratio)), n: a.length, hit: hitRate(a) } : null; };
  const lvl = m => m >= 1.2 ? 'good' : m <= 0.85 ? 'bad' : 'info';
  const jong = w => { const c = String(w).replace(/[」』"'\s]+$/, '').slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 > 0; };
  const eun = w => w + (jong(w) ? '은' : '는'), ieyo = w => w + (jong(w) ? '이에요' : '예요');
  const doy = d => daysBetween(d.slice(0, 4) + '-01-01', d);
  // 막대: 이 콘텐츠 / 우리 같은 주제 / 타 대학 같은 주제
  const cmpBars = R => { R = R.filter(x => x && x[1] != null); if (R.length < 2) return ''; const mx = Math.max(1.5, ...R.map(x => x[1])); return '<div class="cmps">' + R.map((x, i) => '<div class="cmpb"><span class="cl">' + x[0] + '</span><span class="ct"><i class="' + (i ? '' : x[1] >= 1 ? 'up' : 'down') + '" style="width:' + Math.min(100, x[1] / mx * 100).toFixed(1) + '%"></i></span><span class="cv num">' + xf(x[1]) + '</span></div>').join('') + '</div>'; };
  function diag(it) {
    const out = [], F = [], r = ratio(it), base = baseFor(it), own = OWN.includes(it.c), we = own ? '우리' : chName(it.c), age = daysBetween(it.d, D.updated);
    const P = D.items.filter(x => x !== it && x.c === it.c && x.t !== '스토리' && !x.ad && !x.x && x.d >= addDays(D.updated, -730));
    const baseTxt = base.by === '형식' ? '평소 = 같은 형식 ' + typeShort(it.t) + ' 최근 1년 중간값 ' + fmtK(base.v) : '평소 = 채널 전체 중간값 ' + fmtK(base.v);
    // 주제: 우리 같은 분류 · 타 대학 인스타 같은 분류(각 학교 자기 평소 대비 좋아요)
    const tg = it.g ? gStat(P.filter(x => x.g === it.g)) : null;
    const bg = own && it.g ? gStat(D.items.filter(x => benchNames().includes(x.c) && x.g === it.g && x.t !== '스토리' && x.d >= addDays(D.updated, -730))) : null;
    if (tg) {
      const q = '「' + it.g + '」';
      const h = eun(q) + (tg.m >= 1.2 ? (bg && bg.m >= 1.2 ? ' 우리도 타 대학도 잘 되는 주제예요.' : bg && bg.m < 1 ? ' 타 대학보다 우리 채널에서 특히 잘 되는 주제예요.' : ' ' + we + ' 채널에서 잘 되는 주제예요.')
        : tg.m <= 0.85 ? (r != null && r >= HIT && !young(it) ? ' 보통 약한 주제인데 이 콘텐츠는 잘 됐어요.' : ' ' + we + ' 채널에서 보통 약한 주제예요.') : ' ' + we + ' 채널에서 보통 수준의 주제예요.');
      F.push({ k: '주제', m: tg.m, nm: q + ' 주제', h, s: we + ' 최근 2년 ' + tg.n + '개 중간값' + (tg.hit != null ? ' · 잘 된 비율 ' + pct0(tg.hit) : '') + (bg ? ' · 타 대학 인스타 3곳 ' + bg.n + '개' : ''), bars: cmpBars([['이 콘텐츠', r], [we + ' 같은 주제', tg.m], bg ? ['타 대학 같은 주제', bg.m] : null]) });
    }
    // 시기: 예년 같은 때(앞뒤 3주) 같은 주제, 없으면 채널 전체
    const S0 = D.items.filter(x => x !== it && x.c === it.c && x.t !== '스토리' && !x.ad && !x.x && x.d < addDays(it.d, -300) && (dd => Math.min(dd, 365 - dd) <= 21)(Math.abs(doy(x.d) - doy(it.d))));
    const sg = it.g ? gStat(S0.filter(x => x.g === it.g)) : null, sa = sg ? null : gStat(S0);
    if (sg) F.push({ k: '시기', m: sg.m, nm: sg.m >= 1 ? '예년에도 잘 된 주제·시기' : '예년에 약했던 주제·시기', h: '예년 이맘때 「' + it.g + '」 게시물은 ' + mW(it.c) + '가 평소의 ' + xf(sg.m) + '였어요.', s: '지난해까지 같은 때 앞뒤 3주 · ' + sg.n + '개' });
    else if (sa) F.push({ k: '시기', m: sa.m, nm: sa.m >= 1 ? '예년에도 잘 된 시기' : '예년에 약했던 시기', h: '예년 이맘때 ' + we + ' 게시물은 ' + mW(it.c) + '가 평소의 ' + xf(sa.m) + '였어요.', s: '지난해까지 같은 때 앞뒤 3주 · ' + sa.n + '개' });
    // 제작 주체·시리즈
    if (it.p && own) { const pg = gStat(P.filter(x => x.p === it.p)); if (pg) F.push({ k: '제작', m: pg.m, nm: it.p + (/제작$/.test(it.p) ? '' : ' 제작'), h: '「' + it.p + '」 콘텐츠는 보통 조회가 평소의 ' + xf(pg.m) + '예요.', s: we + ' 최근 2년 ' + pg.n + '개' + (pg.hit != null ? ' · 잘 된 비율 ' + pct0(pg.hit) : '') }); }
    if (it.s) { const ss = gStat(P.filter(x => x.s === it.s)); if (ss) F.push({ k: '시리즈', m: ss.m, nm: '「' + it.s + '」 시리즈', h: '「' + it.s + '」 시리즈는 보통 ' + mW(it.c) + '가 평소의 ' + xf(ss.m) + '예요.', s: '같은 시리즈 ' + ss.n + '개' }); }
    // 잘 되는 조건(전략 화면과 같은 계산) 중 이 콘텐츠에 해당하는 것
    const RL = own ? rulesFor(it.c).filter(x => x.kind !== '형식' && !/제작|만든|협업/.test(x.label) && x.f(it)).slice(0, 3) : [];
    RL.forEach(x => F.push({ k: /제목/.test(x.label) ? '제목' : '조건', m: x.eff, nm: x.label, h: eun('「' + x.label + '」') + ' ' + we + ' 채널에서 나머지보다 조회가 ' + xf(x.eff) + (x.eff >= 1 ? ' 잘 됐어요.' : '로 덜 됐어요.'), s: '이 조건 평소의 ' + xf(x.ma) + ' · 나머지 ' + xf(x.mb) + ' · 최근 2년 ' + x.na + '개' }));
    // 타 대학 조사(유튜브): 제목 특징은 롱폼만(쇼츠는 제목에 따른 차이가 거의 없었음)
    if (it.c === '유튜브') {
      const tt = title(it.n);
      if (it.t !== '1분 이하') EXT_TITLE.filter(e => e[1].test(tt)).forEach(e => { const mine = e[0] === '물음표 제목' ? RL.find(x => x.label === '질문형 제목') : null, opp = mine && (mine.eff >= 1) !== (e[2] >= e[3]); F.push({ k: '제목', m: e[2] / e[3], nm: e[0], ext: !!mine || !!e[4], h: '타 대학 조사에서 ' + eun('「' + e[0] + '」') + ' ' + (e[2] >= e[3] ? '잘 되는' : '약한') + ' 제목이었어요.', s: '대학·입시 채널 15곳 롱폼 · 이런 제목 평소의 ' + xf(e[2]) + ' · 아닌 제목 ' + xf(e[3]) + (opp ? ' · 우리 채널에서는 반대로 나왔어요' : e[4] ? ' · ' + e[4] : '') }); });
      const tp = EXT_TOPIC.find(e => e[1].test(it.n || ''));
      if (tp) F.push({ k: '소재', m: 1, ext: true, nm: '「' + tp[0] + '」 소재', h: '타 대학에서 잘 된 영상이 모인 소재 ' + ieyo('「' + tp[0] + '」') + '.', s: '대학·입시 채널 15곳 유튜브 조사 · 2026년 10월' });
    }
    // 첫날 속도 vs 최종: 처음엔 느렸는데 잘 됐으면 추천·검색으로 늦게 퍼진 흐름
    const f0 = (it.ag || []).find(x => x && x[0] > 0 && x[1] >= 1 && x[1] <= 2), b0 = f0 && agAt(it.c, it.t, f0[1]);
    if (b0 && b0.m > 0) {
      const pr = f0[0] / b0.m, late = r != null && !young(it) && pr < 1 && r >= HIT;
      F.push({ k: '속도', m: late ? 1.2 : pr >= 1.5 || pr <= 0.67 ? pr : 1, nm: pr >= 1.5 ? '빠른 첫 반응' : late ? '뒤늦은 확산' : pr <= 0.67 ? '느린 첫 반응' : '평소 같은 첫 반응', h: pr >= 1.5 ? '올리자마자 반응이 빨랐어요.' : late ? '처음엔 느렸다가 뒤늦게 늘었어요.' : pr <= 0.67 ? '첫날 반응이 평소보다 느렸어요.' : '첫날 반응은 평소와 비슷했어요.', s: agName(f0[1]) + ' 조회 평소의 ' + xf(pr) + (late ? ' · 추천·검색으로 늦게 퍼진 흐름으로 보여요' : '') });
    }
    // 반응: 저장·공유·좋아요가 도달·조회 대비 평소보다 많았는지 · 우리 같은 주제·같은 형식과 막대 비교
    if (own) rxKeysOf(it.c).forEach(k => {
      const m = rxVal(it, k); if (m == null) return;
      const M = RXM[k], raw = rxRate(it, k), bv = rxBase(it.c, k, it.t);
      const md = arr => { const a = arr.map(x => rxVal(x, k)).filter(v => v != null); return a.length >= MIN_N ? median(a) : null; };
      const lead = raw != null ? M[1] + ' ' + pctA(raw) + '로 ' : M[0] + '이 ';
      F.push({ k: '반응', m, ext: true, nm: M[1], h: lead + '평소의 ' + xf(m) + (m >= 1.2 ? '예요. ' + M[3] : m <= 0.85 ? '에 그쳤어요.' : '로 비슷해요.'),
        s: (k === 'reach' ? '평소 = 같은 형식 ' + typeShort(it.t) + ' 최근 1년 도달 중간값' : '평소 = 같은 형식 ' + typeShort(it.t) + ' 최근 1년 중간값 ' + pctA(bv) + ' · ' + rxDef(k, it.c)),
        bars: cmpBars([['이 콘텐츠', m], it.g ? [we + ' 같은 주제', md(P.filter(x => x.g === it.g))] : null]) });
    });
    // 결과 + 요약
    if (r != null) {
      if (young(it)) out.push(['info', '결과', (age <= 0 ? '오늘 올려서' : '올린 지 ' + age + '일째라') + ' 아직 판정 전이에요.', '지금까지 평소의 ' + xf(r) + ' · ' + AGE_MIN + '일이 지나면 판정해요']);
      else out.push([r >= HIT ? 'good' : r < 0.5 ? 'bad' : 'info', '결과', MN[mainM(it.c)] + '가 평소의 ' + xf(r) + (r >= HIT ? '로 잘 된 게시물이에요.' : r < 0.5 ? '로 절반에 못 미쳤어요.' : r >= 1 ? '로 평소보다 조금 높아요.' : '로 평소보다 조금 낮아요.'), baseTxt]);
      const use = F.filter(x => !x.ext), pos = use.filter(x => x.m >= 1.2).sort((a, b) => b.m - a.m), neg = use.filter(x => x.m <= 0.85).sort((a, b) => a.m - b.m);
      const names = L => L.slice(0, 3).map(x => x.nm).join(' · ');
      const over = tg && tg.m > 0 && r / tg.m >= 1.5 ? '같은 주제 평소보다도 ' + xf(r / tg.m) + ' 높아요' : '';
      if (young(it)) out.push(['info', '요약', pos.length ? '지금 보이는 잘 되는 특징은 ' + ieyo(names(pos)) + '.' : '눈에 띄게 잘 되는 특징은 아직 없어요.', [neg.length ? '약한 특징 ' + names(neg) : '', '잘 된 이유는 ' + AGE_MIN + '일 뒤 판정과 함께 봐요'].filter(Boolean).join(' · ')]);
      else if (r >= 1) out.push(['good', '요약', pos.length ? '잘 된 이유로 보이는 것은 ' + ieyo(names(pos)) + '.' : '주제·시기·제작만 보면 평범한 조합이에요. 장면·편집 같은 콘텐츠 자체의 힘으로 보여요.', [over, neg.length ? '약한 특징 ' + names(neg) : ''].filter(Boolean).join(' · ')]);
      else out.push(['bad', '요약', neg.length ? '아쉬운 이유로 보이는 것은 ' + ieyo(names(neg)) + '.' : pos.length ? names(pos) + '처럼 잘 되는 조합인데 낮았어요. 제목·첫 장면을 살펴볼 만해요.' : '주제·시기·제작은 평범한 조합이에요. 제목·첫 장면을 살펴볼 만해요.', '']);
    }
    F.forEach(x => out.push([x.k === '소재' ? 'good' : lvl(x.m), x.k, x.h, x.s, x.bars || '']));
    return out;
  }
  function signals(it) {
    const out = [];
    const r = ratio(it), base = baseFor(it), v = last(it) || [];
    // 과거 기록은 과거 기록끼리, 자동 수집 게시물은 자동 수집끼리 비교
    const peers = D.items.filter(x => x.c === it.c && x.t !== '스토리' && !x.ad && !x.x === !it.x);
    const rankPct = fn => { const vals = peers.map(fn).filter(x => x != null).sort((a, b) => b - a); const me = fn(it); if (me == null || !vals.length) return null; return (vals.findIndex(x => x <= me) + 1) / vals.length; };
    diag(it).forEach(x => out.push(x));
    const pr = rankPct(mainVal);
    if (pr != null && pr <= 0.1) out.push(['good', '순위', '이 채널 게시물 전체에서 상위 ' + Math.max(1, Math.round(pr * 100)) + '%예요.', peers.length + '개 중 ' + Math.max(1, Math.round(pr * peers.length)) + '위']);
    if (it.c === '인스타그램' && it.r > 0) {
      const e = engagement(it);
      if (e != null && base.q && !it.x && e < base.q * 0.6) out.push(['bad', '반응', '도달 대비 반응이 평소의 60%도 안 돼요.', '도달한 사람 중 좋아요·댓글·공유·저장한 비율 ' + pct(e) + ' · 평소 ' + pct(base.q)]);
      if ((v[2] || 0) > 200) out.push(['info', '반응', '댓글이 ' + fmt(v[2]) + '개 달렸어요. 이벤트·참여형 게시물에서 자주 보이는 모습이에요.', '']);
    }
    if (it.c === '유튜브') {
      const c = completion(it);
      if (c != null) out.push(c >= 0.6 ? ['good', '시청', '시청자의 ' + Math.round(c * 100) + '%가 끝까지 봤어요.', '평균 시청 ' + fmt(it.a) + '초 / 영상 ' + fmt(it.l) + '초'] : c < 0.2 ? ['bad', '시청', '평균적으로 영상의 ' + Math.round(c * 100) + '%만 보고 나갔어요.', '평균 시청 ' + fmt(it.a) + '초 / 영상 ' + fmt(it.l) + '초'] : ['info', '시청', '평균적으로 영상의 ' + Math.round(c * 100) + '%까지 봤어요.', '평균 시청 ' + fmt(it.a) + '초 / 영상 ' + fmt(it.l) + '초']);
      if (it.ad) out.push(['info', '광고', it.ad.s === '패턴' ? '광고로 늘어난 조회로 보여요(추정).' : it.ad.x && !it.ad.k.length && !it.ad.mk ? '과거 엑셀 기록에 광고 집행으로 적힌 게시물이에요.' : it.ad.mk && !it.ad.k.length ? '메타 광고로 홍보한 게시물이에요. 조회·도달에 광고분이 섞여 있어요.' : '구글애즈 광고를 집행한 영상이에요' + (it.ad.s === '추정' ? ' (추정 연결).' : '.'), it.ad.k.length ? it.ad.k.join(' · ') : it.ad.mk ? it.ad.mk.map(metaLabel).join(' · ') : it.ad.x ? '캠페인 정보 없음' : '조회 1만당 좋아요 ' + ((v[1] || 0) / Math.max(1, v[0]) * 1e4).toFixed(1) + '개']);
      if (it.e != null && v[0]) { const er = it.e / v[0]; if (er < 0.3) out.push(['bad', '광고', '실제 시청 조회는 전체의 ' + Math.round(er * 100) + '%뿐이에요.', '광고 노출이 많았을 수 있어요']); }
      if (it.sus) out.push(['info', '참고', '광고 표시는 없지만 광고 조회로 보여요.', it.sus]);
      if (it.hid) out.push(['info', '참고', '비공개·중복 업로드로 보여요.', HID_TIP]);
    }
    if (it.c === '유튜브' && covFrom('유튜브') && it.d < covFrom('유튜브')) out.push(['info', '참고', dot(covFrom('유튜브')) + ' 이후 조회만 집계된 영상이에요.', '그 전 누적 조회는 원본 수집 범위 밖']);
    return out;
  }
  function whyText(it) {
    if (it.ad) {
      const v = last(it) || [], cs = D.ads ? D.ads.camps.filter(c => it.ad.k.includes(c.n)) : [];
      if (!cs.length && it.ad.mk) return '메타 광고(게시물 홍보)로 노출한 게시물이에요 (' + it.ad.mk.map(metaLabel).join(', ') + '). 조회·도달에 광고분이 섞여 있어 채널 평소와 비교하지 않아요.';
      if (!cs.length && it.ad.x) return '과거 엑셀 기록에 광고 집행으로 적힌 게시물이에요. 캠페인·광고비 정보는 남아 있지 않아요. 조회·도달에 광고분이 섞여 있어 평소와 비교하지 않아요.';
      if (!cs.length) return '광고 리포트 이후 영상이라 캠페인 연결은 없지만, 조회 ' + fmtK(v[0]) + '에 비해 좋아요가 ' + fmt(v[1]) + '개뿐이라 광고 노출로 늘어난 조회로 추정해요.';
      const cost = sum(cs.map(c => c.cost)), imp = sum(cs.map(c => c.imp));
      return '구글애즈 캠페인 ' + cs.length + '개(' + cs.map(c => c.n).join(', ') + ')로 노출 ' + fmtK(imp) + '회, 광고비 ' + fmtK(cost) + '원이 집행된 영상이에요. 조회 ' + fmtK(v[0]) + ' 중 상당 부분이 광고 노출이라 채널 평소와 비교하지 않아요.';
    }
    if (it.x) {
      const yr = it.d.slice(0, 4), same = D.items.filter(x => x.x && x.c === it.c && x.t !== '스토리' && x.d.slice(0, 4) === yr);
      const ml = median(same.map(x => val(x, 1))), v = last(it) || [];
      return '엑셀로 기록하던 시기(' + dot(IG_AUTO) + ' 이전)의 게시물이라 기록 당시 수치예요. 지금 게시물과 평소 대비로 비교하지 않아요.' +
        (ml ? ' 같은 해(' + yr + '년) 게시물의 좋아요 중간값은 ' + fmtK(ml) + '개인데, 이 게시물은 ' + fmt(v[1]) + '개예요.' : '') +
        (it.r > 0 ? ' 도달 ' + fmtK(it.r) + '.' : '');
    }
    const r = ratio(it), g = groupBy(D.items.filter(x => x.c === it.c && !x.ad && !x.x && x.t !== '스토리'), 'g').find(x => x.k === it.g);
    const parts = [];
    const bs = baseFor(it);
    // 「조회 모이는 중」 설명은 진단 「참고」 카드 한 곳에만 · 괄호 대신 두 문장
    if (r != null) parts.push((young(it) ? '지금까지 ' : '지금 ') + MN[mainM(it.c)] + ' ' + fmtK(mainVal(it)) + ', 평소의 ' + xf(r) + (young(it) ? '예요.' : r >= HIT ? '예요. 잘 된 게시물 기준 1.5배를 넘었어요.' : r >= 1 ? '로 평소보다 조금 잘 됐어요.' : r >= 0.5 ? '로 평소보다 조금 낮아요.' : '로 평소의 절반에 못 미쳤어요.') + ' 평소는 ' + (bs.by === '형식' ? '같은 형식 최근 1년 중간값' : '채널 중간값') + ' ' + fmtK(bs.v) + '이에요.');
    else if (it.hid) parts.push('조회 ' + fmt(mainVal(it)) + '로 비공개·일부 공개나 중복 업로드로 보여요. 평소 계산에서 뺐어요.');
    if (g && g.idx != null) parts.push('「' + it.g + '」 분류 게시물은 보통 ' + mW(it.c) + '가 평소의 ' + xf(g.idx) + '인데, 이 콘텐츠는 ' + (r != null && r > g.idx ? '그보다 높아요.' : '그보다 낮아요.'));
    if (it.c === '인스타그램' && it.r > 0) parts.push('도달한 ' + fmtK(it.r) + '명 중 ' + pct(engagement(it)) + '가 좋아요·댓글·공유·저장으로 반응했어요.');
    if (it.w && it.w.length) parts.push('만든 사람: ' + it.w.join(', ') + ' · ' + it.p + '.');
    return parts.join(' ');
  }
  function openDetail(it) {
    if (!it) return;
    lastFocus = document.activeElement;
    const v = last(it) || [], m = mainM(it.c), r = it.ad ? null : ratio(it), d = r == null ? null : r - 1;
    // 아직 판정 전(조회 모이는 중)은 하락색이 아니라 회색
    const cls = d == null || young(it) ? 'flat' : dCls(d);
    const wk = weekly() ? inc(it, m) : null;
    const metrics = [['조회', fmt(v[0])], ['좋아요', fmt(v[1])], ['댓글', fmt(v[2])]];
    if (it.c === '인스타그램' || (it.c === 'hong._.video' && v[3] != null)) metrics.push(['공유', fmt(v[3])], ['저장', fmt(v[4])], ['도달', fmt(it.r)], ['도달 대비 반응', pct(engagement(it))], ['도달 대비 저장', it.r ? pct((v[4] || 0) / it.r) : '–']);
    // 유튜브 시청 지표가 셋 다 비면 「–」 세 줄 대신 한 줄
    if (it.c === '유튜브') { if (it.a || completion(it) != null || it.e != null) metrics.push(['영상 길이', it.l ? Math.floor(it.l / 60) + '분 ' + (it.l % 60) + '초' : '–'], ['평균 시청', it.a ? fmt(it.a) + '초' : '–'], ['시청 완료율', pct(completion(it))], ['실제 시청 조회', fmt(it.e)]); else metrics.push(['영상 길이', it.l ? Math.floor(it.l / 60) + '분 ' + (it.l % 60) + '초' : '–'], ['시청 자료', '게시 2~3일 뒤 들어와요']); }
    if (isBench(it.c) || it.c === 'hong._.video') metrics.push(['좋아요율', pct(likeRate(it))]);
    if (it.x && it.im != null) metrics.push(['노출', fmt(it.im)]);
    metrics.push(['게시일', dot(it.d) + ' · ' + whenTxt(it.d)], ['형식', fmtType(it.t)]);
    if (it.x) metrics.push(['데이터', '엑셀 과거 기록(기록 당시 수치)']);
    if (it.w && it.w.length) metrics.push(['참여자', it.w.join(', ')]);
    if (it.ad && it.ad.mk && D.ads && D.ads.meta) { const ms = D.ads.meta.filter(c => it.ad.mk.includes(c.n)); if (ms.length) metrics.push(['메타 광고비', usd(sum(ms.map(c => c.spend)))], ['메타 광고 노출', fmt(sum(ms.map(c => c.imp)))], ['메타 링크 클릭', fmt(sum(ms.map(c => c.clk)))]); }
    if (it.ad && it.ad.k.length && D.ads) { const cs = D.ads.camps.filter(c => it.ad.k.includes(c.n)); if (cs.length) metrics.push(['광고 캠페인', cs.length + '개 · ' + dot(cs.map(c => c.from).sort()[0]) + '~' + dot(cs.map(c => c.to).sort().pop())], ['캠페인 광고비', fmt(sum(cs.map(c => c.cost))) + '원' + (cs.some(c => c.videos.length > 1) ? ' (여러 영상 공동)' : '')], ['캠페인 노출', fmt(sum(cs.map(c => c.imp)))]); }
    const sim = D.items.filter(x => x !== it && x.c === it.c && x.g === it.g && x.t !== '스토리').sort((a, b) => (mainVal(b) || 0) - (mainVal(a) || 0)).slice(0, 5);
    const el = $('detail');
    el.innerHTML = '<div class="dwrap">' +
      '<div class="dh"><button type="button" id="dClose" aria-label="뒤로">‹</button><div class="ctr"><small>' + esc(chName(it.c)) + ' · ' + esc(glab(it)) + '</small><b class="num ' + cls + '">' + MN[m] + ' ' + fmtK(mainVal(it)) + (d == null ? (it.hid ? ' · 비공개로 보임' : '') : young(it) ? ' · 모이는 중' : ' · 평소의 ' + xf(d + 1)) + '</b></div><span></span></div>' +
      '<div class="dtabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-s="dChart">성과</button><button type="button" role="tab" aria-selected="false" data-s="dSig">성과 진단</button><button type="button" role="tab" aria-selected="false" data-s="dMet">지표</button><button type="button" role="tab" aria-selected="false" data-s="dSim">비슷한 콘텐츠</button></div>' +
      '<section class="dsec" id="dChart"><h1 class="dtitle">' + line(it) + '</h1>' +
        '<div class="dbig num">' + fmt(mainVal(it)) + '<small class="' + cls + '">' + (it.ad ? '광고 영상이라 평소 대비는 계산하지 않아요' : it.hid ? '비공개로 보임 · 평소 계산에서 뺌' : d == null ? '' : (young(it) ? '지금까지 ' + MN[m] + ' 평소의 ' + xf(d + 1) + ' · 조회 모이는 중' : MN[m] + ' 평소의 ' + xf(d + 1))) + '</small></div>' +
        (wk != null ? '<div class="num ' + (wk >= 0 ? 'up' : 'down') + '" style="font-weight:700;margin-top:2px">이번 주 ' + MN[m] + ' ' + sgn(wk) + fmt(wk) + '</div>' : '') +
        '<div class="dtags"><span class="tag">' + esc(glab(it)) + '</span>' + ptag(it.p) + adtag(it) + susTag(it) + hidTag(it) + histTag(it) + '<span class="tag">' + esc(fmtType(it.t)) + '</span>' + (it.w || []).map(n => '<span class="tag">' + esc(n) + '</span>').join('') + '</div>' +
        '<div class="cmp"><canvas id="dCanvas"></canvas></div>' +
        // 누를 수 없는 토글 대신 실제로 그린 차트 이름 한 줄
        '<p class="note" style="text-align:center">' + (detailLine(it) ? '기록 날짜별 누적 ' + MN[m] : '이 콘텐츠 · 같은 분류 · 같은 형식 중간값') + '</p></section>' +
      '<div class="gap"></div><section class="dsec why"><div class="lb"><span>' + ICO.spark + ' ' + (it.ad ? '광고 집행 정보' : d == null || young(it) ? '성과 요약' : d >= 0 ? '왜 잘 됐을까?' : '왜 아쉬웠을까?') + '</span><small>' + mdLabel(D.updated) + ' 기준</small></div><p>' + esc(whyText(it)) + '</p></section>' +
      '<div class="gap"></div><section class="dsec sig" id="dSig"><h3>성과 진단</h3><div class="h">' + (OWN.includes(it.c) ? '우리 과거 게시물·타 대학 게시물과 견준 결과' : '이 학교 과거 게시물과 견준 결과') + '</div>' +
        signals(it).map(s => '<div class="sg"><span class="k ' + s[0] + '">' + s[1] + '</span><div><b>' + esc(s[2]) + '</b>' + (s[3] ? '<span>' + esc(s[3]) + '</span>' : '') + (s[4] || '') + '</div></div>').join('') +
        '<p class="note">우리 자료는 최근 2년 게시물 중간값이에요 · 타 대학 제목·소재는 2026년 10월 대학·입시 채널 15곳 유튜브 조사 · 함께 나타난 특징이라 원인이라고 단정하진 않아요</p></section>' +
      '<div class="gap"></div><section class="dsec" id="dMet"><h3 style="margin:0 0 6px;font-size:var(--fs-xl);font-weight:700">지표</h3><div class="mgrid">' + metrics.map(m2 => '<div><span>' + esc(m2[0]) + '</span><b>' + esc(m2[1]) + '</b></div>').join('') + '</div>' +
        '<h3 style="margin:22px 0 10px;font-size:var(--fs-lg);font-weight:700">캡션</h3><p class="caption">' + esc(String(it.n || '').trim()) + '</p></section>' +
      '<div class="gap"></div><section class="dsec" id="dSim"><h3 style="margin:0 0 6px;font-size:var(--fs-xl);font-weight:700">같은 분류의 다른 콘텐츠</h3><ol class="rank" id="dSimList">' + rankRows(sim) + '</ol></section>' +
      '</div><div class="cta">' + (it.u ? '<a href="' + esc(it.u) + '" target="_blank" rel="noopener">원본 보기</a>' : '<span>원본 링크는 인스타그램 앱에서 확인해 주세요</span>') + '</div>';
    el.hidden = false; el.scrollTop = 0; document.body.style.overflow = 'hidden';
    $('dClose').focus();
    $('dClose').addEventListener('click', closeDetail);
    el.querySelectorAll('.dtabs button').forEach(b => b.addEventListener('click', () => {
      el.querySelectorAll('.dtabs button').forEach(x => x.setAttribute('aria-selected', x === b));
      el.scrollTo({ top: $(b.dataset.s).offsetTop - 120, behavior: 'smooth' });
    }));
    wireRank($('dSimList'), sim);
    drawDetailChart(it);
  }
  // ═════════ 핵심 숫자 상세 — 홈 칸을 누르면 그래프 · 분석 · 데이터 표 ═════════
  const lastMonths = n => { const out = []; for (let k = n - 1; k >= 0; k--) { const d = new Date(D.updated + 'T00:00:00Z'); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - k); out.push(d.toISOString().slice(0, 7)); } return out; };
  const monLab = k => (+k.slice(5, 7)) + '월';
  const yAx = cb => ({ display: true, position: 'right', grid: { color: css('--line') }, border: { display: false }, ticks: { maxTicksLimit: 4, font: { size: 13 }, color: css('--muted'), callback: cb } });
  const kTbl = (head, rows) => '<div class="tw"><table class="tbl"><thead><tr>' + head.map((h, i) => '<th' + (i ? ' class="n"' : '') + '>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(r => '<tr>' + r.map((c, i) => '<td' + (i ? ' class="n"' : '') + '>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  const kRow = (cls, k, b, s) => '<div class="sg"><span class="k ' + cls + '">' + k + '</span><div><b>' + b + '</b>' + (s ? '<span>' + s + '</span>' : '') + '</div></div>';
  const upDn = d => d == null ? 'info' : d > 0.03 ? 'good' : d < -0.03 ? 'bad' : 'info';
  function kpiPage(key, chs) {
    const scope = chs.length > 1 ? '우리 채널 ' + chs.map(chName).join('·') : chName(chs[0]);
    const one = chs.length === 1, col = one ? chColor(chs[0]) : '#0078ad', A = [];
    if (key === 'wk') {
      const w = weekModel(chs, 0), p = w && w.cur; if (!p) return null;
      const P = []; for (let i = 1; i < D.dates.length; i++) { const x = weekPart(chs, i); if (x && x.days <= OKGAP && x.d1 >= addDays(D.updated, -120)) P.push(x); } // 최근 4달 기록만
      const S12 = P.slice(-12), day = p.v / p.days;
      if (w.cmp) A.push(kRow(upDn(w.cmp.d), '비교', '하루 평균 <span class="num">+' + fmtK(day) + '</span> · 직전 ' + w.cmp.days + '일 대비 <span class="num">' + dTxt(w.cmp.d, 1) + '</span>', '직전 기간 ' + md2(w.prev.d0) + ' → ' + md2(w.prev.d1)));
      if (p.v) A.push(kRow('info', '구성', '새 게시물 ' + p.nw.length + '개가 ' + pct0(p.vn / p.v) + ' · 예전 게시물이 ' + pct0(p.vo / p.v), p.vn >= p.vo ? '이번 기간 증가는 새로 올린 게시물이 끌었어요' : '예전 게시물이 계속 보이며 증가를 받쳤어요'));
      const avgs = P.map(x => x.v / x.days).sort((a, b) => b - a), rk = avgs.filter(v => v > day).length + 1;
      if (avgs.length >= 3) A.push(kRow(rk <= Math.ceil(avgs.length / 3) ? 'good' : rk > avgs.length * 2 / 3 ? 'bad' : 'info', '순위', '하루 평균이 기록된 ' + avgs.length + '개 기간 중 ' + rk + '번째예요', '최근 4달 · 기간 = 기록과 기록 사이'));
      if (!one) { const by = chs.map(c => [c, sum(p.nw.concat(p.old).filter(it => it.c === c).map(p.inc0))]).sort((a, b) => b[1] - a[1]); A.push(kRow('info', '채널', by.map(x => chName(x[0]) + ' +' + fmtK(x[1])).join(' · '), p.v ? chName(by[0][0]) + ' 몫 ' + pct0(by[0][1] / p.v) : '')); }
      const top = p.nw.concat(p.old).filter(it => p.inc0(it) > 0).sort((a, b) => p.inc0(b) - p.inc0(a)).slice(0, 8);
      if (top[0] && p.v) A.push(kRow('info', '1위', '「' + esc((t => t.length > 18 ? t.slice(0, 18) + '…' : t)(title(top[0].n))) + '」 하나가 ' + pct0(p.inc0(top[0]) / p.v), '+' + fmtK(p.inc0(top[0])) + ' 조회'));
      return { scope, title: wLab(p) + ' 늘어난 조회', big: '+' + fmt(p.v), sub: md2(p.d0) + ' → ' + md2(p.d1) + ' · ' + p.days + '일 · 광고 제외', A,
        note: '기록 사이 하루 평균 늘어난 조회 · 진한 색 = 새 게시물, 연한 색 = 예전 게시물',
        chart: { type: 'bar', data: { labels: S12.map(x => md2(x.d1)), datasets: [{ label: '새 게시물', data: S12.map(x => x.vn / x.days), backgroundColor: col, stack: 's', borderRadius: 3, maxBarThickness: 30 }, { label: '예전 게시물', data: S12.map(x => x.vo / x.days), backgroundColor: col + '55', stack: 's', borderRadius: 3, maxBarThickness: 30 }] },
          options: chartOpts({ layout: { padding: { top: 8 } }, plugins: { legend: { display: true, position: 'bottom' }, tooltip: { callbacks: { title: c => { const x = S12[c[0].dataIndex]; return dot(x.d0) + ' → ' + dot(x.d1) + ' · ' + x.days + '일'; }, label: c => c.dataset.label + ' 하루 +' + fmtK(c.raw) } } }, scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: Object.assign(yAx(v => fmtK(v)), { stacked: true }) } }) },
        list: { t: '이 기간 많이 늘어난 게시물', L: top, o: { right: it => '조회 <em class="up">+' + fmtK(p.inc0(it)) + '</em>' } },
        table: kTbl(['기간', '일수', '늘어난 조회', '하루 평균', '새 게시물'], S12.slice().reverse().map(x => [md2(x.d0) + ' → ' + md2(x.d1), x.days + '일', '+' + fmt(x.v), '+' + fmt(Math.round(x.v / x.days)), x.nw.length + '개 · +' + fmtK(x.vn)])) };
    }
    if (key === 'hit') {
      const M = lastMonths(12).map(k => { const j = D.items.filter(it => chs.includes(it.c) && it.t !== '스토리' && !it.ad && it.d.slice(0, 7) === k).filter(judged), h = j.filter(isHit).length; return { k, n: j.length, h, r: j.length ? h / j.length : null }; });
      const yr = pool({ channels: chs, since: addDays(D.updated, -365) }).filter(it => !it.ad), yrR = hitRate(yr);
      const c30a = pool({ channels: chs, since: addDays(D.updated, -30) }).filter(it => !it.ad), c30 = c30a.filter(judged), r30 = hitRate(c30);
      if (r30 != null && yrR != null) A.push(kRow(upDn(r30 - yrR), '1년', '최근 30일 ' + pct0(r30) + ' · 최근 1년 ' + pct0(yrR), c30.length < MIN_N ? '최근 30일 판정 게시물이 ' + c30.length + '개라 참고만 해요' : ''));
      const yet = c30a.length - c30.length; if (yet > 0) A.push(kRow('info', '판정', yet + '개는 아직 판정 전이에요', '올린 지 ' + AGE_MIN + '일이 지나면 잘 됐는지 판정해요'));
      const q = pool({ channels: chs, since: addDays(D.updated, -90) }).filter(it => !it.ad && judged(it));
      const ft = groupBy(q, it => fmtType(it.t)).filter(r => r.n >= MIN_N && r.hit != null).sort((a, b) => b.hit - a.hit);
      if (ft.length >= 2) A.push(kRow('info', '형식', ft.map(r => r.k + ' ' + pct0(r.hit)).join(' · '), '최근 3달 · 형식마다 ' + MIN_N + '개 이상'));
      const gt = groupBy(q, 'g').filter(r => r.k && r.k !== 'undefined' && r.n >= MIN_N && r.hit != null).sort((a, b) => b.hit - a.hit);
      if (gt.length >= 2) A.push(kRow('good', '분류', gt[0].k + ' ' + pct0(gt[0].hit) + ' · ' + gt[0].n + '개', '가장 낮은 분류 ' + gt[gt.length - 1].k + ' ' + pct0(gt[gt.length - 1].hit) + ' · 최근 3달'));
      return { scope, title: '최근 30일 잘 된 비율', big: pct0(r30), sub: c30.length + '개 중 ' + c30.filter(isHit).length + '개 잘 됨', A,
        note: '월별 잘 된 비율 · 파란 막대 = 최근 1년 비율 이상 · 잘 된 = 조회 평소의 1.5배 이상',
        chart: { type: 'bar', data: { labels: M.map(r => monLab(r.k)), datasets: [{ data: M.map(r => r.r == null ? null : r.r * 100), backgroundColor: M.map(r => r.r != null && yrR != null && r.r >= yrR ? css('--up') : css('--muted') + '88'), borderRadius: 3, maxBarThickness: 30 }] },
          options: chartOpts({ plugins: { tooltip: { callbacks: { title: c => M[c[0].dataIndex].k.replace('-', '년 ') + '월', label: c => { const r = M[c.dataIndex]; return Math.round(c.raw) + '% · ' + r.n + '개 중 ' + r.h + '개'; } } } }, scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: yAx(v => v + '%') } }) },
        list: { t: '최근 30일 판정된 게시물', L: c30.slice().sort((a, b) => ratio(b) - ratio(a)) },
        table: kTbl(['월', '판정 게시물', '잘 된', '비율'], M.slice().reverse().map(r => [r.k.replace('-', '.'), r.n + '개', r.h + '개', pct0(r.r)])) };
    }
    if (key === 'posts') {
      const ms = lastMonths(12), cnt = (c, k) => D.items.filter(it => it.c === c && it.t !== '스토리' && (S.ads || !it.ad) && it.d.slice(0, 7) === k).length;
      const c30 = pool({ channels: chs, since: addDays(D.updated, -30) }), p30 = pool({ channels: chs, since: addDays(D.updated, -60), until: addDays(D.updated, -31) });
      const mAvg = median(ms.slice(0, -1).map(k => sum(chs.map(c => cnt(c, k)))));
      A.push(kRow(upDn(p30.length ? c30.length / p30.length - 1 : null), '직전', c30.length + '개 · 직전 30일 ' + p30.length + '개', mAvg != null ? '지난 11달 월 중간값 ' + Math.round(mAvg) + '개' : ''));
      const ft = groupBy(c30, it => fmtType(it.t)).sort((a, b) => b.n - a.n);
      if (ft.length) A.push(kRow('info', '형식', ft.map(r => r.k + ' ' + r.n + '개').join(' · '), '최근 30일'));
      const gt = groupBy(c30, 'g').filter(r => r.k && r.k !== 'undefined').sort((a, b) => b.n - a.n).slice(0, 3);
      if (gt.length) A.push(kRow('info', '분류', gt.map(r => r.k + ' ' + r.n + '개').join(' · '), '최근 30일'));
      const q = pool({ channels: chs, since: addDays(D.updated, -90) }), wd = [1, 2, 3, 4, 5, 6, 0].map(k => [WD[k], q.filter(it => new Date(it.d + 'T00:00:00Z').getUTCDay() === k).length]).sort((a, b) => b[1] - a[1]);
      if (q.length >= MIN_N) A.push(kRow('info', '요일', '많이 올린 요일 ' + wd.slice(0, 2).map(x => x[0] + ' ' + x[1] + '개').join(' · '), '최근 3달 ' + q.length + '개 · 가장 적은 요일 ' + wd[wd.length - 1][0] + ' ' + wd[wd.length - 1][1] + '개'));
      return { scope, title: '최근 30일 올린 게시물', big: c30.length + '<small>개</small>', sub: p30.length ? '직전 30일 대비 ' + sgn(c30.length - p30.length) + (c30.length - p30.length) + '개' : '', A,
        note: '월별 올린 게시물 · 스토리 제외 · 이번 달은 ' + (+D.updated.slice(8, 10)) + '일까지',
        chart: { type: 'bar', data: { labels: ms.map(monLab), datasets: chs.map(c => ({ label: chName(c), data: ms.map(k => cnt(c, k)), backgroundColor: chColor(c), stack: 's', borderRadius: 3, maxBarThickness: 30 })) },
          options: chartOpts({ plugins: { legend: { display: !one, position: 'bottom' }, tooltip: { callbacks: { label: c => c.dataset.label + ' ' + c.raw + '개' } } }, scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: Object.assign(yAx(v => v + '개'), { stacked: true }) } }) },
        list: { t: '최근 30일 올린 게시물', L: c30.slice().sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 15) },
        table: kTbl(['월'].concat(one ? [] : chs.map(chName)).concat(['합계']), ms.slice().reverse().map(k => [k.replace('-', '.')].concat(one ? [] : chs.map(c => cnt(c, k) + '개')).concat([sum(chs.map(c => cnt(c, k))) + '개']))) };
    }
    if (key === 'fol') {
      const F = (D.fol || []).filter(r => r[1] === '인스타그램').map(r => ({ d: r[0], v: r[2] }));
      const R = F.length >= 2 ? F : (D.acct || []).filter(x => x.ch === '인스타그램' && x.m['Profile followers'] != null).sort((a, b) => a.d < b.d ? -1 : 1).map(x => ({ d: x.d, v: x.m['Profile followers'], nf: x.m['New followers'] }));
      if (!R.length) return null;
      const cur = R[R.length - 1], prv = R[R.length - 2], fst = R[0];
      if (prv) A.push(kRow(cur.v > prv.v ? 'good' : cur.v < prv.v ? 'bad' : 'info', '직전', md2(prv.d) + ' → ' + md2(cur.d) + ' ' + sgn(cur.v - prv.v) + fmt(cur.v - prv.v) + '명', daysBetween(prv.d, cur.d) + '일 사이'));
      if (fst !== cur && fst !== prv) A.push(kRow(cur.v > fst.v ? 'good' : cur.v < fst.v ? 'bad' : 'info', '전체', dot(fst.d) + ' 이후 ' + sgn(cur.v - fst.v) + fmt(cur.v - fst.v) + '명', '하루 평균 ' + sgn(cur.v - fst.v) + (Math.round((cur.v - fst.v) / Math.max(1, daysBetween(fst.d, cur.d)) * 10) / 10) + '명'));
      const iv = R.slice(1).map((x, i) => ({ a: R[i], b: x, d: x.v - R[i].v })).filter(x => x.d !== 0).sort((a, b) => a.d - b.d);
      if (iv.length) { const lo = iv[0], hi = iv[iv.length - 1]; if (lo.d < 0) A.push(kRow('bad', '감소', md2(lo.a.d) + ' → ' + md2(lo.b.d) + ' ' + fmt(lo.d) + '명', '')); if (hi.d > 0) A.push(kRow('good', '증가', md2(hi.a.d) + ' → ' + md2(hi.b.d) + ' +' + fmt(hi.d) + '명', '')); }
      if (cur.nf != null) A.push(kRow('info', '신규', '마지막 기록 새 팔로워 ' + fmt(cur.nf) + '명', '인스타가 알려 준 기간 값이라 순증과 다를 수 있어요'));
      const L = prv ? D.items.filter(it => it.c === '인스타그램' && it.t !== '스토리' && it.d > prv.d && it.d <= cur.d).sort((a, b) => (mainVal(b) || 0) - (mainVal(a) || 0)) : [];
      const hasNf = R.some(x => x.nf != null);
      return { scope: '인스타그램', title: '인스타 팔로워', big: fmt(cur.v) + '<small>명</small>', sub: prv ? md2(prv.d) + ' 대비 ' + sgn(cur.v - prv.v) + fmt(cur.v - prv.v) + '명' : '', A,
        note: '기록별 팔로워 수',
        chart: { type: 'line', data: { labels: R.map(x => md2(x.d)), datasets: [{ data: R.map(x => x.v), borderColor: chColor('인스타그램'), borderWidth: 2, pointRadius: R.length <= 12 ? 3 : 0, pointBackgroundColor: chColor('인스타그램'), cubicInterpolationMode: 'monotone' }] },
          options: chartOpts({ plugins: { tooltip: { callbacks: { title: c => dot(R[c[0].dataIndex].d), label: c => fmt(c.raw) + '명' } } }, scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: Object.assign(yAx(v => fmt(v)), { beginAtZero: false }) } }) },
        list: L.length ? { t: '이 기간 올린 게시물', L } : null,
        table: kTbl(['날짜', '팔로워', '증감'].concat(hasNf ? ['새 팔로워'] : []), R.slice().reverse().map((x, i, a) => [dot(x.d), fmt(x.v) + '명', a[i + 1] ? sgn(x.v - a[i + 1].v) + fmt(x.v - a[i + 1].v) : '–'].concat(hasNf ? [x.nf == null ? '–' : fmt(x.nf)] : []))) };
    }
    if (key === 'sub') {
      const R = (D.acct || []).filter(x => x.ch === '유튜브' && x.m['Gained subscribers'] != null).sort((a, b) => a.d < b.d ? -1 : 1).map(x => ({ d: x.d, g: x.m['Gained subscribers'], l: x.m['Lost subscribers'] || 0, vv: x.m['Video views'] })).map(x => Object.assign(x, { n: x.g - x.l }));
      if (!R.length) return null;
      const cur = R[R.length - 1], md0 = median(R.map(x => x.n)), best = R.slice().sort((a, b) => b.n - a.n)[0];
      A.push(kRow(cur.n > 0 ? 'good' : cur.n < 0 ? 'bad' : 'info', '최근', '새 구독 ' + fmt(cur.g) + ' · 취소 ' + fmt(cur.l) + ' · 순증 ' + sgn(cur.n) + fmt(cur.n) + '명', dot(cur.d) + ' 기록'));
      if (R.length >= 3) A.push(kRow('info', '보통', '순증 중간값 ' + sgn(md0) + fmt(Math.round(md0)) + '명 · 가장 많은 기록 ' + md2(best.d) + ' ' + sgn(best.n) + fmt(best.n) + '명', R.length + '번 기록'));
      if (cur.g) A.push(kRow(cur.l / cur.g > 0.7 ? 'bad' : 'info', '취소', '새 구독 대비 취소 ' + pct0(cur.l / cur.g), '취소가 많으면 기대와 다른 영상이 노출됐는지 살펴봐요'));
      const L = pool({ channels: ['유튜브'], since: addDays(D.updated, -30) }).sort((a, b) => (mainVal(b) || 0) - (mainVal(a) || 0)).slice(0, 8);
      return { scope: '유튜브', title: '유튜브 구독자 증감', big: sgn(cur.n) + fmt(cur.n) + '<small>명</small>', sub: '새 구독 ' + fmt(cur.g) + ' · 취소 ' + fmt(cur.l), A,
        note: '기록별 구독자 순증 · 유튜브 분석이 알려 준 기간 값',
        chart: { type: 'bar', data: { labels: R.map(x => md2(x.d)), datasets: [{ data: R.map(x => x.n), backgroundColor: R.map(x => x.n >= 0 ? css('--up') : css('--down-bar')), borderRadius: 3, maxBarThickness: 30 }] },
          options: chartOpts({ plugins: { tooltip: { callbacks: { title: c => dot(R[c[0].dataIndex].d), label: c => { const x = R[c.dataIndex]; return '순증 ' + sgn(x.n) + fmt(x.n) + ' · 새 ' + fmt(x.g) + ' · 취소 ' + fmt(x.l); } } } }, scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: Object.assign(yAx(v => fmt(v)), { beginAtZero: true }) } }) },
        list: L.length ? { t: '최근 30일 유튜브 영상', L } : null,
        table: kTbl(['기록일', '새 구독', '취소', '순증', '영상 조회'], R.slice().reverse().map(x => [dot(x.d), fmt(x.g), fmt(x.l), sgn(x.n) + fmt(x.n), x.vv == null ? '–' : fmt(x.vv)])) };
    }
    return null;
  }
  function openKpi(key, chs) {
    const K = kpiPage(key, chs); if (!K) return;
    lastFocus = document.activeElement;
    const el = $('detail'), h3 = t => '<h3 style="margin:0 0 6px;font-size:var(--fs-xl);font-weight:700">' + t + '</h3>';
    el.innerHTML = '<div class="dwrap">' +
      '<div class="dh"><button type="button" id="dClose" aria-label="뒤로">‹</button><div class="ctr"><small>' + esc(K.scope) + '</small><b>' + K.title + '</b></div><span></span></div>' +
      '<section class="dsec"><h1 class="dtitle">' + K.title + '</h1><div class="dbig num">' + K.big + (K.sub ? '<small>' + K.sub + '</small>' : '') + '</div>' +
        (K.chart ? '<div class="cmp"><canvas id="kCanvas"></canvas></div>' : '') + (K.note ? '<p class="note" style="text-align:center">' + K.note + '</p>' : '') + '</section>' +
      (K.A.length ? '<div class="gap"></div><section class="dsec sig"><h3>분석</h3><div class="h">' + mdLabel(D.updated) + ' 기준 · 광고·스토리 제외</div>' + K.A.join('') + '</section>' : '') +
      (K.list ? '<div class="gap"></div><section class="dsec">' + h3(K.list.t) + '<ol class="rank" id="kList">' + rankRows(K.list.L, K.list.o) + '</ol></section>' : '') +
      '<div class="gap"></div><section class="dsec">' + h3('데이터') + K.table + '</section></div>';
    el.hidden = false; el.scrollTop = 0; document.body.style.overflow = 'hidden';
    $('dClose').focus(); $('dClose').addEventListener('click', closeDetail);
    if (K.list) wireRank($('kList'), K.list.L);
    if (K.chart) draw('kCanvas', K.chart);
  }
  // 상세 선 차트: 이 게시물 기록이 2개 이상일 때만, 첫 기록부터. 점이 적으면 점을 찍고 날짜 글자는 기울이지 않음
  const detailLine = it => { const m = mainM(it.c); return D.dates.filter((d, i) => it.h[i] && it.h[i][m] != null).length >= 2; };
  function drawDetailChart(it) {
    const m = mainM(it.c), col = chColor(it.c);
    if (detailLine(it)) {
      const idx = D.dates.map((d, i) => i).filter(i => it.h[i] && it.h[i][m] != null), i0 = idx[0], ds = D.dates.slice(i0);
      draw('dCanvas', { type: 'line', data: { labels: ds.map(md2), datasets: [{ label: MN[m], data: ds.map((d, k) => it.h[i0 + k] ? it.h[i0 + k][m] : null), borderColor: col, borderWidth: 2, pointRadius: idx.length <= 4 ? 3 : 0, pointBackgroundColor: col, pointHoverRadius: 4, cubicInterpolationMode: 'monotone', spanGaps: true }] },
        options: chartOpts({ layout: { padding: { top: 12 } }, scales: { x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 } }, y: { beginAtZero: false, display: true, position: 'right', grid: { color: css('--line') }, border: { display: false }, ticks: { maxTicksLimit: 3, font: { size: 13 }, color: css('--muted'), callback: v => fmt(v) } } }, plugins: { tooltip: { callbacks: { title: c => dot(ds[c[0].dataIndex]), label: c => MN[m] + ' ' + fmt(c.raw) } } } }) });
      return;
    }
    const base = baseFor(it);
    const g = groupBy(D.items.filter(x => x.c === it.c && !x.ad && x.t !== '스토리'), 'g').find(x => x.k === it.g);
    // 축 글자는 기울이지 않고 두 줄로
    const rows = [[['이 콘텐츠'], mainVal(it), col], [['「' + it.g + '」', '중간값'], g ? g.v : null, css('--muted')], [base.by === '형식' ? [typeShort(it.t), '중간값'] : ['채널', '중간값'], base.v, css('--line')]];
    draw('dCanvas', {
      type: 'bar', data: { labels: rows.map(r => r[0]), datasets: [{ data: rows.map(r => r[1]), backgroundColor: rows.map(r => r[2]), borderRadius: 3, maxBarThickness: 64 }] },
      options: chartOpts({ scales: { x: { ticks: { maxRotation: 0, autoSkip: false } } }, plugins: { tooltip: { callbacks: { title: c => rows[c[0].dataIndex][0].join(' '), label: c => fmt(c.raw) } } } }),
      plugins: [{ id: 'vl', afterDatasetsDraw(ch) { const x = ch.ctx; x.save(); x.font = '700 14px ' + css('--font'); x.fillStyle = css('--fg'); x.textAlign = 'center'; ch.getDatasetMeta(0).data.forEach((b, i) => x.fillText(fmtK(rows[i][1]), b.x, b.y - 8)); x.restore(); } }],
    });
  }
  function closeDetail() {
    $('detail').hidden = true; document.body.style.overflow = '';
    ['dCanvas', 'kCanvas'].forEach(id => { if (charts[id]) { charts[id].destroy(); delete charts[id]; } });
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('detail').hidden) closeDetail(); });

  // ───────── 차트 공통 ─────────
  function chartOpts(extra) {
    Chart.defaults.font.family = css('--font'); Chart.defaults.color = css('--muted'); Chart.defaults.font.size = 14;
    const o = { responsive: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 24 } },
      plugins: { legend: { display: false, labels: { boxWidth: 12, boxHeight: 12, color: css('--sub') } }, tooltip: { backgroundColor: css('--fg'), titleColor: css('--bg'), bodyColor: css('--bg'), padding: 12, cornerRadius: 10, caretSize: 0, titleFont: { weight: '700' }, boxPadding: 4, usePointStyle: true, displayColors: false } },
      elements: { line: { borderCapStyle: 'round', borderJoinStyle: 'round' }, point: { hoverBorderWidth: 2, hoverBorderColor: css('--bg') } },
      scales: { x: { grid: { display: false }, border: { display: false }, ticks: { color: css('--sub'), font: { size: 13, weight: '600' } } }, y: { display: false, beginAtZero: true, border: { display: false } } } };
    return merge(o, extra || {});
  }
  // 시안: 범례 대신 선 끝에 계열 이름(Datawrapper·Carbon). 겹치면 14px 간격으로 밀어낸다
  const endLabels = { id: 'endLabels', afterDatasetsDraw(c, args, po) {
    const LMAX = (po && po.max) || 5;
    const x = c.ctx, a = c.chartArea, X = (c.scales.y && c.scales.y.position === 'right' ? c.scales.y.right : a.right) + 6, L = [];
    c.data.datasets.forEach((d, i) => { const m = c.getDatasetMeta(i); if (m.hidden) return; let j = d.data.length - 1; while (j >= 0 && d.data[j] == null) j--; if (j < 0 || !m.data[j]) return; L.push({ y: m.data[j].y, t: d.label, col: d.borderColor }); });
    L.sort((p, q) => p.y - q.y); for (let i = 1; i < L.length; i++) if (L[i].y - L[i - 1].y < 14) L[i].y = L[i - 1].y + 14;
    x.save(); x.textAlign = 'left'; x.textBaseline = 'middle';
    L.forEach(l => { x.font = '700 12px ' + css('--font'); x.fillStyle = typeof l.col === 'string' ? l.col : css('--sub'); x.fillText(l.t.length > LMAX ? l.t.slice(0, LMAX) : l.t, X, Math.min(Math.max(l.y, a.top + 6), a.bottom)); });
    x.restore(); } };
  function merge(a, b) { Object.keys(b).forEach(k => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof b[k] !== 'function' && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = b[k]; }); return a; }
  // 차트 대체 텍스트: 화면 낭독기용으로 계열·마지막 값 요약을 붙인다
  function chartLabel(cfg) {
    try {
      const d = cfg.data || {}, L = d.labels || [], ds = (d.datasets || []).slice(0, 4);
      return '차트: ' + ds.map(s => (s.label || '값') + ' ' + (L.length ? L[0] + '~' + L[L.length - 1] + ', 마지막 ' : '') + (s.data && s.data.length ? (typeof s.data[s.data.length - 1] === 'number' ? fmtK(s.data[s.data.length - 1]) : '–') : '–')).join(' · ');
    } catch (e) { return '차트'; }
  }
  function draw(id, cfg) { if (charts[id]) charts[id].destroy(); const el = $(id); if (!el) return; el.setAttribute('role', 'img'); el.setAttribute('aria-label', chartLabel(cfg)); charts[id] = new Chart(el, cfg); }

  // ───────── 렌더 ─────────
  function wireScroll() { document.querySelectorAll('.tw').forEach(w => { if (w.__sc) return; w.__sc = 1; const f = () => { w.classList.toggle('scrolled', w.scrollLeft > 2); w.classList.toggle('end', w.scrollLeft + w.clientWidth >= w.scrollWidth - 2); }; w.addEventListener('scroll', f, { passive: true }); f(); }); }
  // 키보드 접근: 클릭으로 여는 표 행·매트릭스 칸·표 머리 칸을 Tab으로 갈 수 있게 하고 Enter·Space로 연다
  const KB_SEL = 'tr.click, tr[data-i], tr[data-s], th[data-bi], .mx td[data-k]:not(.none)';
  function wireKeys() { document.querySelectorAll(KB_SEL).forEach(el => { if (el.hasAttribute('tabindex')) return; el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); }); }
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches(KB_SEL)) { e.preventDefault(); e.target.click(); } });
  new MutationObserver(() => { wireScroll(); wireKeys(); }).observe(document.body, { childList: true, subtree: true });
  function render() {
    renderBell();
    Object.keys(charts).forEach(k => { if (k !== 'dCanvas') { charts[k].destroy(); delete charts[k]; } });
    save(); syncChrome();
    ({ brief: viewBrief, strategy: viewStrategy, maker: viewMaker, season: viewSeason, ads: viewAds, explore: viewExplore, export: viewExport }[S.view] || viewBrief)();
  }
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.view === 'explore') renderTrend(); }, 150); });

  // 채널별 기록 여부 · 메타 광고(인스타 게시물 홍보) 연결
  const hasRec = (c, i) => !!(D.rec && D.rec[c] && D.rec[c][i]);
  // 광고 캠페인이 일별 리포트가 아니라 「광고 추가 입력」의 합계에서 온 것이면 표시
  const manTag = c => c && c.manual ? ' <span class="tag p-col" title="' + esc(c.manual) + '">합계 입력</span>' : '';
  // 원본 미갱신 기간이면 그 기간 증가분은 0이 아니라 '셀 수 없음'. 마지막 기간은 D.stale(서버 fresh 정보 우선), 그 전 기간은 D.staleIdx
  const staleAt = (c, i) => i === D.dates.length - 1 ? !!(D.stale && D.stale[c]) : !!(D.staleIdx && D.staleIdx[c] && D.staleIdx[c].includes(i));
  // 알림 목록: 데이터가 멈췄거나 새로 안 들어온 것. id에 날짜를 넣어 상황이 바뀌면 다시 새 알림으로 뜬다
  function notices() {
    const out = [], s = Object.keys(D.stale || {}), a = Object.keys(D.acctStale || {}).filter(c => !s.includes(c));
    if (s.length || a.length) {
      const d = (D.stale || {})[s[0]] || (D.acctStale || {})[a[0]];
      out.push({ id: 'stale:' + s.concat(a).join(',') + ':' + d.d1, t: s.concat(a).map(chName).join(' · ') + ' 데이터가 새로 안 들어왔어요',
        b: (s.length ? s.map(chName).join(' · ') + ' 게시물 값' : '') + (s.length && a.length ? ', ' : '') + (a.length ? a.map(chName).join(' · ') + ' 계정 지표' : '') + '가 ' + mdLabel(d.d0) + '과 ' + mdLabel(d.d1) + ' 기록에서 똑같아요. 그래서 이 기간에 늘어난 조회는 0으로 치지 않고 합계에서 뺐어요. 스냅샷 시트의 Supermetrics 예약 갱신이 돌았는지 확인해 주세요.' });
    }
    const A = D.ads || {};
    if (A.end && daysBetween(A.end, D.updated) > 14) {
      const daily = (A.camps || []).filter(c => !c.manual).map(c => c.to).sort().pop() || '';
      out.push({ id: 'gads:' + A.end, t: '구글애즈 광고 데이터가 ' + dot(A.end) + '에서 멈춰 있어요',
        b: '그 뒤에 집행한 광고는 아직 보드에 없어요. 스냅샷 시트 「구글애즈 리포트」 탭에 일별 캠페인 보고서(' + (daily ? dot(addDays(daily, 1)) : '마지막 날 다음 날') + ' ~ 어제)를 붙여 넣거나, 「광고 추가 입력」 탭에 캠페인 합계를 적으면 다음 갱신 때 들어와요.' });
    }
    // 직전 기간 원본 미갱신: 「직전 N일 대비」 비교에서 그 채널을 뺌
    const n = D.dates.length;
    if (n >= 3 && daysBetween(D.dates[n - 3], D.dates[n - 2]) <= OKGAP) {
      const ps = OWN.filter(c => staleAt(c, n - 2));
      if (ps.length) out.push({ id: 'pstale:' + ps.join(',') + ':' + D.dates[n - 2], t: ps.map(chName).join(' · ') + ' 직전 기간 데이터가 멈춰 있었어요',
        b: mdLabel(D.dates[n - 3]) + '과 ' + mdLabel(D.dates[n - 2]) + ' 기록의 ' + ps.map(chName).join(' · ') + ' 값이 모두 같아요. 그래서 「직전 N일 대비」 비교에서 이 채널을 뺐어요. 이번 기간 증가는 그대로 셌어요.' });
    }
    // 늦게 수집된 예전 게시물: 처음 잡힌 누적값이 한 기간 증가로 들어가지 않게 뺌
    const wl = weekPart(OWN, n - 1), late = wl ? wl.late : [];
    if (late.length) out.push({ id: 'late:' + D.updated + ':' + late.length, t: '늦게 수집된 예전 게시물 ' + late.length + '개는 증가 합계에서 뺐어요',
      b: late.slice(0, 3).map(it => chName(it.c) + ' 「' + title(it.n).slice(0, 18) + '」 ' + dot(it.d)).join(' · ') + (late.length > 3 ? ' 외' : '') + ' — 이번 기록에 처음 들어와 누적 조회 전체가 한 번에 잡혀요. 콘텐츠 목록에는 그대로 나와요.' });
    // 화면에서 뺀 설정 안내(원칙 9): 빈 「채널 목표」·「전략 기록」·「광고 계획」 탭, 타 대학 팔로워 자료
    if (!goalsHtml()) out.push({ id: 'setup:goal', t: '월 목표가 아직 없어요', b: '스냅샷 시트 「채널 목표」 탭에 채널 · 지표 · 목표값을 적으면 전략 화면에 진행률이 나와요. 지표는 게시 수 · 조회 · 잘 된 비율 · 평균 조회 · 팔로워 순증 중에서 골라요. 월을 비우면 매달 같은 목표예요.' });
    if (!(D.strat || []).some(s => s.from && s.what)) out.push({ id: 'setup:strat', t: '채점할 전략 기록이 없어요', b: '「전략 기록」 탭에 시작일 · 종료일 · 채널 · 분류 · 형식 · 제목 키워드 · 시도 내용을 한 줄씩 적으면, 그 기간 게시물이 평소보다 나아졌는지 채점해요. 예) 2026-10-14 · 2026-11-30 · 인스타 · 학과 소개 · 릴스 · 비움 · 학과 소개를 릴스로 주 1회' });
    if (A.camps && A.camps.length && !(A.plans || []).some(p => p.n)) out.push({ id: 'setup:plan', t: '광고 계획 탭이 비어 있어요', b: '스냅샷 시트 「광고 계획」 탭에 캠페인 이름 · 시작일 · 종료일 · 예산 · 목표 · 메모를 적으면 광고 화면에 예산 소진율 · 기간 경과 · 클릭률이 나와요. 캠페인 이름은 구글애즈 이름의 일부만 적어도 돼요.' });
    if (benchNames().length && !['인스타그램'].concat(benchNames()).some(ch => folAt(ch, D.updated))) out.push({ id: 'setup:benchfol', t: '타 대학 팔로워 비교는 준비 중이에요', b: '타 대학 팔로워 수는 「타대학 일별」 탭에 쌓이고 있어요. 보드 업데이트를 배포하면 팔로워당 반응 · 팔로워 증가가 타 대학 탭에 나와요.' });
    // 메타 광고 중 연결된 게시물이 없는 지출 캠페인(캡션 매칭 실패일 수 있음)
    const um = (A.meta || []).filter(c => c.spend > 0 && !(c.posts || []).length && /^(?:Instagram (?:게시물|post)|게시물):/i.test(c.n || ''));
    if (um.length) out.push({ id: 'meta-unl:' + um.length, t: '게시물 연결 안 된 메타 광고 ' + um.length + '건', b: um.slice(0, 3).map(c => '「' + metaLabel(c.n).slice(0, 20) + '」 ' + usd(c.spend)).join(' · ') + ' — 캡션이 바뀌었거나 수집 기간 밖이라 게시물을 못 찾았어요. 그 게시물은 광고 표시 없이 평소 계산에 들어가 있을 수 있어요. 「광고 매핑」 탭에 연결을 적으면 고쳐져요.' });
    return out;
  }
  const seenGet = () => { try { return JSON.parse(localStorage.getItem('sb-seen') || '[]'); } catch (e) { return []; } };
  function renderBell() {
    const btn = $('bell'), p = $('ntf'); if (!btn || !p) return;
    const N = notices(), seen = seenGet(), k = N.filter(x => !seen.includes(x.id)).length;
    $('bellN').textContent = k; $('bellN').hidden = !k;
    btn.setAttribute('aria-label', '알림 ' + N.length + '개' + (k ? ', 새 알림 ' + k + '개' : ''));
    p.innerHTML = '<div class="ntf-h">알림</div>' + (N.length ? '<ul>' + N.map(x => '<li' + (seen.includes(x.id) ? '' : ' class="new"') + '><b>' + esc(x.t) + '</b><p>' + esc(x.b) + '</p></li>').join('') + '</ul>' : '<p class="ntf-e">지금은 확인할 게 없어요. 데이터가 모두 제때 들어오고 있어요.</p>');
    if (btn.__w) return; btn.__w = 1;
    const close = () => { if (p.hidden) return; p.hidden = true; btn.setAttribute('aria-expanded', 'false'); renderBell(); };
    btn.addEventListener('click', e => { e.stopPropagation(); if (!p.hidden) { close(); return; } p.hidden = false; btn.setAttribute('aria-expanded', 'true'); try { localStorage.setItem('sb-seen', JSON.stringify(notices().map(x => x.id))); } catch (er) {} $('bellN').hidden = true; });
    document.addEventListener('click', e => { if (!p.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !p.hidden) { close(); btn.focus(); } });
  }
  function staleHtml(chs) {
    const s = chs.filter(c => D.stale && D.stale[c]), a = chs.filter(c => D.acctStale && D.acctStale[c]);
    if (!s.length && !a.length) return '';
    const d = (D.stale[s[0]] || D.acctStale[a[0]]);
    return '<div class="callout warn">원본 데이터가 갱신되지 않은 채널이 있어요: ' +
      (s.length ? '<b>' + s.map(chName).join(' · ') + '</b> 게시물 값' : '') + (s.length && a.length ? ', ' : '') + (a.length ? '<b>' + a.map(chName).join(' · ') + '</b> 계정 지표' : '') +
      '<small>' + mdLabel(d.d0) + ' → ' + mdLabel(d.d1) + ' 두 기록의 값이 모두 같아요. 이 기간 증가는 0이 아니라 셀 수 없어서 합계에서 뺐어요. Supermetrics 예약 갱신을 확인해 주세요.</small></div>';
  }
  const nz = x => String(x || '').replace(/(\.\.\.|…)\s*$/, '').replace(/[\s⠀.]+/g, '');
  const metaLabel = n => { const m = /^(?:Instagram (?:게시물|post)|게시물):\s*"?([\s\S]*?)"?$/i.exec(n || ''); return (m ? m[1] : n || '').split('\n')[0].replace(/(\.\.\.|…)$/, '').trim() || n; };
  function prep() {
    if (D.items.some(it => it.L)) { D.coverage = D.coverage || {}; D.coverage['유튜브'] = '2012-01-01'; }
    const igMin = D.items.filter(it => it.c === '인스타그램').map(it => it.d).sort()[0];
    if (igMin && D.coverage && D.coverage['인스타그램'] && igMin < D.coverage['인스타그램']) D.coverage['인스타그램'] = igMin.slice(0, 7) + '-01';
    // 제목을 잘라 저장하면서 반쪽 난 이모지(짝 없는 서로게이트)와 대체 문자 정리
    D.items.forEach(it => { if (typeof it.n === 'string') it.n = it.n.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|\uFFFD/g, ''); });
    // hong 크레딧은 「🎬by. 인스타아이디」로 적혀 명단(한글 이름) 매칭이 안 됨 → 아이디를 참여자로, 명단에 없으면 역할은 홍보대사
    D.roles = D.roles || {};
    D.items.forEach(it => {
      if (it.c !== 'hong._.video' || (it.w && it.w.length)) return;
      const m = /\bby\.?\s*:?\s*((?:@?[A-Za-z0-9._]{2,30}(?:\s*[,&\/·]\s*|\s+(?=@)))*@?[A-Za-z0-9._]{2,30})/i.exec(it.n || '');
      if (!m) return;
      it.w = [...new Set(m[1].split(/[\s,&\/·]+/).map(x => x.replace(/^@/, '').replace(/\.+$/, '')).filter(x => x.length >= 2))].map(x => '@' + x);
      it.w.forEach(x => { if (!D.roles[x]) D.roles[x] = '홍보대사'; });
    });
    D.rec = {};
    D.items.forEach(it => { const r = D.rec[it.c] = D.rec[it.c] || D.dates.map(() => false); it.h.forEach((x, i) => { if (x) r[i] = true; }); });
    // 원본 미갱신 감지: 두 기록에 모두 있는 게시물(5개 이상)의 조회·좋아요가 하나도 안 바뀌었으면 원본이 갱신되지 않은 것.
    // 기간마다 따로 본다(직전 기간이 멈춰 있으면 「직전 N일 대비」 비교가 가짜가 됨)
    D.stale = {}; D.staleIdx = {};
    const ni = D.dates.length - 1;
    for (let i = 1; i <= ni; i++) Object.keys(D.rec).forEach(c => {
      if (!hasRec(c, i) || !hasRec(c, i - 1)) return;
      const both = D.items.filter(it => it.c === c && it.h[i] && it.h[i - 1]);
      if (both.length >= 5 && !both.some(it => it.h[i][0] !== it.h[i - 1][0] || it.h[i][1] !== it.h[i - 1][1])) (D.staleIdx[c] = D.staleIdx[c] || []).push(i);
    });
    if (ni >= 1) Object.keys(D.rec).forEach(c => {
      if (!hasRec(c, ni) || !hasRec(c, ni - 1)) return;
      const both = D.items.filter(it => it.c === c && it.h[ni] && it.h[ni - 1]);
      const changed = both.filter(it => it.h[ni][0] !== it.h[ni - 1][0] || it.h[ni][1] !== it.h[ni - 1][1]).length;
      if (both.length >= 5 && !changed) D.stale[c] = { n: both.length, d0: D.dates[ni - 1], d1: D.dates[ni] };
    });
    // 서버가 기록 때 계산한 원본 갱신 정보(fresh: {채널: {changed, total, latest, prev, d}})가 있으면 그것을 우선
    if (D.fresh && typeof D.fresh === 'object') Object.entries(D.fresh).forEach(([c, f]) => {
      if (!f || f.total == null) return;
      if (f.prev && D.dates.indexOf(f.prev) < 0) return; // 비교 상대가 지워진 임시 기록(화~일)이면 남아 있는 직전 기록과 직접 비교한 결과를 씀
      if (f.total >= 5 && !f.changed) D.stale[c] = { n: f.total, d0: f.prev || D.dates[ni - 1], d1: f.d || D.dates[ni] };
      else delete D.stale[c];
    });
    D.acctStale = {};
    const byCh = {};
    (D.acct || []).forEach(x => (byCh[x.ch] = byCh[x.ch] || []).push(x));
    Object.entries(byCh).forEach(([c, a]) => { a.sort((x, y) => x.d < y.d ? -1 : 1); const p = a[a.length - 2], q = a[a.length - 1]; if (p && q && p.d !== q.d && JSON.stringify(p.m) === JSON.stringify(q.m)) D.acctStale[c] = { d0: p.d, d1: q.d }; });
    const M = (D.ads && D.ads.meta) || [];
    const ig = D.items.filter(it => it.c === '인스타그램').map(it => [it, nz(it.n)]);
    M.forEach(c => {
      c.posts = [];
      // 메타 내보내기 이름: 「Instagram 게시물: 캡션…」 · 「Instagram post: 캡션…」 · 「게시물: "캡션"」
      const m = /^(?:Instagram (?:게시물|post)|게시물):\s*"?([\s\S]*?)"?$/i.exec(c.n || ''); if (!m) return;
      const key = nz(m[1]).slice(0, 30); if (key.length < 8) return;
      const end = /^\d{4}-\d{2}-\d{2}$/.test(c.end) ? c.end : '9999-12-31';
      const hits = ig.filter(([it, n]) => n.length >= 8 && it.d <= end && n.startsWith(key.slice(0, Math.min(key.length, n.length)))).map(x => x[0]);
      // 캡션 앞부분이 같은 시리즈 게시물이면 캠페인 종료일 직전에 올린 게시물 하나만
      const pick = hits.length > 1 ? [hits.sort((a, b) => a.d < b.d ? 1 : -1)[0]] : hits;
      pick.forEach(it => {
        c.posts.push(it);
        it.ad = it.ad || { s: '확인', k: [] };
        it.ad.mk = it.ad.mk || [];
        if (!it.ad.mk.includes(c.n)) it.ad.mk.push(c.n);
      });
    });
    // 서버가 「광고 매핑」 탭으로 붙인 메타 캠페인(트래픽 광고 등)도 캠페인별 게시물에 넣음
    D.items.forEach(it => { if (it.ad && it.ad.mk) it.ad.mk.forEach(n => M.filter(c => c.n === n).forEach(c => { if (!c.posts.includes(it)) c.posts.push(it); })); });
    // 비공개·중복 업로드로 보이는 유튜브 영상: 올린 지 14일이 넘었는데 조회 20 이하 → 평소 계산·판정에서 빼고 「비공개로 보임」 표시
    // 전체 기간 값(L)이 없는 예전 영상은 수집 시작 뒤 조회만 있어 원래 작으므로 제외
    D.items.forEach(it => { if (it.c === '유튜브' && (it.L || it.d >= D.dates[0]) && daysBetween(it.d, D.updated) > AGE_MIN) { const v = val(it, 0); if (v != null && v <= 20) it.hid = 1; } });
    // 광고 의심: 광고 표시가 없는 유튜브 영상 중 평소의 3배 이상인데 좋아요율이 같은 형식 중간값의 1/4 미만이고 최근 기록 사이 조회가 거의 그대로(1% 미만)
    // 표시만 붙이고 계산에서는 빼지 않는다(광고 매핑 탭에서 확인되면 그때 광고로 빠짐)
    const LR = {};
    const lrMed = it => { if (!(it.t in LR)) { const a = D.items.filter(x => x.c === '유튜브' && x.t === it.t && !x.ad && !x.hid && x.d >= addDays(D.updated, -365)).map(likeRate).filter(v => v != null); LR[it.t] = a.length >= BASE_T_MIN ? median(a) : null; } return LR[it.t]; };
    D.items.forEach(it => {
      if (it.c !== '유튜브' || it.ad || it.hid || young(it)) return;
      const r = ratio(it), lr = likeRate(it), md = lrMed(it);
      if (r == null || r < 3 || lr == null || !md || lr >= md / 4) return;
      const ix = it.h.map((x, i) => x && x[0] != null ? i : -1).filter(i => i >= 0);
      if (ix.length < 2) return;
      const a = it.h[ix[ix.length - 2]][0], b = it.h[ix[ix.length - 1]][0];
      if (!(b > 0) || (b - a) / b >= 0.01) return;
      it.sus = '광고 표시는 없지만 광고 조회로 보여요 · 좋아요율 ' + pctA(lr) + '(같은 형식 중간값 ' + pctA(md) + '의 1/' + Math.round(md / Math.max(lr, 1e-9)) + ') · ' + md2(D.dates[ix[ix.length - 2]]) + ' → ' + md2(D.dates[ix[ix.length - 1]]) + ' 조회 +' + fmt(b - a) + ' · 계산에는 그대로 넣었어요';
    });
  }
  function boot(data) {
    D = data;
    prep();
    const sv = load(); if (sv) Object.assign(S, sv);
    if (!VIEWS.some(v => v[0] === S.view)) S.view = 'brief';
    buildChrome(); render();
    const rer = () => { render(); };
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', rer); } catch (e) {}
    new MutationObserver(rer).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  // 로딩: 기다리는 동안 안내, 30초 넘으면 다시 시도 버튼(늦게 도착하면 그대로 그림). 차트 라이브러리 실패와 데이터 실패를 구분
  let booted = false, slowT = null;
  const retry = () => { location.reload(); };
  const fail = (why) => {
    if (booted) return;
    $('st1').textContent = why === 'chart' ? '차트 도구를 불러오지 못했어요' : '데이터를 불러오지 못했어요';
    msgView(why === 'chart' ? '차트 도구(Chart.js)를 불러오지 못했어요' : '데이터를 불러오지 못했어요',
      why === 'chart' ? '학교 네트워크에서 외부 스크립트(cdn.jsdelivr.net)가 막혔을 수 있어요. 다른 네트워크에서 열거나 잠시 후 다시 시도해 주세요.' : why === 'slow' ? '데이터 응답이 30초 넘게 오지 않아요. 보통 15초 안팎 걸려요. 계속 기다리거나 다시 시도해 주세요.' : 'Apps Script 웹앱 응답에 문제가 있어요. 잠시 후 다시 시도해 주세요.',
      ['다시 시도', retry]);
  };
  // 접속 키(2026-10-18): 사람별 링크 …/#k=<키>로 한 번 열면 이 기기에 저장. 키가 없거나 막히면 데이터를 받지 않고 키 입력 화면
  const KEY_STORE = 'sb-key';
  const keyOf = t => { const m = /(?:^|[#?&])k=([A-Za-z0-9]{16,64})/.exec(t || ''); return m ? m[1] : /^[A-Za-z0-9]{16,64}$/.test(String(t || '').trim()) ? String(t).trim() : ''; };
  let KEY = keyOf(location.hash) || keyOf(location.search);
  if (KEY) { try { localStorage.setItem(KEY_STORE, KEY); } catch (e) {} try { history.replaceState(null, '', location.pathname); } catch (e) {} }
  else { try { KEY = localStorage.getItem(KEY_STORE) || ''; } catch (e) {} }
  const gate = msg => {
    clearTimeout(slowT); $('st1').textContent = '접속 키가 필요해요';
    $('view').innerHTML = '<section class="sec"><div class="wait gate"><b>' + esc(msg) + '</b><br>담당자에게 받은 접속 링크로 열거나, 링크·키를 아래에 붙여 넣어 주세요.<form id="keyF" class="gate-f"><input class="inp" id="keyIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="접속 링크 또는 키" aria-label="접속 링크 또는 키"><button type="submit" class="btn pri">열기</button></form><small id="keyE" class="mu"></small></div></section>';
    $('keyF').addEventListener('submit', ev => {
      ev.preventDefault(); const k = keyOf($('keyIn').value);
      if (!k) { $('keyE').textContent = '링크나 키 모양이 아니에요. 받은 그대로 붙여 넣어 주세요.'; return; }
      try { localStorage.setItem(KEY_STORE, k); } catch (e) {}
      location.replace(location.pathname + '#k=' + k); location.reload();
    });
  };
  const start = d => {
    if (booted) return; clearTimeout(slowT);
    if (d && d.error === 'auth') { try { localStorage.removeItem(KEY_STORE); } catch (e) {} gate(KEY ? '이 접속 키는 막혔거나 맞지 않아요' : '접속 키가 필요해요'); return; }
    if (!window.Chart) { fail('chart'); return; } try { booted = true; boot(d); } catch (e) { booted = false; console.error(e); fail(); }
  };
  msgView('데이터를 불러오는 중이에요', '보통 15초 안팎 걸려요. 전체 기록(약 1MB)을 받고 있어요.');
  slowT = setTimeout(() => fail('slow'), 30000);
  // 키가 없어도 한 번은 요청(서버가 키를 요구할 때만 입력 화면)
  if (window.SNS_API_URL) {
    window.__sbData = start;
    const sc = document.createElement('script'); sc.src = window.SNS_API_URL + '?callback=__sbData' + (KEY ? '&key=' + encodeURIComponent(KEY) : '') + '&t=' + Date.now(); sc.onerror = () => { clearTimeout(slowT); fail(); }; document.body.appendChild(sc);
  } else {
    fetch('./data.json', { cache: 'no-store' }).then(r => r.json()).then(start).catch(e => { console.error(e); clearTimeout(slowT); fail(); });
  }
})();
