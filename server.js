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
const sharePointConfig = { siteId: process.env.SITE_ID, driveId: process.env.DRIVE_ID, folderIds: { fakturering: process.env.FOLDER_ID_FAKTURERING, kickoff: process.env.FOLDER_ID_KICKOFF, kundehåndtering: process.env.FOLDER_ID_KUNDEHAANDTERING, kvalitetsstyring: process.env.FOLDER_ID_KVALITETSSTYRING, mandagsmøder: process.env.FOLDER_ID_MANDAGSMOEDER, personalehåndbog: process.env.FOLDER_ID_PERSONALEHAANDBOG, persondatapolitik: process.env.FOLDER_ID_PERSONDATAPOLITIK, slettepolitik: process.env.FOLDER_ID_SLETTEPOLITIK, whistleblower: process.env.FOLDER_ID_WHISTLEBLOWER, fjernlager: process.env.FOLDER_ID_FJERNLAGER, kompetenceskema: process.env.FOLDER_ID_KOMPETENCESKEMA, kursusmaterialer: process.env.FOLDER_ID_KURSUSMATERIALER, planlægning: process.env.FOLDER_ID_PLANLAEGNING, bygning: process.env.FOLDER_ID_BYGNING, rådgivere: process.env.FOLDER_ID_RAADGIVERE, systemer: process.env.FOLDER_ID_SYSTEMER, aftalebreve: process.env.FOLDER_ID_AFTALEBREVE, engagement: process.env.FOLDER_ID_ENGAGEMENT, habilitet: process.env.FOLDER_ID_HABILITET, protokollat: process.env.FOLDER_ID_PROTOKOLLAT, tjeklister: process.env.FOLDER_ID_TJEKLISTER, oevrige: process.env.FOLDER_ID_OEVRIGE } };
const newsListId = process.env.NEWS_LIST_ID;
const calendarId = process.env.CALENDAR_ID;
const calendarUser = process.env.CALENDAR_USER_EMAIL;
const HASH_SECRET = process.env.HASH_SECRET;

const supabase = createClient(supabaseUrl, supabaseKey);
const cca = new ConfidentialClientApplication(msalConfig);
async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
    return Client.init({ authProvider: (done) => done(null, authResponse.accessToken) });
}

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

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

app.get('/api/hash/:secret/:password', (req, res) => {
    const { secret, password } = req.params;
    if (secret !== HASH_SECRET) {
        return res.status(403).send('Adgang nægtet.');
    }
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    res.send(`<p>Krypteret password for '${password}':</p><p style="font-family:monospace; background:#eee; padding:10px; border:1px solid #ddd;">${hash}</p>`);
});

// ... (alle dine andre endpoints som /api/news, /api/search etc. er her) ...

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));