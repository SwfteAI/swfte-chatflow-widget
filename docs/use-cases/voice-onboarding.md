# Use Case: Voice Phone-Call Onboarding

The same ChatFlow that powers your web onboarding can answer an inbound phone call, complete the onboarding by voice, and write the collected fields back to your DB. No new code needed once the ChatFlow is voice-enabled.

## How it works

1. Author your ChatFlow at [swfte.com/products/chatflows](https://www.swfte.com/products/chatflows). Toggle "Enable voice" — this assigns a phone number from your [Swfte Voice](https://www.swfte.com/products/voice) pool.
2. Speech-to-text and text-to-speech run inside Swfte's voice runtime — sub-500 ms TTFB end-to-end.
3. When a caller dials the number, the runtime starts a session against the same ChatFlow. The same fields are extracted, the same `onComplete` webhook fires.
4. Recordings, transcripts, and audit trails are accessible via [V2 voice calls APIs](https://www.swfte.com/developers).

## Configure once, run everywhere

```tsx
// Web mount — exact same widget
<ChatFlowProvider
  config={{
    baseUrl: '/api/chatflow',
    chatFlowId: process.env.NEXT_PUBLIC_ONBOARDING_ID!,
    proxyUrl: '/api/chatflow',
    apiKey: '',
  }}
>
  <ChatFlowChat />
</ChatFlowProvider>
```

```bash
# Voice — no code, just call the number assigned to the chatflow
+44 20 XXXX XXXX
```

## Server-side webhook

Wire the same `onComplete` webhook for both web and voice — collected data is identical. Add a `channel` discriminator to your handler if you want to vary post-completion behaviour:

```ts
export async function POST(req: Request) {
  const { sessionId, channel, data } = await req.json();
  if (channel === 'VOICE') {
    await sendSms(data.phoneNumber, 'Thanks! We sent a confirmation email.');
  }
  await db.profiles.upsert({ ...data, source: channel });
  return Response.json({ ok: true });
}
```

## Listening to recordings

Recordings and transcripts are exposed via the V2 API:

```bash
GET /v2/voice/calls/{callSid}/recording
GET /v2/voice/calls/{callSid}/transcript
GET /v2/voice/calls/{callSid}/audit
```

See the language SDKs ([java](https://github.com/SwfteAI/swfte-java), [node](https://github.com/SwfteAI/swfte-node), [python](https://github.com/SwfteAI/swfte-python)) for typed clients.

Full reference at [swfte.com/developers](https://www.swfte.com/developers).
