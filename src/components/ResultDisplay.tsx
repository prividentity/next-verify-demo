'use client';

import { useState } from 'react';
import type { SessionData } from '@/lib/privateId/types';
import { useAutoSendPuid } from '@/lib/hooks/useNativeBridge';

interface ResultDisplayProps {
  sessionData: SessionData;
}

interface FoundImage {
  label: string;
  src: string;
}

// Recursively scan the webhook payload for image-like values so we can display
// whatever images PrivateID returns when `sendImages` is enabled, regardless of
// the exact field names used in the payload.
function collectImages(value: unknown, path = ''): FoundImage[] {
  if (value == null) return [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const label = path || 'image';

    // Already a data URI
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed)) {
      return [{ label, src: trimmed }];
    }
    // Image URL
    if (/^https?:\/\/.+\.(png|jpe?g|gif|webp|bmp)(\?.*)?$/i.test(trimmed)) {
      return [{ label, src: trimmed }];
    }
    // Raw base64 (heuristic: long, base64 charset, and the key hints at an image)
    const looksBase64 = trimmed.length > 256 && /^[A-Za-z0-9+/=\s]+$/.test(trimmed);
    const keyHintsImage = /image|img|photo|portrait|selfie|face|document|doc|front|back|scan/i.test(path);
    if (looksBase64 && keyHintsImage) {
      return [{ label, src: `data:image/jpeg;base64,${trimmed.replace(/\s+/g, '')}` }];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, i) => collectImages(item, `${path}[${i}]`));
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, v]) =>
      collectImages(v, path ? `${path}.${key}` : key)
    );
  }

  return [];
}

export default function ResultDisplay({ sessionData }: ResultDisplayProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  // Automatically send result to native webview when verification completes
  // SUCCESS: Sends PUID via uuid message
  // FAILURE: Sends verification_complete message with error
  const errorMessage = sessionData.webhookData?.message ||
                      sessionData.webhookData?.errors?.[0]?.message;

  useAutoSendPuid(
    sessionData.sessionType,
    sessionData.status,
    sessionData.webhookData?.puid,
    sessionData.webhookData?.guid,
    errorMessage
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700';
      case 'FAILED':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-700';
    }
  };

  // Interpret the Age verification outcome from the result payload.
  // The threshold outcome lives on result.facialAgeEstimation.thresholdResult and
  // is mirrored on sessionStatus; the estimated age is result.facialAgeEstimation.exact.
  const facialAgeEstimation = sessionData.webhookData?.result?.facialAgeEstimation;
  const ageStatus: string | undefined =
    facialAgeEstimation?.thresholdResult || sessionData.webhookData?.sessionStatus;
  const estimatedAge: number | undefined =
    typeof facialAgeEstimation?.exact === 'number' ? facialAgeEstimation.exact : undefined;
  const ageResult = (() => {
    if (!ageStatus) return null;
    const normalized = ageStatus.toUpperCase();
    if (normalized.includes('ABOVE')) {
      return { label: 'Above age threshold', passed: true };
    }
    if (normalized.includes('BELOW') || normalized.includes('UNDER')) {
      return { label: 'Below age threshold', passed: false };
    }
    // Unknown/intermediate status — show it verbatim without pass/fail styling.
    return { label: ageStatus.replace(/_/g, ' '), passed: null as boolean | null };
  })();

  const webhookData = sessionData.webhookData;
  const identityInfo = webhookData?.identityInformation;
  const contactInfo = webhookData?.contactInformation;
  const deviceInfo = webhookData?.deviceInfo;
  const indicators = webhookData?.indicators;
  const riskEvaluation = webhookData?.riskEvaluation;
  const images = webhookData ? collectImages(webhookData) : [];

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <div className={`border-2 rounded-xl p-6 ${getStatusColor(sessionData.status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl font-bold">{sessionData.status}</span>
              {sessionData.status === 'SUCCESS' && <span className="text-2xl">✓</span>}
              {sessionData.status === 'FAILED' && <span className="text-2xl">✗</span>}
            </div>
            <p className="text-sm opacity-80">
              {sessionData.sessionType} verification via {sessionData.flowType} flow
            </p>
            {webhookData?.message && (
              <p className="text-sm mt-2 font-medium opacity-90">
                {webhookData.message}
              </p>
            )}
          </div>
          {(webhookData?.puid || webhookData?.guid) && (
            <div className="text-right text-xs font-mono opacity-90 space-y-1">
              {webhookData.puid && (
                <div>
                  <div className="text-[10px] opacity-75 mb-0.5">UUID</div>
                  <div className="font-medium">{webhookData.puid}</div>
                </div>
              )}
              {webhookData.guid && (
                <div>
                  <div className="text-[10px] opacity-75 mb-0.5">GUID</div>
                  <div className="font-medium">{webhookData.guid}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Age Verification Result */}
      {sessionData.sessionType === 'AGE' && ageResult && (
        <div
          className={`border-2 rounded-xl p-6 shadow-sm ${
            ageResult.passed === true
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
              : ageResult.passed === false
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
              : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700'
          }`}
        >
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-xl">🎂</span>
            Age Verification
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Result</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                {ageResult.label}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {ageResult.passed === true && <span className="text-3xl">✓</span>}
              {ageResult.passed === false && <span className="text-3xl">✗</span>}
              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-white/60 dark:bg-black/30 text-gray-700 dark:text-gray-300">
                {ageStatus}
              </span>
            </div>
          </div>
          {estimatedAge !== undefined && (
            <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
              <p className="text-sm text-gray-500 dark:text-gray-400">Estimated Age</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {estimatedAge.toFixed(1)}{' '}
                <span className="text-base font-normal text-gray-500 dark:text-gray-400">
                  years
                </span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Risk Evaluation */}
      {riskEvaluation && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            Risk Evaluation
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {riskEvaluation.level && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Risk Level</span>
                <p>
                  <span
                    className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      riskEvaluation.level === 'LOW'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : riskEvaluation.level === 'HIGH'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}
                  >
                    {riskEvaluation.level}
                  </span>
                </p>
              </div>
            )}
            {riskEvaluation.recommendation && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Recommendation</span>
                <p>
                  <span
                    className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                      riskEvaluation.recommendation === 'ALLOW'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : riskEvaluation.recommendation === 'DENY' || riskEvaluation.recommendation === 'BLOCK'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}
                  >
                    {riskEvaluation.recommendation}
                  </span>
                </p>
              </div>
            )}
            {typeof riskEvaluation.score === 'number' && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Score</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium mt-1">
                  {riskEvaluation.score}
                </p>
              </div>
            )}
          </div>

          {Array.isArray(riskEvaluation.flags) && riskEvaluation.flags.length > 0 && (
            <div className="mt-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">Flags</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {riskEvaluation.flags.map((flag: string, index: number) => (
                  <span
                    key={`${flag}-${index}`}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                  >
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Messages */}
      {sessionData.status === 'FAILED' && webhookData?.errors && webhookData.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4 text-red-900 dark:text-red-200 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            Verification Failed
          </h3>
          <div className="space-y-3">
            {webhookData.errors.map((error, index) => (
              <div
                key={index}
                className="bg-white dark:bg-red-950/30 border border-red-300 dark:border-red-700 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                    <span className="text-red-700 dark:text-red-300 font-bold text-sm">
                      {error.code || index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-red-900 dark:text-red-100 font-medium">
                      {error.message}
                    </p>
                    {error.code && (
                      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                        Error Code: {error.code}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Captured Images (shown when the session was created with Send Images enabled) */}
      {images.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-xl">🖼️</span>
            Captured Images
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({images.length})
            </span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {images.map((img, index) => (
              <div key={`${img.label}-${index}`} className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.label}
                  className="w-full h-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 object-contain"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                  {img.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Identity & Contact Information */}
      {(identityInfo || contactInfo) && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Identity Information */}
          {identityInfo && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="text-xl">🪪</span>
                Identity Document
              </h3>
              <div className="space-y-3">
                {identityInfo.documentType && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Document Type:</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium capitalize">
                      {identityInfo.documentType.replace('_', ' ')}
                    </p>
                  </div>
                )}
                {identityInfo.verificationDate && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Verified On:</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {new Date(identityInfo.verificationDate).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact Information */}
          {contactInfo && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="text-xl">📧</span>
                Contact Information
              </h3>
              <div className="space-y-3">
                {contactInfo.email && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Email:</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {contactInfo.email}
                    </p>
                  </div>
                )}
                {contactInfo.phone && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Phone:</span>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {contactInfo.phone}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Indicators */}
      {indicators && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            Security Verification
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Virtual Camera Detection */}
            {indicators.virtualCamera && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Virtual Camera Detection
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Risk Level:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      indicators.virtualCamera.riskLevel === 'LOW'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                    }`}>
                      {indicators.virtualCamera.riskLevel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Confidence:</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {indicators.virtualCamera.overallConfidence}%
                    </span>
                  </div>
                  {indicators.virtualCamera.browserCompatibility && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Browser:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {indicators.virtualCamera.browserCompatibility.browser} ({indicators.virtualCamera.browserCompatibility.supportLevel})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Headless Browser Detection */}
            {indicators.headless && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Headless Detection
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(indicators.headless).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        value ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-3">
                  ✓ No headless browser detected
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Device Information */}
      {deviceInfo && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-xl">💻</span>
            Device Information
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceInfo.browserType && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Browser:</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {deviceInfo.browserType} {deviceInfo.browserVersion}
                </p>
              </div>
            )}
            {deviceInfo.osName && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Operating System:</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {deviceInfo.osName} {deviceInfo.osVersion}
                </p>
              </div>
            )}
            {deviceInfo.deviceType && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Device Type:</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {deviceInfo.deviceType}
                </p>
              </div>
            )}
            {deviceInfo.screenDimensions && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Screen:</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {deviceInfo.screenDimensions.width} × {deviceInfo.screenDimensions.height}
                </p>
              </div>
            )}
            {deviceInfo.orientation && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Orientation:</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium capitalize">
                  {deviceInfo.orientation.replace('-', ' ')}
                </p>
              </div>
            )}
            {deviceInfo.ipAddress && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">IP Address:</span>
                <p className="text-gray-900 dark:text-gray-100 font-medium font-mono text-sm">
                  {deviceInfo.ipAddress}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Metadata */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-4 text-gray-900 dark:text-gray-100">
          Session Details
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Session ID:</span>
            <p className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all mt-1">
              {sessionData.sessionId}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Created:</span>
            <p className="text-gray-900 dark:text-gray-100 mt-1">
              {new Date(sessionData.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Updated:</span>
            <p className="text-gray-900 dark:text-gray-100 mt-1">
              {new Date(sessionData.updatedAt).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Timestamp:</span>
            <p className="text-gray-900 dark:text-gray-100 mt-1">
              {webhookData?.timestamp ? new Date(webhookData.timestamp).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Raw JSON Toggle */}
      <div className="text-center">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          {showRawJson ? '↑ Hide' : '↓ Show'} Raw JSON Data
        </button>

        {showRawJson && (
          <div className="mt-4 text-left">
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg overflow-auto text-xs max-h-96">
              {JSON.stringify(sessionData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
