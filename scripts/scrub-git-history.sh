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

# 2) Redact real production numbers from commit MESSAGES.
#    (These regexes replace the leaked figures with a neutral marker.)
cat > /tmp/scrub-messages.txt <<'EOF'
regex:\b3,?999\b==>[redacted]
regex:\b2,?09[0-9]\b==>[redacted]
regex:\b75[0-9]\b==>[redacted]
regex:\b76[0-9]\b==>[redacted]
regex:\b549\b==>[redacted]
regex:\b2,?103\b==>[redacted]
the company==>[previous employer]
EOF
git filter-repo --force --replace-message /tmp/scrub-messages.txt
rm -f /tmp/scrub-messages.txt

echo
echo "✅ History rewritten. INSPECT before pushing:"
echo "   git log --oneline | head"
echo "   git log --all -p | grep -iE 'the company|3,999|find-people|sfdc-' || echo clean"
echo
echo "Then force-push (this overwrites the remote):"
echo "   git remote add origin https://github.com/chzchzchzchz/AI-CRM.git   # fresh clone already has it"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
