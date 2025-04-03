#!/usr/bin/env bash
# Connect a REPL to the MongoDB cluster. This assumes you have a local `.env`
# file set up with the correct values.

source .env
mongosh "$DB_CONNECTION_STRING"
