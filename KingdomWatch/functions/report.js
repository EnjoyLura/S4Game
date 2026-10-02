// 战斗真机诊断收集端（Pages Functions，与游戏同域、免 CORS）
// POST /report：把手机上报的诊断行写入 KV（构建后由 tools/patch-web-dpr.py 复制到 build/web-mobile/functions/）
// GET  /report：读回最近一条（远程排障用：curl https://kingdom-watch.pages.dev/report）
export async function onRequestPost({ request, env }) {
  try {
    const body = (await request.text()).slice(0, 1000);
    const ts = new Date().toISOString();
    await env.KW_DIAG.put('latest', ts + '\n' + body);
    return new Response('ok');
  } catch (e) {
    return new Response('err ' + e, { status: 500 });
  }
}

export async function onRequestGet({ env }) {
  return new Response((await env.KW_DIAG.get('latest')) || 'empty', {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
