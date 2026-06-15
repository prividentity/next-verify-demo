import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/session/store';
import { privateIdClient } from '@/lib/privateId/client';

/**
 * Fallback endpoint to poll PrivateID directly for webhook data
 * Used when webhook POST is delayed or fails
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    console.log('[API /sessions/:id/poll] Polling PrivateID for session:', sessionId);

    // Get session from store
    const session = sessionStore.get(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found', sessionId },
        { status: 404 }
      );
    }

    // Check if we already have a final result
    if (session.status === 'SUCCESS' || session.status === 'FAILED') {
      console.log('[API /sessions/:id/poll] Session already complete:', session.status);
      return NextResponse.json({
        success: true,
        message: 'Session already complete',
        status: session.status,
      });
    }

    // Check if we have PrivateID's session ID
    if (!session.privateIdSessionId) {
      return NextResponse.json(
        { error: 'PrivateID session ID not found' },
        { status: 400 }
      );
    }

    console.log('[API /sessions/:id/poll] Fetching webhook data from PrivateID...');

    // Fetch webhook data directly from PrivateID
    const webhookData = await privateIdClient.fetchWebhookData(
      session.privateIdSessionId,
      session.sessionType,
      { apiBase: session.apiBaseUrl, apiKey: session.apiKey }
    );

    // Determine session status from webhook data.
    // The verification-session webhook uses `status`; the Age /session/:id/result
    // endpoint uses `flowStatus` (e.g. "COMPLETED").
    let sessionStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' = 'IN_PROGRESS';

    const rawStatus = webhookData.status || webhookData.flowStatus;
    if (rawStatus) {
      const normalizedStatus = String(rawStatus).toUpperCase();
      if (normalizedStatus === 'SUCCESS' || normalizedStatus === 'COMPLETED') {
        sessionStatus = 'SUCCESS';
      } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'ERROR' || normalizedStatus === 'FAILURE') {
        sessionStatus = 'FAILED';
      }
    }

    // Update session with webhook data
    sessionStore.update(sessionId, {
      status: sessionStatus,
      webhookData,
    });

    console.log('[API /sessions/:id/poll] Session updated from polling:', {
      sessionId,
      status: sessionStatus,
    });

    return NextResponse.json({
      success: true,
      message: 'Session updated from PrivateID polling',
      status: sessionStatus,
      webhookData,
    });
  } catch (error) {
    console.error('[API /sessions/:id/poll] Error polling PrivateID:', error);

    return NextResponse.json(
      {
        error: 'Failed to poll PrivateID',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
