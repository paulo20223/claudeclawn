---
name: youtube-summary
description: |
  Summarize a YouTube video from its transcript.
  Triggers: youtube link, youtube video, summarize video, пересказ видео, о чём видео,
  краткое содержание видео, суть видео, транскрипция видео, ютуб ролик, youtube ролик,
  what is the video about, video summary, watch?v=, youtu.be
---

# YouTube Video Summary

Summarize a YouTube video by extracting its transcript and generating a concise Russian-language summary.

## Step 1 — Download transcript

Extract the video ID from the URL and try subtitles first.

**Check `yt-dlp`:** Run `which yt-dlp`. If missing, tell the user to `brew install yt-dlp` and stop.

**Cookies (optional):** Check for cookies file to access age-restricted/private videos:

```bash
COOKIES_FLAG=""
[ -f /app/.claude/claudeclaw/youtube.cookie.txt ] && COOKIES_FLAG="--cookies /app/.claude/claudeclaw/youtube.cookie.txt"
```

**List subtitles:**

```bash
yt-dlp $COOKIES_FLAG --list-subs "VIDEO_URL" 2>&1
```

If subtitles exist (including auto-generated), download and clean them:

```bash
yt-dlp $COOKIES_FLAG --write-auto-sub --sub-lang "en,ru,de,fr,es,pt,it,ja,ko,zh,ar,hi" --sub-format vtt --skip-download -o "/tmp/yt-%(id)s" "VIDEO_URL"
```

```bash
bash skills/youtube-summary/scripts/clean-vtt.sh /tmp/yt-VIDEO_ID.*.vtt
```

If subtitles are unavailable or the cleaned output is empty, fall through to STT.

## Step 2 — Fallback: STT transcription

If `STT_URL` env var is not set, skip this step and report that transcription is unavailable.

Download audio and transcribe via HTTP STT service:

```bash
yt-dlp $COOKIES_FLAG -x --audio-format wav --audio-quality 5 -o "/tmp/yt-%(id)s.%(ext)s" "VIDEO_URL"
```

```bash
curl -s -X POST "${STT_URL}/inference" \
  -F "file=@/tmp/yt-VIDEO_ID.wav" \
  -F "temperature=0.0" \
  -F "response_format=json" \
  | jq -r '.text'
```

## Step 3 — Summarize

Ты — конспектёр. Твоя задача: создать конспект, после которого человек получит те же знания, что и от просмотра видео, но за 2 минуты чтения.

### Принципы

- **Плотность**: каждое предложение несёт факт, идею или вывод. Ноль воды.
- **Конкретика**: сохраняй числа, проценты, имена, названия инструментов/книг/компаний, даты, цитаты. Если автор говорит "в 3 раза быстрее" или "исследование 2023 года" — это должно быть в конспекте.
- **Логика**: передавай цепочки аргументации (если A → то B, потому что C), а не просто выводы без контекста.
- **Нюансы**: если автор упоминает ограничения, контраргументы, оговорки — включай их.

### Что НЕ делать

- Не пиши "автор рассказывает интересные вещи о..." — пиши сами вещи
- Не обобщай до потери смысла: "разбираются разные подходы" → какие именно подходы и чем отличаются
- Не добавляй оценочные комментарии от себя ("отличный доклад", "полезно знать")
- Не повторяй одну мысль разными словами

### Формат ответа (на русском)

**Суть** — 2–3 предложения. Тема + главный тезис или цель автора. Не пересказ, а ответ на "зачем смотреть это видео."

**Конспект:**

Структурированное изложение содержания. Используй подзаголовки, если видео имеет явные смысловые блоки (разделы лекции, этапы процесса, отдельные темы). Для коротких видео (< 15 мин) подзаголовки не нужны — достаточно нумерованного списка.

Правила:
- Каждый пункт — законченная мысль с конкретикой, а не общее утверждение
- Если автор приводит пример для иллюстрации тезиса — включай пример кратко
- Технические термины оставляй на языке оригинала в скобках при первом упоминании
- Этапы, шаги, рецепты, инструкции — воспроизводи полностью, не сокращай

**Выводы и рекомендации** — только если автор явно формулирует. Если это tutorial/how-to — пропусти секцию, конспект и так содержит всё нужное.

## Step 4 — Cleanup

```bash
rm -f /tmp/yt-VIDEO_ID*
```

## Error handling

- **Приватное/возрастное видео:** `yt-dlp` вернёт ошибку — сообщи пользователю, что видео недоступно. Если cookies файл отсутствует, упомяни что можно положить cookies в `/app/.claude/claudeclaw/youtube.cookie.txt`.
- **Нет субтитров И STT недоступен:** сообщи, что транскрипция невозможна (`STT_URL` не задан).
- **Слишком длинный транскрипт:** если текст > 100k символов, предупреди пользователя и суммаризируй по частям.
