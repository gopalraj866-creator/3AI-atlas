# 3I/ATLAS + the 63-light-year radio signal — 8-minute Three.js documentary

A fully code-generated YouTube video:

* **Visuals** – real-time **Three.js / WebGL** scenes (comet with jets, orbit sim, Webb telescope, deuterium/carbon-13 charts, cosmic timeline, Beta Pictoris system, MeerKAT array with a radio waterfall, magnetosphere + aurora). Every frame is a pure function of time, so renders are deterministic.
* **Rendering** – headless Chrome steps through the scenes frame-by-frame inside **GitHub Actions**, in parallel chunks, then joins them with `ffmpeg` (stream copy, no re-encode).
* **Sound** – neural narration (Microsoft Edge voices via `edge-tts`), a procedurally composed cinematic score + SFX, voice EQ/compression, automatic ducking, two-pass loudness mastering to **-14 LUFS / -1.5 dBTP** (YouTube reference), 48 kHz, AAC 320 kbps plus a 24-bit WAV master.
* **Subtitles** – `.srt` and `.vtt` generated from the real TTS word timings. Optionally burned in (always for Shorts).
* **Outputs** – `1080p` (1920×1080), `4K` (3840×2160), and a ~58 s **Short** (1080×1920, captions burned in).

## Quick start

1. Create a GitHub repo and push this folder (the `.github/workflows/render.yml` must be at the repo root).
2. **Actions → Render video → Run workflow.**
   * First run with **preview = true** (low-res, a few minutes) to check everything.
   * Then run `quality = 1080p`, and when happy `quality = 4k`.
3. When it finishes, open the run and download the artifacts:
   * `video-long-1080p`, `video-long-4k`, `video-short-shorts` – each contains the `.mp4`, `.srt`, `.vtt`, a thumbnail and the 24-bit master WAV.
   * `audio` – narration, music stem, cues, transcript, loudness report.
   * Tick **publish_release** to also attach everything to a GitHub Release.

Workflow inputs: `format` (both/long/short) · `quality` (both/1080p/4k) · `preview` · `burn_captions_long` · `voice` · `rate` · `fps` · `publish_release`.

### Cost / time (be aware)

GitHub runners have no GPU, so WebGL runs on software rendering (SwiftShader). **Measured on a 2-vCPU machine** with the heaviest scene (comet jets): **~8 s/frame at 1080p, ~30 s/frame at 4K, ~1–2 s/frame at 540×960**. The film is 14,400 frames, so the whole 1080p render is roughly **15–25 CPU-hours** and 4K roughly **60–100 CPU-hours**. The workflow splits it into **26 chunks (1080p), 65 chunks (4K, 8 s each), 7 (Short)** that render in parallel; each job stays well under GitHub's 6 h limit. Wall-clock is then limited by how many jobs your plan runs at once (about 20 on free plans): expect ~2–4 h for 1080p and a long day for 4K.

* **Public repo**: free standard-runner minutes, so this is just waiting time (public runners also have 4 vCPUs, ~2× faster than the numbers above).
* **Private repo**: the free quota (2,000 min/month) is *not* enough even for 1080p. Use a public repo, a paid plan, or run `render-segment.mjs` locally.
* Render **preview** first (960×540, a few minutes), then **1080p**, then **4k**. Use `fps = 24` to cut cost by 20 %.

## Run locally

```bash
npm install                       # three + puppeteer-core
pip install numpy scipy edge-tts  # audio
sudo apt install ffmpeg           # plus Google Chrome / Chromium (set CHROME_PATH if not in /usr/bin)

python3 audio/build_audio.py --format long  --out build/audio     # narration + srt + score + master
python3 audio/build_audio.py --format short --out build/audio

node render/plan.mjs --format long --quality 1080p --dump build/plan.json
# render one chunk (index 3 shown):
SEG="$(node -e "console.log(JSON.stringify(require('./build/plan.json').include[3]))")" \
  node render/render-segment.mjs --out out --cues build/audio/cues.long.json
# preview stills of any scene:
node render/still.mjs --scene s05_webb --times 6,30,52 --w 1280 --h 720 --out stills
# after rendering all chunks of a group:
bash scripts/assemble.sh long-1080p out build/audio dist
```

`edge-tts` needs internet access to Microsoft's speech service (available on GitHub runners). If it is unreachable the audio step falls back to `espeak-ng` (robotic – check the log for a warning) or, as a last resort, silent timing only.

## Project layout

```
content/script.json        timeline, narration lines, pronunciations (edit this to change the film)
src/page/                  Three.js engine: main.js (renderer+post), ui.js (HUD), common.js, exo.js
src/page/scenes/s01..s11   the 11 scenes (each = build(ctx) -> {scene,camera,update(t),cues})
render/                    plan.mjs (matrix) · render-segment.mjs (frames -> mp4) · still.mjs · lib.mjs
audio/                     build_audio.py (layout, SRT, mix, master) · tts.py · synth.py (score + SFX)
scripts/assemble.sh        concat + mux
metadata/youtube.md        title, description, chapters, tags, sources
.github/workflows/render.yml
```

## Editing

* **Narration / timing** – `content/script.json`. Each block = one scene (or a window of one for the Short); lines are spaced automatically and sped up (max 1.3×) if they overrun the slot.
* **On-screen text** – the `cues` array at the bottom of each scene file (`at`, `dur`, `pos`, `kind`).
* **Mood of the music** – `mood` per block (`mystery, wonder, journey, tension, science, epic, transition, signal, aurora, resolve, outro`), defined in `audio/synth.py`.

## Facts and sources (checked 1 Nov 2026)

* 3I/ATLAS discovered July 2025 by the NASA-funded ATLAS survey in Chile; third confirmed interstellar object after ʻOumuamua (2017) and Borisov (2019); ~137,000 mph; perihelion ~29/30 Oct 2025 at ~203 million km; closest to Earth 19 Dec 2025 at ~270 million km. (Smithsonian, USA Today, Sci.News)
* Post-perihelion brightening/bluer colour and ≥7 jets imaged 8–9 Nov 2025; NASA reports no anomalous deceleration or orbit change. (Sci.News, Ground News, The News Lens)
* Webb NIRSpec (Dec 2025): ~30× solar-system deuterium, low carbon-13 → formed 10–12 billion years ago ("cosmic noon"). Cordiner et al., *Nature*, 22 June 2026; companion VLT paper Opitom et al. (NASA, ESA, Smithsonian, EarthSky)
* Radio signal: first radio emission from an exoplanet, **Beta Pictoris b, ~63 ly**, MeerKAT, arXiv preprint 15 Sept 2026; field ≥200× Jupiter's (>1,000 gauss); *not* evidence of intelligent life. (CNN, Science News, ScienceAlert, RNZ)
* The "60 light-years" in the headline refers to this ~63 ly detection. The 2015 RATAN-600 / HD 164595 (≈94 ly) signal and the 1977 Wow! signal are mentioned only as context.
* Statements attributed to Avi Loeb are presented as his hypothesis; the on-screen "NASA says" box reflects NASA statements reported by The News Lens.

> The comet age is an estimate from isotope ratios; the exoplanet result is a preprint awaiting peer review. The video says so.
