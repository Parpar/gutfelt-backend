require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const msalConfig = { auth: { clientId: process.env.CLIENT_ID, authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`, clientSecret: process.env.CLIENT_SECRET } };
const sharePointConfig = { siteId: process.env.SITE_ID };
const newsListId = process.env.NEWS_LIST_ID;
const calendarId = process.env.CALENDAR_ID;
const calendarUser = process.env.CALENDAR_USER_EMAIL;
const PARTNERS_LIST_ID = process.env.PARTNERS_LIST_ID;

const supabase = createClient(supabaseUrl, supabaseKey);
const cca = new ConfidentialClientApplication(msalConfig);
async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
    return Client.init({ authProvider: (done) => done(null, authResponse.accessToken) });
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Gutfelt Back-end er live.'));

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email og password er påkrævet.' });
    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
        if (error || !user) return res.status(401).json({ message: 'Forkert email eller password.' });
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: 'Forkert email eller password.' });
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (err) { res.status(500).json({ message: 'Der skete en serverfejl.' }); }
});

app.get('/api/news', async (req, res) => {
    try {
        const graphClient = await getGraphClient();
        const response = await graphClient.api(`/sites/${sharePointConfig.siteId}/lists/${newsListId}/items`).expand('fields($select=Title,Summary)').orderby('lastModifiedDateTime desc').top(5).get();
        res.json(response.value.map(item => ({ title: item.fields.Title, summary: item.fields.Summary })));
    } catch (error) { res.status(500).json({ message: 'Kunne ikke hente nyheder.' }); }
});

app.get('/api/calendar-events', async (req, res) => {
    try {
        const graphClient = await getGraphClient();
        const now = new Date().toISOString();
        const response = await graphClient.api(`/users/${calendarUser}/calendars/${calendarId}/events`).filter(`start/dateTime ge '${now}'`).orderby('start/dateTime asc').top(10).select('id,subject,start').get();
        res.json(response.value);
    } catch (error) { res.status(500).json({ message: 'Kunne ikke hente kalender-events.' }); }
});

app.get('/api/partners/:category', async (req, res) => {
    const category = req.params.category;
    if (!category) return res.status(400).json({ message: `Kategori mangler.` });
    try {
        const graphClient = await getGraphClient();
        const response = await graphClient.api(`/sites/${sharePointConfig.siteId}/lists/${PARTNERS_LIST_ID}/items`)
            .expand('fields')
            .get();
        const allPartners = response.value.map(item => item.fields);
        const filteredPartners = allPartners.filter(p => p.Kategori === category);
        res.json(filteredPartners);
    } catch (error) {
        console.error("Fejl i /api/partners:", error);
        res.status(500).json({ message: 'Kunne ikke hente partnere.' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));