import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const PUBLIC_USER_FIELDS = 'id, username, email, created_at';

// POST /api/auth/google { accessToken }
// The browser finishes Google sign-in with Supabase and sends us the Supabase access token.
// We ask Supabase who that token belongs to, so the email comes from Supabase, never from the browser.
export async function POST(request: NextRequest) {
  try {
    let payload: { accessToken?: unknown };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : '';
    if (!accessToken) {
      return NextResponse.json({ error: 'Sign-in token is missing' }, { status: 400 });
    }

    const { data: verified, error: verifyError } = await supabaseAdmin.auth.getUser(accessToken);
    const googleUser = verified?.user;
    if (verifyError || !googleUser?.email) {
      return NextResponse.json({ error: 'Google sign-in could not be verified' }, { status: 401 });
    }
    if (!googleUser.email_confirmed_at) {
      return NextResponse.json({ error: 'This Google email is not verified' }, { status: 401 });
    }

    const email = googleUser.email.toLowerCase();
    const name =
      (typeof googleUser.user_metadata?.full_name === 'string' && googleUser.user_metadata.full_name.trim()) ||
      email.split('@')[0];

    let { data: existingUser } = await supabaseAdmin
      .from('users')
      .select(PUBLIC_USER_FIELDS)
      .eq('email', email)
      .maybeSingle();

    if (!existingUser) {
      // Usernames are unique; if the Google name is taken, add a few digits.
      for (let attempt = 0; attempt < 5 && !existingUser; attempt++) {
        const username = attempt === 0 ? name : `${name}${Math.floor(1000 + Math.random() * 9000)}`;
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({ username, email, password_hash: 'GOOGLE_OAUTH' })
          .select(PUBLIC_USER_FIELDS)
          .single();

        if (!createError) {
          existingUser = newUser;
        } else if (createError.code !== '23505') {
          console.error('Error creating user:', createError);
          return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
        }
      }

      if (!existingUser) {
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const token = jwt.sign({ userId: existingUser.id, username: existingUser.username }, jwtSecret, { expiresIn: '7d' });

    const response = NextResponse.json({ success: true, user: existingUser });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !process.env.IS_ELECTRON,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Google auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
