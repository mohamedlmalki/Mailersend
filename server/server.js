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

// --- Auth Check (v1) ---
app.post('/api/check-status', async (req, res) => {
    const { secretKey } = req.body;
    if (!secretKey) return res.status(400).json({ message: 'Missing Secret Key' });

    try {
        const response = await axios.get('https://api.emailit.com/v1/sending-domains', {
            headers: { 
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.json({ success: true, message: 'Connected to Emailit (v1).', data: response.data });
    } catch (error) {
        res.status(401).json({ success: false, message: 'Authentication Failed' });
    }
});

// --- Send Email (v1 - FIXED HTML/TEXT ISSUE) ---
app.post('/api/send-email', async (req, res) => {
    const { accountId, to, subject, content, from } = req.body;
    if (!accountId || !to || !subject || !content) return res.status(400).json({ error: "Missing parameters" });

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        // 1. Prepare HTML: Ensure it is wrapped in <html><body> tags
        let htmlContent = content;
        if (!htmlContent.trim().toLowerCase().startsWith('<html') && !htmlContent.includes('<body')) {
            htmlContent = `<!DOCTYPE html><html><body>${content}</body></html>`;
        }

        // 2. Prepare Text: Ensure it is not empty (Emailit requires non-empty string)
        let textContent = String(content).replace(/<[^>]*>?/gm, " ").trim();
        if (!textContent || textContent.length === 0) {
            textContent = "Please view this email in an HTML compatible email client.";
        }

        const payload = {
            to: to,
            subject: subject,
            html: htmlContent, // Use wrapped HTML
            text: textContent  // Use valid text
        };
        
        if (from) payload.from = from;

        const response = await axios.post('https://api.emailit.com/v1/emails', payload, {
            headers: {
                'Authorization': `Bearer ${account.secretKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Emailit Send Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ error: "Failed to send email", details: error.response?.data });
    }
});

// --- Add to Audience (v1) ---
app.post('/api/track-event', async (req, res) => {
    const { accountId, event, email, data } = req.body; 
    if (!accountId || !event || !email) return res.status(400).json({ error: "Missing parameters" });

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const response = await axios.post(`https://api.emailit.com/v1/audiences/${event}/subscribers`, {
            email: email,
            custom_fields: data || {}
        }, {
            headers: {
                'Authorization': `Bearer ${account.secretKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ error: "Failed to add subscriber", details: error.response?.data });
    }
});

// --- Analytics / Logs (v1) ---
app.get('/api/email/log', async (req, res) => {
    const { accountId, limit = 25, page = 1, status } = req.query;

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        if (!account) return res.status(404).json({ error: "Account not found" });

        const params = {
            per_page: limit, 
            page: page
        };

        if (status === 'delivered') params['filter[type]'] = 'email.delivery.sent';
        if (status === 'failed') params['filter[type]'] = 'email.delivery.hardfail'; 
        if (status === 'opened') params['filter[type]'] = 'email.loaded';
        if (status === 'clicked') params['filter[type]'] = 'email.link.clicked';

        const response = await axios.get('https://api.emailit.com/v1/events', {
            headers: { 
                'Authorization': `Bearer ${account.secretKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            params: params
        });

        const logs = response.data.data.map(event => {
            const data = event.data || {};
            const emailObj = data.object?.email || {}; 
            
            let status = 'processing';
            if (event.type.includes('sent') || event.type.includes('delivery.sent')) status = 'delivered';
            else if (event.type.includes('fail') || event.type.includes('bounce') || event.type.includes('error')) status = 'failed';
            else if (event.type.includes('loaded') || event.type.includes('open')) status = 'opened';
            else if (event.type.includes('click')) status = 'clicked';
            else if (event.type.includes('held') || event.type.includes('spam')) status = 'spam';

            return {
                id: event.id,
                type: event.type,
                to: emailObj.to || 'Unknown',
                from: emailObj.from || 'Unknown',
                subject: emailObj.subject || 'No Subject',
                status: status,
                detailedStatus: event.type.replace('email.', '').replace('delivery.', ''),
                sentAt: event.created_at || new Date().toISOString(),
                errorMessage: (status === 'failed') ? (data.details || event.type) : null
            };
        });

        res.json({ 
            success: true, 
            data: logs, 
            pagination: { page: Number(page), limit: Number(limit), total: 100, totalPages: 5 } 
        });

    } catch (error) {
        console.error("Emailit Logs Error:", error.response?.data || error.message);
        if (error.response?.status === 401) {
             return res.status(401).json({ error: "Unauthorized: Please check API Key permissions." });
        }
        res.status(500).json({ error: "Failed to fetch logs" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});