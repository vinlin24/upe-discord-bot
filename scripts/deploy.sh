#!/bin/bash
# NOTE: This script assumes you have an SSH key set up and the droplet IP
# address saved in a local `droplet.txt` file. You can pass an option GIT_BRANCH
# argument to specify pulling and running that version on the remote server.

set -e
set -x

if [ ! -f droplet.txt ]; then
    echo "droplet.txt not found. Create one with the IP of the droplet."
    exit 1
fi

DROPLET_IP="$(cat droplet.txt)"
DROPLET_USER=root

GIT_BRANCH=main
if [ -n "$1" ]; then
    GIT_BRANCH="$1"
fi

# Check out to desired branch and ensure dependencies are updated.
# shellcheck disable=SC2087
ssh "${DROPLET_USER}@${DROPLET_IP}" << EOF
    cd ~/upe-discord-bot &&
    git fetch --all &&
    (git checkout ${GIT_BRANCH} || git checkout -b ${GIT_BRANCH}) &&
    git reset --hard origin/${GIT_BRANCH} &&
    git clean -df &&
    npm install
EOF

# Compile locally since the droplet can't handle it apparently.
npm run build
ssh "${DROPLET_USER}@${DROPLET_IP}" 'rm -rf ~/upe-discord-bot/dist'
scp -r dist "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"

# Sync any important files outside of the build process.
scp .env "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"

# Sync application commands.
npm run sync

# Start a fresh version of the `terabyte` process.
ssh "${DROPLET_USER}@${DROPLET_IP}" << EOF
    cd ~/upe-discord-bot &&
    pm2 delete terabyte 2>/dev/null
    pm2 start ~/upe-discord-bot/scripts/start-bot.sh --name terabyte
EOF
