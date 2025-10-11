import { NextRequest, NextResponse } from 'next/server';
import { generateAutoreply } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userMessage, campaignId, contactId } = body;

    if (!userMessage || !campaignId || !contactId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user has already replied to this contact (prevent AI from responding after human interaction)
    const existingRepliesResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/replies`);
    const existingReplies = existingRepliesResponse.ok ? await existingRepliesResponse.json() : [];

    const hasUserReplied = existingReplies.some((reply: any) =>
      reply.contactId === contactId && !reply.isAIResponded
    );

    if (hasUserReplied) {
      return NextResponse.json({
        response: null,
        shouldReply: false,
        message: "User has already replied to this contact - AI will not respond"
      });
    }

    // Fetch FAQs for the campaign/company
    // In a real implementation, this would be stored per user/company
    const faqsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/faqs`);
    const faqs = faqsResponse.ok ? await faqsResponse.json() : [];

    // Temporary: Simple response for testing
    let aiResponse = null;
    if (userMessage.toLowerCase().includes('where') || userMessage.toLowerCase().includes('location')) {
      aiResponse = "We are located in Nairobi, Kenya. You can visit us at our office in Westlands.";
    } else {
      aiResponse = "Thank you for your message. How can we help you today?";
    }

    // Generate AI response
    // const aiResult = await generateAutoreply(userMessage, faqs);

    // if (!aiResult.success) {
    //   return NextResponse.json({ error: 'Failed to generate AI response' }, { status: 500 });
    // }

    // // Check if AI should reply based on FAQ availability
    // if (!aiResult.shouldReply) {
    //   return NextResponse.json({
    //     response: null,
    //     shouldReply: false,
    //     message: aiResult.message || "No relevant information found"
    //   });
    // }

    // const aiResponse = aiResult.data;

    return NextResponse.json({
      response: aiResponse,
      success: true
    });
  } catch (error) {
    console.error('Error generating autoreply:', error);
    return NextResponse.json({ error: 'Failed to generate autoreply' }, { status: 500 });
  }
}