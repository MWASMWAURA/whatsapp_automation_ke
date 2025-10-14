import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { db } from '@/lib/database';

export async function GET(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (id) {
        const campaign = await db.getCampaign(id, parseInt(user.userId));
        if (!campaign) {
          return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }
        return NextResponse.json(campaign);
      }

      const campaigns = await db.getCampaigns(parseInt(user.userId));
      return NextResponse.json(campaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const campaignData = {
        ...body,
        replies: [],
        replyStats: {
          totalReplies: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
        },
      };

      // Ensure the field name matches database expectations
      if (campaignData.contacts && !campaignData.selectedContacts) {
        campaignData.selectedContacts = campaignData.contacts;
        delete campaignData.contacts;
      }

      const newCampaign = await db.createCampaign(parseInt(user.userId), campaignData);
      return NextResponse.json(newCampaign, { status: 201 });
    } catch (error) {
      console.error('Error creating campaign:', error);
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const body = await request.json();
      const { id, ...updates } = body;

      const updatedCampaign = await db.updateCampaign(id, parseInt(user.userId), updates);
      return NextResponse.json(updatedCampaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      if (error.message === 'Campaign not found') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest) {
  return withAuth(request, async (request, user) => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
      }

      await db.deleteCampaign(id, parseInt(user.userId));
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }
  });
}