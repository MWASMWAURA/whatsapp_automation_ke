import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateAutoreply } from '@/lib/ai';

// Simple similarity scoring function
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.length > 2 && word2.length > 2 && word1 === word2) {
        matches++;
      }
    }
  }

  const totalWords = Math.max(words1.length, words2.length);
  return matches / totalWords;
}

// Find best matching FAQ
function findMatchingFAQ(message: string, faqs: any[]): { faq: any; score: number } | null {
  let bestMatch = null;
  let bestScore = 0.3;

  for (const faq of faqs) {
    const score = calculateSimilarity(message, faq.question);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = faq;
    }
  }

  return bestMatch ? { faq: bestMatch, score: bestScore } : null;
}

// Function to send WhatsApp message via backend
async function sendWhatsAppMessage(
  contactPhone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/send-message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: contactPhone,
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Failed to send message',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper to read replies from file storage
function readReplies(): any[] {
  try {
    const repliesFile = path.join(process.cwd(), 'data', 'replies.json');
    if (fs.existsSync(repliesFile)) {
      const data = fs.readFileSync(repliesFile, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading replies:', error);
  }
  return [];
}

// Helper to update replies in file storage
function updateReplies(replies: any[]): void {
  try {
    const repliesFile = path.join(process.cwd(), 'data', 'replies.json');
    const dataDir = path.dirname(repliesFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(repliesFile, JSON.stringify(replies, null, 2));
  } catch (error) {
    console.error('Error updating replies:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userMessage, campaignId, contactId, contactPhone, contactName } = body;

    if (!userMessage || !campaignId || !contactId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If contactPhone not provided, fetch it from contacts API
    let phone = contactPhone;
    let fetchedContactName = contactName || '';
    if (!phone) {
      const contactsResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/contacts`);
      const contacts = contactsResponse.ok ? await contactsResponse.json() : [];
      const contact = contacts.find((c: any) => c.id === contactId);
      if (contact) {
        phone = contact.phone;
        fetchedContactName = contact.name || '';
      }
    }
    const finalContactName = contactName || fetchedContactName;

    if (!phone) {
      return NextResponse.json(
        { error: 'Could not find contact phone number' },
        { status: 400 }
      );
    }

    // Get all replies
    const replies = readReplies();

    // Check if user has already replied to this contact
    const hasUserReplied = replies.some(
      (reply: any) => reply.contactId === contactId && reply.isHumanResponded
    );

    if (hasUserReplied) {
      return NextResponse.json({
        response: null,
        shouldReply: false,
        message: 'User has already replied - AI will not respond',
      });
    }

    // Fetch FAQs
    const faqsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/faqs`
    );
    const faqs = faqsResponse.ok ? await faqsResponse.json() : [];

    if (faqs.length === 0) {
      return NextResponse.json({
        response: null,
        shouldReply: false,
        message: 'No FAQs configured - cannot auto-reply',
      });
    }

    // Find matching FAQ
    const matchResult = findMatchingFAQ(userMessage, faqs);

    if (!matchResult || matchResult.score < 0.3) {
      return NextResponse.json({
        response: null,
        shouldReply: false,
        message: `No matching FAQ found (best match score: ${matchResult?.score.toFixed(2) || '0.00'})`,
      });
    }

    // FAQ matched - generate personalized AI response
    const companyInfo = `Kenya School of Sales - Professional sales training and development company offering Frontline Sales Program and other training courses.`;
    const aiResult = await generateAutoreply(userMessage, [matchResult.faq], companyInfo, finalContactName);

    let aiResponse: string;
    if (!aiResult.success || !aiResult.data) {
      // Fallback to direct FAQ answer if AI generation fails
      console.warn('AI generation failed, using direct FAQ answer:', aiResult.error);
      aiResponse = matchResult.faq.answer;
    } else {
      aiResponse = aiResult.data;
    }

    // SEND THE MESSAGE TO CONTACT VIA WHATSAPP
    const sendResult = await sendWhatsAppMessage(phone, aiResponse);

    if (!sendResult.success) {
      console.error('Failed to send WhatsApp message:', sendResult.error);

      // Store for retry when connection is restored
      const pendingReplyData = {
        replyId: replies.find((r: any) => r.campaignId === campaignId && r.contactId === contactId)?.id,
        phone: phone,
        message: aiResponse,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      };

      // Add to pending replies (this will be handled by backend reconnection logic)
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/store-pending-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingReplyData)
        });
      } catch (storeError) {
        console.error('Failed to store pending reply:', storeError);
      }

      // Still return success to UI, but indicate message wasn't sent
      return NextResponse.json({
        response: aiResponse,
        success: true,
        messageSent: false,
        sendError: sendResult.error,
        matchScore: matchResult.score,
        matchedFAQ: matchResult.faq.question,
        queuedForRetry: true
      });
    }

    // Update the reply record to mark as AI responded
    const replyIndex = replies.findIndex(
      (r: any) => r.campaignId === campaignId && r.contactId === contactId
    );

    if (replyIndex !== -1) {
      replies[replyIndex] = {
        ...replies[replyIndex],
        isAIResponded: true,
        aiResponse: aiResponse,
        aiResponseTime: new Date().toISOString(),
      };
      updateReplies(replies);
    }

    return NextResponse.json({
      response: aiResponse,
      success: true,
      messageSent: true,
      matchScore: matchResult.score,
      matchedFAQ: matchResult.faq.question,
    });
  } catch (error) {
    console.error('Error generating autoreply:', error);
    return NextResponse.json(
      { error: 'Failed to generate autoreply' },
      { status: 500 }
    );
  }
}