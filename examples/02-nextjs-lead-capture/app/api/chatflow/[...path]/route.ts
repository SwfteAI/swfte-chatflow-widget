const SWFTE_BASE = 'https://api.swfte.com/agents';

async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = `${SWFTE_BASE}/${path.join('/')}${new URL(req.url).search}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();

  const r = await fetch(url, {
    method: req.method,
    headers: {
      Authorization: `Bearer ${process.env.SWFTE_API_KEY}`,
      'X-API-Key': process.env.SWFTE_API_KEY!,
      'X-Workspace-ID': process.env.SWFTE_WORKSPACE_ID ?? '',
      'Content-Type': req.headers.get('content-type') ?? 'application/json',
    },
    body,
  });

  return new Response(r.body, {
    status: r.status,
    headers: {
      'Content-Type': r.headers.get('content-type') ?? 'application/json',
    },
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const dynamic = 'force-dynamic';
