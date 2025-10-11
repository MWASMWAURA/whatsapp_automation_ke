// AI integration for AutoSend Pro via backend
import { BACKEND_URL } from './utils';

export interface AIResponse {
  success: boolean;
  data?: string;
  error?: string;
  shouldReply?: boolean;
  message?: string;
}

export async function standardizeContactName(name: string): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/standardize-contact-name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('AI standardization error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function generateMessageTone(message: string, tone: string): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/generate-message-tone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, tone }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('AI API error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function suggestContactTitle(name: string, context: string): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/suggest-contact-title`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, context }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('AI suggestion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function cleanPhoneNumber(phone: string): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/clean-phone-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
      shouldReply: data.shouldReply,
      message: data.message,
    };
  } catch (error) {
    console.error('AI phone cleaning error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export interface CSVProcessingResponse {
  analysis: string;
  suggestions: string[];
  transformedData?: any[] | null;
}

export async function processCSVData(
  csvData: any[],
  headers: string[],
  userPrompt: string
): Promise<{ success: boolean; data?: CSVProcessingResponse; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/process-csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csvData, headers, userPrompt }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('AI CSV processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export interface SentimentAnalysisResponse {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  explanation?: string;
}

export async function analyzeSentiment(message: string): Promise<{ success: boolean; data?: SentimentAnalysisResponse; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/analyze-sentiment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('AI sentiment analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function generateAutoreply(
  userMessage: string,
  faqs: Array<{ question: string; answer: string }>,
  companyInfo?: string
): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/generate-autoreply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userMessage, faqs, companyInfo }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Backend response:', data);
    return {
      success: data.success,
      data: data.data,
      error: data.error,
      shouldReply: data.shouldReply,
      message: data.message,
    };
  } catch (error) {
    console.error('AI autoreply generation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}