# Use Case: NPS / Customer Surveys

Run conversational NPS, CSAT, and post-sale surveys with much higher completion rates than a static form.

## Pattern

1. Trigger after a key event — purchase complete, support ticket closed, feature first-use.
2. Single-question entry ("On a scale of 0-10, how likely…") — branch on the score.
3. Detractor branch asks "what would have made it a 10?"; promoter branch asks for a public quote.
4. Pipe scored results to your analytics warehouse and product board.

## Suggested fields

| Field | Type | Notes |
|---|---|---|
| `nps` | NUMBER | 0-10 |
| `category` | ENUM | Detractor (0-6), Passive (7-8), Promoter (9-10) — auto-derived |
| `freeText` | TEXT | Why? (asked of detractors and promoters) |
| `mayWeQuote` | BOOL | Asked of promoters only — used for testimonials. |
| `wouldRecommend` | TEXT | Optional follow-up. |

## Mount with auto-trigger

```tsx
const [show, setShow] = useState(false);
useEffect(() => {
  // trigger 7 days after signup, once per user
  if (shouldShowNps(userId)) setShow(true);
}, [userId]);

return show && (
  <Modal onClose={() => setShow(false)}>
    <ChatFlowProvider
      config={{
        baseUrl: '/api/chatflow',
        chatFlowId: process.env.NEXT_PUBLIC_NPS_ID!,
        apiKey: '',
        proxyUrl: '/api/chatflow',
        sessionVariables: { userId, signupDate, lifetimeValue },
        onComplete: async (data) => {
          await fetch('/api/nps', { method: 'POST', body: JSON.stringify(data) });
          markNpsAsked(userId);
          setShow(false);
        },
      }}
    >
      <ChatFlowChat agentName="Quick favour?" />
    </ChatFlowProvider>
  </Modal>
);
```

## Why conversational beats forms

A single-page NPS form typically completes at 5-15%. Conversational delivery typically completes at 35-60% because:

- It feels low-friction (one question at a time).
- The follow-up is contextual, not generic.
- Mobile UX is dramatically better.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
