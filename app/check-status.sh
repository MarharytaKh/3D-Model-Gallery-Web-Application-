#!/bin/sh

echo "=== APP STATUS ==="

if pgrep node > /dev/null; then
    echo "node app: RUNNING"
else
    echo "node app: NOT RUNNING"
fi

echo
echo "=== LISTENING PORTS ==="
netstat -tlnp | grep 3001 || echo "port 3001 not listening"

