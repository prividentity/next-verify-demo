import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/session/store';
import type { WebhookPayload } from '@/lib/privateId/types';

/**
 * Webhook endpoint for receiving PrivateID callbacks
 * This endpoint is called by PrivateID when verification is complete
 */
export async function POST(request: NextRequest) {
  try {
    // Parse webhook payload
    const payload: WebhookPayload = await request.json();

    console.log('[API /webhook] Received webhook:', {
      sessionId: payload.sessionId,
      status: payload.status,
      timestamp: payload.timestamp,
    });

    // Print the full results being sent from the webhook.
    // Image fields can be large base64 strings, so summarize them instead of dumping raw data.
    console.log('[API /webhook] Full webhook payload:');
    console.log(
      JSON.stringify(
        payload,
        (key, value) =>
          typeof value === 'string' && value.length > 200
            ? `<${value.length} chars${value.startsWith('data:image') || /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 64)) ? ', likely image/base64' : ''}>`
            : value,
        2
      )
    );

    // Validate payload has session ID
    if (!payload.sessionId) {
      console.error('[API /webhook] Missing sessionId in webhook payload');
      return NextResponse.json(
        { error: 'Missing sessionId in webhook payload' },
        { status: 400 }
      );
    }

    // Find session by PrivateID's session ID
    // The webhook contains PrivateID's sessionId, not our internal one
    const session = sessionStore.findByPrivateIdSessionId(payload.sessionId);

    if (!session) {
      console.error('[API /webhook] Session not found for PrivateID sessionId:', payload.sessionId);
      console.log('[API /webhook] Available sessions:', sessionStore.getAll().map(s => ({
        internalId: s.sessionId,
        privateIdId: s.privateIdSessionId
      })));
      return NextResponse.json(
        { error: 'Session not found', privateIdSessionId: payload.sessionId },
        { status: 404 }
      );
    }

    // Determine session status from webhook
    let sessionStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' = 'IN_PROGRESS';

    if (payload.status) {
      const normalizedStatus = payload.status.toUpperCase();
      if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED') {
        sessionStatus = 'SUCCESS';
      } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR' || normalizedStatus === 'FAILURE') {
        sessionStatus = 'FAILED';
      }
    }

    // Update session with webhook data using our internal sessionId
    sessionStore.update(session.sessionId, {
      status: sessionStatus,
      webhookData: payload,
    });

    console.log('[API /webhook] Session updated successfully:', {
      internalSessionId: session.sessionId,
      privateIdSessionId: payload.sessionId,
      status: sessionStatus,
    });

    // Return 200 OK to acknowledge webhook receipt
    return NextResponse.json({
      success: true,
      sessionId: payload.sessionId,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('[API /webhook] Error processing webhook:', error);

    // Still return 200 to prevent webhook retries (log for debugging)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 } // Return 200 to prevent retries
    );
  }
}

// GET endpoint for testing (return webhook endpoint info)
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/webhook',
    method: 'POST',
    description: 'Webhook endpoint for PrivateID callbacks',
    expectedPayload: {
      sessionId: 'string (required)',
      status: 'string (SUCCESS, FAILED, etc.)',
      verificationResult: 'object (optional)',
      error: 'object (optional)',
      timestamp: 'string (optional)',
    },
  });
}
