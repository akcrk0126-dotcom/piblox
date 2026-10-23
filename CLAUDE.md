# piblox

## 업데이트마다 트레일러 영상

게임을 업데이트할 때마다 (지금은 블록크래프트 `craft.html`) 트레일러 영상과 업데이트 내용을 같이 올려요.

1. 장면 스크립트를 만들어요: `tools/trailer/scenes/<게임>-<YYYY-MM-DD>.js`
   (`prepare(rec)` 에서 장소 · 아이템을 준비하고, `play(rec)` 에서 `rec.shoot(초, 매프레임함수)` · `rec.caption()` · `rec.card()` 로 찍어요.
   이전 장면 파일을 본보기로 쓰세요.)
2. 녹화해요 (로컬 서버 `python3 -m http.server 8790` 를 켜 둔 채로):
   `FFMPEG=<ffmpeg 경로> node tools/trailer/record.js tools/trailer/scenes/<파일>.js trailers/<게임>-<날짜>.mp4`
   - ffmpeg 가 없으면 `pip install imageio-ffmpeg` 후 `python3 -c "import imageio_ffmpeg as f;print(f.get_ffmpeg_exe())"`
   - 가상 시계로 프레임을 한 장씩 찍어서 느린 헤드리스에서도 30fps 로 부드러워요.
   mp4 와 같은 이름의 webm · jpg(표지) 도 같이 만들어져요 (모두 커밋).
3. `craft.html` 의 `UPDATES` 배열 맨 앞에 `{v, title, video, notes}` 를 추가해요.
   타이틀 화면 "🎬 새 소식" 버튼과 (처음 한 번) 빨간 점으로 보여요.
4. 영상은 10MB 아래로. 녹화기가 넘으면 `-crf` 를 올려서 다시 만들어요 (처음 값은 `CRF=` · `WEBM_CRF=` 로 바꿀 수 있어요).
