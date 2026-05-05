'use client';

import { useState } from 'react';
import type { SessionData } from '@/lib/privateId/types';
import { useAutoSendPuid } from '@/lib/hooks/useNativeBridge';

interface ResultDisplayProps {
  sessionData: SessionData;
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

  const webhookData = sessionData.webhookData;
  const identityInfo = webhookData?.identityInformation;
  const contactInfo = webhookData?.contactInformation;
  const deviceInfo = webhookData?.deviceInfo;
  const indicators = webhookData?.indicators;

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
