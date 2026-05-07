# Vue 3 / Nuxt Integration

The widget exposes a framework-agnostic `ChatFlowClient`. Wire it into a Vue 3 component or a Nuxt page using the composition API.

## Vue 3 component

```vue
<script setup lang="ts">
import { ChatFlowClient } from '@swfte/chatflow-widget';
import { onMounted, onBeforeUnmount, reactive } from 'vue';

const client = new ChatFlowClient({
  baseUrl: 'https://api.swfte.com/agents',
  chatFlowId: import.meta.env.VITE_CHATFLOW_ID,
  apiKey: import.meta.env.VITE_SWFTE_API_KEY,
  workspaceId: import.meta.env.VITE_SWFTE_WORKSPACE_ID,
  onComplete: (data) => emit('complete', data),
});

const state = reactive({ messages: [] as any[], progress: 0, collected: {} });
let unsubscribe: (() => void) | null = null;

onMounted(async () => {
  unsubscribe = client.subscribe(() => {
    state.messages = [...client.state.messages];
    state.progress = client.state.progressPercent;
    state.collected = { ...client.state.collectedData };
  });
  await client.start();
});

onBeforeUnmount(() => { unsubscribe?.(); });

const input = ref('');
async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await client.send(text);
}
</script>

<template>
  <div class="chatflow">
    <div v-for="m in state.messages" :key="m.id" :class="m.role">
      {{ m.content }}
    </div>
    <progress :value="state.progress" max="100" />
    <input v-model="input" @keydown.enter="send" placeholder="Type..." />
  </div>
</template>
```

## Nuxt 3

Same component; ensure the proxy lives in `server/api/chatflow/[...path].ts` so the API key never reaches the browser. Set `baseUrl: '/api/chatflow'` in the client.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
