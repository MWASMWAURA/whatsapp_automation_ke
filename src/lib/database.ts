import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon DB
  }
});

// Initialize database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

export interface Contact {
  id: string;
  name: string;
  title: string;
  phone: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Reply {
  id: string;
  campaignId: string;
  contactId: string;
  message: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  timestamp: string;
  isAIResponded?: boolean;
  aiResponse?: string;
  aiResponseTime?: string;
  isHumanResponded?: boolean;
  humanResponse?: string;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  contacts: string[];
  selectedContacts?: number[];
  scheduledAt?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed';
  createdAt: string;
  autoreplyEnabled?: boolean;
  replies?: Reply[];
  replyStats?: {
    totalReplies: number;
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
  createdAt: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  category: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

// Database operations
export class Database {
  // Contacts
  static async getContacts(userId: number): Promise<Contact[]> {
    try {
      const result = await pool.query('SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return result.rows.map(row => ({
        id: row.id.toString(),
        name: row.name,
        title: row.title,
        phone: row.phone,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }
  }

  static async createContact(userId: number, contact: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    try {
      const result = await pool.query(
        'INSERT INTO contacts (user_id, name, title, phone, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [userId, contact.name, contact.title, contact.phone, contact.tags]
      );
      const row = result.rows[0];
      return {
        id: row.id.toString(),
        name: row.name,
        title: row.title,
        phone: row.phone,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  static async updateContact(id: string, userId: number, updates: Partial<Contact>): Promise<Contact> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.title !== undefined) {
        fields.push(`title = $${paramCount++}`);
        values.push(updates.title);
      }
      if (updates.phone !== undefined) {
        fields.push(`phone = $${paramCount++}`);
        values.push(updates.phone);
      }
      if (updates.tags !== undefined) {
        fields.push(`tags = $${paramCount++}`);
        values.push(updates.tags);
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(id), userId);

      const result = await pool.query(
        `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Contact not found');
      }

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        name: row.name,
        title: row.title,
        phone: row.phone,
        tags: row.tags || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      console.error('Error updating contact:', error);
      throw error;
    }
  }

  static async deleteContact(id: string, userId: number): Promise<void> {
    try {
      await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2', [parseInt(id), userId]);
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }

  // Campaigns
  static async getCampaigns(userId: number): Promise<Campaign[]> {
    try {
      const result = await pool.query('SELECT * FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return result.rows.map(row => ({
        id: row.id.toString(),
        name: row.name,
        message: row.message,
        contacts: [], // Legacy field, kept for compatibility
        selectedContacts: row.selected_contacts,
        scheduledAt: row.scheduled_at,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        autoreplyEnabled: row.autoreply_enabled,
        replyStats: row.reply_stats
      }));
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  }

  static async getCampaign(id: string, userId: number): Promise<Campaign | null> {
    try {
      const result = await pool.query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [parseInt(id), userId]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        name: row.name,
        message: row.message,
        contacts: [], // Legacy field
        selectedContacts: row.selected_contacts,
        scheduledAt: row.scheduled_at,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        autoreplyEnabled: row.autoreply_enabled,
        replyStats: row.reply_stats
      };
    } catch (error) {
      console.error('Error fetching campaign:', error);
      throw error;
    }
  }

  static async createCampaign(userId: number, campaign: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign> {
    try {
      const result = await pool.query(
        'INSERT INTO campaigns (user_id, name, message, selected_contacts, scheduled_at, status, autoreply_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, campaign.name, campaign.message, campaign.selectedContacts, campaign.scheduledAt, campaign.status, campaign.autoreplyEnabled]
      );
      const row = result.rows[0];
      return {
        id: row.id.toString(),
        name: row.name,
        message: row.message,
        contacts: [], // Legacy field
        selectedContacts: row.selected_contacts,
        scheduledAt: row.scheduled_at,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        autoreplyEnabled: row.autoreply_enabled,
        replyStats: row.reply_stats
      };
    } catch (error) {
      console.error('Error creating campaign:', error);
      throw error;
    }
  }

  static async updateCampaign(id: string, userId: number, updates: Partial<Campaign>): Promise<Campaign> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramCount++}`);
        values.push(updates.name);
      }
      if (updates.message !== undefined) {
        fields.push(`message = $${paramCount++}`);
        values.push(updates.message);
      }
      if (updates.selectedContacts !== undefined) {
        fields.push(`selected_contacts = $${paramCount++}`);
        values.push(updates.selectedContacts);
      }
      if (updates.scheduledAt !== undefined) {
        fields.push(`scheduled_at = $${paramCount++}`);
        values.push(updates.scheduledAt);
      }
      if (updates.status !== undefined) {
        fields.push(`status = $${paramCount++}`);
        values.push(updates.status);
      }
      if (updates.autoreplyEnabled !== undefined) {
        fields.push(`autoreply_enabled = $${paramCount++}`);
        values.push(updates.autoreplyEnabled);
      }
      if (updates.replyStats !== undefined) {
        fields.push(`reply_stats = $${paramCount++}`);
        values.push(JSON.stringify(updates.replyStats));
      }

      values.push(parseInt(id), userId);

      const result = await pool.query(
        `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        name: row.name,
        message: row.message,
        contacts: [], // Legacy field
        selectedContacts: row.selected_contacts,
        scheduledAt: row.scheduled_at,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        autoreplyEnabled: row.autoreply_enabled,
        replyStats: row.reply_stats
      };
    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  }

  static async deleteCampaign(id: string, userId: number): Promise<void> {
    try {
      await pool.query('DELETE FROM campaigns WHERE id = $1 AND user_id = $2', [parseInt(id), userId]);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }

  // Replies
  static async getReplies(campaignId?: string): Promise<Reply[]> {
    try {
      let query = 'SELECT * FROM replies';
      const values = [];

      if (campaignId) {
        query += ' WHERE campaign_id = $1';
        values.push(parseInt(campaignId));
      }

      query += ' ORDER BY timestamp DESC';

      const result = await pool.query(query, values);
      return result.rows.map(row => ({
        id: row.id.toString(),
        campaignId: row.campaign_id.toString(),
        contactId: row.contact_id.toString(),
        message: row.message,
        sentiment: row.sentiment,
        timestamp: row.timestamp.toISOString(),
        isAIResponded: row.is_ai_responded,
        aiResponse: row.ai_response
      }));
    } catch (error) {
      console.error('Error fetching replies:', error);
      throw error;
    }
  }

  static async getRepliesByCampaignIds(campaignIds: string[]): Promise<Reply[]> {
    try {
      const result = await pool.query('SELECT * FROM replies WHERE campaign_id = ANY($1) ORDER BY timestamp DESC', [campaignIds.map(id => parseInt(id))]);
      return result.rows.map(row => ({
        id: row.id.toString(),
        campaignId: row.campaign_id.toString(),
        contactId: row.contact_id.toString(),
        message: row.message,
        sentiment: row.sentiment,
        timestamp: row.timestamp.toISOString(),
        isAIResponded: row.is_ai_responded,
        aiResponse: row.ai_response
      }));
    } catch (error) {
      console.error('Error fetching replies by campaign IDs:', error);
      throw error;
    }
  }

  static async createReply(reply: Omit<Reply, 'id'>): Promise<Reply> {
    try {
      const result = await pool.query(
        'INSERT INTO replies (campaign_id, contact_id, message, sentiment) VALUES ($1, $2, $3, $4) RETURNING *',
        [parseInt(reply.campaignId), parseInt(reply.contactId), reply.message, reply.sentiment]
      );
      const row = result.rows[0];
      return {
        id: row.id.toString(),
        campaignId: row.campaign_id.toString(),
        contactId: row.contact_id.toString(),
        message: row.message,
        sentiment: row.sentiment,
        timestamp: row.timestamp.toISOString(),
        isAIResponded: row.is_ai_responded,
        aiResponse: row.ai_response
      };
    } catch (error) {
      console.error('Error creating reply:', error);
      throw error;
    }
  }

  static async updateReply(id: string, updates: Partial<Reply>): Promise<Reply> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updates.isAIResponded !== undefined) {
        fields.push(`is_ai_responded = $${paramCount++}`);
        values.push(updates.isAIResponded);
      }
      if (updates.aiResponse !== undefined) {
        fields.push(`ai_response = $${paramCount++}`);
        values.push(updates.aiResponse);
      }
      if (updates.aiResponseTime !== undefined) {
        fields.push(`ai_response_time = $${paramCount++}`);
        values.push(updates.aiResponseTime);
      }
      if (updates.isHumanResponded !== undefined) {
        fields.push(`is_human_responded = $${paramCount++}`);
        values.push(updates.isHumanResponded);
      }
      if (updates.humanResponse !== undefined) {
        fields.push(`human_response = $${paramCount++}`);
        values.push(updates.humanResponse);
      }

      values.push(parseInt(id));

      const result = await pool.query(
        `UPDATE replies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('Reply not found');
      }

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        campaignId: row.campaign_id.toString(),
        contactId: row.contact_id.toString(),
        message: row.message,
        sentiment: row.sentiment,
        timestamp: row.timestamp.toISOString(),
        isAIResponded: row.is_ai_responded,
        aiResponse: row.ai_response
      };
    } catch (error) {
      console.error('Error updating reply:', error);
      throw error;
    }
  }

  // FAQs
  static async getFAQs(userId: number): Promise<FAQ[]> {
    try {
      const result = await pool.query('SELECT * FROM faqs WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
      return result.rows.map(row => ({
        id: row.id.toString(),
        question: row.question,
        answer: row.answer,
        category: row.category,
        createdAt: row.created_at.toISOString()
      }));
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      throw error;
    }
  }

  static async createFAQ(userId: number, faq: Omit<FAQ, 'id' | 'createdAt'>): Promise<FAQ> {
    try {
      const result = await pool.query(
        'INSERT INTO faqs (user_id, question, answer, category) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, faq.question, faq.answer, faq.category]
      );
      const row = result.rows[0];
      return {
        id: row.id.toString(),
        question: row.question,
        answer: row.answer,
        category: row.category,
        createdAt: row.created_at.toISOString()
      };
    } catch (error) {
      console.error('Error creating FAQ:', error);
      throw error;
    }
  }

  static async updateFAQ(id: string, userId: number, updates: Partial<FAQ>): Promise<FAQ> {
    try {
      const fields = [];
      const values = [];
      let paramCount = 1;

      if (updates.question !== undefined) {
        fields.push(`question = $${paramCount++}`);
        values.push(updates.question);
      }
      if (updates.answer !== undefined) {
        fields.push(`answer = $${paramCount++}`);
        values.push(updates.answer);
      }
      if (updates.category !== undefined) {
        fields.push(`category = $${paramCount++}`);
        values.push(updates.category);
      }

      values.push(parseInt(id), userId);

      const result = await pool.query(
        `UPDATE faqs SET ${fields.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('FAQ not found');
      }

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        question: row.question,
        answer: row.answer,
        category: row.category,
        createdAt: row.created_at.toISOString()
      };
    } catch (error) {
      console.error('Error updating FAQ:', error);
      throw error;
    }
  }

  static async deleteFAQ(id: string, userId: number): Promise<void> {
    try {
      await pool.query('DELETE FROM faqs WHERE id = $1 AND user_id = $2', [parseInt(id), userId]);
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      throw error;
    }
  }

  // Users
  static async createUser(email: string, passwordHash: string, name?: string): Promise<User> {
    try {
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
        [email, passwordHash, name]
      );
      const row = result.rows[0];
      return {
        id: row.id.toString(),
        email: row.email,
        name: row.name,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async getUserByEmailPassword(email: string, passwordHash: string): Promise<User | null> {
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password_hash = $2', [email, passwordHash]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        email: row.email,
        name: row.name,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error fetching user by email and password:', error);
      throw error;
    }
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        email: row.email,
        name: row.name,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  }

  static async getUserById(id: number): Promise<User | null> {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id.toString(),
        email: row.email,
        name: row.name,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      };
    } catch (error) {
      console.error('Error fetching user by id:', error);
      throw error;
    }
  }

  // Pending replies
  static async getPendingReplies() {
    const result = await pool.query('SELECT * FROM pending_replies ORDER BY timestamp ASC');
    return result.rows;
  }

  static async createPendingReply(pendingReply: { replyId: number; phone: string; message: string; timestamp?: string; attemptCount?: number }) {
    const result = await pool.query(
      'INSERT INTO pending_replies (reply_id, phone, message, attempt_count) VALUES ($1, $2, $3, $4) RETURNING *',
      [pendingReply.replyId, pendingReply.phone, pendingReply.message, pendingReply.attemptCount || 1]
    );
    return result.rows[0];
  }

  static async updatePendingReply(id: number, updates: { attemptCount?: number }) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.attemptCount !== undefined) {
      fields.push(`attempt_count = $${paramCount++}`);
      values.push(updates.attemptCount);
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE pending_replies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async deletePendingReply(id: number) {
    await pool.query('DELETE FROM pending_replies WHERE id = $1', [id]);
  }
}

export const db = Database;