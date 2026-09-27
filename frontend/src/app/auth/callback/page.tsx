'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const supabase = getSupabaseBrowser();

        // Get session from URL hash (Supabase stores tokens there)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Failed to get session');
          return;
        }

        if (!session) {
          // Try to exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href.split('code=')[1]?.split('&')[0] || ''
          );

          if (exchangeError) {
            console.error('Exchange error:', exchangeError);
            setError('Authentication failed');
            return;
          }
        }

        // Get the session again after exchange
        const { data: { session: newSession } } = await supabase.auth.getSession();

        if (!newSession?.user) {
          setError('No user session');
          return;
        }

        // Call our API to create JWT and set cookie
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newSession.user.email,
            name: newSession.user.user_metadata?.full_name || newSession.user.email?.split('@')[0],
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to authenticate');
          return;
        }

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err) {
        console.error('Callback error:', err);
        setError('An unexpected error occurred');
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="text-primary hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
