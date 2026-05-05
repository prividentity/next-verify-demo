'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ResultDisplay from '@/components/ResultDisplay';
import type { SessionData } from '@/lib/privateId/types';
import { useNativeBridge } from '@/lib/hooks/useNativeBridge';

function RedirectResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || searchParams.get('session_id');
  const reason = searchParams.get('reason'); // Check for reason parameter

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [hasTriggeredFallback, setHasTriggeredFallback] = useState(false);


  const triggerFallbackPolling = useCallback(async () => {
    if (!sessionId || hasTriggeredFallback) return;

    try {
      console.log('[RedirectResult] Triggering fallback polling to PrivateID...');
      setHasTriggeredFallback(true);

      const response = await fetch(`/api/sessions/${sessionId}/poll`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[RedirectResult] Fallback polling result:', data);

        // Fetch updated session data
        await fetchSession();
      }
    } catch (err) {
      console.error('[RedirectResult] Fallback polling error:', err);
    }
  }, [sessionId, hasTriggeredFallback]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided in URL');
      setLoading(false);
      return;
    }

    try {
      console.log('[RedirectResult] Fetching session:', sessionId);

      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Session not found. It may have expired or is invalid.');
        }
        throw new Error('Failed to fetch session data');
      }

      const data = await response.json();
      setSessionData(data);

      console.log('[RedirectResult] Session data:', data);

      // Stop loading only when we reach a final status (SUCCESS or FAILED)
      // Keep polling for intermediate statuses (PENDING, IN_PROGRESS)
      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        setLoading(false);
      }
    } catch (err) {
      console.error('[RedirectResult] Error fetching session:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }, [sessionId]);

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Add PUID to URL when webhook data arrives - this signals native to close
  useEffect(() => {
    console.log('[RedirectResult] 🔍 URL update check:', {
      hasReason: !!reason,
      reasonValue: reason,
      hasSessionData: !!sessionData,
      sessionStatus: sessionData?.status,
      hasWebhookData: !!sessionData?.webhookData,
      isLoading: loading,
      currentSearchParams: searchParams.toString(),
    });

    // Need all these conditions before adding PUID to URL:
    // 1. URL has reason parameter (indicates redirect from PrivateID)
    // 2. Session data exists
    // 3. Not currently loading
    // 4. Has webhook data (confirmation we received response from PrivateID)
    // 5. Final status (SUCCESS or FAILED)

    if (!reason) {
      console.log('[RedirectResult] ❌ URL not ready: No reason parameter');
      return;
    }

    if (!sessionData) {
      console.log('[RedirectResult] ⏳ URL not ready: No session data yet');
      return;
    }

    if (loading) {
      console.log('[RedirectResult] ⏳ URL not ready: Still loading');
      return;
    }

    if (!sessionData.webhookData) {
      console.log('[RedirectResult] ⏳ URL not ready: No webhook data yet (waiting for PrivateID response)');
      return;
    }

    const status = sessionData.status;

    if (status !== 'SUCCESS' && status !== 'FAILED') {
      console.log('[RedirectResult] ⏳ URL not ready: Status is', status, '(not final)');
      return;
    }

    // Check if we've already added UUID to URL
    if (searchParams.get('uuid') || searchParams.get('status')) {
      console.log('[RedirectResult] ℹ️  UUID/status already in URL, skipping');
      return;
    }

    // All conditions met! Add UUID or status to URL
    const uuid = sessionData.webhookData.puid;
    const errorMessage = status === 'FAILED'
      ? sessionData.webhookData?.message || sessionData.webhookData?.errors?.[0]?.message
      : undefined;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ ADDING UUID TO URL - WEBVIEW READY TO CLOSE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('Verification Status:', status);
    console.log('UUID:', uuid || 'N/A');
    console.log('Reason from URL:', reason);
    if (errorMessage) {
      console.log('Error Message:', errorMessage);
    }
    console.log('Session ID:', sessionData.sessionId);
    console.log('');

    // Update URL with status and result data
    const newParams = new URLSearchParams(searchParams.toString());

    if (status === 'SUCCESS' && uuid) {
      newParams.set('status', 'success');
      newParams.set('uuid', uuid);
      console.log('📝 Adding status=success and uuid to URL:', uuid);
    } else if (status === 'FAILED') {
      newParams.set('status', 'failed');
      if (errorMessage) {
        newParams.set('error', errorMessage);
      }
      console.log('📝 Adding status=failed and error to URL');
    }

    // Update URL without page reload
    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.replaceState({}, '', newUrl);

    console.log('✅ URL updated:', newUrl);
    console.log('');
    console.log('💡 Native app can now detect status parameter and close the webview');
    console.log('═══════════════════════════════════════════════════════════');
  }, [reason, sessionData, loading, searchParams]);

  // Poll for updates every 2 seconds until webhook data arrives
  useEffect(() => {
    if (!sessionId || !loading || error) {
      return;
    }

    const interval = setInterval(() => {
      fetchSession();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [sessionId, loading, error, fetchSession]);

  // Fallback: Poll PrivateID directly after 10 seconds if no final result
  useEffect(() => {
    if (!sessionId || !loading || error || hasTriggeredFallback) {
      return;
    }

    const timeElapsed = Date.now() - startTime;
    const timeToWait = 10000 - timeElapsed; // 10 seconds total

    if (timeToWait <= 0) {
      // Already past 10 seconds, trigger immediately
      triggerFallbackPolling();
      return;
    }

    // Trigger after remaining time
    const timeout = setTimeout(() => {
      console.log('[RedirectResult] 10 seconds elapsed, triggering fallback polling...');
      triggerFallbackPolling();
    }, timeToWait);

    return () => clearTimeout(timeout);
  }, [sessionId, loading, error, hasTriggeredFallback, startTime, triggerFallbackPolling]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="font-semibold text-lg mb-2 text-red-900 dark:text-red-200">
              Error
            </h2>
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>

          <Link
            href="/redirect-flow"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </Link>
        </div>
      </main>
    );
  }

  // Show loading spinner if no session data yet
  if (!sessionData) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="max-w-2xl w-full space-y-6 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Waiting for verification results...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Polling for webhook data. This may take a few moments after you complete verification.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Session ID: <span className="font-mono text-xs">{sessionId}</span>
          </p>
        </div>
      </main>
    );
  }

  const isWaitingForFinalResult = loading && (sessionData.status === 'PENDING' || sessionData.status === 'IN_PROGRESS');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <Link
            href="/redirect-flow"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Start New Verification
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Verification Results
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Redirect Flow - Results received via webhook
          </p>
        </div>

        {/* Loading Banner - Show while waiting for final result */}
        {isWaitingForFinalResult && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                  Waiting for final verification result...
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  {hasTriggeredFallback
                    ? 'Fetching directly from PrivateID (fallback mode)...'
                    : `Polling for webhook updates every 2 seconds. Current status: ${sessionData.status}`}
                </p>
                {!hasTriggeredFallback && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Will fetch directly from PrivateID if webhook takes longer than 10 seconds
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <ResultDisplay sessionData={sessionData} />

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Link
            href="/redirect-flow"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Start New Verification
          </Link>
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-gray-100"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function RedirectResult() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
          <div className="max-w-2xl w-full space-y-6 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              Loading...
            </h2>
          </div>
        </main>
      }
    >
      <RedirectResultContent />
    </Suspense>
  );
}
