import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/session-status`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching session status:', error);
    return NextResponse.json(
      { hasClient: false, status: 'disconnected', connectionState: null, error: error.message },
      { status: 500 }
    );
  }
}