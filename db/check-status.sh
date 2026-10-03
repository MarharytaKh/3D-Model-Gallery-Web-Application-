#!/bin/sh

echo "=== POSTGRES STATUS ==="

pg_isready -U postgres

echo
echo "=== POSTGRES PROCESSES ==="
ps aux | grep postgres | grep -v grep
