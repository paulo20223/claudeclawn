---
description: Stop the heartbeat daemon
---

Stop the heartbeat daemon. Follow these steps:

1. **Read PID file**: Read `.claude/heartbeat/daemon.pid`. If it doesn't exist, tell the user no daemon is running and exit.

2. **Kill process**: Run `kill <pid>` to stop the daemon. If the process doesn't exist (already dead), that's fine — just note it.

3. **Clean up**: Remove `.claude/heartbeat/daemon.pid`.

4. **Report**: Tell the user the daemon has been stopped.
