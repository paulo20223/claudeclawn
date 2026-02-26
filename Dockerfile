FROM oven/bun:1.1.30-debian AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gosu \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp (standalone binary, no python needed)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# Node.js 22 (needed for claude CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

RUN useradd -m -s /bin/bash claw

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src/ src/
COPY prompts/ prompts/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN chown -R claw:claw /app
RUN mkdir -p /app/.claude && chown claw:claw /app/.claude

ENV CLAUDECLAW_WEB_HOST=0.0.0.0
EXPOSE 4632

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "run", "src/index.ts", "start", "--web"]
