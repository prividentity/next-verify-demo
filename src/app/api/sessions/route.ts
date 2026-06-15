import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { privateIdClient } from '@/lib/privateId/client';
import { sessionStore } from '@/lib/session/store';
import { PRIVATEID_CONFIG } from '@/lib/privateId/config';
import type { SessionType, FlowType, SessionData, CreateSessionRequest, CreateSessionResponse } from '@/lib/privateId/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionType,
      flowType,
      baseUrl,
      requirements,
      isWebView,
      customerId,
      apiKey: requestApiKey,
      apiBaseUrl: requestApiBaseUrl,
      callbackUrl: requestCallbackUrl,
      redirectUrl: requestRedirectUrl,
      launchUrlHost: requestLaunchUrlHost,
      sendImages: requestSendImages,
      facialAgeEstimationReturnFormat: requestFacialAgeEstimationReturnFormat,
    } = body as {
      sessionType: SessionType;
      flowType: FlowType;
      baseUrl?: string;
      requirements?: string[];
      isWebView?: boolean;
      customerId?: string;
      apiKey?: string;
      apiBaseUrl?: string;
      callbackUrl?: string;
      redirectUrl?: string;
      launchUrlHost?: string;
      sendImages?: boolean;
      facialAgeEstimationReturnFormat?: 'threshold' | 'exact' | 'both' | 'none';
    };

    // Default to true to preserve previous behavior when the client doesn't specify
    const effectiveSendImages = requestSendImages ?? true;
    // Default to 'both' so the estimated age is returned alongside the threshold result
    const effectiveFacialAgeEstimationReturnFormat = requestFacialAgeEstimationReturnFormat ?? 'both';
    console.log({body});
    // Validate input
    if (!sessionType || !['ENROLL', 'VERIFY', 'VERIFY_ULTRA', 'AGE'].includes(sessionType)) {
      return NextResponse.json(
        { error: 'Invalid session type. Must be ENROLL, VERIFY, VERIFY_ULTRA, or AGE' },
        { status: 400 }
      );
    }

    if (!flowType || !['redirect', 'iframe'].includes(flowType)) {
      return NextResponse.json(
        { error: 'Invalid flow type. Must be redirect or iframe' },
        { status: 400 }
      );
    }

    // VERIFY_ULTRA requires a customerId (must match previously enrolled user)
    if (sessionType === 'VERIFY_ULTRA' && !customerId) {
      return NextResponse.json(
        { error: 'customerId is required for VERIFY_ULTRA. Must match a previously enrolled user.' },
        { status: 400 }
      );
    }

    // Use baseUrl from request body, fallback to env, or use default
    const effectiveBaseUrl = baseUrl || PRIVATEID_CONFIG.baseUrl || 'http://localhost:3000';

    // Validate baseUrl format
    if (!effectiveBaseUrl.startsWith('http://') && !effectiveBaseUrl.startsWith('https://')) {
      return NextResponse.json(
        { error: 'Invalid baseUrl format. Must start with http:// or https://' },
        { status: 400 }
      );
    }

    // Use API config from request or fallback to env
    const effectiveApiKey = requestApiKey || PRIVATEID_CONFIG.apiKey;
    const effectiveApiBaseUrl = requestApiBaseUrl || PRIVATEID_CONFIG.apiBase;

    // Generate internal session ID first (so we can include it in redirectURL)
    const internalSessionId = randomUUID();

    // Generate webhook URL (use custom callback URL or default)
    const webhookUrl = requestCallbackUrl || `${effectiveBaseUrl}/api/webhook`;

    // Generate redirect URL with sessionId
    // PrivateID requires this even for iframe flows (as a fallback)
    // For iframe flow, user won't see this redirect, but API requires it
    // For webview, use minimal result page
    let finalRedirectUrl: string;
    if (requestRedirectUrl) {
      // Use custom redirect URL if provided
      finalRedirectUrl = `${requestRedirectUrl}${requestRedirectUrl.includes('?') ? '&' : '?'}sessionId=${internalSessionId}`;
    } else if (flowType === 'redirect') {
      if (isWebView) {
        finalRedirectUrl = `${effectiveBaseUrl}/webview/result?sessionId=${internalSessionId}`;
      } else {
        finalRedirectUrl = `${effectiveBaseUrl}/redirect-flow/result?sessionId=${internalSessionId}`;
      }
    } else {
      finalRedirectUrl = `${effectiveBaseUrl}/iframe-flow?sessionId=${internalSessionId}`;
    }

    // Use provided customerId or generate one for ENROLL
    // VERIFY_ULTRA requires customerId from request (validated above)
    const effectiveCustomerId = customerId || `customer-${randomUUID()}`;

    console.log('[API /sessions] Creating session:', {
      sessionType,
      flowType,
      webhookUrl,
      redirectUrl: finalRedirectUrl,
      internalSessionId,
      customerId: effectiveCustomerId,
      apiBaseUrl: effectiveApiBaseUrl,
    });

    // Call PrivateID API to create session
    let response;
    if (sessionType === 'AGE') {
      // Use Age-specific API endpoint with custom config
      console.log({effectiveApiBaseUrl, effectiveApiKey})
      response = await createAgeSessionDirect(
        effectiveApiKey,
        effectiveApiBaseUrl,
        finalRedirectUrl,
        requirements,
        {
          sessionId: internalSessionId,
          customerId: effectiveCustomerId,
        },
        requestLaunchUrlHost,
        effectiveSendImages,
        effectiveFacialAgeEstimationReturnFormat
      );
    } else {
      // Use standard verification session endpoint for ENROLL, VERIFY, and VERIFY_ULTRA
      response = await createSessionDirect(
        effectiveApiKey,
        effectiveApiBaseUrl,
        sessionType,
        webhookUrl,
        finalRedirectUrl,
        effectiveCustomerId,
        requirements,
        requestLaunchUrlHost,
        effectiveSendImages
      );
    }

    // Use our internal session ID (which is in the redirectURL)
    // Store PrivateID's sessionId separately for webhook correlation
    const sessionId = internalSessionId;
    const privateIdSessionId = response.sessionId;

    // Store session data
    const sessionData: SessionData = {
      sessionId,
      privateIdSessionId, // Store PrivateID's session ID for webhook correlation
      sessionType,
      status: 'PENDING',
      verificationUrl: response.verificationUrl,
      flowType,
      createdAt: new Date(),
      updatedAt: new Date(),
      apiBaseUrl: effectiveApiBaseUrl,
      apiKey: effectiveApiKey,
    };

    sessionStore.create(sessionData);

    console.log('[API /sessions] Session created successfully:', {
      sessionId,
      privateIdSessionId,
      verificationUrl: response.verificationUrl,
    });

    // Return session data to client
    return NextResponse.json(
      {
        sessionId,
        verificationUrl: response.verificationUrl,
        expiresAt: response.expiresAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API /sessions] Error creating session:', error);

    return NextResponse.json(
      {
        error: 'Failed to create verification session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to list all sessions (for debugging)
export async function GET() {
  const sessions = sessionStore.getAll();

  return NextResponse.json({
    sessions,
    count: sessions.length,
  });
}

// Helper function to create standard verification session with custom API config
async function createSessionDirect(
  apiKey: string,
  apiBase: string,
  sessionType: SessionType,
  webhookUrl: string,
  redirectUrl: string,
  customerId: string,
  requirements?: string[],
  launchUrlHost?: string,
  sendImages: boolean = true
): Promise<CreateSessionResponse> {
  const payload: CreateSessionRequest = {
    type: sessionType,
    callback: {
      url: webhookUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    },
    redirectURL: redirectUrl,
    locale: 'en-US',
    enableDesktop: true,
    sendImages,
    sendEventWebhooks: true,
    requirements: requirements || (sessionType === 'ENROLL' ? ['face', 'identity_document'] : ['face']),
    customerId,
  };

  const response = await fetch(`${apiBase}/verification-session`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PrivateID API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const originalUrl = data.launchUrl || data.verificationUrl || data.url;

  // Replace hostname with custom host if provided
  let modifiedUrl = originalUrl;
  if (launchUrlHost) {
    try {
      const urlObj = new URL(originalUrl);
      const [hostname, port] = launchUrlHost.split(':');
      urlObj.hostname = hostname;
      if (port) {
        urlObj.port = port;
      }
      // Use http if localhost, otherwise https
      urlObj.protocol = hostname.includes('localhost') ? 'http:' : 'https:';
      modifiedUrl = urlObj.toString();
      console.log('[API] Modified launch URL:', { original: originalUrl, modified: modifiedUrl });
    } catch (error) {
      console.warn('[API] Failed to modify URL, using original:', error);
    }
  }

  // The Age /session endpoint returns its session ID under `token`, which is the
  // ID that /session/:id/result expects — NOT the `sessionId` query param in the
  // launch URL (a different, unrelated ID). `data.token` is undefined for the
  // standard verification-session response, so it harmlessly falls through there.
  return {
    sessionId: data.token || data.sessionId || extractSessionIdFromUrl(originalUrl),
    verificationUrl: modifiedUrl,
    expiresAt: data.expiresAt,
  };
}

// Extract PrivateID's sessionId from the launch URL query param when the
// API response doesn't include a top-level sessionId field (e.g. Age flow)
function extractSessionIdFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).searchParams.get('sessionId') || undefined;
  } catch {
    return undefined;
  }
}

// Helper function to create Age session with custom API config
async function createAgeSessionDirect(
  apiKey: string,
  apiBase: string,
  redirectUrl: string,
  requirements?: string[],
  metadata?: Record<string, any>,
  launchUrlHost?: string,
  sendImages: boolean = true,
  facialAgeEstimationReturnFormat: 'threshold' | 'exact' | 'both' | 'none' = 'both'
): Promise<CreateSessionResponse> {
  const payload = {
    ageThreshold: 0.01,
    redirectUrl,
    livenessEnabled: true,
    enableSwitchDevice: true,
    locale: 'en',
    enableDesktop: true,
    metadata: metadata || {},
    compareThreshold: 0.2,
    documentAgeReturnFormat: 'both',
    facialAgeEstimationReturnFormat,
    faceMatchThreshold: 0.2,
    documentAgeThreshold: 0.01,
    sendImages,
    requirements: requirements || ['face'],
  };

  const response = await fetch(`${apiBase}/session`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PrivateID Age API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const originalUrl = data.launchUrl || data.verificationUrl || data.url;

  // Replace hostname with custom host if provided
  let modifiedUrl = originalUrl;
  if (launchUrlHost) {
    try {
      const urlObj = new URL(originalUrl);
      const [hostname, port] = launchUrlHost.split(':');
      urlObj.hostname = hostname;
      if (port) {
        urlObj.port = port;
      }
      // Use http if localhost, otherwise https
      urlObj.protocol = hostname.includes('localhost') ? 'http:' : 'https:';
      modifiedUrl = urlObj.toString();
      console.log('[API] Modified launch URL:', { original: originalUrl, modified: modifiedUrl });
    } catch (error) {
      console.warn('[API] Failed to modify URL, using original:', error);
    }
  }

  // The Age /session endpoint returns its session ID under `token`, which is the
  // ID that /session/:id/result expects — NOT the `sessionId` query param in the
  // launch URL (a different, unrelated ID). `data.token` is undefined for the
  // standard verification-session response, so it harmlessly falls through there.
  return {
    sessionId: data.token || data.sessionId || extractSessionIdFromUrl(originalUrl),
    verificationUrl: modifiedUrl,
    expiresAt: data.expiresAt,
  };
}
