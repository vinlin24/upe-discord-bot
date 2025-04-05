#!/bin/bash
# NOTE: This script assumes you have an SSH key set up and the droplet IP
# address saved in a local `droplet.txt` file. Set the `SCP` environment
# variable to use SCP instead of SSH.

if [ ! -f droplet.txt ]; then
    echo "droplet.txt not found. Create one with the IP of the droplet."
    exit 1
fi

DROPLET_IP="$(cat droplet.txt)"
DROPLET_USER=root

if [ -z "$SCP" ]; then
    ssh "${DROPLET_USER}@${DROPLET_IP}" "$@"
else
    scp -r "$@" "${DROPLET_USER}@${DROPLET_IP}:~/upe-discord-bot"
fi
