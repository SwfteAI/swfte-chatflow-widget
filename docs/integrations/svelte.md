# SvelteKit Integration

```ts
// src/routes/onboarding/+page.svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { ChatFlowClient } from '@swfte/chatflow-widget';

  let messages: any[] = [];
  let progress = 0;
  let input = '';
  let client: ChatFlowClient;
  let unsubscribe: (() => void) | undefined;

  onMount(async () => {
    client = new ChatFlowClient({
      baseUrl: '/api/chatflow',
      chatFlowId: import.meta.env.VITE_CHATFLOW_ID,
      apiKey: '',
      proxyUrl: '/api/chatflow',
    });
    unsubscribe = client.subscribe(() => {
      messages = [...client.state.messages];
      progress = client.state.progressPercent;
    });
    await client.start();
  });

  onDestroy(() => unsubscribe?.());

  async function send() {
    const text = input.trim();
    if (!text) return;
    input = '';
    await client.send(text);
  }
</script>

<div class="chatflow">
  {#each messages as m (m.id)}
    <p class={m.role}>{m.content}</p>
  {/each}
  <progress value={progress} max="100" />
  <input bind:value={input} on:keydown={(e) => e.key === 'Enter' && send()} />
</div>
```

`src/routes/api/chatflow/[...path]/+server.ts`:

```ts
import type { RequestHandler } from './$types';

const KEY = process.env.SWFTE_API_KEY!;
const BASE = 'https://api.swfte.com/agents';

const forward: RequestHandler = async ({ request, params, url }) => {
  const target = `${BASE}/${(params.path ?? []).join('/')}${url.search}`;
  const body = ['GET','HEAD'].includes(request.method) ? undefined : await request.text();
  const r = await fetch(target, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'X-API-Key': KEY,
      'X-Workspace-ID': process.env.SWFTE_WORKSPACE_ID ?? '',
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
    },
    body,
  });
  return new Response(await r.text(), {
    status: r.status,
    headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' },
  });
};

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
```

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
