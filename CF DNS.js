/**
 * 高性能 DoH 转发器 (RFC 8484)
 * 优化点：流式转发、减少对象实例化、边缘缓存优化
 */

// 1. 配置项：请修改此路径以保护您的服务不被滥用
const ENDPOINT_PATH = '/cfns'; 
const UPSTREAM_URL = 'https://dns.cloudflare.com/dns-query';

// 2. 缓存配置：提高边缘节点命中率
const CF_OPTIONS = {
  cacheEverything: true,
  cacheTtl: 120, // 缓存 120 秒，可根据需求微调
  cacheTtlByStatus: { "200-299": 120, "404": 1, "500-599": 0 },
  httpProtocol: "http2", // 优先使用 h2
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 路径鉴权：不匹配路径直接返回 404
    if (url.pathname !== ENDPOINT_PATH) {
      return new Response('Not Found', { status: 404 });
    }

    const method = request.method;

    // 处理 GET 请求 (RFC 8484: Base64URL 编码查询)
    if (method === 'GET') {
      const search = url.search;
      if (!search || !search.includes('dns=')) {
        return new Response('Missing parameters', { status: 400 });
      }

      // 优化：直接拼接字符串，避免重新构造 URL 对象，降低 CPU 消耗
      return fetch(`${UPSTREAM_URL}${search}`, {
        method: 'GET',
        headers: { 
          'Accept': 'application/dns-message' 
        },
        cf: CF_OPTIONS
      });
    }

    // 处理 POST 请求 (RFC 8484: 二进制流查询)
    if (method === 'POST') {
      // 优化：零拷贝流式转发 (Streaming)
      // 直接将 request.body 传给 fetch，数据边收边发，不经过内存解析
      return fetch(UPSTREAM_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/dns-message',
          'Content-Type': 'application/dns-message',
        },
        body: request.body, 
        cf: CF_OPTIONS
      });
    }

    // 拒绝其他 HTTP 方法
    return new Response('Method Not Allowed', { status: 405 });
  }
};