import { createChatFlowHandler } from '@swfte/chatflow-widget/next';

/**
 * Next.js App Router proxy for the ChatFlow widget.
 *
 * The widget calls short paths like `/start`, `/input`, `/config`,
 * `/readiness`, `/session/:id` against its configured `endpoint`. The
 * SDK's `createChatFlowHandler` knows how to translate those into the
 * canonical Swfte agents-service v2 routes, attaches the API key, and
 * synthesises the runtime config. A generic forward proxy will silently
 * 404 on these short paths.
 */
export const { GET, POST } = createChatFlowHandler({
  apiKey: process.env.SWFTE_API_KEY!,
  chatFlowId: process.env.NEXT_PUBLIC_CHATFLOW_ID!,
  workspaceId: process.env.SWFTE_WORKSPACE_ID,
  channel: 'WEB_CHAT',
});

export const dynamic = 'force-dynamic';
