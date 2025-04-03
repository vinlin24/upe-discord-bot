#!/usr/bin/env bash
source .env
mongosh "$DB_CONNECTION_STRING"
