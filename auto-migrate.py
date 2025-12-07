#!/usr/bin/env python3
import subprocess
import sys
import time

# Start the drizzle-kit generate process
proc = subprocess.Popen(
    ["pnpm", "drizzle-kit", "generate"],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    cwd="/home/ubuntu/target-account-dashboard"
)

# Auto-answer all prompts with Enter (select default option)
while True:
    line = proc.stdout.readline()
    if not line:
        break
    print(line, end='')
    
    # If we see a prompt, send Enter to select default
    if '❯' in line or 'created or renamed' in line:
        time.sleep(0.1)
        proc.stdin.write('\n')
        proc.stdin.flush()

proc.wait()
sys.exit(proc.returncode)
