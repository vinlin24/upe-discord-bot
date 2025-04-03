#!/bin/bash
# NOTE: This script assumes you have an SSH key set up and the droplet IP
# address saved in a local `droplet.txt` file.

set -e
set -x

if [ ! -f droplet.txt ]; then
    echo "droplet.txt not found. Create one with the IP of the droplet."
    exit 1
fi

DROPLET_IP="$(cat droplet.txt)"
DROPLET_USER=root

# Ensure dependencies are updated.
ssh "${DROPLET_USER}@${DROPLET_IP}" << EOF
    cd ~/upe-discord-bot
    git pull
    npm install
EOF

# Compile locally since the droplet can't handle it apparently.
npm run build

# Sync any important files outside of the build process.
scp .env "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"

# Sync application commands.
npm run sync

# Start a fresh version of the `terabyte` process.
ssh "${DROPLET_USER}@${DROPLET_IP}" << EOF
    pm2 delete terabyte 2>/dev/null
    pm2 start ~/upe-discord-bot/scripts/start-bot.sh --name terabyte
EOF
