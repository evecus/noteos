FROM alpine:3.19

# 基础依赖
RUN apk add --no-cache ca-certificates tzdata curl

# 下载 cloudflared（多架构）
ARG TARGETARCH
RUN ARCH="${TARGETARCH}" && \
    if [ "${ARCH}" = "amd64" ]; then CF_ARCH="amd64"; \
    elif [ "${ARCH}" = "arm64" ]; then CF_ARCH="arm64"; \
    else CF_ARCH="amd64"; fi && \
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

# 复制 noteos 二进制（由 workflow 构建时注入）
COPY noteos-linux-${TARGETARCH} /noteos
RUN chmod +x /noteos

# 启动脚本
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV CF=false
ENV TOKEN=""

EXPOSE 2344
VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
