'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WebViewFlow() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startVerification = async (type: 'ENROLL' | 'VERIFY') => {
    setLoading(true);
    setError(null);

    try {
      console.log(`[WebView] Starting ${type}`);

      const baseUrl = window.location.origin;

      // Create session and redirect
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: type,
          flowType: 'redirect',
          baseUrl,
          requirements: ['face'], // Only face verification
          isWebView: true, // Use minimal result page
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const data = await response.json();
      console.log(`[WebView] Session created, redirecting to PrivateID`);

      // Redirect to PrivateID
      window.location.href = data.verificationUrl;

    } catch (err) {
      console.error('[WebView] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            WebView Flows
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Choose a verification flow
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Standard Flows */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Standard Flows
          </h2>

          <button
            onClick={() => startVerification('ENROLL')}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
          >
            {loading ? 'Processing...' : 'Enroll'}
          </button>

          <button
            onClick={() => startVerification('VERIFY')}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
          >
            {loading ? 'Processing...' : 'Verify'}
          </button>
        </div>

        {/* Ultra & Age Flows */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Advanced Flows
          </h2>

          <button
            onClick={() => router.push('/webview/verify-ultra')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
          >
            Ultra Verify
          </button>

          <button
            onClick={() => router.push('/webview/age')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors text-lg shadow-md"
          >
            Age Verification
          </button>
        </div>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-4">
          Standard flows: Face verification only<br/>
          Ultra Verify: Requires Customer ID<br/>
          Age Verification: Age verification with documents
        </p>
      </div>
    </div>
  );
}
