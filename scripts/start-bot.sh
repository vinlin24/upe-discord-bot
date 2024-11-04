#!/bin/bash

echo "[$(date)]" >> bot.log
node . | tee -a bot.log
