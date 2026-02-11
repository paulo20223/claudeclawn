---
description: Start the heartbeat daemon
---

Start the heartbeat daemon for this project. Follow these steps exactly:

1. **Check if already running**: Read `.claude/heartbeat/daemon.pid`. If it exists, check if the process is alive with `kill -0 <pid>`. If alive, tell the user the daemon is already running and exit.

2. **Initialize config if needed**: If `.claude/heartbeat/` doesn't exist:
   - Create `.claude/heartbeat/`, `.claude/heartbeat/jobs/`, `.claude/heartbeat/logs/`
   - Write `.claude/heartbeat/settings.json`:
     ```json
     {
       "heartbeat": {
         "enabled": true,
         "interval": 15,
         "prompt": "Check system health and report any issues."
       }
     }
     ```
   - Write `.claude/heartbeat/jobs/example.md`:
     ```
     ---
     schedule: "0 9 * * *"
     ---
     Review yesterday's git commits and summarize.
     ```

3. **Launch daemon**: Run this command to start the daemon in the background:
   ```bash
   nohup bun run ${CLAUDE_PLUGIN_ROOT}/src/index.ts > .claude/heartbeat/logs/daemon.log 2>&1 &
   ```

4. **Report**: Tell the user the daemon is running and show the PID. Mention they can use `/heartbeat:status` to check on it and `/heartbeat:stop` to stop it.
