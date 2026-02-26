---
name: youtube-summary
description: Summarize a YouTube video. Triggers: youtube link, youtube video, summarize video, суть видео, транскрипция видео, ютуб ролик, youtube ролик
---

# YouTube Video Summary

Summarize a YouTube video by extracting its transcript and generating a concise Russian-language summary.

## Step 1 — Check dependencies

Run `which yt-dlp`. If not found, tell the user to install it:

```
brew install yt-dlp
```

Do NOT proceed until `yt-dlp` is available.

## Step 2 — Extract video ID

Parse the YouTube URL to get the video ID. Supported formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/shorts/VIDEO_ID`

## Step 3 — Try subtitles first

Check available subtitles:

```bash
yt-dlp --list-subs "VIDEO_URL" 2>&1
```

If subtitles exist (look for language codes in the output, including auto-generated):

1. Download them (prefer original language over auto-translated):
```bash
yt-dlp --write-auto-sub --sub-lang "en,ru,de,fr,es,pt,it,ja,ko,zh,ar,hi" --sub-format vtt --skip-download -o "/tmp/yt-%(id)s" "VIDEO_URL"
```

2. Parse the VTT file to clean text. Run:
```bash
sed -n '/^[0-9][0-9]:[0-9][0-9]/!{/^$/!{/^WEBVTT/!{/^Kind:/!{/^Language:/!{/^NOTE/!p}}}}}}' /tmp/yt-VIDEO_ID.*.vtt | awk '!seen[$0]++' | tr '\n' ' ' | sed 's/  */ /g'
```

This removes timestamps, WEBVTT headers, metadata lines, deduplicates repeated lines (common in auto-subs), and joins into a single text block.

If the VTT file is not found or the cleaned text is empty, fall back to Step 4.

## Step 4 — Fallback: whisper transcription

If no subtitles are available:

1. Download audio:
```bash
yt-dlp -x --audio-format wav --audio-quality 5 -o "/tmp/yt-%(id)s.%(ext)s" "VIDEO_URL"
```

2. Transcribe using whisper.cpp (already installed in the project):
```bash
.claude/claudeclaw/whisper/bin/whisper-cli -m .claude/claudeclaw/whisper/models/ggml-small.bin -f /tmp/yt-VIDEO_ID.wav --no-timestamps --language auto
```

If the whisper binary or model is missing, run `bun run src/whisper.ts` from the claudeclaw project root first — it auto-downloads both.

Use the transcription output as the text for summarization.

## Step 5 — Summarize

You now have the transcript text. Analyze it and produce a response **in Russian** with the following structure:

**Суть видео** — 2-3 sentences capturing what the video is about.

**Ключевые мысли:**
1. Numbered list of main ideas/arguments from the video
2. Each point should be 1-2 sentences
3. Include specific examples or data if mentioned

**Выводы автора** — if the author draws explicit conclusions or gives recommendations, list them here. Omit this section if there are no clear conclusions.

## Step 6 — Cleanup

Remove all temporary files:

```bash
rm -f /tmp/yt-VIDEO_ID*
```
