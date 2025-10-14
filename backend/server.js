require('dotenv').config();
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');
const puppeteer = require('puppeteer');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const { createCanvas } = require('canvas');

// Function to get browser executable path
function getBrowserExecutablePath() {
  // For SaaS deployment, always use Puppeteer's bundled Chromium
  // This ensures consistency across different environments
  const bundledPath = puppeteer.executablePath();
  console.log('✅ Using Puppeteer bundled Chromium:', bundledPath);
  return bundledPath;
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

let clients = {}; // Map of userId -> client
let qrCodes = {}; // Map of userId -> qrCode
let currentQrs = {}; // Map of userId -> currentQr
let sessionStatuses = {}; // Map of userId -> sessionStatus
let reconnectIntervals = {}; // Map of userId -> reconnectInterval
let isReconnectingMap = {}; // Map of userId -> isReconnecting
let browserLaunchedMap = {}; // Map of userId -> browserLaunched
let validSessions = {}; // Map of userId -> validSession
let pendingReplies = {}; // Map of userId -> pendingReplies array

// Function to convert ASCII QR code to image
function generateAsciiQrImage(qrData) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = createCanvas(400, 400);
      const ctx = canvas.getContext('2d');

      // Set background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 400, 400);

      // Set text properties
      ctx.fillStyle = '#000000';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';

      // Generate ASCII QR and draw it
      let y = 50;
      const lines = [];

      qrcode.generate(qrData, { small: true }, (chunk) => {
        lines.push(chunk);
      });

      // Wait a bit for qrcode.generate to complete
      setTimeout(() => {
        lines.forEach((line, index) => {
          ctx.fillText(line, 200, y + (index * 16));
        });

        // Convert to data URL
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      }, 100);

    } catch (error) {
      reject(error);
    }
  });
}

// Function to start reconnection attempts for a specific user
function startReconnection(userId) {
  if (isReconnectingMap[userId]) return;

  isReconnectingMap[userId] = true;
  console.log(`🔄 Starting automatic reconnection for user ${userId}...`);

  reconnectIntervals[userId] = setInterval(async () => {
    try {
      console.log(`🔄 Attempting to reconnect for user ${userId}...`);

      // Close existing client if it exists
      if (clients[userId]) {
        await clients[userId].close();
        clients[userId] = null;
      }

      // Create new client
      clients[userId] = await wppconnect.create({
        session: `whatsapp-session-${userId}`,
        puppeteer: {
          headless: true,
          protocolTimeout: 60000,
          executablePath: getBrowserExecutablePath(),
          ignoreDefaultArgs: ['--disable-extensions'],
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images',
            // Note: JavaScript must remain enabled for WhatsApp Web to function properly
            '--disable-plugins-discovery',
            '--disable-print-preview',
            '--disable-component-extensions-with-background-pages',
            '--user-data-dir=./temp-chrome-profile-' + userId + '-' + Date.now()
          ]
        },
        catchQR: async (qr) => {
           console.log(`QR received from wppconnect for user ${userId}`);

   // Store the raw QR code as-is
   if (typeof qr === 'object' && qr.code) {
     currentQrs[userId] = qr.code;
   } else if (typeof qr === 'string') {
     currentQrs[userId] = qr;
   } else {
     currentQrs[userId] = JSON.stringify(qr);
   }

   validSessions[userId] = true;
   browserLaunchedMap[userId] = true;
   console.log(`QR code stored successfully for user ${userId}`);
        },
        statusFind: (status) => {
          sessionStatuses[userId] = status;
          console.log(`🟡 Status for user ${userId}:`, status);

          if (status === 'connected' || status === 'isLogged' || status === 'inChat') {
            console.log(`✅ Reconnected successfully for user ${userId}`);
            browserLaunchedMap[userId] = true;
            validSessions[userId] = true;
            isReconnectingMap[userId] = false;
            if (reconnectIntervals[userId]) {
              clearInterval(reconnectIntervals[userId]);
              reconnectIntervals[userId] = null;
            }

            // Process any pending AI replies that failed during disconnection
            if (pendingReplies[userId] && pendingReplies[userId].length > 0) {
              console.log(`🔄 Processing ${pendingReplies[userId].length} pending AI replies for user ${userId}...`);
              processPendingReplies(userId);
            }
          } else if (status === 'browserClose' || status === 'disconnected' || status === 'notLogged') {
            browserLaunchedMap[userId] = false;
            validSessions[userId] = false;
            qrCodes[userId] = null; // Clear invalid QR codes
          }
        },
        autoClose: 3600000,
      });

      console.log(`✅ Reconnection client created successfully for user ${userId}`);

      // Add message listener for autoreply functionality
      clients[userId].onMessage(async (message) => {
        try {
          console.log('📨 Received message:', message.body, 'from:', message.from);

          // Skip messages from ourselves not, groups, or status broadcasts
          if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
            return;
          }

          // Extract phone number from sender (remove @c.us)
          const senderPhone = message.from.replace('@c.us', '');

          // Fetch campaigns to check if this contact is in any campaign with autoreply enabled
          const campaignsResponse = await fetch('http://localhost:3000/api/campaigns');
          const campaigns = campaignsResponse.ok ? await campaignsResponse.json() : [];

          // Fetch contacts to find the contact ID
          const contactsResponse = await fetch('http://localhost:3000/api/contacts');
          const contacts = contactsResponse.ok ? await contactsResponse.json() : [];

          // Helper function to normalize phone numbers
          const normalizePhone = (phone) => {
            return phone.replace(/[\s\-\(\)\+]/g, '');
          };

          // Find contact by phone number (more flexible matching)
          const contact = contacts.find((c) => {
            const normalizedContactPhone = normalizePhone(c.phone);
            const normalizedSenderPhone = normalizePhone(senderPhone);
            console.log('🔍 Checking contact:', c.name, 'phone:', c.phone, 'normalized:', normalizedContactPhone, 'vs sender:', normalizedSenderPhone);
            return normalizedContactPhone === normalizedSenderPhone ||
                   normalizedContactPhone.endsWith(normalizedSenderPhone) ||
                   normalizedSenderPhone.endsWith(normalizedContactPhone);
          });

          if (!contact) {
            console.log('❌ Contact not found for phone:', senderPhone, 'Available contacts:', contacts.map(c => ({name: c.name, phone: c.phone})));
            return;
          }

          console.log('✅ Found contact:', contact.name, 'for phone:', senderPhone);

          // Check if contact is in any campaign with autoreply enabled
          // Use the most recent campaign (by creation date)
          let relevantCampaign = null;
          const sortedCampaigns = campaigns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          for (const campaign of sortedCampaigns) {
            if (campaign.autoreplyEnabled && campaign.selectedContacts?.includes(contact.id)) {
              relevantCampaign = campaign;
              break;
            }
          }

          if (!relevantCampaign) {
            console.log('❌ No autoreply-enabled campaign found for contact:', contact.name);
            return;
          }

          console.log('🤖 Processing autoreply for campaign:', relevantCampaign.name, 'contact:', contact.name);

          // Store the incoming reply
          const replyResponse = await fetch('http://localhost:3000/api/replies', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              campaignId: relevantCampaign.id,
              contactId: contact.id,
              message: message.body,
            }),
          });

          if (!replyResponse.ok) {
            console.error('❌ Failed to store reply');
            return;
          }

          const storedReply = await replyResponse.json();
          console.log('✅ Reply stored with ID:', storedReply.id);

          // Generate AI autoreply
          const autoreplyResponse = await fetch('http://localhost:3000/api/autoreply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userMessage: message.body,
              campaignId: relevantCampaign.id,
              contactId: contact.id,
            }),
          });

          if (!autoreplyResponse.ok) {
            console.error('❌ Failed to generate autoreply');
            return;
          }

          const autoreplyData = await autoreplyResponse.json();

          if (autoreplyData.response) {
            // Send the AI response back
            try {
              await clients[userId].sendText(message.from, autoreplyData.response);
              console.log('✅ AI response sent to:', contact.name);

              // Update the reply record to mark as AI responded
              await fetch(`http://localhost:3000/api/replies`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: storedReply.id,
                  isAIResponded: true,
                  aiResponse: autoreplyData.response,
                }),
              });
            } catch (sendError) {
              console.error('❌ Failed to send AI response to:', contact.name, sendError.message);
              // Still mark as AI responded but note the failure
              await fetch(`http://localhost:3000/api/replies`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: storedReply.id,
                  isAIResponded: true,
                  aiResponse: autoreplyData.response + ' (Send failed: ' + sendError.message + ')',
                }),
              });
            }
          } else {
            console.log('🤖 AI decided not to reply:', autoreplyData.message || 'No relevant information');
          }

        } catch (error) {
          console.error('❌ Error processing incoming message:', error);
        }
      });

    } catch (error) {
      console.error(`❌ Reconnection attempt failed for user ${userId}:`, error.message);
      // Continue trying to reconnect
    }
  }, 30000); // Try to reconnect every 30 seconds
}

// Function to stop reconnection for a specific user
function stopReconnection(userId) {
  if (reconnectIntervals[userId]) {
    clearInterval(reconnectIntervals[userId]);
    reconnectIntervals[userId] = null;
  }
  isReconnectingMap[userId] = false;
}

// Message template
const baseMessage = (name) => `
Hello ${name},

I hope you're doing well.

We noticed you registered for our Frontline Sales Program Webinar "Build Your Sales Confidence: From Prospecting to Closing with AI & Objection Handling" but couldn't attend. No worries — you can still watch the full session here:
https://drive.google.com/file/d/18iNqb2FT1fkXTJ1UlRyqx2IT8wJdIFQI/view?usp=sharing

The webinar covered key strategies to enhance your sales skills, including:
- Leveraging AI tools to streamline your sales process
- Effective prospecting techniques to identify and engage potential clients
- Mastering objection handling to close deals confidently

To help you take the next step register for the full Frontline Sales Program starting on 25th October 2025:

📝 Application form:
https://forms.zohopublic.com/Yusudi/form/KenyaSchoolofSalesKSSAdmissionsForm2/formperma/vUXeYcRHs8hiIJ34Hhkob4Of2fgL_RD2FhAOM4gqQXg

🌐 Learn more about the program:
https://kss.or.ke/programs/frontlinesales

🎥 Watch the webinar recording:
https://drive.google.com/file/d/18iNqb2FT1fkXTJ1UlRyqx2IT8wJdIFQI/view?usp=sharing

If your employer is willing to sponsor your participation, kindly let us know. Please share your company's PIN number, and we'll generate an official invoice to facilitate the process.

If you'd like to discuss flexible payment options, registration assistance, or have any questions about the program, please don't hesitate to reach out.

📞 *Contact us:*
Stephen Gathiru – Kenya School of Sales | +254 798149980 | stephen@cca.co.ke
Alex Mahugu – General Manager, KSS | +254 722257323 | Alex.mahugu@yusudi.co

We look forward to helping you and your team take the next step toward sales excellence.

Warm regards,
*Stephen Gathiru*
Kenya School of Sales (KSS)
📧 stephen@cca.co.ke
📞 +254 798149980
🌐 kss.or.ke/programs
`;

// Upload CSV
const upload = multer({ dest: 'uploads/' });
app.post('/upload-contacts', upload.single('contacts'), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      fs.writeFileSync('./contacts.json', JSON.stringify(results, null, 2));
      fs.unlinkSync(req.file.path); // remove uploaded file
      res.json({ message: 'Contacts uploaded successfully', count: results.length });
    })
    .on('error', (error) => {
      res.status(500).json({ error: error.message });
    });
});

// Upload video
const videoUpload = multer({ dest: 'uploads/', limits: { fileSize: 59 * 1024 * 1024 } }); // 59MB
app.post('/upload-video', videoUpload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  fs.renameSync(req.file.path, './video.mp4');
  res.json({ message: 'Video uploaded successfully' });
});

// Get files
app.get('/files', (req, res) => {
  const files = [];
  if (fs.existsSync('./video.mp4')) {
    const stats = fs.statSync('./video.mp4');
    files.push({ name: 'video.mp4', size: stats.size, type: 'video' });
  }
  if (fs.existsSync('./template.txt')) {
    const stats = fs.statSync('./template.txt');
    files.push({ name: 'template.txt', size: stats.size, type: 'template' });
  }
  const uploadFiles = fs.readdirSync('uploads');
  uploadFiles.forEach(file => {
    const stats = fs.statSync(`uploads/${file}`);
    files.push({ name: file, size: stats.size, type: 'other' });
  });
  res.json(files);
});

// Upload template
app.post('/upload-template', upload.single('template'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const content = fs.readFileSync(req.file.path, 'utf8');
  fs.writeFileSync('./template.txt', content);
  fs.unlinkSync(req.file.path);
  res.json({ message: 'Template uploaded successfully' });
});

// Get template
app.get('/template', (req, res) => {
  if (fs.existsSync('./template.txt')) {
    const template = fs.readFileSync('./template.txt', 'utf8');
    res.json({ template });
  } else {
    res.json({ template: baseMessage('') });
  }
});

// Get contacts
app.get('/contacts', (req, res) => {
  if (fs.existsSync('./contacts.json')) {
    const contacts = JSON.parse(fs.readFileSync('./contacts.json', 'utf8'));
    res.json(contacts);
  } else {
    res.json([]);
  }
});

// Update contacts (for editing)
app.post('/contacts', (req, res) => {
  const contacts = req.body.contacts;
  fs.writeFileSync('./contacts.json', JSON.stringify(contacts, null, 2));
  res.json({ message: 'Contacts updated' });
});

// Start session for a specific user
app.post('/api/start-session', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  console.log(`🔄 Start session request received for user ${userId}`);
  if (clients[userId]) {
    console.log(`ℹ️ Client already exists for user ${userId}, returning status:`, sessionStatuses[userId]);
    res.json({ status: sessionStatuses[userId] });
    return;
  }
  try {
    // Delete existing session folder to ensure fresh start
    const sessionPath = `./tokens/whatsapp-session-${userId}`;
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🗑️ Deleted existing session folder for user ${userId} for fresh start`);
      } catch (deleteError) {
        console.log(`⚠️ Could not delete session folder for user ${userId}, proceeding anyway:`, deleteError.message);
      }
    }

    console.log(`🚀 Creating WhatsApp client for user ${userId}...`);
    clients[userId] = await wppconnect.create({
      session: `whatsapp-session-${userId}`,
      puppeteer: {
        headless: true, // Keep headless for SaaS - browser runs on server, not user machine
        protocolTimeout: 60000,
        executablePath: getBrowserExecutablePath(),
        ignoreDefaultArgs: ['--disable-extensions'],
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      },
      catchQR: async (qr) => {
        console.log(`🔍 DEBUG: catchQR called with qr type for user ${userId}:`, typeof qr);

   // DON'T try to re-encode the session token
   // Just pass it through as-is to the frontend
   if (typeof qr === 'object' && qr.code) {
     currentQrs[userId] = qr.code;
   } else if (typeof qr === 'string') {
     currentQrs[userId] = qr;
   } else {
     currentQrs[userId] = JSON.stringify(qr);
   }

   validSessions[userId] = true;
   browserLaunchedMap[userId] = true;
   console.log(`📱 QR code stored for user ${userId} - length:`, currentQrs[userId]?.length);

   // Don't try to convert to DataURL, just store the raw code
      },
      statusFind: (status) => {
        sessionStatuses[userId] = status;
        console.log(`🟡 Status for user ${userId}:`, status);

        if (status === 'connected' || status === 'isLogged' || status === 'inChat') {
          console.log(`✅ WhatsApp client connected successfully for user ${userId}`);
          browserLaunchedMap[userId] = true;
          validSessions[userId] = true;
          stopReconnection(userId); // Stop any ongoing reconnection attempts
          qrCodes[userId] = null; // Clear QR once connected
        } else if (status === 'browserClose' || status === 'disconnected' || status === 'notLogged') {
          console.log(`⚠️ WhatsApp connection lost for user ${userId}`);
          browserLaunchedMap[userId] = false;
          validSessions[userId] = false;
          qrCodes[userId] = null;
        }
      },
      autoClose: 3600000, // 1 hour timeout
    });
    console.log(`✅ Session started successfully for user ${userId}`);

    // Message listener code remains the same...
    clients[userId].onMessage(async (message) => {
      try {
        console.log('📨 Received message:', message.body, 'from:', message.from);

        // Skip messages from ourselves not, groups, or status broadcasts
        if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
          return;
        }

        // Extract phone number from sender (remove @c.us)
        const senderPhone = message.from.replace('@c.us', '');

        // Fetch campaigns to check if this contact is in any campaign with autoreply enabled
        const campaignsResponse = await fetch('http://localhost:3000/api/campaigns');
        const campaigns = campaignsResponse.ok ? await campaignsResponse.json() : [];

        // Fetch contacts to find the contact ID
        const contactsResponse = await fetch('http://localhost:3000/api/contacts');
        const contacts = contactsResponse.ok ? await contactsResponse.json() : [];

        // Helper function to normalize phone numbers
        const normalizePhone = (phone) => {
          return phone.replace(/[\s\-\(\)\+]/g, '');
        };

        // Find contact by phone number (more flexible matching)
        const contact = contacts.find((c) => {
          const normalizedContactPhone = normalizePhone(c.phone);
          const normalizedSenderPhone = normalizePhone(senderPhone);
          console.log('🔍 Checking contact:', c.name, 'phone:', c.phone, 'normalized:', normalizedContactPhone, 'vs sender:', normalizedSenderPhone);
          return normalizedContactPhone === normalizedSenderPhone ||
                 normalizedContactPhone.endsWith(normalizedSenderPhone) ||
                 normalizedSenderPhone.endsWith(normalizedContactPhone);
        });

        if (!contact) {
          console.log('❌ Contact not found for phone:', senderPhone, 'Available contacts:', contacts.map(c => ({name: c.name, phone: c.phone})));
          return;
        }

        console.log('✅ Found contact:', contact.name, 'for phone:', senderPhone);

        // Check if contact is in any campaign with autoreply enabled
        // Use the most recent campaign (by creation date)
        let relevantCampaign = null;
        const sortedCampaigns = campaigns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        for (const campaign of sortedCampaigns) {
          if (campaign.autoreplyEnabled && campaign.selectedContacts?.includes(contact.id)) {
            relevantCampaign = campaign;
            break;
          }
        }

        if (!relevantCampaign) {
          console.log('❌ No autoreply-enabled campaign found for contact:', contact.name);
          return;
        }

        console.log('🤖 Processing autoreply for campaign:', relevantCampaign.name, 'contact:', contact.name);

        // Store the incoming reply
        const replyResponse = await fetch('http://localhost:3000/api/replies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campaignId: relevantCampaign.id,
            contactId: contact.id,
            message: message.body,
          }),
        });

        if (!replyResponse.ok) {
          console.error('❌ Failed to store reply');
          return;
        }

        const storedReply = await replyResponse.json();
        console.log('✅ Reply stored with ID:', storedReply.id);

        // Generate AI autoreply
        const autoreplyResponse = await fetch('http://localhost:3000/api/autoreply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userMessage: message.body,
            campaignId: relevantCampaign.id,
            contactId: contact.id,
            contactPhone: senderPhone,
            contactName: contact.name,
          }),
        });

        if (!autoreplyResponse.ok) {
          console.error('❌ Failed to generate autoreply');
          return;
        }

        const autoreplyData = await autoreplyResponse.json();

        if (autoreplyData.response) {
          // Send the AI response back
          try {
            await clients[userId].sendText(message.from, autoreplyData.response);
            console.log('✅ AI response sent to:', contact.name);

            // Update the reply record to mark as AI responded
            await fetch(`http://localhost:3000/api/replies`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: storedReply.id,
                isAIResponded: true,
                aiResponse: autoreplyData.response,
              }),
            });
          } catch (sendError) {
            console.error('❌ Failed to send AI response to:', contact.name, sendError.message);
            // Still mark as AI responded but note the failure
            await fetch(`http://localhost:3000/api/replies`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: storedReply.id,
                isAIResponded: true,
                aiResponse: autoreplyData.response + ' (Send failed: ' + sendError.message + ')',
              }),
            });
          }
        } else {
          console.log('🤖 AI decided not to reply:', autoreplyData.message || 'No relevant information');
        }

      } catch (error) {
        console.error('❌ Error processing incoming message:', error);
      }
    });

    res.json({ status: 'session started' });
  } catch (error) {
    console.error(`❌ Error starting session for user ${userId}:`, error);
    browserLaunchedMap[userId] = false;
    validSessions[userId] = false;
    qrCodes[userId] = null;
    res.status(500).json({ error: error.message });
  }
});

// API route for frontend to fetch QR for a specific user
app.get('/api/qr', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  console.log(`🔍 DEBUG: /api/qr called for user ${userId} - currentQr exists:`, !!currentQrs[userId], 'length:', currentQrs[userId]?.length || 'undefined', 'status:', sessionStatuses[userId]);
  res.json({
    qr: currentQrs[userId],
    status: sessionStatuses[userId],
    validSession: validSessions[userId],
    hasQR: !!currentQrs[userId],
    qrType: currentQrs[userId] && currentQrs[userId].startsWith('data:image/') ? 'image' : 'text'
  });
});

// API route to get ASCII QR as image (for when regular QR generation fails)
app.get('/api/qr-ascii-image', async (req, res) => {
  try {
    // This would generate an image of the ASCII QR code
    // For now, return a placeholder message
    const message = "QR code too large. Please contact administrator to scan from server terminal.";
    const qrDataURL = await QRCode.toDataURL(message, {
      version: 5,
      errorCorrectionLevel: 'L',
      width: 256,
    });

    res.json({
      qr: qrDataURL,
      message: "QR code data is too large for browser display. Please contact your system administrator to scan the QR code from the server terminal."
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate fallback QR' });
  }
});

// Check session status for a specific user
app.get('/api/session-status', async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    if (clients[userId]) {
      // Check if client is still connected
      const state = await clients[userId].getConnectionState();
      res.json({
        hasClient: true,
        status: sessionStatuses[userId],
        connectionState: state
      });
    } else {
      res.json({
        hasClient: false,
        status: sessionStatuses[userId],
        connectionState: null
      });
    }
  } catch (error) {
    console.error(`Error checking session status for user ${userId}:`, error);
    res.json({
      hasClient: !!clients[userId],
      status: sessionStatuses[userId],
      connectionState: null,
      error: error.message
    });
  }
});

// Send messages for a specific user
app.post('/send-messages', async (req, res) => {
  const { userId, selectedContacts, message: customMessage, campaignId, campaignName } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  if (!clients[userId]) {
    res.status(400).json({ error: 'Session not started for this user' });
    return;
  }
  if (!selectedContacts || !Array.isArray(selectedContacts)) {
    res.status(400).json({ error: 'selectedContacts required as array' });
    return;
  }
  // Simple idempotency: if campaignId or campaignName was provided and we've
  // already processed it, return early to avoid duplicate sends.
  try {
    const SENT_FILE = `./sent_campaigns_${userId}.json`;
    let sentCampaigns = [];
    if (fs.existsSync(SENT_FILE)) {
      sentCampaigns = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')) || [];
    }
    const already = campaignId
      ? sentCampaigns.find((c) => c.campaignId === campaignId)
      : campaignName
      ? sentCampaigns.find((c) => c.campaignName === campaignName)
      : null;
    if (already) {
      console.log(`⚠️ Duplicate send request detected for user ${userId}:`, campaignId || campaignName);
      return res.json({ message: 'Campaign already processed', success: 0, failed: 0, duplicate: true });
    }
  } catch (e) {
    console.warn(`Could not read sent_campaigns_${userId}.json for idempotency:`, e.message);
  }
  const sentCount = { success: 0, failed: 0 };

  for (const contact of selectedContacts) {
    const firstName = contact.name ? contact.name.split(' ')[0] : 'User';
    const chatId = `${contact.phone}@c.us`;
    // Use custom message if provided, else fall back to template
    let message = customMessage || baseMessage(firstName);
    if (customMessage) {
      message = customMessage.replace(/{{name}}/g, firstName).replace(/{{title}}/g, contact.title || '');
    }

    // Load template if no custom message
    if (!customMessage && fs.existsSync('./template.txt')) {
      const templateText = fs.readFileSync('./template.txt', 'utf8');
      message = templateText.replace(/{name}/g, firstName);
    }

    try {
      console.log(`📤 Sending message to ${contact.name} for user ${userId}...`);
      await clients[userId].sendText(chatId, message);

      // Send video if exists
      if (fs.existsSync('./video.mp4')) {
        await clients[userId].sendFile(chatId, './video.mp4', 'kss-promo.mp4', '🎬 Here\'s a short video recap!');
        console.log(`✅ Video sent to ${contact.name} for user ${userId}`);
      }

      sentCount.success++;
      console.log(`✅ Message sent to ${contact.name} for user ${userId}`);
      await new Promise((resolve) => setTimeout(resolve, 4000)); // delay
    } catch (err) {
      console.error(`❌ Failed to send to ${contact.name} for user ${userId}:`, err.message);
      sentCount.failed++;
    }
  }

  res.json({ message: 'Messages sent', ...sentCount });
  // Record that this campaign has been processed to avoid duplicate sends on retry
  try {
    const SENT_FILE = `./sent_campaigns_${userId}.json`;
    let sentCampaigns = [];
    if (fs.existsSync(SENT_FILE)) {
      sentCampaigns = JSON.parse(fs.readFileSync(SENT_FILE, 'utf8')) || [];
    }
    sentCampaigns.push({ campaignId: campaignId || null, campaignName: campaignName || null, timestamp: Date.now() });
    fs.writeFileSync(SENT_FILE, JSON.stringify(sentCampaigns, null, 2));
  } catch (e) {
    console.warn(`Could not update sent_campaigns_${userId}.json:`, e.message);
  }
});


// AI endpoints
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(prompt, model = 'anthropic/claude-3-haiku') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3002',
      'X-Title': 'AutoSend Pro',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response content received');
  }

  return content.trim();
}

app.post('/api/ai/generate-message-tone', async (req, res) => {
  try {
    const { message, tone } = req.body;
    if (!message || !tone) {
      return res.status(400).json({ error: 'Message and tone required' });
    }

    const prompt = `Rewrite this WhatsApp message to have a ${tone} tone while keeping it professional and engaging.
Original message: "${message}"

Return only the rewritten message, nothing else.`;

    const result = await callOpenRouter(prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/standardize-contact-name', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const prompt = `Please standardize this contact name to a professional format.
Return only the standardized name, nothing else.
Examples:
- "john doe" → "John Doe"
- "jane smith-md" → "Jane Smith"
- "bob johnson ceo" → "Bob Johnson"

Name to standardize: "${name}"`;

    const result = await callOpenRouter(prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('AI standardization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/suggest-contact-title', async (req, res) => {
  try {
    const { name, context } = req.body;
    if (!name || !context) {
      return res.status(400).json({ error: 'Name and context required' });
    }

    const prompt = `Based on the name "${name}" and context "${context}", suggest a professional title or role.
Return only the suggested title, nothing else.
Examples:
- "Dr. Sarah Johnson" with medical context → "Chief Medical Officer"
- "Mike Chen" with sales context → "Sales Director"

Name: "${name}"
Context: "${context}"`;

    const result = await callOpenRouter(prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/clean-phone-number', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const prompt = `Please clean and standardize this phone number by removing any plus signs, spaces, dashes, parentheses, and other non-numeric characters except for the country code if present.
Return only the cleaned phone number with no plus sign, nothing else.
Examples:
- "+1 234-567-8900" → "12345678900"
- "+254 798 149 980" → "254798149980"
- "(555) 123-4567" → "5551234567"
- "+44 20 7946 0958" → "442079460958"

Phone number to clean: "${phone}"`;

    const result = await callOpenRouter(prompt);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('AI phone cleaning error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/ai/process-csv', async (req, res) => {
  try {
    const { csvData, userPrompt, headers } = req.body;
    if (!csvData || !Array.isArray(csvData) || !userPrompt) {
      return res.status(400).json({ error: 'CSV data array and user prompt required' });
    }

    // Convert CSV data to a readable format for the AI
    const csvText = [
      headers.join(','),
      ...csvData.slice(0, 10).map(row =>
        headers.map(header => row[header] || '').join(',')
      )
    ].join('\n');

    const prompt = `You are an AI assistant helping to clean and format CSV contact data. The user wants to prepare this data for import into a WhatsApp outreach system.

CSV Data (showing first 10 rows):
${csvText}

${csvData.length > 10 ? `... and ${csvData.length - 10} more rows` : ''}

User's request: "${userPrompt}"

Please analyze the data and provide specific suggestions for cleaning/formatting. Focus on:
1. Identifying the correct columns for name, title, and phone
2. Cleaning phone numbers (remove + signs, standardize format)
3. Standardizing names and titles
4. Removing duplicates or invalid rows
5. Any other data quality improvements

Return your response as a JSON object with:
- "analysis": brief analysis of the data
- "suggestions": array of specific actionable suggestions
- "transformedData": if you can suggest a cleaned version, provide the first 10 rows as an array of objects

Be specific and actionable in your suggestions.`;

    const result = await callOpenRouter(prompt);
    let parsedResult;

    // Try to extract JSON from the response
    try {
      // Look for JSON content in the response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      // If AI doesn't return valid JSON, create a structured response
      parsedResult = {
        analysis: result.replace(/```json\n?|\n?```/g, '').trim(),
        suggestions: ["Please review the AI analysis above for specific recommendations"],
        transformedData: null
      };
    }

    res.json({ success: true, data: parsedResult });
  } catch (error) {
    console.error('AI CSV processing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Disconnect WhatsApp session for a specific user
app.post('/api/disconnect-session', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    stopReconnection(userId); // Stop any reconnection attempts
    if (clients[userId]) {
      await clients[userId].close();
      clients[userId] = null;
      qrCodes[userId] = null;
      sessionStatuses[userId] = 'disconnected';
      console.log(`✅ WhatsApp session disconnected for user ${userId}`);
      res.json({ success: true, message: 'Session disconnected' });
    } else {
      res.json({ success: true, message: 'No active session to disconnect' });
    }
  } catch (error) {
    console.error(`Error disconnecting session for user ${userId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete WhatsApp session for a specific user (for corrupted sessions)
app.post('/api/delete-session', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    stopReconnection(userId); // Stop any reconnection attempts
    if (clients[userId]) {
      await clients[userId].close();
      clients[userId] = null;
    }
    qrCodes[userId] = null;
    sessionStatuses[userId] = 'disconnected';

    // Delete session folder
    const sessionPath = `./tokens/whatsapp-session-${userId}`;
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`✅ WhatsApp session folder deleted for user ${userId}`);
    }

    res.json({ success: true, message: 'Session deleted and reset' });
  } catch (error) {
    console.error(`Error deleting session for user ${userId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Send reminder messages to user
app.post('/api/ai/generate-autoreply', async (req, res) => {
  try {
    const { userMessage, faqs, companyInfo, contactName } = req.body;
    if (!userMessage) {
      return res.status(400).json({ error: 'User message required' });
    }

    // Check if the user's message can be answered using FAQs
    let relevantFAQ = null;
    let shouldReply = false;

    if (faqs && faqs.length > 0) {
      // Simple keyword matching to find relevant FAQ
      const userMessageLower = userMessage.toLowerCase();
      for (const faq of faqs) {
        const questionLower = faq.question.toLowerCase();
        const answerLower = faq.answer.toLowerCase();

        // Check if user message contains keywords from FAQ question or answer
        const keywords = questionLower.split(' ').concat(answerLower.split(' '));
        const hasRelevantKeywords = keywords.some(keyword =>
          keyword.length > 3 && userMessageLower.includes(keyword)
        );

        if (hasRelevantKeywords) {
          relevantFAQ = faq;
          shouldReply = true;
          break;
        }
      }
    }

    // Always try to reply, even if no FAQ matches
    shouldReply = true;

    let prompt;
    if (relevantFAQ) {
      // Generate AI response based on the relevant FAQ
      prompt = `You are a helpful customer service AI assistant${contactName ? ` responding to ${contactName}` : ''}. A customer asked: "${userMessage}"

Based on our FAQ knowledge, here's the relevant information:
Question: ${relevantFAQ.question}
Answer: ${relevantFAQ.answer}

${companyInfo ? `Company information: ${companyInfo}` : ''}

Please provide a helpful, friendly, and personalized response that answers their question using the FAQ information. Keep it concise and professional. Do not mention that you're using FAQ data - just provide the helpful answer.`;
    } else {
      // Generate a general helpful response
      prompt = `You are a helpful customer service AI assistant for a sales training company. A customer sent this message: "${userMessage}"

${companyInfo ? `Company information: ${companyInfo}` : ''}

Please provide a helpful, friendly, and professional response. If the message seems like a question or inquiry, try to answer it helpfully. If it's a statement or greeting, respond appropriately. Keep your response concise and engaging.

If you don't have enough context to provide a specific answer, acknowledge their message and offer to help further.`;
    }

    const aiResponse = await callOpenRouter(prompt);
    res.json({
      success: true,
      data: aiResponse,
      shouldReply: true
    });
  } catch (error) {
    console.error('AI autoreply generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/send-reminder', async (req, res) => {
  try {
    const { userId, phone, message } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message required' });
    }

    if (!clients[userId]) {
      return res.status(400).json({ error: 'WhatsApp client not connected for this user' });
    }

    const chatId = `${phone}@c.us`;
    await clients[userId].sendText(chatId, message);
    console.log(`Reminder sent to ${phone} for user ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Reminder send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Function to process pending AI replies when connection is restored for a specific user
async function processPendingReplies(userId) {
  if (!pendingReplies[userId] || pendingReplies[userId].length === 0 || !clients[userId]) return;

  console.log(`🔄 Processing ${pendingReplies[userId].length} pending AI replies for user ${userId}...`);

  for (let i = pendingReplies[userId].length - 1; i >= 0; i--) {
    const pendingReply = pendingReplies[userId][i];

    try {
      // Check if this reply still needs AI response (not manually handled)
      const replies = JSON.parse(fs.readFileSync('./data/replies.json', 'utf8'));
      const currentReply = replies.find((r) => r.id === pendingReply.replyId);

      if (currentReply && !currentReply.isAIResponded && !currentReply.isHumanResponded) {
        // Still needs AI response, try to send now
        await clients[userId].sendText(pendingReply.phone, pendingReply.message);
        console.log(`✅ Sent pending AI reply to ${pendingReply.phone} for user ${userId}`);

        // Update the reply record
        currentReply.isAIResponded = true;
        currentReply.aiResponse = pendingReply.message;
        currentReply.aiResponseTime = new Date().toISOString();
        fs.writeFileSync('./data/replies.json', JSON.stringify(replies, null, 2));

        // Remove from pending list
        pendingReplies[userId].splice(i, 1);
      } else {
        // Reply was already handled manually, remove from pending
        pendingReplies[userId].splice(i, 1);
      }
    } catch (error) {
      console.error(`❌ Failed to send pending reply to ${pendingReply.phone} for user ${userId}:`, error.message);
      // Keep in pending list for next retry
    }
  }

  console.log(`📊 Pending replies processed for user ${userId}. ${pendingReplies[userId].length} remaining.`);

  // Save updated pending replies
  try {
    fs.writeFileSync('./data/pending-replies.json', JSON.stringify(pendingReplies, null, 2));
  } catch (error) {
    console.error('Error saving pending replies:', error);
  }
}

// Reset sent campaigns history for a specific user
app.post('/reset-sent-campaigns', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const SENT_FILE = `./sent_campaigns_${userId}.json`;
    if (fs.existsSync(SENT_FILE)) {
      fs.unlinkSync(SENT_FILE);
      console.log(`Sent campaigns history reset for user ${userId}`);
    }
    res.json({ success: true, message: 'Sent campaigns history has been reset' });
  } catch (error) {
    console.error(`Error resetting sent campaigns for user ${userId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));