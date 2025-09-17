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
const sharePointConfig = { siteId: process.env.SITE_ID, driveId: process.env.DRIVE_ID, folderIds: { fakturering: process.env.FOLDER_ID_FAKTURERING, kickoff: process.env.FOLDER_ID_KICKOFF, kundehåndtering: process.env.FOLDER_ID_KUNDEHAANDTERING, kvalitetsstyring: process.env.FOLDER_ID_KVALITETSSTYRING, mandagsmøder: process.env.FOLDER_ID_MANDAGSMOEDER, personalehåndbog: process.env.FOLDER_ID_PERSONALEHAANDBOG, persondatapolitik: process.env.FOLDER_ID_PERSONDATAPOLITIK, slettepolitik: process.env.FOLDER_ID_SLETTEPOLITIK, whistleblower: process.env.FOLDER_ID_WHISTLEBLOWER, fjernlager: process.env.FOLDER_ID_FJERNLAGER, kompetenceskema: process.env.FOLDER_ID_KOMPETENCESKEMA, kursusmaterialer: process.env.FOLDER_ID_KURSUSMATERIALER, planlægning: process.env.FOLDER_ID_PLANLAEGNING, bygning: process.env.FOLDER_ID_BYGNING, rådgivere: process.env.FOLDER_ID_RAADGIVERE, systemer: process.env.FOLDER_ID_SYSTEMER, aftalebreve: process.env.FOLDER_ID_AFTALEBREVE, engagement: process.env.FOLDER_ID_ENGAGEMENT, habilitet: process.env.FOLDER_ID_HABILITET, protokollat: process.env.FOLDER_ID_PROTOKOLLAT, tjeklister: process.env.FOLDER_ID_TJEKLISTER, oevrige: process.env.FOLDER_ID_OEVRIGE, forsikringer: process.env.FOLDER_ID_FORSIKRINGER } };
const newsListId = process.env.NEWS_LIST_ID;
const calendarId = process.env.CALENDAR_ID;
const calendarUser = process.env.CALENDAR_USER_EMAIL;
const HASH_SECRET = process.env.HASH_SECRET;
const PLANNING_SHEET_ID = process.env.PLANNING_SHEET_ID;

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

app.post('/api/login', async (req, res) => { /* Koden er uændret */ });
app.get('/api/news', async (req, res) => { /* Koden er uændret */ });
app.get('/api/calendar-events', async (req, res) => { /* Koden er uændret */ });
app.get('/api/documents/:category', async (req, res) => { /* Koden er uændret */ });
app.post('/api/upload/:category', upload.single('document'), async (req, res) => { /* Koden er uændret */ });
app.get('/api/search', async (req, res) => { /* Koden er uændret */ });
app.get('/api/hash/:secret/:password', (req, res) => { /* Koden er uændret */ });

app.get('/api/planning-sheet', async (req, res) => {
    if (!PLANNING_SHEET_ID) {
        return res.status(500).json({ message: 'Planlægnings-ark er ikke konfigureret.' });
    }
    try {
        const graphClient = await getGraphClient();
        const permissionUrl = `/drives/${sharePointConfig.driveId}/items/${PLANNING_SHEET_ID}/permissions`;
        const embedUrlPath = `/drives/${sharePointConfig.driveId}/items/${PLANNING_SHEET_ID}/preview`;

        const permissionPayload = {
            roles: ["read"],
            grantedToIdentities: [{ application: { id: msalConfig.auth.clientId, displayName: "Gutfelt Intranet Backend" } }]
        };

        // Først, anmod om midlertidig læse-adgang for at skabe et link
        await graphClient.api(permissionUrl).post(permissionPayload);

        // Dernæst, bed om et preview-link, som kan indlejres
        const response = await graphClient.api(embedUrlPath).post({ viewer: "office", allowEdit: true });
        
        // Ret URL'en til at være et embed-link
        const embedUrl = response.getUrl.replace("WopiFrame.aspx", "WopiFrame.aspx?action=embedview&wdbipreview=true");

        res.json({ embedUrl: embedUrl });

    } catch (error) {
        console.error('Fejl under hentning af embed-link:', error);
        res.status(500).json({ message: 'Kunne ikke hente indlejrings-link.' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));