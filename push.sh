#!/usr/bin/env bash
# ============================================================================
#  Publish ha-toyota-chr to GitHub (aghediri/ha-toyota-chr), v1.0.0
#  Run from INSIDE the repo folder:  cd ha-toyota-chr
# ============================================================================
set -e

# 1) One-time: create the empty repo on GitHub first (via web or gh CLI):
#    gh repo create aghediri/ha-toyota-chr --public --disable-wiki \
#        --description "Home Assistant HACS integration for Toyota C-HR OBD-II data over Bluetooth (ELM327)"

# 2) Initialize + first commit
git init
git branch -M main
git add .
git commit -m "feat: Toyota C-HR OBD v1.0.0 - local Bluetooth ELM327 integration"

# 3) Point at your GitHub repo (HTTPS)
git remote add origin https://github.com/aghediri/ha-toyota-chr.git
#    (SSH alternative:)
#    git remote add origin git@github.com:aghediri/ha-toyota-chr.git

# 4) Push main
git push -u origin main

# 5) Tag the release (HACS uses tags as versions; must match manifest.json "version")
git tag -a v1.0.0 -m "v1.0.0 - first release"
git push origin v1.0.0

echo "Done. The 'Validate' GitHub Action (HACS + hassfest) runs automatically."
echo "Install in HA: HACS -> Integrations -> Custom repositories ->"
echo "  https://github.com/aghediri/ha-toyota-chr  (category: Integration)"
