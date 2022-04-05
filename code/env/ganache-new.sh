#!/usr/bin/env bash
# Use if you want to emulate 2-seconds per block
#ganache -b 2 --server.ws --database.dbPath "./db"

ganache --server.ws --database.dbPath "./db"