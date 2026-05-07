import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export default function App() {
  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Acme onboarding</h1>
      <p>This is a minimal demo of the Swfte ChatFlow widget. See <a href="https://www.swfte.com/products/chatflows">swfte.com/products/chatflows</a>.</p>

      <ChatFlowProvider
        config={{
          endpoint: 'https://api.swfte.com/agents',
          chatFlowId: import.meta.env.VITE_CHATFLOW_ID,
          apiKey: import.meta.env.VITE_SWFTE_API_KEY,
          workspaceId: import.meta.env.VITE_SWFTE_WORKSPACE_ID,
          greeting: "Welcome to Acme! Let's set up your profile in 60 seconds.",
          onComplete: (data) => alert('Done: ' + JSON.stringify(data, null, 2)),
        }}
      >
        <ChatFlowChat agentName="Acme Setup" agentSubtitle="2 minutes" />
      </ChatFlowProvider>
    </main>
  );
}
