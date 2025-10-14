import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from './auth';

export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, user: any) => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    return handler(request, user);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

// Helper function to check if user is authenticated
export async function requireAuth(request: NextRequest): Promise<any> {
  const user = await authenticateRequest(request);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}