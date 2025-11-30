const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3008;
const accountsFilePath = path.join(__dirname, 'accounts.json');

app.use(cors());
app.use(bodyParser.json());

// --- Helper Functions ---
const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, '[]', 'utf8');
      return [];
    }
    throw error;
  }
};

const writeJsonFile = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
};

// --- Account Management ---
app.get('/api/accounts', async (req, res) => {
  try { res.json(await readJsonFile(accountsFilePath)); } 
  catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const accounts = await readJsonFile(accountsFilePath);
    accounts.push(req.body);
    await writeJsonFile(accountsFilePath, accounts);
    res.status(201).json(req.body);
  } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    let accounts = await readJsonFile(accountsFilePath);
    let updated = null;
    accounts = accounts.map(acc => {
      if (acc.id === req.params.id) {
        updated = { ...acc, ...req.body };
        return updated;
      }
      return acc;
    });
    await writeJsonFile(accountsFilePath, accounts);
    res.json(updated || {});
  } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    let accounts = await readJsonFile(accountsFilePath);
    accounts = accounts.filter(acc => acc.id !== req.params.id);
    await writeJsonFile(accountsFilePath, accounts);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// --- Auth Check (MailerSend) ---
app.post('/api/check-status', async (req, res) => {
    const { secretKey } = req.body;
    if (!secretKey) return res.status(400).json({ message: 'Missing API Token' });

    try {
        const response = await axios.get('https://api.mailersend.com/v1/domains', {
            headers: { 
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ success: true, message: 'Connected to MailerSend.', data: response.data });
    } catch (error) {
        console.error("Auth Error:", error.response?.data || error.message);
        res.status(401).json({ success: false, message: 'Authentication Failed', details: error.response?.data });
    }
});

// --- Send Email (MailerSend) ---
app.post('/api/send-email', async (req, res) => {
    const { accountId, to, subject, content, fromEmail, fromName } = req.body;
    
    if (!accountId || !to || !subject || !content) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        // 1. Determine Sender Details
        const senderEmail = fromEmail || account.fromEmail;
        const senderName = fromName;

        if (!senderEmail) {
            return res.status(400).json({ error: "No 'From Email' specified." });
        }

        // 2. Prepare HTML (Ensure basic structure exists)
        let htmlContent = content;
        if (!htmlContent.trim().toLowerCase().startsWith('<html') && !htmlContent.includes('<body')) {
            htmlContent = `<!DOCTYPE html><html><body>${content}</body></html>`;
        }

        // 3. Prepare Plain Text
        let textContent = String(content).replace(/<[^>]*>?/gm, " ").trim();
        if (!textContent || textContent.length === 0) {
            textContent = "Please view this email in an HTML compatible email client.";
        }

        const payload = {
            from: { email: senderEmail, name: senderName || undefined },
            to: [{ email: to, name: to }],
            subject: subject,
            html: htmlContent,
            text: textContent
        };

        const response = await axios.post('https://api.mailersend.com/v1/email', payload, {
            headers: {
                'Authorization': `Bearer ${account.secretKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        res.json({ 
            success: true, 
            messageId: response.headers['x-message-id'],
            status: response.status 
        });

    } catch (error) {
        console.error("Send Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: "Failed to send email", 
            details: error.response?.data 
        });
    }
});

// --- Analytics / Activity Logs (MailerSend Activity API) ---
app.get('/api/email/log', async (req, res) => {
    const { accountId, limit = 25, page = 1, status } = req.query;

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        // 1. Get Domain ID (MailerSend requires a domain_id to fetch activity)
        // We fetch the first verified domain associated with the token.
        const domainResponse = await axios.get('https://api.mailersend.com/v1/domains', {
            headers: { 'Authorization': `Bearer ${account.secretKey}` }
        });

        const domainId = domainResponse.data.data?.[0]?.id;
        if (!domainId) {
            return res.json({ success: true, data: [], message: "No domains found for this token." });
        }

        // 2. Prepare Activity Filters
        const params = {
            limit: limit,
            page: page,
        };

        // Map frontend "status" to MailerSend "event" types
        if (status === 'delivered') params.event = ['delivered'];
        if (status === 'failed') params.event = ['soft_bounced', 'hard_bounced'];
        if (status === 'opened') params.event = ['opened'];
        if (status === 'clicked') params.event = ['clicked'];
        if (status === 'spam') params.event = ['spam_complaint', 'junk'];

        // 3. Fetch Activity
        const response = await axios.get(`https://api.mailersend.com/v1/activity/${domainId}`, {
            headers: { 'Authorization': `Bearer ${account.secretKey}` },
            params: params
        });

        // 4. Transform Response for Frontend
        const logs = response.data.data.map(activity => {
            
            // Map MailerSend types back to Frontend statuses
            let displayStatus = 'processing';
            if (activity.type === 'sent' || activity.type === 'delivered') displayStatus = 'delivered';
            else if (activity.type.includes('bounced')) displayStatus = 'failed';
            else if (activity.type === 'opened') displayStatus = 'opened';
            else if (activity.type === 'clicked') displayStatus = 'clicked';
            else if (activity.type === 'spam_complaint') displayStatus = 'spam';

            return {
                id: activity.id,
                type: activity.type, // e.g. "soft_bounced"
                to: activity.recipient?.email || 'Unknown',
                from: activity.email?.from || 'Unknown',
                subject: activity.email?.subject || 'No Subject',
                status: displayStatus, 
                detailedStatus: activity.type.replace('_', ' '), // Clean up "soft_bounced" -> "soft bounced"
                sentAt: activity.created_at,
                errorMessage: null // MailerSend activity log rarely sends explicit error text in the list view
            };
        });

        res.json({ 
            success: true, 
            data: logs,
            // MailerSend pagination metadata
            pagination: response.data.meta ? {
                page: response.data.meta.current_page,
                limit: response.data.meta.per_page,
                total: response.data.meta.total,
                totalPages: response.data.meta.last_page
            } : {}
        });

    } catch (error) {
        console.error("Logs Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

app.post('/api/track-event', async (req, res) => {
     res.status(501).json({ error: "Endpoint pending migration to MailerSend" });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});