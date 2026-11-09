// ───────── 매일 분석 규칙(2026-11-03 담당자 「추천하는대로 진행」) ─────────
// 토큰 없이 숫자로만 판정한다. 보드 전략 화면 「어제 게시물 판정」과 아침 9시 메일(gas/Ana.gs — build.sh가 이 파일을 그대로 복사)이 같은 코드를 쓴다
// 원인·사진·말투 판단과 다음 기획 제안은 주 1회·월 1회 Claude 분석(viral-reverse-engineering·content-audit)이 하고,
// 그 분석이 찾은 패턴 중 캡션·태그로 잴 수 있는 것을 FEAT에 규칙으로 더한다(처음 규칙 = 11/3 단풍 분석 「장소를 알려 주면 공유된다」)
var Ana = (function () {
  var OWN = ['인스타그램', 'hong._.video'];
  var MIN_N = 5, RX_MIN = 300, KPI = { share: 0.01, save: 0.003 };
  // 캡션 특징: 서버가 자르기 전 캡션 전체로 계산해 it.ft에 넣음(없으면 잘린 제목으로)
  var FEAT = [
    { k: 'p', name: '장소 정보', re: /📍|스팟|명소|가기 좋은|포토 ?존|장소|▪️[^\n]*(앞|뒤|관|구장|잔디)/, why: '11/3 단풍 분석: 장소를 알려 준 계절·공간 게시물 공유 1.4~3.0% 대 풍경만 0.1~0.4%' },
    { k: 'q', name: '질문형 첫 줄', re: null, why: '11/3 90일 점검: 공유 상위가 질문형 첫 줄(「구독료 없이 쓴다고?」 등)' }
  ];
  function featOf(cap) {
    var s = String(cap || ''), first = s.split(/\n|⠀/)[0];
    return (FEAT[0].re.test(s) ? 'p' : '') + (/[?？]/.test(first) ? 'q' : '');
  }
  var day = function (s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)); };
  var age = function (d, u) { return Math.round((day(u) - day(d)) / 864e5); };
  var addD = function (s, n) { return new Date(day(s) + n * 864e5).toISOString().slice(0, 10); };
  function med(a) { a = a.filter(function (x) { return x != null && isFinite(x); }).sort(function (p, q) { return p - q; }); var n = a.length; return n ? (n % 2 ? a[n >> 1] : (a[n / 2 - 1] + a[n / 2]) / 2) : null; }
  function last(it) { var h = (it.h || []).filter(Boolean); return h.length ? h[h.length - 1] : null; }
  function rate(it, j) { var v = last(it); return v && it.r >= RX_MIN && v[j] != null ? v[j] / it.r : null; }
  var live = function (it) { return it.t !== '스토리' && !it.ad && !it.hid && !it.x; };
  var typ = function (it) { return it.c === 'hong._.video' ? '릴스' : it.t; }; // hong은 예전 「릴스/영상」과 지금 「릴스」를 한 형식으로
  var ft = function (it) { return it.ft != null ? it.ft : featOf(it.n); };
  var fx = function (x) { return x == null ? '–' : x >= 10 ? Math.round(x) + '배' : (Math.round(x * 10) / 10) + '배'; };
  var pc = function (x) { return x == null ? '–' : (Math.round(x * 1000) / 10).toFixed(x < 0.01 ? 2 : 1) + '%'; };
  var pc2 = function (x) { return x == null ? '–' : (x * 100).toFixed(2) + '%'; };
  var nm = function (s) { return String(s || '').split(/\s{2,}|⠀|\n/)[0].slice(0, 40); };

  // 평소: 같은 채널·형식, 최근 1년, 게시 14일 이상, 광고 빼고. 이벤트는 댓글 말고는 낮아서 비율 평소에서 뺌
  function bases(D) {
    var U = D.updated, B = {};
    D.items.forEach(function (it) {
      if (OWN.indexOf(it.c) < 0 || !live(it)) return;
      var a = age(it.d, U); if (a < 14 || a > 365) return;
      [it.c + '|' + typ(it), it.c + '|*'].forEach(function (k) {
        var b = B[k] = B[k] || { v: [], s: [], sv: [], l: [], cm: [], ag: [], evc: [] };
        var v = last(it); if (v && v[0] != null) b.v.push(v[0]);
        if (it.ty === '이벤트') { b.evc.push(rate(it, 2)); return; }
        b.s.push(rate(it, 3)); b.sv.push(rate(it, 4)); b.l.push(rate(it, 1)); b.cm.push(rate(it, 2));
        (it.ag || []).forEach(function (x) { if (x && x[0] > 0) b.ag.push(x); });
      });
    });
    Object.keys(B).forEach(function (k) { var b = B[k]; b.n = b.v.length; b.mv = med(b.v); b.ms = med(b.s); b.msv = med(b.sv); b.ml = med(b.l); b.mcm = med(b.cm); b.mevc = med(b.evc); });
    return B;
  }
  // 올린 지 a일 평소 조회: 지난 게시물의 1·3·7일 기록 중 날수가 가까운 것(±1일, 7일 넘으면 ±2일) 5개 이상
  function ageBase(b, a) {
    if (!b) return null;
    var w = a > 7 ? 2 : 1, xs = b.ag.filter(function (x) { return Math.abs(x[1] - a) <= w; }).map(function (x) { return x[0]; });
    return xs.length >= MIN_N ? med(xs) : null;
  }
  function pick(B, it) { var k = B[it.c + '|' + typ(it)]; return k && k.n >= MIN_N ? k : B[it.c + '|*']; }

  // 조회 속도(2026-11-09 담당자 「조회수 속도에 대한 분석도 콘텐츠 분석에」): it.sp = [[경과 시간, 조회, 도달] | null] × 올린 지 1·3·6·24시간(서버 loadSpeed_, 「게시물 시간별」 2026-10-20~)
  // 평소 = 같은 채널·형식 게시물이 같은 시간에 받은 조회 중간값(나를 빼고 3개 이상 = 보드 오늘 칸 hbase와 같은 수), 순위 = 기록이 있는 같은 채널·형식 중 조회 순위
  // 인스타 캐러셀 조회는 장 넘김까지 세서 장 수에 따라 부풀므로 도달 배수를 함께 씀
  var SP_H = [1, 3, 6, 24], SP_MIN = 3, SP_MAIN = 1; // SP_MAIN = 대표 칸(3시간), 없으면 있는 것 중 가장 늦은 시간
  function speedPool(D) {
    var P = {};
    D.items.forEach(function (it) {
      if (OWN.indexOf(it.c) < 0 || !live(it) || !it.sp) return;
      var p = P[it.c + '|' + typ(it)] = P[it.c + '|' + typ(it)] || [[], [], [], []];
      it.sp.forEach(function (x, j) { if (x && x[1] != null) p[j].push({ it: it, v: x[1], r: x[2] }); });
    });
    return P;
  }
  function speed(P, it) {
    var pool = it.sp && P[it.c + '|' + typ(it)];
    if (!pool) return null;
    var res = [];
    it.sp.forEach(function (x, j) {
      if (!x || x[1] == null) return;
      var o = pool[j].filter(function (y) { return y.it !== it; }), mv = med(o.map(function (y) { return y.v; })), mr = med(o.map(function (y) { return y.r; }));
      res.push({ h: SP_H[j], v: x[1], r: x[2], n: o.length + 1, rank: 1 + o.filter(function (y) { return y.v > x[1]; }).length,
        vr: o.length >= SP_MIN && mv ? x[1] / mv : null, rr: o.length >= SP_MIN && mr && x[2] != null ? x[2] / mr : null });
    });
    if (!res.length) return null;
    var main = res.filter(function (s) { return s.h === SP_H[SP_MAIN]; })[0] || res[res.length - 1];
    return { all: res, main: main };
  }
  function spTxt(S, t) {
    if (!S) return '';
    var m = S.main, w = m.h + '시간';
    if (m.vr == null) return '첫 ' + w + ' 조회 ' + m.v.toLocaleString() + ' · 같은 형식 기록이 적어 비교 안 함';
    return '첫 ' + w + ' 조회 같은 형식 평소의 ' + fx(m.vr) + (m.rr != null && t === '캐러셀' ? ' · 도달 ' + fx(m.rr) : '') + ' · 기록된 ' + m.n + '개 중 ' + m.rank + '위';
  }

  // 게시물 하나 판정 → { 모양, 한 줄 }
  function judge(D, B, it, P) {
    var U = D.updated, a = age(it.d, U), b = pick(B, it), v = last(it), out = { it: it, age: a, title: nm(it.n), c: it.c, t: it.t, u: it.u || '' };
    out.sp = P ? speed(P, it) : null;
    if (!b || !v) { out.shape = '기준 없음'; out.line = '비교할 평소 자료가 아직 적어요'; return out; }
    var ab = a < 14 ? ageBase(b, a) : null;
    out.views = v[0];
    out.vr = v[0] == null ? null : ab ? v[0] / ab : b.mv ? v[0] / b.mv : null;
    out.vk = a >= 14 ? '최종' : ab ? a + '일째' : '다 자란 평소';
    if (it.r != null && it.r < RX_MIN) { out.shape = '모으는 중'; out.line = '도달 ' + it.r + '명이라 비율은 아직 안 봐요'; return out; }
    if (it.ty === '이벤트') {
      var c = rate(it, 2), mc = b.mevc;
      out.shape = '이벤트'; out.cr = c;
      out.line = '이벤트라 댓글로 봐요: 댓글 ÷ 도달 ' + pc2(c) + (mc ? ' · 이벤트 평소 ' + pc2(mc) + (c != null && c < mc * 0.8 ? ' — 참여가 줄었어요' : '') : '');
      return out;
    }
    var s = rate(it, 3), sv = rate(it, 4), l = rate(it, 1);
    out.s = s; out.sv = sv; out.l = l;
    var sr = s != null && b.ms ? s / b.ms : null, svr = sv != null && b.msv ? sv / b.msv : null, lr = l != null && b.ml ? l / b.ml : null, vr = out.vr;
    out.sr = sr; out.svr = svr; out.lr = lr;
    // 올린 지 14일 전인데 같은 날수 평소가 없으면(다 자란 평소와만 견줄 수 있으면) 조회로는 판정하지 않음 — 11/3 단풍 캐러셀(13시간째 같은 시간 평소의 2.3배)이 다 자란 평소 대비 0.6배라 「덜 퍼짐」으로 잘못 나와서
    var vOk = a >= 14 || out.vk !== '다 자란 평소', vj = vOk ? vr : null;
    var head = vOk ? '조회 같은 형식 ' + out.vk + ' 평소의 ' + fx(vr) : '조회는 다 자란 평소까지 ' + (vr == null ? '–' : Math.round(vr * 100) + '%') + '(아직 판정 안 함)';
    var sh, why;
    if (vj != null && vj >= 1.5 && sr != null && sr >= 1.3) { sh = '잘 퍼짐·공유형'; why = '많이 퍼졌고 공유도 평소의 ' + fx(sr) + ' — 친구에게 보낼 이유가 있던 게시물'; }
    else if (vj != null && vj >= 1.5) { sh = '잘 퍼짐'; why = '많이 퍼졌어요 · 공유 ' + fx(sr) + ' · 저장 ' + fx(svr); }
    // 공유가 크게 높으면 덜 퍼졌어도 공유형(11/3 「AI 모델 48개」 공유 6.6%가 조회 0.6배로 「덜 퍼짐」에 묻혀서)
    else if (sr != null && sr >= 1.3 && (lr == null || lr < 1.15)) { sh = '공유형'; why = '좋아요보다 공유가 높아요(평소의 ' + fx(sr) + ')' + (vj != null && vj < 0.7 ? ' — 덜 퍼졌지만 본 사람은 많이 보냈어요' : ''); }
    else if (sr != null && sr >= 1.1 && lr != null && lr >= 1.1) { sh = '고르게 좋음'; why = '공유(평소의 ' + fx(sr) + ')·좋아요(' + fx(lr) + ') 모두 평소 이상' + (vj != null && vj < 0.7 ? ' — 덜 퍼졌지만 본 사람 반응은 좋아요' : ''); }
    else if (svr != null && svr >= 1.3 && !(vj != null && vj < 0.7)) { sh = '저장형'; why = '저장이 평소의 ' + fx(svr) + ' — 다시 볼 정보가 있던 게시물'; }
    else if (vj != null && vj < 0.7 && ((lr != null && lr >= 0.9) || (sr != null && sr >= 0.9))) { sh = '덜 퍼짐'; why = '본 사람 반응은 평소인데 덜 퍼졌어요 — 첫 장·첫 3초나 올린 시간을 볼 차례'; }
    else if (vj != null && vj < 0.7) { sh = '약함'; why = '조회와 반응이 둘 다 평소 아래예요'; }
    else if (svr != null && svr >= 1.3) { sh = '저장형'; why = '저장이 평소의 ' + fx(svr) + ' — 다시 볼 정보가 있던 게시물'; }
    else { sh = '평소'; why = '공유 ' + fx(sr) + ' · 저장 ' + fx(svr) + ' · 좋아요 ' + fx(lr); }
    var f = ft(it), hint = [];
    if (f.indexOf('p') >= 0) hint.push(sr != null && sr >= 1.1 ? '장소 정보 있음(공유 잘 되는 패턴과 맞음)' : '장소 정보 있음');
    if (f.indexOf('q') >= 0) hint.push('질문형 첫 줄');
    var st = a < 14 ? spTxt(out.sp, it.t) : ''; // 판정 확정(14일) 줄에는 속도를 다시 쓰지 않음
    out.shape = sh; out.line = head + (st ? ' · ' + st : '') + ' · ' + why + (hint.length ? ' · ' + hint.join(' · ') : '') + (a < 14 ? ' (아직 느는 중)' : '');
    return out;
  }

  // 인스타 최근 90일(게시 14일 이상 = 다 자란 것) 묶음: 유형 · 캡션 특징 · 형식 · 제작
  function groups(D) {
    var U = D.updated, L = D.items.filter(function (it) { var a = age(it.d, U); return it.c === '인스타그램' && live(it) && a >= 14 && a <= 104; });
    var K = L.filter(function (it) { return it.ty !== '이벤트'; });
    var all = { n: K.length, s: med(K.map(function (it) { return rate(it, 3); })), sv: med(K.map(function (it) { return rate(it, 4); })), v: med(K.map(function (it) { var v = last(it); return v && v[0]; })) };
    function grp(arr, label) {
      var g = { k: label, n: arr.length, s: med(arr.map(function (it) { return rate(it, 3); })), sv: med(arr.map(function (it) { return rate(it, 4); })), v: med(arr.map(function (it) { var v = last(it); return v && v[0]; })) };
      if (g.n < MIN_N) { g.vd = '표본 적음'; return g; }
      var hs = g.s >= all.s * 1.1, hv = g.sv >= all.sv * 1.1, ls = g.s < all.s * 0.9, lv = g.sv < all.sv * 0.9;
      g.vd = hs && hv ? '늘리기' : ls && lv ? '줄이기 검토' : (hs && lv) ? '고치기(저장 약함)' : (hv && ls) ? '고치기(공유 약함)' : hs || hv ? '늘리기' : ls || lv ? '고치기' : '유지';
      // 공지·소식은 신호가 좋아도 늘리지 않음(전략: 피드가 공지판처럼 보이면 안 됨, 비율은 KPI 칸에서 따로)
      if (label === '공지·소식' && g.vd === '늘리기') g.vd = '유지(비율은 따로)';
      return g;
    }
    function by(f, arr) { var o = {}; arr.forEach(function (it) { var k = f(it) || '-'; (o[k] = o[k] || []).push(it); }); return Object.keys(o).map(function (k) { return grp(o[k], k); }).sort(function (a, b) { return b.n - a.n; }); }
    var ev = L.filter(function (it) { return it.ty === '이벤트'; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
    return {
      all: all,
      ty: by(function (it) { return it.ty; }, K),
      feat: FEAT.map(function (F) { var y = K.filter(function (it) { return ft(it).indexOf(F.k) >= 0; }), nn = K.filter(function (it) { return ft(it).indexOf(F.k) < 0; }); return { name: F.name, why: F.why, yes: grp(y, '있음'), no: grp(nn, '없음') }; }),
      t: by(function (it) { return it.t; }, K),
      p: by(function (it) { return it.p; }, K),
      ev: { n: ev.length, last: ev.slice(-3).map(function (it) { return { d: it.d, c: rate(it, 2) }; }) }
    };
  }

  // KPI: 공유 1.0% · 캐러셀 저장 0.3% · 공지·소식 비율 · 릴스 수와 도달(작년 같은 90일과)
  function kpi(D) {
    var U = D.updated, ig = function (a0, a1) { return D.items.filter(function (it) { var a = age(it.d, U); return it.c === '인스타그램' && live(it) && a >= a0 && a <= a1; }); };
    var now = ig(0, 89), ripe = ig(14, 104).filter(function (it) { return it.ty !== '이벤트'; }), ly = ig(365, 454), lyR = ig(379, 469);
    var reels = function (A) { return A.filter(function (it) { return it.t === '릴스'; }).length; };
    return {
      share: med(ripe.map(function (it) { return rate(it, 3); })), save: med(ripe.filter(function (it) { return it.t === '캐러셀'; }).map(function (it) { return rate(it, 4); })),
      notice: now.length ? now.filter(function (it) { return it.ty === '공지·소식'; }).length / now.length : null,
      n: now.length, reels: reels(now), reelsLy: reels(ly),
      reach: med(ig(14, 104).map(function (it) { return it.r; })), reachLy: med(lyR.map(function (it) { return it.r; })),
      target: KPI
    };
  }

  // 전체: 어제(월요일이면 금~일) 올린 것 + 오늘로 14일째가 된 것(판정 확정)
  // o.days: 보드는 최근 7일을 보여 줌(메일은 어제, 월요일은 금~일)
  function build(D, o) {
    var U = D.updated, B = bases(D), P = speedPool(D), wd = new Date(day(U)).getUTCDay(), back = (o && o.days) || (wd === 1 ? 3 : 1);
    var mine = D.items.filter(function (it) { return OWN.indexOf(it.c) >= 0 && live(it); });
    var yest = mine.filter(function (it) { var a = age(it.d, U); return a >= 1 && a <= back; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; }).map(function (it) { return judge(D, B, it, P); });
    var done = mine.filter(function (it) { return age(it.d, U) === 14 || (back > 1 && age(it.d, U) >= 14 && age(it.d, U) <= 16); }).map(function (it) { return judge(D, B, it); });
    return { at: U, from: addD(U, -back), yest: yest, done: done, g: groups(D), kpi: kpi(D), fx: fx, pc: pc, pc2: pc2, SP_H: SP_H };
  }
  return { build: build, featOf: featOf, FEAT: FEAT, MIN_N: MIN_N };
})();
