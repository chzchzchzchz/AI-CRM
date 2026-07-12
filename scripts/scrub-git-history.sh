#!/usr/bin/env bash
#
# scrub-git-history.sh — remove prior-employer data from ALL git history.
#
# ⚠️  READ THIS FIRST. This rewrites every commit hash and REQUIRES a force-push.
#     It is destructive and irreversible for collaborators. Only the repo owner
#     should run it, after confirming they want to rewrite public history.
#
# What it removes from history (not just the current tree):
#   - presentation-materials.tar.gz + presentation/ + presentation-screenshots/
#     (real customer screenshots and talking points)
#   - any *.csv, and the SFDC-* / Find-people-* exports (real accounts/contacts)
#   - real production counts embedded in old commit MESSAGES
#     (e.g. "[redacted] contacts", "[redacted] accounts", "[redacted] Gong calls")
#
# Requirements: git-filter-repo  (https://github.com/newren/git-filter-repo)
#   macOS:  brew install git-filter-repo
#   pip:    pipx install git-filter-repo
#
# Recommended usage (filter-repo prefers a FRESH clone):
#   git clone https://github.com/chzchzchzchz/AI-CRM.git AI-CRM-scrub
#   cd AI-CRM-scrub
#   bash scripts/scrub-git-history.sh
#   # inspect the result, then:
#   git push origin --force --all
#   git push origin --force --tags
#
set -euo pipefail

if ! command -v git-filter-repo >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo is not installed. See the header of this script." >&2
  exit 1
fi

echo "This will REWRITE ALL GIT HISTORY in $(pwd)."
read -r -p "Type 'scrub' to continue: " confirm
[ "$confirm" = "scrub" ] || { echo "Aborted."; exit 1; }

# 1) Strip sensitive paths from every commit.
git filter-repo --force \
  --invert-paths \
  --path-glob '*.csv' \
  --path-glob 'SFDC-*' \
  --path-glob 'Find-people-*' \
  --path presentation-materials.tar.gz \
  --path-glob 'presentation/*' \
  --path-glob 'presentation-screenshots/*' \
  --path PRESENTATION_COMPLETE.md

# 2) Redact sensitive strings from commit MESSAGES.
#    The actual sensitive terms (real employer name, real production counts) live
#    in a LOCAL, gitignored file so they are never committed to this repo. Copy the
#    template and fill it in before running:
#        cp scripts/scrub-replacements.local.txt.example scripts/scrub-replacements.local.txt
#        # edit scripts/scrub-replacements.local.txt with your real terms
REPL_FILE="${SCRUB_REPLACEMENTS_FILE:-scripts/scrub-replacements.local.txt}"
if [ -f "$REPL_FILE" ]; then
  echo "Applying message redactions from $REPL_FILE ..."
  git filter-repo --force --replace-message "$REPL_FILE"
else
  echo "⚠️  No $REPL_FILE found — skipping commit-MESSAGE redaction."
  echo "    (Paths were still stripped above. To also scrub leaked names/numbers"
  echo "     from old commit messages, create that file from the .example template.)"
fi

echo
echo "✅ History rewritten. INSPECT before pushing (use your own terms):"
echo "   git log --oneline | head"
echo "   git log --all -p | grep -iE 'find-people|sfdc-' || echo clean"
echo
echo "Then force-push (this overwrites the remote):"
echo "   git remote add origin https://github.com/chzchzchzchz/AI-CRM.git   # fresh clone already has it"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
