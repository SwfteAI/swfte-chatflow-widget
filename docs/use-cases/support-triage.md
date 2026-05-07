# Use Case: Support Request Triage

Classify, summarise, and route inbound support tickets with a ChatFlow before a human agent ever sees them.

## Pattern

1. Embed the widget on your help-centre or in-app help drawer.
2. Greet the customer, classify the issue, and collect environmental detail (browser, version, plan, error code).
3. The ChatFlow either (a) auto-resolves the issue from a connected knowledge base via [Swfte RAG](https://www.swfte.com/products/rag) or (b) hands off to a human with a summarised ticket.

## Suggested fields

| Field | Type | Notes |
|---|---|---|
| `category` | ENUM | Billing, Account, Technical, Feature request |
| `severity` | ENUM | Blocking, Degraded, Question |
| `summary` | TEXT | LLM-generated summary of the issue. |
| `customerEmail` | EMAIL | |
| `customerPlan` | STRING | Hydrated from your auth context via `sessionVariables`. |
| `errorCode` | STRING | Optional, prompt the user only if `severity == Technical`. |

## Auto-handoff

```tsx
<ChatFlowProvider
  config={{
    baseUrl: '/api/chatflow',
    chatFlowId: process.env.NEXT_PUBLIC_SUPPORT_TRIAGE_ID!,
    apiKey: '',
    proxyUrl: '/api/chatflow',
    sessionVariables: { customerId, plan, region },
    greeting: "Hi! Tell me what's going wrong.",
    onComplete: async (data) => {
      if (data.severity === 'Blocking') {
        await fetch('/api/support/escalate', { method: 'POST', body: JSON.stringify(data) });
      } else {
        await fetch('/api/support/queue', { method: 'POST', body: JSON.stringify(data) });
      }
    },
  }}
>
  <ChatFlowChat agentName="Support" />
</ChatFlowProvider>
```

## RAG-powered self-serve

Connect a knowledge dataset (your docs, runbooks, KB) to the ChatFlow at [swfte.com/products/rag](https://www.swfte.com/products/rag). The agent will retrieve relevant articles and quote them inline before falling back to handoff. This typically deflects 30-60% of tier-one tickets.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
