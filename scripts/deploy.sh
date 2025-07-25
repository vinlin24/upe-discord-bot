#!/bin/bash
# NOTE: You can also pass an optional GIT_BRANCH argument to specify pulling and
# running that version on the remote server.

set -e
set -x

SCRIPT_DIR="$(dirname "$0")";
SSH="${SCRIPT_DIR}/droplet-ssh.sh"

GIT_BRANCH=main
if [ -n "$1" ]; then
    GIT_BRANCH="$1"
fi

# Check out to desired branch and ensure dependencies are updated.
# shellcheck disable=SC2087
"$SSH" << EOF
    cd ~/upe-discord-bot &&
    git fetch --all &&
    (git checkout ${GIT_BRANCH} || git checkout -b ${GIT_BRANCH}) &&
    git reset --hard origin/${GIT_BRANCH} &&
    git clean -df &&
    npm install &&
    cd job-webhook &&
    pip3 install -r requirements.txt
EOF

# Compile locally since the droplet can't handle it apparently.
npm run build
"$SSH" 'rm -rf ~/upe-discord-bot/dist'
SCP=1 "$SSH" dist

# Upload environment file and modify as needed.
SCP=1 "$SSH" .env
"$SSH" << EOF
    cd ~/upe-discord-bot &&
    sed -i 's/^NODE_ENV=[^[:space:]]*/NODE_ENV=production/' .env
EOF

# Sync application commands.
npm run sync

# Start a fresh version of the `terabyte` process.
"$SSH" << EOF
    cd ~/upe-discord-bot &&
    pm2 delete terabyte 2>/dev/null &&
    pm2 delete job-scraper 2>/dev/null
    pm2 start ~/upe-discord-bot/scripts/start-bot.sh \
        --no-autorestart \
        --name terabyte
    pm2 start python3 \
        --name job-scraper \
        --cwd ~/upe-discord-bot/job-webhook \
        -- job_scraper.py
EOF

# Sanity check that the processes didn't immediately die right after `pm2 start`.
sleep 1
# shellcheck disable=SC2016
if "$SSH" 'test "$(pm2 pid terabyte)"'; then
    echo 'Terabyte PM2 process seems to stay online!'
else
    echo >&2 'Terabyte PM2 process does not seem to stay online!'
    exit 1
fi

# shellcheck disable=SC2016
if "$SSH" 'test "$(pm2 pid job-scraper)"'; then
    echo 'Job scraper PM2 process seems to stay online!'
else
    echo >&2 'Job scraper PM2 process does not seem to stay online!'
    exit 1
fi
