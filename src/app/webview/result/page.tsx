'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { SessionData } from '@/lib/privateId/types';
import { sendToMaui } from '@/lib/mauiBridge';

function WebViewResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || searchParams.get('session_id');
  const reason = searchParams.get('reason');

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID provided');
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }

      const data = await response.json();
      setSessionData(data);

      // If we have webhook data with final status, add to URL
      if (data.webhookData && (data.status === 'SUCCESS' || data.status === 'FAILED')) {
        addResultToUrl(data);
      }
    } catch (err) {
      console.error('[WebViewResult] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [sessionId]);

  const addResultToUrl = (data: SessionData) => {
    // Check if already added
    if (searchParams.get('status')) {
      return;
    }

    const newParams = new URLSearchParams(searchParams.toString());

    if (data.status === 'SUCCESS' && data.webhookData?.puid) {
      newParams.set('status', 'success');
      newParams.set('uuid', data.webhookData.puid);
      console.log('[WebViewResult] ✅ Adding UUID to URL:', data.webhookData.puid);

      // Send UUID to native via mauiBridge
      console.log('[WebViewResult] 📤 Sending UUID to native via mauiBridge');
      sendToMaui({
        type: 'uuid',
        message: data.webhookData.puid,
        sentAt: new Date().toISOString(),
      });
    } else if (data.status === 'FAILED') {
      newParams.set('status', 'failed');
      const errorMsg = data.webhookData?.message || data.webhookData?.errors?.[0]?.message || 'Verification failed';
      newParams.set('error', errorMsg);
      console.log('[WebViewResult] ❌ Adding failure to URL');

      // Send failure notification to native via mauiBridge
      console.log('[WebViewResult] 📤 Sending failure to native via mauiBridge');
      sendToMaui({
        type: 'verification_complete',
        status: 'failed',
        sessionType: data.sessionType.toLowerCase(),
        message: errorMsg,
        sentAt: new Date().toISOString(),
      });
    }

    const newUrl = `${window.location.pathname}?${newParams.toString()}`;
    window.history.replaceState({}, '', newUrl);

    console.log('═══════════════════════════════════════════');
    console.log('✅ URL UPDATED & MESSAGE SENT TO NATIVE');
    console.log('URL:', newUrl);
    console.log('═══════════════════════════════════════════');
  };

  // Initial fetch
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Poll every 2 seconds if no final result yet
  useEffect(() => {
    if (!sessionId || !sessionData || searchParams.get('status')) {
      return;
    }

    if (sessionData.status === 'SUCCESS' || sessionData.status === 'FAILED') {
      return; // Already final
    }

    const interval = setInterval(fetchSession, 2000);
    return () => clearInterval(interval);
  }, [sessionId, sessionData, searchParams, fetchSession]);

  // Fallback: poll PrivateID after 10s
  useEffect(() => {
    if (!sessionId || !reason || searchParams.get('status')) {
      return;
    }

    const timer = setTimeout(async () => {
      console.log('[WebViewResult] Triggering fallback polling...');
      try {
        await fetch(`/api/sessions/${sessionId}/poll`, { method: 'POST' });
        fetchSession();
      } catch (err) {
        console.error('[WebViewResult] Fallback polling error:', err);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [sessionId, reason, searchParams, fetchSession]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-sm">
          <p className="text-red-800 dark:text-red-200 text-center">{error}</p>
        </div>
      </div>
    );
  }

  const status = sessionData?.status;
  const isComplete = status === 'SUCCESS' || status === 'FAILED';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="text-center space-y-4">
        {!isComplete ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
            <p className="text-gray-700 dark:text-gray-300 text-lg">
              Processing verification...
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Please wait
            </p>
          </>
        ) : (
          <>
            {status === 'SUCCESS' ? (
              <div className="text-green-600 dark:text-green-400">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-xl font-semibold">Success!</p>
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-xl font-semibold">Verification Failed</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {sessionData.webhookData?.message || 'Please try again'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function WebViewResult() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600" />
        </div>
      }
    >
      <WebViewResultContent />
    </Suspense>
  );
}
