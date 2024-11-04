#!/bin/bash
# NOTE: This script assumes you have an SSH key set up and the droplet IP
# address saved in a local droplet.txt file.

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
tsc
scp -r dist "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"

# Sync any additional files.
if [ $# -gt 0 ]; then
    scp -r "$@" "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"
fi
