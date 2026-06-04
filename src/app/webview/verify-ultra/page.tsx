'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function WebViewVerifyUltra() {
  const searchParams = useSearchParams();
  const [customerId, setCustomerId] = useState(
    searchParams.get('customerId') || 'shiven-11111'
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startVerifyUltra = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!customerId.trim()) {
        throw new Error('Customer ID is required');
      }

      console.log('[WebView] Starting VERIFY_ULTRA with customerId:', customerId);

      const baseUrl = window.location.origin;

      // Create VERIFY_ULTRA session and redirect
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionType: 'VERIFY_ULTRA',
          flowType: 'redirect',
          baseUrl,
          requirements: ['face'],
          isWebView: true,
          customerId: customerId.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create VERIFY_ULTRA session');
      }

      const data = await response.json();
      console.log('[WebView] VERIFY_ULTRA session created, redirecting to PrivateID');

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
      <div className="w-full max-w-sm space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Ultra Verification
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter the Customer ID to verify
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="customerId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Customer ID
            </label>
            <input
              id="customerId"
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter customer ID"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={startVerifyUltra}
            disabled={loading || !customerId.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Starting...
              </span>
            ) : (
              'Start Verification'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
