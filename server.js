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

const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};

const sharePointConfig = {
    siteId: process.env.SITE_ID
};

const newsListId = process.env.NEWS_LIST_ID;

if (!supabaseUrl || !supabaseKey || !msalConfig.auth.clientId || !newsListId) {
    console.error("Fejl: Kritiske Environment Variables mangler.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const cca = new ConfidentialClientApplication(msalConfig);

async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
    return Client.init({ authProvider: (done) => done(null, authResponse.accessToken) });
}

const app = express();
const PORT = process.env.PORT || 8000;
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
    } catch (err) {
        res.status(500).json({ message: 'Der skete en serverfejl.' });
    }
});

app.get('/api/news', async (req, res) => {
    try {
        const graphClient = await getGraphClient();
        const response = await graphClient.api(`/sites/${sharePointConfig.siteId}/lists/${newsListId}/items`)
            .expand('fields($select=Title,Summary)')
            .get();
        const newsArticles = response.value.map(item => ({
            title: item.fields.Title,
            summary: item.fields.Summary
        }));
        res.json(newsArticles);
    } catch (error) {
        res.status(500).json({ message: 'Kunne ikke hente nyheder fra SharePoint.' });
    }
});

app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));