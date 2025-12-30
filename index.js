// DNS请求路径，需要自行配置
const endpointPath = '/dns-query';
//上游DNS服务器，需要使用域，Worker不能直接使用IP
const upstream = 'https://cloudflare-dns.com/dns-query';

//开启缓存和https3链接
const CF_OPTIONS = {
  cacheEverything: true,
  cacheTtl: 120,               // 缓存 120 秒
  cacheTtlByStatus: { "200-299": 120, "404": 1, "500-599": 0 },
  httpProtocol: "http3",       // 建议 Worker 回源也优先使用 h3
};

//跨域转发
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 路径快速匹配
    if (url.pathname !== endpointPath) {
      return new Response('404 Not Found', { status: 404 });
    }

    // 快速响应 OPTIONS（HTTP/3 下的预检请求也很频繁）
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const method = request.method;
    let response;

    // 核心业务处理
    if (method === 'GET') {
      const dnsQuery = url.search;
      if (!dnsQuery) return new Response('Missing Param', { status: 400, headers: CORS_HEADERS });

      response = await fetch(`${upstream}${dnsQuery}`, {
        method: 'GET',
        headers: { 'Accept': 'application/dns-message' },
        cf: CF_OPTIONS
      });
    } 
    else if (method === 'POST') {
      // 这里的流式转发配合 HTTP/3 的多路复用效果最好
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
      return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
    }

    // 合并 Header 并返回
    const finalHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      finalHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      headers: finalHeaders
    });
  }
};
