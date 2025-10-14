import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import fs from 'fs';
import path from 'path';

// File-based storage for FAQs
const FAQS_FILE = path.join(process.cwd(), 'data', 'faqs.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

// Helper function to read FAQs from file
function readFAQs(): any[] {
  try {
    if (fs.existsSync(FAQS_FILE)) {
      const data = fs.readFileSync(FAQS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading FAQs file:', error);
  }
  return [];
}

// Helper function to write FAQs to file
function writeFAQs(faqs: any[]): void {
  try {
    fs.writeFileSync(FAQS_FILE, JSON.stringify(faqs, null, 2));
  } catch (error) {
    console.error('Error writing FAQs file:', error);
  }
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    const faqs = readFAQs();
    return NextResponse.json(faqs);
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

      const faqs = readFAQs();
      const newFAQ = {
        id: Date.now().toString(),
        question,
        answer,
        category: category || 'General',
        createdAt: new Date().toISOString(),
      };

      faqs.push(newFAQ);
      writeFAQs(faqs);
      return NextResponse.json(newFAQ, { status: 201 });
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

      const faqs = readFAQs();
      const faqIndex = faqs.findIndex((f: any) => f.id === id);
      if (faqIndex === -1) {
        return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
      }

      faqs[faqIndex] = { ...faqs[faqIndex], ...updates };
      writeFAQs(faqs);
      return NextResponse.json(faqs[faqIndex]);
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
        return NextResponse.json({ error: 'FAQ ID required' }, { status: 400 });
      }

      const faqs = readFAQs();
      const faqIndex = faqs.findIndex((f: any) => f.id === id);
      if (faqIndex === -1) {
        return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
      }

      faqs.splice(faqIndex, 1);
      writeFAQs(faqs);
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  });
}
