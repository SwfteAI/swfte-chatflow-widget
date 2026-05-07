# Use Case: B2B Lead Qualification

Score and route inbound leads with a ChatFlow that asks the right questions, ranks the lead, and pushes to your CRM in real-time.

## Pattern

1. Embed the widget on `/get-a-demo` — open with a relevant qualifier ("What problem are you trying to solve?").
2. Branch on company-size and role.
3. Score against your ICP (industry, headcount, role, intent).
4. Pipe the result to your CRM via the `onComplete` callback or via a server-side webhook configured at [swfte.com/products/chatflows](https://www.swfte.com/products/chatflows).

## Suggested fields

| Field | Type | Notes |
|---|---|---|
| `email` | EMAIL | Validate domain against free-mailbox blocklist server-side. |
| `companyName` | STRING | |
| `companyDomain` | STRING | Auto-extract from email if missing. |
| `headcount` | ENUM | 1-10, 11-50, 51-200, 201-1000, 1000+ |
| `role` | ENUM | C-suite, VP/Director, Manager, IC |
| `useCase` | TEXT | LLM extracts pain-point keywords. |
| `timeline` | ENUM | This month, This quarter, 6+ months, Just exploring |
| `budget` | ENUM | <$10k, $10-50k, $50k+, Don't know yet |

## Sample mount

```tsx
<ChatFlowProvider
  config={{
    baseUrl: '/api/chatflow',
    chatFlowId: process.env.NEXT_PUBLIC_LEAD_QUAL_ID!,
    apiKey: '',
    proxyUrl: '/api/chatflow',
    greeting: 'Quick question — what brings you to Acme today?',
    onComplete: async (data) => {
      const score = scoreLead(data); // your scoring fn
      await fetch('/api/crm/lead', { method: 'POST', body: JSON.stringify({ ...data, score }) });
    },
  }}
>
  <ChatFlowChat agentName="Acme" agentSubtitle="Sales" />
</ChatFlowProvider>
```

## Server-side enrichment

Hook a ChatFlow webhook (configured in the dashboard) that fires on `onFieldExtracted` for `email`. Use it to call an enrichment provider, then write back to the session via the V2 ChatFlow API. The widget will pick up the enriched fields on its next sync.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
