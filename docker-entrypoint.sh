#!/bin/sh
set -e

# 启动 NoteOS
/noteos --dir /data --port 2344 &
NOTEOS_PID=$!

# 如果 CF=true 且 TOKEN 不为空，启动 cloudflared 隧道
if [ "${CF}" = "true" ] && [ -n "${TOKEN}" ]; then
    echo "🌐 启动 Cloudflare Tunnel..."
    cloudflared tunnel --no-autoupdate run --token "${TOKEN}" &
    CF_PID=$!
    echo "✅ Cloudflare Tunnel 已启动 (PID: ${CF_PID})"
else
    echo "ℹ️  Cloudflare Tunnel 未启用（CF=${CF}，TOKEN 未设置或为空）"
fi

# 等待 NoteOS 进程，任一退出则容器退出
wait ${NOTEOS_PID}
