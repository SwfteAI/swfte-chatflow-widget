# Vanilla HTML / CDN

Drop a ChatFlow on any static page in under twenty lines of HTML.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Onboarding | Acme</title>
</head>
<body>
  <main id="onboarding"></main>

  <script type="module">
    import { ChatFlowClient } from 'https://cdn.jsdelivr.net/npm/@swfte/chatflow-widget/+esm';

    const client = new ChatFlowClient({
      baseUrl: 'https://api.swfte.com/agents',
      chatFlowId: 'cf_yourchatflowid',
      apiKey: 'sk-swfte-...', // For demos only — use a proxy in production
      workspaceId: '226',
      onComplete: (data) => console.log('Done:', data),
    });

    const root = document.getElementById('onboarding');

    function render() {
      const { messages, progressPercent } = client.state;
      root.innerHTML = `
        <progress value="${progressPercent}" max="100"></progress>
        ${messages.map((m) => `<p class="${m.role}">${m.content}</p>`).join('')}
        <input id="i" placeholder="Type..." />
      `;
      const inputEl = document.getElementById('i');
      inputEl.focus();
      inputEl.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        const text = inputEl.value.trim();
        if (!text) return;
        inputEl.value = '';
        await client.send(text);
      });
    }

    client.subscribe(render);
    await client.start();
  </script>
</body>
</html>
```

For production, deploy a thin server that holds the API key and proxy `baseUrl: '/api/chatflow'` through it. See [proxy-pattern.md](../proxy-pattern.md).

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
