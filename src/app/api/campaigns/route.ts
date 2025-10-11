import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// File-based storage for campaigns
const CAMPAIGNS_FILE = path.join(process.cwd(), 'data', 'campaigns.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

// Helper function to read campaigns from file
function readCampaigns(): any[] {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      const data = fs.readFileSync(CAMPAIGNS_FILE, 'utf8');
      const campaigns = JSON.parse(data);

      // Migrate old 'contacts' field to 'selectedContacts' for backward compatibility
      return campaigns.map((campaign: any) => {
        if (campaign.contacts && !campaign.selectedContacts) {
          campaign.selectedContacts = campaign.contacts;
          delete campaign.contacts;
        }
        return campaign;
      });
    }
  } catch (error) {
    console.error('Error reading campaigns file:', error);
  }
  return [];
}

// Helper function to write campaigns to file
function writeCampaigns(campaigns: any[]): void {
  try {
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
  } catch (error) {
    console.error('Error writing campaigns file:', error);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  const campaigns = readCampaigns();
  if (id) {
    const campaign = campaigns.find((c: any) => c.id === id);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    return NextResponse.json(campaign);
  }

  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaigns = readCampaigns();
    const newCampaign = {
      id: Date.now().toString(),
      ...body,
      createdAt: new Date().toISOString(),
      replies: [],
      replyStats: {
        totalReplies: 0,
        positive: 0,
        negative: 0,
        neutral: 0,
      },
    };

    // Ensure the field name matches frontend expectations
    if (newCampaign.contacts && !newCampaign.selectedContacts) {
      newCampaign.selectedContacts = newCampaign.contacts;
      delete newCampaign.contacts;
    }

    campaigns.push(newCampaign);
    writeCampaigns(campaigns);
    return NextResponse.json(newCampaign, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex((c: any) => c.id === id);
    if (campaignIndex === -1) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    campaigns[campaignIndex] = { ...campaigns[campaignIndex], ...updates };
    writeCampaigns(campaigns);
    return NextResponse.json(campaigns[campaignIndex]);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Campaign ID required' }, { status: 400 });
    }

    const campaigns = readCampaigns();
    const campaignIndex = campaigns.findIndex((c: any) => c.id === id);
    if (campaignIndex === -1) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    campaigns.splice(campaignIndex, 1);
    writeCampaigns(campaigns);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}