import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const faqs = await db.getFAQs(parseInt(user.userId));
      return NextResponse.json(faqs);
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const { question, answer, category } = body;

      if (!question || !answer) {
        return NextResponse.json({ error: 'Question and answer are required' }, { status: 400 });
      }

      const newFAQ = await db.createFAQ(parseInt(user.userId), {
        question,
        answer,
        category: category || 'General'
      });

      return NextResponse.json(newFAQ, { status: 201 });
    } catch (error) {
      console.error('Error creating FAQ:', error);
      return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const { id, ...updates } = body;

      const updatedFAQ = await db.updateFAQ(id, parseInt(user.userId), updates);
      return NextResponse.json(updatedFAQ);
    } catch (error) {
      console.error('Error updating FAQ:', error);
      if (error.message === 'FAQ not found') {
        return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'FAQ ID required' }, { status: 400 });
      }

      await db.deleteFAQ(id, parseInt(user.userId));
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
    }
  });
}
