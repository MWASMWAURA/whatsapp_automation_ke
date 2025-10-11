import { NextRequest, NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/ai';
import fs from 'fs';
import path from 'path';

// File-based storage for replies
const REPLIES_FILE = path.join(process.cwd(), 'data', 'replies.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

// Helper function to read replies from file
function readReplies(): any[] {
  try {
    if (fs.existsSync(REPLIES_FILE)) {
      const data = fs.readFileSync(REPLIES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading replies file:', error);
  }
  return [];
}

// Helper function to write replies to file
function writeReplies(replies: any[]): void {
  try {
    fs.writeFileSync(REPLIES_FILE, JSON.stringify(replies, null, 2));
  } catch (error) {
    console.error('Error writing replies file:', error);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaignId');
  const campaignIds = searchParams.get('campaignIds');

  const replies = readReplies();
  if (campaignIds) {
    const ids = campaignIds.split(',');
    const campaignReplies = replies.filter((reply: any) => ids.includes(reply.campaignId));
    return NextResponse.json(campaignReplies);
  } else if (campaignId) {
    const campaignReplies = replies.filter((reply: any) => reply.campaignId === campaignId);
    return NextResponse.json(campaignReplies);
  }

  return NextResponse.json(replies);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { campaignId, contactId, message } = body;

    if (!campaignId || !contactId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Analyze sentiment of the reply
    const sentimentResult = await analyzeSentiment(message);

    const replies = readReplies();
    const newReply = {
      id: Date.now().toString(),
      campaignId,
      contactId,
      message,
      sentiment: sentimentResult.success ? sentimentResult.data?.sentiment : 'neutral',
      timestamp: new Date().toISOString(),
      isAIResponded: false,
      aiResponse: null,
    };

    replies.push(newReply);
    writeReplies(replies);
    return NextResponse.json(newReply, { status: 201 });
  } catch (error) {
    console.error('Error processing reply:', error);
    return NextResponse.json({ error: 'Failed to process reply' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isAIResponded, aiResponse } = body;

    const replies = readReplies();
    const replyIndex = replies.findIndex((r: any) => r.id === id);
    if (replyIndex === -1) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    replies[replyIndex] = {
      ...replies[replyIndex],
      isAIResponded: isAIResponded ?? replies[replyIndex].isAIResponded,
      aiResponse: aiResponse ?? replies[replyIndex].aiResponse,
    };

    writeReplies(replies);
    return NextResponse.json(replies[replyIndex]);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}