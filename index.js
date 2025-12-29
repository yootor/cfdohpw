// 请求路径。请修改此路径，避免该 worker 所有人都能使用。
const endpointPath = '/dns-query';
// 上游 DoH 地址。必需是域名，不能是 IP。Cloudflare 有限制。
// https://cloudflare-dns.com/dns-query,https://dns.google/dns-query
const upstream = 'https://cloudflare-dns.com/dns-query';

const CF_OPTIONS = {
  cacheEverything: true,
  cacheTtl: 60,              // 可调，建议 30~120 秒
  httpProtocol: "http2",     // h2/h3 优先
};

async function forwardToDoH(urlOrReq) {
  return await fetch(urlOrReq, { cf: CF_OPTIONS });
}

async function handleRequestGet(request, clientUrl) {
  const dnsValue = clientUrl.searchParams.get('dns');
  if (!dnsValue)
    return new Response('missing parameters', { status: 400 });

  const upstreamUrl = new URL(upstream);
  upstreamUrl.searchParams.set('dns', dnsValue);

  const req = new Request(upstreamUrl.toString(), {
    method: 'GET',
    headers: {
      'accept': 'application/dns-message'
    }
  });

  return forwardToDoH(req);
}

async function handleRequestPost(request) {
  const body = await request.arrayBuffer();

  const req = new Request(upstream, {
    method: 'POST',
    headers: {
      'accept': 'application/dns-message',
      'content-type': 'application/dns-message',
    },
    body,
  });

  return forwardToDoH(req);
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname !== endpointPath) {
    return new Response('404 not found', { status: 404 });
  }

  if (request.method === 'GET')
    return handleRequestGet(request, url);

  if (request.method === 'POST')
    return handleRequestPost(request);

  return new Response('method not allowed', { status: 405 });
}

addEventListener('fetch', e => {
  e.respondWith(handleRequest(e.request));
});
