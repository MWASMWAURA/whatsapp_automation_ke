import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withAuth } from '@/lib/middleware';

// File-based storage for contacts
const CONTACTS_FILE = path.join(process.cwd(), 'data', 'contacts.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

// Helper function to read contacts from file
function readContacts(): any[] {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading contacts file:', error);
  }
  // Return default contacts if file doesn't exist
  return [
    {
      id: '1',
      name: 'John Doe',
      title: 'CEO',
      phone: '+1234567890',
      tags: ['VIP', 'Tech'],
    },
    {
      id: '2',
      name: 'Jane Smith',
      title: 'Marketing Manager',
      phone: '+1234567891',
      tags: ['Marketing'],
    },
    {
      id: '3',
      name: 'Bob Johnson',
      title: 'Sales Rep',
      phone: '+1234567892',
      tags: ['Sales'],
    },
  ];
}

// Helper function to write contacts to file
function writeContacts(contacts: any[]): void {
  try {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
  } catch (error) {
    console.error('Error writing contacts file:', error);
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    // Return contacts for the authenticated user only
    const contacts = readContacts();
    const userContacts = contacts.filter((contact: any) => contact.userId === user.userId);
    return NextResponse.json(userContacts);
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const contacts = readContacts();
      const newContact = {
        id: Date.now().toString(),
        ...body,
        userId: user.userId,
      };

      contacts.push(newContact);
      writeContacts(contacts);
      return NextResponse.json(newContact, { status: 201 });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const { id, ...updates } = body;

      const contacts = readContacts();
      const contactIndex = contacts.findIndex((c: any) => c.id === id && c.userId === user.userId);
      if (contactIndex === -1) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }

      contacts[contactIndex] = { ...contacts[contactIndex], ...updates };
      writeContacts(contacts);
      return NextResponse.json(contacts[contactIndex]);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
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

      const contacts = readContacts();
      const contactIndex = contacts.findIndex((c: any) => c.id === id && c.userId === user.userId);
      if (contactIndex === -1) {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
      }

      contacts.splice(contactIndex, 1);
      writeContacts(contacts);
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  });
}