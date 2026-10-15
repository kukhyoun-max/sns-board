#!/bin/bash
# 대시보드 조립: src/ → index.html (GitHub Pages 배포본)
#   ./build.sh          → index.html (실데이터 API 연결)
#   ./build.sh preview  → .preview/index.html (sample/data.json 사용, API 호출 없음)
#                         확인: cd .preview && python3 -m http.server 8767 → http://localhost:8767
set -e
cd "$(dirname "$0")"

# Apps Script 웹앱 주소 (배포 ID가 같으면 새 버전을 배포해도 이 주소는 그대로)
API_URL="https://script.google.com/macros/s/AKfycbyGL0h1nmGMIMiG0KsZksAyOUaxcdwKiXLysmB2ExGLEhVX3eUiwmRbv7uTPhsWf6Q6/exec"
CHART_TAG='<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js"></script>'

MODE="${1:-prod}" API_URL="$API_URL" CHART_TAG="$CHART_TAG" python3 - <<'PY'
import os
mode = os.environ['MODE']
head = open('src/head.html', encoding='utf-8').read()
css  = open('src/extra.css', encoding='utf-8').read()
body = open('src/body.html', encoding='utf-8').read()
app  = open('src/app.js', encoding='utf-8').read()
html = head + css + body + app + '</script>\n'
tag = os.environ['CHART_TAG']
assert html.count(tag) == 1, 'chart.js 태그를 찾을 수 없음'
if mode == 'preview':
    os.makedirs('.preview', exist_ok=True)
    html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + '</body></html>'
    open('.preview/index.html', 'w', encoding='utf-8').write(html)
    import shutil; shutil.copy('sample/data.json', '.preview/data.json')
    print('.preview/index.html (샘플 데이터)')
else:
    inj = '<script>window.SNS_API_URL = "' + os.environ['API_URL'] + '";</script>\n'
    html = html.replace(tag, inj + tag)
    open('index.html', 'w', encoding='utf-8').write(html)
    print('index.html', len(html.encode('utf-8')), 'bytes')
PY
