#!/bin/bash
# Web-Fetch 启动脚本

# 加载 .env 文件
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 默认值
export PORT=${PORT:-8080}
export HTTP_PROXY=${HTTP_PROXY:-http://127.0.0.1:7890}
export HTTPS_PROXY=${HTTPS_PROXY:-http://127.0.0.1:7890}

echo "Starting Web-Fetch..."
echo "  Port: $PORT"
echo "  Proxy: $HTTP_PROXY"

node src/index.js
