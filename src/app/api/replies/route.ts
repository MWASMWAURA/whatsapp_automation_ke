import { NextRequest, NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/ai';
import fs from 'fs';
import path from 'path';

// Helper to read pending replies
function readPendingReplies(): any[] {
  try {
    const pendingFile = path.join(process.cwd(), 'data', 'pending-replies.json');
    if (fs.existsSync(pendingFile)) {
      const data = fs.readFileSync(pendingFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading pending replies:', error);
  }
  return [];
}

// Helper to write pending replies
function writePendingReplies(replies: any[]): void {
  try {
    const pendingFile = path.join(process.cwd(), 'data', 'pending-replies.json');
    const dataDir = path.dirname(pendingFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(pendingFile, JSON.stringify(replies, null, 2));
  } catch (error) {
    console.error('Error writing pending replies:', error);
  }
}

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

    // Check if this is a pending reply storage request
    if (body.replyId && body.phone && body.message) {
      // Handle pending reply storage
      const { replyId, phone, message, timestamp, attemptCount } = body;

      const pendingReplies = readPendingReplies();

      // Check if this reply is already pending
      const existingIndex = pendingReplies.findIndex((p: any) => p.replyId === replyId);

      if (existingIndex >= 0) {
        // Update existing pending reply
        pendingReplies[existingIndex] = {
          ...pendingReplies[existingIndex],
          message,
          timestamp: timestamp || new Date().toISOString(),
          attemptCount: (pendingReplies[existingIndex].attemptCount || 0) + 1
        };
      } else {
        // Add new pending reply
        pendingReplies.push({
          replyId,
          phone,
          message,
          timestamp: timestamp || new Date().toISOString(),
          attemptCount: attemptCount || 1
        });
      }

      writePendingReplies(pendingReplies);

      return NextResponse.json({
        success: true,
        message: 'Pending reply stored for retry'
      }, { status: 201 });
    } else {
      // Handle normal reply creation
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
    }
  } catch (error) {
    console.error('Error processing reply:', error);
    return NextResponse.json({ error: 'Failed to process reply' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isAIResponded, aiResponse, isHumanResponded, humanResponse, aiResponseTime } = body;

    const replies = readReplies();
    const replyIndex = replies.findIndex((r: any) => r.id === id);
    if (replyIndex === -1) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
    }

    replies[replyIndex] = {
      ...replies[replyIndex],
      isAIResponded: isAIResponded ?? replies[replyIndex].isAIResponded,
      aiResponse: aiResponse ?? replies[replyIndex].aiResponse,
      isHumanResponded: isHumanResponded ?? replies[replyIndex].isHumanResponded,
      humanResponse: humanResponse ?? replies[replyIndex].humanResponse,
      aiResponseTime: aiResponseTime ?? replies[replyIndex].aiResponseTime,
    };

    writeReplies(replies);
    return NextResponse.json(replies[replyIndex]);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
