'use client';

import { useEffect, useState } from 'react';

export default function WebViewVerify() {
  const [error, setError] = useState<string | null>(null);
  const [initiated, setInitiated] = useState(false);

  useEffect(() => {
    if (initiated) return;

    const startVerification = async () => {
      setInitiated(true);
      setError(null);

      try {
        console.log('[WebView] Starting VERIFY');

        const baseUrl = window.location.origin;

        // Create session and redirect
        const response = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionType: 'VERIFY',
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
        console.log('[WebView] Session created, redirecting to PrivateID');

        // Redirect to PrivateID
        window.location.href = data.verificationUrl;

      } catch (err) {
        console.error('[WebView] Error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    };

    startVerification();
  }, [initiated]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm space-y-4">
        {error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Starting verification...</p>
          </div>
        )}
      </div>
    </div>
  );
}
