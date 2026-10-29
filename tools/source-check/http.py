"""只读诊断传输：用系统 Python/OpenSSL 交叉复查 curl 的 TLS/连接错误。"""

import base64
import gzip
import json
import sys
import urllib.error
import urllib.request
import zlib


def main():
    spec = json.load(sys.stdin)
    headers = dict(spec.get("headers", {}))
    # 不依赖外部 Brotli 库；普通网站允许请求未压缩正文。
    headers["Accept-Encoding"] = "identity"
    if spec.get("imageProbe"):
        headers["Range"] = "bytes=0-511"
    request = urllib.request.Request(
        spec["url"],
        data=base64.b64decode(spec["body"]) if spec.get("body") else None,
        headers=headers,
        method=spec.get("method", "GET"),
    )
    try:
        response = urllib.request.urlopen(request, timeout=25)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        body = response.read(20 * 1024 * 1024 + 1)
        if len(body) > 20 * 1024 * 1024:
            raise ValueError("Response exceeds diagnostic size limit")
        encoding = response.headers.get("Content-Encoding", "").lower()
        if encoding == "gzip":
            body = gzip.decompress(body)
        elif encoding == "deflate":
            body = zlib.decompress(body)
        result = {
            "status": response.status,
            "url": response.url,
            "headers": {key.lower(): value for key, value in response.headers.items()},
            "body": base64.b64encode(body).decode("ascii"),
        }
        json.dump(result, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        json.dump({"error": str(error)}, sys.stdout)
        sys.exit(1)
