/**
 * 구글애즈 스크립트 — 매일 스냅샷 시트에 광고 실적 쓰기 (02_광고/2026-10-17_광고데이터_자동화_설계안.md 2장)
 *
 * 구글애즈 → 도구 → 일괄 작업 → 스크립트 → + → 이 파일 전체를 붙여 넣음 → 승인 → 미리보기 → 실행 → 일정: 매일 06:00
 * - 「구글애즈 리포트」 탭: FROM ~ 어제 일별 캠페인 실적(Day · Campaign · Impr. · Clicks · Cost)을 통째로 다시 씀
 *   Apps Script(gadsCols_)가 읽는 열 이름 그대로라 대시보드 코드는 그대로 둠. 비용은 계정 통화(원).
 * - 「구글애즈 동영상」 탭: 캠페인 × 영상 합계(Campaign · Video ID · Video title · Impr. · Views · Cost)
 *   영상 ID로 유튜브 게시물에 광고 「확인」 표시가 붙음(loadAdLinks_).
 * - 「실행 로그」 탭에 결과 한 줄을 남김. 08:00 Apps Script 기록이 이 값을 읽어 대시보드에 반영.
 * - 시트 편집 권한이 있는 구글 계정으로 승인해야 함. 이 스크립트는 시트에 쓰기만 하고 광고 설정은 바꾸지 않음.
 */
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1WshbvV-foluKpVu79vdZ75BBfH-ycME_nPe0RcJuwr4/edit';
const FROM = '2019-01-01';                 // 계정에 남아 있는 가장 오래된 광고(2019-06)보다 앞
const DAILY_TAB = '구글애즈 리포트', VIDEO_TAB = '구글애즈 동영상', LOG_TAB = '실행 로그';

function main() {
  const ss = SpreadsheetApp.openByUrl(SHEET_URL);
  const tz = AdsApp.currentAccount().getTimeZone();
  const to = Utilities.formatDate(new Date(Date.now() - 864e5), tz, 'yyyy-MM-dd');
  const range = "segments.date BETWEEN '" + FROM + "' AND '" + to + "'";
  const won = micros => Math.round(Number(micros || 0) / 1e4) / 100;
  try {
    // 1) 일별 캠페인
    const daily = [];
    const it = AdsApp.search('SELECT segments.date, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros ' +
      'FROM campaign WHERE ' + range + ' AND metrics.impressions > 0');
    while (it.hasNext()) {
      const r = it.next();
      daily.push([r.segments.date, r.campaign.name, Number(r.metrics.impressions) || 0, Number(r.metrics.clicks) || 0, won(r.metrics.costMicros)]);
    }
    daily.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1);
    write_(ss, DAILY_TAB, ['Day', 'Campaign', 'Impr.', 'Clicks', 'Cost'], daily, 1);

    // 2) 캠페인 × 영상 (조회수 필드 이름이 API 버전에 따라 달라서 새 이름 → 옛 이름 순서로 시도)
    let video = [];
    ['video_trueview_views', 'video_views'].some(f => {
      try {
        const rows = [];
        const v = AdsApp.search('SELECT campaign.name, video.id, video.title, metrics.impressions, metrics.' + f + ', metrics.cost_micros ' +
          'FROM video WHERE ' + range + ' AND metrics.impressions > 0');
        const key = f.replace(/_(\w)/g, (m, c) => c.toUpperCase());
        while (v.hasNext()) {
          const r = v.next();
          rows.push([r.campaign.name, r.video.id, r.video.title || '', Number(r.metrics.impressions) || 0, Number(r.metrics[key]) || 0, won(r.metrics.costMicros)]);
        }
        video = rows;
        return true;
      } catch (e) { Logger.log(f + ': ' + e.message); return false; }
    });
    video.sort((a, b) => b[5] - a[5]);
    write_(ss, VIDEO_TAB, ['Campaign', 'Video ID', 'Video title', 'Impr.', 'Views', 'Cost'], video, 0);

    const cost = daily.reduce((s, r) => s + r[4], 0);
    log_(ss, daily.length, '정상 — ' + FROM + '~' + to + ' 일별 ' + daily.length + '행(비용 ' + Math.round(cost).toLocaleString() + '원) · 영상 ' + video.length + '행');
  } catch (e) {
    log_(ss, 0, '오류: ' + e.message);
    throw e;
  }
}

// 탭을 비우고 머리글 + 행을 씀. textCols: 앞에서부터 글자로 둘 열 수(날짜가 날짜값으로 바뀌지 않게)
function write_(ss, name, head, rows, textCols) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  if (rows.length) {
    if (textCols) sh.getRange(2, 1, rows.length, textCols).setNumberFormat('@');
    sh.getRange(2, 1, rows.length, head.length).setValues(rows);
  }
  sh.setFrozenRows(1);
}

function log_(ss, n, msg) {
  const sh = ss.getSheetByName(LOG_TAB);
  if (sh) sh.appendRow([new Date(), '구글애즈 스크립트', n, msg]);
}
