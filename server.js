require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const msalConfig = { auth: { clientId: process.env.CLIENT_ID, authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`, clientSecret: process.env.CLIENT_SECRET } };
const sharePointConfig = { siteId: process.env.SITE_ID, driveId: process.env.DRIVE_ID };
const newsListId = process.env.NEWS_LIST_ID;
const calendarId = process.env.CALENDAR_ID;
const calendarUser = process.env.CALENDAR_USER_EMAIL;

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
    // Login-kode...
});
app.get('/api/news', async (req, res) => {
    // Nyheds-kode...
});
app.get('/api/calendar-events', async (req, res) => {
    // Kalender-kode...
});
app.get('/api/documents/:category', async (req, res) => {
    // Hent-dokumenter-kode...
});
app.post('/api/upload/:category', upload.single('document'), async (req, res) => {
    // Upload-kode...
});

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ message: 'Søgeord mangler.' });

    try {
        const graphClient = await getGraphClient();
        
        // Promise.all lader os køre begge søgninger på samme tid
        const [newsResults, documentResults] = await Promise.all([
            // Søgning #1: Søg i Supabase efter nyheder
            supabase
                .from('news')
                .select('title, summary')
                .textSearch('fts', query, { type: 'websearch', config: 'danish' }),

            // Søgning #2: Søg i SharePoint efter dokumenter
            graphClient.api(`/drives/${sharePointConfig.driveId}/root/search(q='${query}')`)
                .select('id,name,webUrl')
                .get()
        ]);
        
        // Formater resultaterne fra Supabase
        const formattedNews = newsResults.data.map(item => ({
            type: 'Nyhed',
            title: item.title,
            description: item.summary,
            link: '/' // Nyheder linker bare til forsiden for nu
        }));

        // Formater resultaterne fra SharePoint
        const formattedDocuments = documentResults.value.map(item => ({
            type: 'Dokument',
            title: item.name,
            description: 'Et dokument fundet i SharePoint.',
            link: item.webUrl // Direkte link til filen
        }));

        // Kombiner de to lister og send dem tilbage
        const combinedResults = [...formattedNews, ...formattedDocuments];
        res.json(combinedResults);

    } catch (error) {
        console.error('Fejl under kombineret søgning:', error);
        res.status(500).json({ message: 'Der skete en fejl under søgningen.' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));