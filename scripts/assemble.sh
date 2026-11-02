#!/usr/bin/env bash
# Join rendered segments (stream copy) and mux the mastered audio.
#   scripts/assemble.sh <group> <segments_dir> <audio_dir> <out_dir>      e.g. long-4k segs build/audio dist
set -euo pipefail
GROUP="$1"; SEGS="$2"; AUDIO="$3"; OUT="$4"; FORMAT="${GROUP%%-*}"; QUALITY="${GROUP#*-}"
mkdir -p "$OUT"; LIST="$(mktemp)"
ls "$SEGS"/"${GROUP}"__*.mp4 | sort | sed "s#^#file '$(pwd)/#; s#\$#'#" > "$LIST"
[ -s "$LIST" ] || { echo "no segments for $GROUP in $SEGS"; exit 1; }
echo "segments:"; cat "$LIST"
NAME="Interstellar_3I-ATLAS_${QUALITY}"; [ "$FORMAT" = "short" ] && NAME="Interstellar_3I-ATLAS_Short_1080x1920"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$OUT/_video_only.mp4"
ffmpeg -y -loglevel error -i "$OUT/_video_only.mp4" -i "$AUDIO/master.${FORMAT}.m4a" -map 0:v:0 -map 1:a:0 -c:v copy -c:a copy \
  ${SMOKE:+-shortest} -movflags +faststart "$OUT/${NAME}.mp4"
rm -f "$OUT/_video_only.mp4" "$LIST"
probe() { ffprobe -v error -select_streams "$2" -show_entries stream=duration -of default=noprint_wrappers=1:nokey=1 "$1" | head -1 | tr -d ', \r'; }
V=$(probe "$OUT/${NAME}.mp4" v:0); A=$(probe "$OUT/${NAME}.mp4" a:0)
echo "video ${V}s audio ${A}s"
# informational only: never fail the job on this check
python3 - "$V" "$A" <<'PY' || true
import sys
try:
    v, a = float(sys.argv[1]), float(sys.argv[2])
    if abs(v - a) > 0.25: print(f"::warning::A/V length mismatch {v:.2f}s vs {a:.2f}s")
except Exception as e:
    print(f"::notice::duration check skipped ({e})")
PY
cp "$AUDIO/captions.${FORMAT}.srt" "$OUT/${NAME}.srt"; cp "$AUDIO/captions.${FORMAT}.vtt" "$OUT/${NAME}.vtt"
cp "$AUDIO/master.${FORMAT}.wav" "$OUT/${NAME}_audio_master_24bit.wav" 2>/dev/null || true
ffmpeg -y -loglevel error -ss "${THUMB_AT:-6}" -i "$OUT/${NAME}.mp4" -frames:v 1 -q:v 2 "$OUT/${NAME}_thumbnail.jpg" || true
ls -la "$OUT"
