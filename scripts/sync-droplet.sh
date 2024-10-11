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

ssh "${DROPLET_USER}@${DROPLET_IP}" << EOF
    cd ~/upe-discord-bot
    git pull
    npm install
EOF

if [ $# -gt 0 ]; then
    scp "$@" "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"
fi
