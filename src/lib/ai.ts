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
    // Enhanced phone cleaning logic for Kenya numbers
    const cleanPhoneLocally = (phoneStr: string): string => {
      if (!phoneStr) return '';

      // Convert to string and remove all non-numeric characters except spaces and hyphens initially
      let cleaned = String(phoneStr).replace(/[^\d\s\-\(\)\+]/g, '');
      const numericOnly = cleaned.replace(/\D/g, '');

      // If it already starts with any valid country code (3 digits), keep as is
      if (/^(254|255|256|257|258|259|260|261|262|263|264|265|266|267|268|269|27[0-9]|2[89][0-9]|3[0-9][0-9])/.test(numericOnly)) {
        cleaned = numericOnly;
      }
      // Handle Kenya-specific formats
      // If it starts with 7, 1, or 0 followed by 8-9 digits, add 254 prefix
      else if (/^(7|1|0)\d{8,9}$/.test(numericOnly)) {
        // Special handling for Excel numbers that start with 1 instead of 01
        // If it starts with 1 and has 9 digits total, it's likely a Kenyan number missing the 0
        if (numericOnly.startsWith('1') && numericOnly.length === 9) {
          cleaned = '254' + numericOnly; // Add 254 prefix for numbers like 111234234 (was 0111234234)
        } else {
          cleaned = '254' + numericOnly.substring(numericOnly.length - 9);
        }
      }
      // If it starts with +254, keep it but remove the +
      else if (cleaned.startsWith('+254')) {
        cleaned = cleaned.substring(1);
      }
      // If it starts with 254, keep as is
      else if (cleaned.startsWith('254')) {
        // Keep as is
      }
      // If it starts with + followed by other country codes, keep the format but remove +
      else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
      }

      // Final cleanup: remove all non-numeric characters
      return cleaned.replace(/\D/g, '');
    };

    const localCleaned = cleanPhoneLocally(phone);

    // Still call the backend for additional AI processing if needed
    const response = await fetch(`${BACKEND_URL}/api/ai/clean-phone-number`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: localCleaned }),
    });

    if (!response.ok) {
      // If backend fails, return the local cleaning result
      return {
        success: true,
        data: localCleaned,
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      data: data.data || localCleaned,
      error: data.error,
      shouldReply: data.shouldReply,
      message: data.message,
    };
  } catch (error) {
    console.error('AI phone cleaning error:', error);
    // Fallback to local cleaning
    const fallbackClean = (phoneStr: string): string => {
      if (!phoneStr) return '';
      let cleaned = String(phoneStr).replace(/[^\d\s\-\(\)\+]/g, '');
      const numericOnly = cleaned.replace(/\D/g, '');

      if (/^(7|1|0)\d{8,9}$/.test(numericOnly)) {
        // Special handling for Excel numbers that start with 1 instead of 01
        if (numericOnly.startsWith('1') && numericOnly.length === 9) {
          cleaned = '2540' + numericOnly; // Add 2540 prefix for numbers like 123456789
        } else {
          cleaned = '254' + numericOnly.substring(numericOnly.length - 9);
        }
      } else if (cleaned.startsWith('+254')) {
        cleaned = cleaned.substring(1);
      } else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
      }
      return cleaned.replace(/\D/g, '');
    };

    return {
      success: true,
      data: fallbackClean(phone),
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
  companyInfo?: string,
  contactName?: string
): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/generate-autoreply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userMessage, faqs, companyInfo, contactName }),
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