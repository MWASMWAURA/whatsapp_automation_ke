import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const contacts = await db.getContacts(user.userId);
      return NextResponse.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const newContact = await db.createContact(parseInt(user.userId), body);
      return NextResponse.json(newContact, { status: 201 });
    } catch (error) {
      console.error('Error creating contact:', error);
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const { id, ...updates } = body;

      const updatedContact = await db.updateContact(id, parseInt(user.userId), updates);
      return NextResponse.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      if (error.message === 'Contact not found') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'Contact ID required' }, { status: 400 });
      }

      await db.deleteContact(id, parseInt(user.userId));
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting contact:', error);
      return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
    }
  });
}