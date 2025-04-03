#!/bin/bash
# Bot entry point to run on the remote server.

echo "[$(date)]" >> bot.log
node . | tee -a bot.log
