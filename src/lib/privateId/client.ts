import { PRIVATEID_CONFIG } from './config';
import type { CreateSessionRequest, CreateSessionResponse, CreateAgeSessionRequest, SessionType } from './types';

/**
 * PrivateID API Client
 * Handles communication with PrivateID verification API
 */
export class PrivateIdClient {
  private apiKey: string;
  private apiBase: string;

  constructor() {
    this.apiKey = PRIVATEID_CONFIG.apiKey;
    this.apiBase = PRIVATEID_CONFIG.apiBase;

    if (!this.apiKey) {
      throw new Error('PrivateID API key is not configured');
    }
  }

  /**
   * Create a verification session
   */
  async createSession(
    sessionType: SessionType,
    webhookUrl: string,
    redirectUrl?: string,
    customerId?: string,
    requirements?: string[],
    launchUrlHost?: string
  ): Promise<CreateSessionResponse> {
    const payload: CreateSessionRequest = {
      type: sessionType,
      callback: {
        url: webhookUrl,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      redirectURL: redirectUrl || '', // PrivateID requires this field
      locale: 'en-US',
      enableDesktop: true,
      sendImages: true, // Enable to receive parsed document data (name, address, DOB, etc.)
      sendEventWebhooks: true,
      // Use provided requirements, or default: ENROLL = face + document, VERIFY/VERIFY_ULTRA = face only
      requirements: requirements || (sessionType === 'ENROLL' ? ['face', 'identity_document'] : ['face']),
    };

    // Add optional customer ID
    if (customerId) {
      payload.customerId = customerId;
    }

    try {
      console.log('[PrivateIdClient] Sending payload to PrivateID:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.apiBase}/verification-session`, {
        method: 'POST',
        headers: {
          'x_api_key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PrivateIdClient] API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        throw new Error(
          `PrivateID API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      console.log('[PrivateIdClient] Session created successfully:', {
        sessionId: data.sessionId,
        launchUrl: data.launchUrl,
        type: sessionType,
      });

      // Get the original launch URL from PrivateID
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
          } else {
            urlObj.port = '';
          }
          // Use http if localhost, otherwise https
          urlObj.protocol = hostname.includes('localhost') ? 'http:' : 'https:';
          modifiedUrl = urlObj.toString();

          console.log('[PrivateIdClient] Modified URL with custom host:', {
            original: originalUrl,
            modified: modifiedUrl,
            launchUrlHost,
          });
        } catch (error) {
          console.warn('[PrivateIdClient] Failed to modify URL, using original:', error);
        }
      }

      // Map launchUrl to verificationUrl (PrivateID uses 'launchUrl' in their response)
      return {
        sessionId: data.sessionId,
        verificationUrl: modifiedUrl,
        expiresAt: data.expiresAt,
      };
    } catch (error) {
      console.error('[PrivateIdClient] Error creating session:', error);
      throw error;
    }
  }

  /**
   * Create an Age verification session
   */
  async createAgeSession(
    redirectUrl: string,
    options?: Partial<CreateAgeSessionRequest>,
    launchUrlHost?: string
  ): Promise<CreateSessionResponse> {
    const payload: CreateAgeSessionRequest = {
      ageThreshold: options?.ageThreshold ?? 0.01,
      redirectUrl,
      livenessEnabled: options?.livenessEnabled ?? true,
      enableSwitchDevice: options?.enableSwitchDevice ?? true,
      locale: options?.locale ?? 'en',
      enableDesktop: options?.enableDesktop ?? true,
      metadata: options?.metadata ?? {},
      compareThreshold: options?.compareThreshold ?? 0.2,
      documentAgeReturnFormat: options?.documentAgeReturnFormat ?? 'both',
      facialAgeEstimationReturnFormat: options?.facialAgeEstimationReturnFormat ?? 'none',
      faceMatchThreshold: options?.faceMatchThreshold ?? 0.2,
      documentAgeThreshold: options?.documentAgeThreshold ?? 0.01,
      requirements: options?.requirements ?? ['face'],
    };

    try {
      console.log('[PrivateIdClient] Creating Age session:', JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.apiBase}/session`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PrivateIdClient] Age Session API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        throw new Error(
          `PrivateID Age API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      console.log('[PrivateIdClient] Age session created successfully:', {
        sessionId: data.sessionId,
        launchUrl: data.launchUrl,
      });

      // Get the original launch URL from PrivateID
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
          } else {
            urlObj.port = '';
          }
          // Use http if localhost, otherwise https
          urlObj.protocol = hostname.includes('localhost') ? 'http:' : 'https:';
          modifiedUrl = urlObj.toString();

          console.log('[PrivateIdClient] Modified Age URL with custom host:', {
            original: originalUrl,
            modified: modifiedUrl,
            launchUrlHost,
          });
        } catch (error) {
          console.warn('[PrivateIdClient] Failed to modify URL, using original:', error);
        }
      }

      return {
        sessionId: data.sessionId,
        verificationUrl: modifiedUrl,
        expiresAt: data.expiresAt,
      };
    } catch (error) {
      console.error('[PrivateIdClient] Error creating Age session:', error);
      throw error;
    }
  }

  /**
   * Fetch webhook data directly from PrivateID
   * Useful as a fallback if webhook POST is delayed or fails
   */
  async fetchWebhookData(privateIdSessionId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiBase}/verification-session/${privateIdSessionId}/webhook`,
        {
          method: 'GET',
          headers: {
            'x_api_key': this.apiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PrivateIdClient] Webhook fetch error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });

        throw new Error(
          `PrivateID webhook fetch error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      console.log('[PrivateIdClient] Fetched webhook data:', {
        sessionId: data.sessionId,
        status: data.status,
      });

      return data;
    } catch (error) {
      console.error('[PrivateIdClient] Error fetching webhook data:', error);
      throw error;
    }
  }

  /**
   * Health check method (optional - for testing API connectivity)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // This is a simple check - adjust based on PrivateID's actual health endpoint
      const response = await fetch(`${this.apiBase}/health`, {
        method: 'GET',
        headers: {
          'x_api_key': this.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[PrivateIdClient] Health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const privateIdClient = new PrivateIdClient();
