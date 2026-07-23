require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Test DB connection
pool.query('SELECT NOW()').then(() => {
  console.log('✓ Connected to Supabase Postgres');
}).catch(err => {
  console.error('✗ DB connection failed:', err.message);
});

// ============================================================
// HEALTH
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

// ============================================================
// LISTINGS — CRUD
// ============================================================

// GET /api/listings
app.get('/api/listings', async (req, res) => {
  try {
    const { q, type, status = 'active', city, min_price, max_price, limit = 20, offset = 0 } = req.query;
    
    let where = ['status = $1'];
    const params = [status];
    let idx = 2;

    if (q) { where.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`); params.push(`%${q}%`); idx++; }
    if (type) { where.push(`property_type = $${idx}`); params.push(type); idx++; }
    if (city) { where.push(`city ILIKE $${idx}`); params.push(`%${city}%`); idx++; }
    if (min_price) { where.push(`price >= $${idx}`); params.push(min_price); idx++; }
    if (max_price) { where.push(`price <= $${idx}`); params.push(max_price); idx++; }

    const query = `
      SELECT * FROM listings
      WHERE ${where.join(' AND ')}
      ORDER BY is_featured DESC, created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    res.json({ listings: result.rows, count: result.rows.length });
  } catch (err) {
    console.error('GET /api/listings error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/listings/:id
app.get('/api/listings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM listings WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json({ listing: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/listings (admin/agent)
app.post('/api/listings', async (req, res) => {
  try {
    const { title, description, price, property_type, status, bedrooms, bathrooms, square_feet, address, city, country, images } = req.body;
    
    const result = await pool.query(
      `INSERT INTO listings (title, description, price, property_type, status, bedrooms, bathrooms, square_feet, address, city, country, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [title, description, price, property_type || 'other', status || 'active', bedrooms, bathrooms, square_feet, address, city, country, images || []]
    );
    res.status(201).json({ listing: result.rows[0] });
  } catch (err) {
    console.error('POST /api/listings error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// CONTACTS
// ============================================================
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, email, phone, subject, message, listing_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO contacts (name, email, phone, subject, message, listing_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, email, phone, subject, message, listing_id || null]
    );

    // Log activity
    await pool.query('INSERT INTO activities (action, entity_type, entity_id) VALUES ($1, $2, $3)', 
      ['contact_created', 'contact', result.rows[0].id]);

    res.status(201).json({ contact: result.rows[0], message: 'Contact saved. We will respond within 48 hours.' });
  } catch (err) {
    console.error('POST /api/contacts error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/contacts (admin)
app.get('/api/contacts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100');
    res.json({ contacts: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// SUBSCRIBERS
// ============================================================
app.post('/api/subscribers', async (req, res) => {
  try {
    const { email, name, preferences } = req.body;
    
    const result = await pool.query(
      `INSERT INTO subscribers (email, name, preferences) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, preferences = EXCLUDED.preferences RETURNING *`,
      [email, name || '', preferences || {}]
    );

    res.status(201).json({ subscriber: result.rows[0], message: 'Subscribed successfully.' });
  } catch (err) {
    console.error('POST /api/subscribers error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// STATS
// ============================================================
app.get('/api/stats', async (req, res) => {
  try {
    const listings = await pool.query('SELECT COUNT(*) FROM listings WHERE status = $1', ['active']);
    const contacts = await pool.query('SELECT COUNT(*) FROM contacts');
    const countries = await pool.query('SELECT COUNT(DISTINCT country) FROM listings');
    
    res.json({
      listings: parseInt(listings.rows[0].count),
      inquiries: parseInt(contacts.rows[0].count),
      countries: parseInt(countries.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// VIDEO GENERATION (FAL.ai integration placeholder)
// ============================================================
app.post('/api/video/generate', async (req, res) => {
  try {
    const { prompt, style, user_id } = req.body;
    
    const result = await pool.query(
      `INSERT INTO video_projects (user_id, prompt, style, status) VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id || 'anonymous', prompt, style || 'luxury', 'pending']
    );

    // TODO: Integrate FAL.ai when API is available
    // For now, return placeholder
    res.status(202).json({ 
      project: result.rows[0],
      message: 'Video generation queued. FAL.ai integration pending.' 
    });
  } catch (err) {
    console.error('POST /api/video/generate error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ============================================================
// TELEGRAM WEBHOOK
// ============================================================
app.post('/api/webhook/telegram', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const update = JSON.parse(req.body);
    const msg = update.message;
    
    if (msg && msg.text) {
      const chatId = msg.chat.id;
      const text = msg.text.toLowerCase();
      
      // Log to DB
      pool.query('INSERT INTO activities (action, metadata) VALUES ($1, $2)', 
        ['telegram_message', { chatId, text: msg.text }]);
      
      // Simple bot logic
      let reply = 'Thanks for messaging Novagent Realty. How can we help?';
      if (text.includes('listing') || text.includes('property')) reply = 'We have 2,400+ listings across 15 countries. Share your criteria and we will match you.';
      else if (text.includes('price') || text.includes('cost')) reply = 'Our listings range from $500k to $10M+. What is your budget?';
      else if (text.includes('contact') || text.includes('call')) reply = 'Call us at +1-555-0199 or email hello@novagentrealty.com';
      else if (text.includes('hello') || text.includes('hi')) reply = 'Welcome to Novagent Realty. Agent-handled property across 15 countries.';
      
      // Send reply via Telegram API
      const tgToken = process.env.TELEGRAM_BOT_TOKEN;
      if (tgToken) {
        const data = JSON.stringify({ chat_id: chatId, text: reply });
        const options = {
          hostname: 'api.telegram.org',
          path: `/bot${tgToken}/sendMessage`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        };
        https.request(options, (res) => res.on('data', () => {})).end(data);
      }
    }
    
    res.status(200).send('OK');
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.status(500).send('Error');
  }
});

// ============================================================
// WHATSAPP WEBHOOK (placeholder)
// ============================================================
app.post('/api/webhook/whatsapp', express.raw({ type: 'application/json' }), (req, res) => {
  // TODO: Integrate Twilio WhatsApp API
  res.status(200).send('OK');
});

// ============================================================
// VOICE / AUDIO (ElevenLabs integration placeholder)
// ============================================================
app.post('/api/voice/generate', async (req, res) => {
  try {
    const { text, voice_id = '21m00Tcm4TlvDq8ikWAM' } = req.body;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      return res.status(503).json({ error: 'ElevenLabs not configured' });
    }

    // TODO: Integrate ElevenLabs TTS API
    // Placeholder response
    res.status(202).json({ 
      message: 'Voice generation queued',
      text_length: text.length,
      status: 'pending'
    });
  } catch (err) {
    res.status(500).json({ error: 'Voice generation failed' });
  }
});

// ============================================================
// SEARCH / FULLTEXT
// ============================================================
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });
    
    const result = await pool.query(
      `SELECT *, 
       ts_rank(to_tsvector('english', title || ' ' || COALESCE(description,'') || ' ' || COALESCE(city,'')), 
              plainto_tsquery('english', $1)) as rank
       FROM listings
       WHERE to_tsvector('english', title || ' ' || COALESCE(description,'') || ' ' || COALESCE(city,'')) 
             @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT 20`,
      [q]
    );
    
    res.json({ results: result.rows });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================================
// ANALYTICS EVENT
// ============================================================
app.post('/api/analytics/event', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    await pool.query('INSERT INTO activities (action, metadata) VALUES ($1, $2)', 
      [event || 'page_view', data || {}]);
    
    res.status(201).json({ logged: true });
  } catch (err) {
    res.status(500).json({ error: 'Analytics error' });
  }
});

// ============================================================
// START SERVER
// ============================================================
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Novagent Backend running on port ${PORT}`);
  console.log(`✓ API: http://localhost:${PORT}/api`);
  console.log(`✓ DB: ${process.env.DATABASE_URL ? 'connected' : 'not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
});
