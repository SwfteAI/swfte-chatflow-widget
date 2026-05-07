'use client';
import { ChatFlowProvider, ChatFlowChat } from '@swfte/chatflow-widget/react';

export default function Page() {
  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Talk to sales</h1>
      <p>
        Embedded with the official{' '}
        <a href="https://www.swfte.com/products/chatflows">Swfte ChatFlows</a> widget. The browser
        never sees the API key — it&apos;s held by the Next.js proxy at <code>/api/chatflow</code>.
      </p>

      <ChatFlowProvider
        config={{
          endpoint: '/api/chatflow',
          apiKey: '',
          chatFlowId: process.env.NEXT_PUBLIC_CHATFLOW_ID!,
          greeting: 'Quick question — what brings you to Acme today?',
          onComplete: async (data) => {
            await fetch('/api/lead', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });
          },
        }}
      >
        <ChatFlowChat agentName="Acme" agentSubtitle="Sales" />
      </ChatFlowProvider>
    </main>
  );
}
