const { Pool } = require('pg');

// Create a pool instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon DB
  }
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create contacts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        phone VARCHAR(50) NOT NULL,
        tags TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create campaigns table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        selected_contacts INTEGER[],
        scheduled_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        autoreply_enabled BOOLEAN DEFAULT FALSE,
        reply_stats JSONB DEFAULT '{"totalReplies": 0, "positive": 0, "negative": 0, "neutral": 0}'
      );
    `);

    // Create replies table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS replies (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        sentiment VARCHAR(50) DEFAULT 'neutral',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_ai_responded BOOLEAN DEFAULT FALSE,
        ai_response TEXT,
        ai_response_time TIMESTAMP,
        is_human_responded BOOLEAN DEFAULT FALSE,
        human_response TEXT
      );
    `);

    // Create faqs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS faqs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        category VARCHAR(255) DEFAULT 'General',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create pending_replies table for failed message retries
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_replies (
        id SERIAL PRIMARY KEY,
        reply_id INTEGER REFERENCES replies(id) ON DELETE CASCADE,
        phone VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        attempt_count INTEGER DEFAULT 1
      );
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

// Helper functions for database operations
const db = {
  // Users
  async createUser(email, passwordHash, name) {
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [email, passwordHash, name]
    );
    return result.rows[0];
  },

  async getUserByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  },

  async getUserById(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },

  // Contacts
  async getContacts(userId) {
    const result = await pool.query('SELECT * FROM contacts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows;
  },

  async createContact(userId, contact) {
    const result = await pool.query(
      'INSERT INTO contacts (user_id, name, title, phone, tags) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, contact.name, contact.title, contact.phone, contact.tags]
    );
    return result.rows[0];
  },

  async updateContact(id, userId, updates) {
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
    values.push(id, userId);

    const result = await pool.query(
      `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteContact(id, userId) {
    await pool.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2', [id, userId]);
  },

  // Campaigns
  async getCampaigns(userId) {
    const result = await pool.query('SELECT * FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows;
  },

  async getCampaign(id, userId) {
    const result = await pool.query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [id, userId]);
    return result.rows[0];
  },

  async createCampaign(userId, campaign) {
    const result = await pool.query(
      'INSERT INTO campaigns (user_id, name, message, selected_contacts, scheduled_at, status, autoreply_enabled) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [userId, campaign.name, campaign.message, campaign.selectedContacts, campaign.scheduledAt, campaign.status, campaign.autoreplyEnabled]
    );
    return result.rows[0];
  },

  async updateCampaign(id, userId, updates) {
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

    values.push(id, userId);

    const result = await pool.query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteCampaign(id, userId) {
    await pool.query('DELETE FROM campaigns WHERE id = $1 AND user_id = $2', [id, userId]);
  },

  // Replies
  async getReplies(campaignId = null) {
    let query = 'SELECT * FROM replies';
    const values = [];

    if (campaignId) {
      query += ' WHERE campaign_id = $1';
      values.push(campaignId);
    }

    query += ' ORDER BY timestamp DESC';

    const result = await pool.query(query, values);
    return result.rows;
  },

  async getRepliesByCampaignIds(campaignIds) {
    const result = await pool.query('SELECT * FROM replies WHERE campaign_id = ANY($1) ORDER BY timestamp DESC', [campaignIds]);
    return result.rows;
  },

  async createReply(reply) {
    const result = await pool.query(
      'INSERT INTO replies (campaign_id, contact_id, message, sentiment) VALUES ($1, $2, $3, $4) RETURNING *',
      [reply.campaignId, reply.contactId, reply.message, reply.sentiment]
    );
    return result.rows[0];
  },

  async updateReply(id, updates) {
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

    values.push(id);

    const result = await pool.query(
      `UPDATE replies SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  // FAQs
  async getFAQs(userId) {
    const result = await pool.query('SELECT * FROM faqs WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return result.rows;
  },

  async createFAQ(userId, faq) {
    const result = await pool.query(
      'INSERT INTO faqs (user_id, question, answer, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, faq.question, faq.answer, faq.category]
    );
    return result.rows[0];
  },

  async updateFAQ(id, userId, updates) {
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

    values.push(id, userId);

    const result = await pool.query(
      `UPDATE faqs SET ${fields.join(', ')} WHERE id = $${paramCount - 1} AND user_id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  },

  async deleteFAQ(id, userId) {
    await pool.query('DELETE FROM faqs WHERE id = $1 AND user_id = $2', [id, userId]);
  },

  // Pending replies
  async getPendingReplies() {
    const result = await pool.query('SELECT * FROM pending_replies ORDER BY timestamp ASC');
    return result.rows;
  },

  async createPendingReply(pendingReply) {
    const result = await pool.query(
      'INSERT INTO pending_replies (reply_id, phone, message, attempt_count) VALUES ($1, $2, $3, $4) RETURNING *',
      [pendingReply.replyId, pendingReply.phone, pendingReply.message, pendingReply.attemptCount || 1]
    );
    return result.rows[0];
  },

  async updatePendingReply(id, updates) {
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
  },

  async deletePendingReply(id) {
    await pool.query('DELETE FROM pending_replies WHERE id = $1', [id]);
  }
};

module.exports = { pool, initializeDatabase, db };