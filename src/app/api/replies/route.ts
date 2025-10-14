import { NextRequest, NextResponse } from 'next/server';
import { analyzeSentiment } from '@/lib/ai';
import { withAuth } from '@/lib/middleware';
import { db, Reply } from '@/lib/database';

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const campaignId = searchParams.get('campaignId');
      const campaignIds = searchParams.get('campaignIds');

      if (campaignIds) {
        const ids = campaignIds.split(',');
        const campaignReplies = await db.getRepliesByCampaignIds(ids);
        return NextResponse.json(campaignReplies);
      } else if (campaignId) {
        const campaignReplies = await db.getReplies(campaignId);
        return NextResponse.json(campaignReplies);
      }

      // Return all replies (admin functionality)
      const replies = await db.getReplies();
      return NextResponse.json(replies);
    } catch (error) {
      console.error('Error fetching replies:', error);
      return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();

      // Check if this is a pending reply storage request
      if (body.replyId && body.phone && body.message) {
        // Handle pending reply storage
        const { replyId, phone, message, timestamp, attemptCount } = body;

        await db.createPendingReply({
          replyId: parseInt(replyId),
          phone,
          message,
          timestamp: timestamp || new Date().toISOString(),
          attemptCount: attemptCount || 1
        });

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

        const newReply = await db.createReply({
          campaignId,
          contactId,
          message,
          sentiment: sentimentResult.success ? sentimentResult.data?.sentiment : 'neutral'
        });

        return NextResponse.json(newReply, { status: 201 });
      }
    } catch (error) {
      console.error('Error processing reply:', error);
      return NextResponse.json({ error: 'Failed to process reply' }, { status: 500 });
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const { id, isAIResponded, aiResponse, isHumanResponded, humanResponse, aiResponseTime } = body;

      const updates: Partial<Reply> = {};
      if (isAIResponded !== undefined) updates.isAIResponded = isAIResponded;
      if (aiResponse !== undefined) updates.aiResponse = aiResponse;
      if (isHumanResponded !== undefined) updates.isHumanResponded = isHumanResponded;
      if (humanResponse !== undefined) updates.humanResponse = humanResponse;
      if (aiResponseTime !== undefined) updates.aiResponseTime = aiResponseTime;

      const updatedReply = await db.updateReply(id, updates);
      return NextResponse.json(updatedReply);
    } catch (error) {
      console.error('Error updating reply:', error);
      if (error.message === 'Reply not found') {
        return NextResponse.json({ error: 'Reply not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update reply' }, { status: 500 });
    }
  });
}
