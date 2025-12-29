// 请求路径。请修改此路径，避免该 worker 所有人都能使用。
const endpointPath = '/dns-query';
const upstream = 'https://cloudflare-dns.com/dns-query';
const upstreamHost = 'cloudflare-dns.com';

// 如果你确实不需要缓存，可以将下方的 cf 对象删除或设置 cacheTtl 为 0
const CF_OPTIONS = {
  cacheEverything: true,
  cacheTtl: 60, // 建议至少保留 60 秒
  httpProtocol: "http2",
};

// 预定义 CORS 头部，减少函数内重复创建
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    const clientUrl = new URL(request.url);

    // 1. 路径拦截
    if (clientUrl.pathname !== endpointPath) {
      return new Response('Hello World!', { status: 404 });
    }

    // 2. 预检请求处理 (处理浏览器 CORS 的关键)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    let response;
    const method = request.method;

    // 3. 业务逻辑
    if (method === 'GET') {
      const dnsValue = clientUrl.searchParams.get('dns');
      if (!dnsValue) return new Response('missing parameters', { status: 400, headers: CORS_HEADERS });
      
      // 注意：部分客户端 Accept 可能不规范，这里不做强制死锁检查以提高兼容性
      
      response = await fetch(`${upstream}?dns=${dnsValue}`, {
        method: 'GET',
        headers: { 'Accept': 'application/dns-message' },
        cf: CF_OPTIONS
      });
    } 
    else if (method === 'POST') {
      // 优化：不再使用 arrayBuffer()，直接透传 request.body 流，实现零拷贝
      response = await fetch(upstream, {
        method: 'POST',
        headers: {
          'Accept': 'application/dns-message',
          'Content-Type': 'application/dns-message',
        },
        body: request.body, 
        cf: CF_OPTIONS
      });
    } 
    else {
      return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // 4. 统一注入 CORS 头并返回
    const finalHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => finalHeaders.set(k, v));

    return new Response(response.body, {
      status: response.status,
      headers: finalHeaders
    });
  }
};
