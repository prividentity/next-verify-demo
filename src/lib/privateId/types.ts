// PrivateID API Types
export type SessionType = "ENROLL" | "VERIFY" | "VERIFY_ULTRA" | "AGE";
export type FlowType = "redirect" | "iframe";
export type SessionStatus = "PENDING" | "IN_PROGRESS" | "SUCCESS" | "FAILED";

// Request payload for creating a verification session
export interface CreateSessionRequest {
  type: SessionType;
  redirectURL?: string;
  callback: {
    url: string;
    headers?: Record<string, string>;
  };
  customerId?: string;
  productGroupId?: string;
  locale?: string;
  enableDesktop?: boolean;
  sendImages?: boolean;
  sendEventWebhooks?: boolean;
  requirements?: string[];
}

// Request payload for creating an Age verification session
export interface CreateAgeSessionRequest {
  ageThreshold?: number;
  redirectUrl: string;
  livenessEnabled?: boolean;
  enableSwitchDevice?: boolean;
  locale?: string;
  enableDesktop?: boolean;
  metadata?: Record<string, any>;
  compareThreshold?: number;
  documentAgeReturnFormat?: 'both' | 'document' | 'facial' | 'none';
  facialAgeEstimationReturnFormat?: 'threshold' | 'exact' | 'both' | 'none';
  faceMatchThreshold?: number;
  documentAgeThreshold?: number;
  sendImages?: boolean;
  requirements?: string[];
}

// Response from PrivateID when creating a session
// Note: PrivateID API returns 'launchUrl', we map it to 'verificationUrl' for consistency
export interface CreateSessionResponse {
  sessionId: string;
  verificationUrl: string; // Mapped from API's 'launchUrl'
  expiresAt?: string;
}

// Webhook payload structure from PrivateID
export interface WebhookPayload {
  sessionId?: string;
  status?: string;
  verificationResult?: {
    faceMatchScore?: number;
    livenessScore?: number;
    documentVerified?: boolean;
    userData?: {
      name?: string;
      dateOfBirth?: string;
      documentNumber?: string;
      [key: string]: any;
    };
  };
  error?: {
    code: string;
    message: string;
  };
  errors?: Array<{
    code: number | string;
    message: string;
  }>;
  timestamp?: string;
  [key: string]: any; // Allow additional fields
}

// Internal session data structure
export interface SessionData {
  sessionId: string; // Our internal session ID (used in URLs)
  privateIdSessionId?: string; // PrivateID's session ID (used in webhooks)
  sessionType: SessionType;
  status: SessionStatus;
  verificationUrl: string;
  flowType: FlowType;
  createdAt: Date;
  updatedAt: Date;
  webhookData?: WebhookPayload;
  // The API base/key used to create this session, so polling targets the same
  // PrivateID environment instead of the singleton client's env-based defaults.
  apiBaseUrl?: string;
  apiKey?: string;
}

// API error response
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}
