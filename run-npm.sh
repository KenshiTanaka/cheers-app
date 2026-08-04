#!/bin/bash
source ~/.bashrc 2>/dev/null || true
export PATH=/usr/bin:/usr/local/bin:$PATH

echo "=== Server npm install ==="
cd /home/kensh/cheers-app/server
npm install

echo "=== Client npm install ==="
cd /home/kensh/cheers-app/client
npm install
