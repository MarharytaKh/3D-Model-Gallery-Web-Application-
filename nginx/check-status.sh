#!/bin/sh

echo "=== NGINX STATUS ==="

if pgrep nginx > /dev/null; then
    echo "nginx: RUNNING"
else
    echo "nginx: NOT RUNNING"
fi

echo
echo "=== FAIL2BAN STATUS ==="

if [ -S /var/run/fail2ban/fail2ban.sock ]; then
    fail2ban-client status
else
    echo "fail2ban: NOT RUNNING"
fi


