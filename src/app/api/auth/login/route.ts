import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const APP_PASSWORD = process.env.APP_PASSWORD;

if (!APP_PASSWORD) {
  console.error('CRITICAL: APP_PASSWORD environment variable is not set');
}
const AUTH_COOKIE_NAME = 'avencare_auth';
const AUTH_TOKEN = 'authenticated_user_session';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!APP_PASSWORD) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (password !== APP_PASSWORD) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Set auth cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, AUTH_TOKEN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
