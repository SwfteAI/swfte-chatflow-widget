<script setup lang="ts">
import { ChatFlowClient } from '@swfte/chatflow-widget';
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';

const client = new ChatFlowClient({
  baseUrl: 'https://api.swfte.com/agents',
  chatFlowId: import.meta.env.VITE_CHATFLOW_ID,
  apiKey: import.meta.env.VITE_SWFTE_API_KEY,
  workspaceId: import.meta.env.VITE_SWFTE_WORKSPACE_ID,
  greeting: 'On a scale of 0-10, how likely are you to recommend Acme to a colleague?',
  onComplete: (data) => alert('Thanks: ' + JSON.stringify(data)),
});

const state = reactive({ messages: [] as any[], progress: 0 });
const input = ref('');
let unsubscribe: (() => void) | null = null;

onMounted(async () => {
  unsubscribe = client.subscribe(() => {
    state.messages = [...client.state.messages];
    state.progress = client.state.progressPercent;
  });
  await client.start();
});

onBeforeUnmount(() => unsubscribe?.());

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await client.send(text);
}
</script>

<template>
  <main style="max-width: 640px; margin: 40px auto; font-family: system-ui, sans-serif;">
    <h1>How are we doing?</h1>
    <p>
      Powered by
      <a href="https://www.swfte.com/products/chatflows">Swfte ChatFlows</a>.
    </p>

    <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
      <div v-for="m in state.messages" :key="m.id" :class="m.role">
        <strong>{{ m.role === 'user' ? 'You' : 'Acme' }}:</strong> {{ m.content }}
      </div>
      <progress :value="state.progress" max="100" style="width: 100%;" />
      <input
        v-model="input"
        @keydown.enter="send"
        placeholder="Type your response..."
        style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #cbd5e1;"
      />
    </div>
  </main>
</template>
