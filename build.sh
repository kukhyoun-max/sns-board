#!/bin/bash
# 대시보드 조립: src/ → index.html (GitHub Pages 배포본)
#   ./build.sh          → index.html (실데이터 API 연결)
#   ./build.sh preview  → .preview/index.html (sample/data.json 사용, API 호출 없음)
#                         확인: cd .preview && python3 -m http.server 8767 → http://localhost:8767
# 조립은 perl로 한다(Git Bash·macOS·Linux 기본 포함 — Python이 없는 PC에서도 빌드되게)
set -e
cd "$(dirname "$0")"

# Apps Script 웹앱 주소 (배포 ID가 같으면 새 버전을 배포해도 이 주소는 그대로)
API_URL="https://script.google.com/macros/s/AKfycbyGL0h1nmGMIMiG0KsZksAyOUaxcdwKiXLysmB2ExGLEhVX3eUiwmRbv7uTPhsWf6Q6/exec"
CHART_TAG='<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js" integrity="sha384-dug+JxfBvklEQdJ4AYuBBAIScUz0bVN73xpy273gcAwHjb3qI0fXmuYNaNfdyYJG" crossorigin="anonymous"></script>'

MODE="${1:-prod}" API_URL="$API_URL" CHART_TAG="$CHART_TAG" perl - <<'PL'
use strict; use warnings;
my ($mode, $api, $tag) = @ENV{qw(MODE API_URL CHART_TAG)};
sub rd { my $f = shift; open my $F, '<:raw', $f or die "$f: $!\n"; local $/; my $s = <$F>; $s =~ s/\r\n/\n/g; $s }
sub wr { my ($f, $s) = @_; open my $F, '>:raw', $f or die "$f: $!\n"; print $F $s; close $F }
my $html = rd('src/head.html') . rd('src/extra.css') . rd('src/body.html') . rd('src/app.js') . "</script>\n";
my $n = () = $html =~ /\Q$tag\E/g;
die "chart.js 태그를 찾을 수 없음\n" unless $n == 1;
# 배포본에도 doctype·viewport·lang을 붙인다(없으면 휴대폰에서 PC 폭으로 그려 축소됨)
my $pre = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>';
my $post = '</body></html>';
if ($mode eq 'preview') {
    mkdir '.preview' unless -d '.preview';
    wr('.preview/index.html', $pre . $html . $post);
    wr('.preview/data.json', rd('sample/data.json'));
    # API 분석 데이터(part) 미리보기용 가짜 값
    for my $p (qw(yt ig yv)) { wr(".preview/part_$p.json", rd("sample/part_$p.json")) if -e "sample/part_$p.json"; }
    print ".preview/index.html (샘플 데이터)\n";
} else {
    my $inj = '<script>window.SNS_API_URL = "' . $api . '";</script>' . "\n";
    $html =~ s/\Q$tag\E/$inj$tag/;
    $html = $pre . $html . $post;
    wr('index.html', $html);
    print 'index.html ', length($html), " bytes\n";
}
PL
