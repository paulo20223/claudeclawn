#!/bin/sh
MODEL=/models/ggml-small.bin
if [ ! -f "$MODEL" ]; then
  echo "Downloading whisper model..."
  curl -L -o "$MODEL" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
fi
exec whisper-server --host 0.0.0.0 --port 8080 -m "$MODEL" --language auto --convert
