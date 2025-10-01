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
const sharePointConfig = { siteId: process.env.SITE_ID, driveId: process.env.DRIVE_ID, folderIds: { fakturering: process.env.FOLDER_ID_FAKTURERING, kickoff: process.env.FOLDER_ID_KICKOFF, kundehåndtering: process.env.FOLDER_ID_KUNDEHAANDTERING, kvalitetsstyring: process.env.FOLDER_ID_KVALITETSSTYRING, mandagsøder: process.env.FOLDER_ID_MANDAGSMOEDER, personalehåndbog: process.env.FOLDER_ID_PERSONALEHAANDBOG, persondatapolitik: process.env.FOLDER_ID_PERSONDATAPOLITIK, slettepolitik: process.env.FOLDER_ID_SLETTEPOLITIK, whistleblower: process.env.FOLDER_ID_WHISTLEBLOWER, fjernlager: process.env.FOLDER_ID_FJERNLAGER, kompetenceskema: process.env.FOLDER_ID_KOMPETENCESKEMA, kursusmaterialer: process.env.FOLDER_ID_KURSUSMATERIALER, planlægning: process.env.FOLDER_ID_PLANLAEGNING, bygning: process.env.FOLDER_ID_BYGNING, rådgivere: process.env.FOLDER_ID_RAADGIVERE, systemer: process.env.FOLDER_ID_SYSTEMER, aftalebreve: process.env.FOLDER_ID_AFTALEBREVE, engagement: process.env.FOLDER_ID_ENGAGEMENT, habilitet: process.env.FOLDER_ID_HABILITET, protokollat: process.env.FOLDER_ID_PROTOKOLLAT, tjeklister: process.env.FOLDER_ID_TJEKLISTER, oevrige: process.env.FOLDER_ID_OEVRIGE, forsikringer: process.env.FOLDER_ID_FORSIKRINGER, hvidvask: process.env.FOLDER_ID_HVIDVASK } };
const newsListId = process.env.NEWS_LIST_ID;
const calendarId = process.env.CALENDAR_ID;
const calendarUser = process.env.CALENDAR_USER_EMAIL;
const HASH_SECRET = process.env.HASH_SECRET;
const PLANNING_SHEET_ID = process.env.PLANNING_SHEET_ID;
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

app.get('/api/documents/:category', async (req, res) => {
    const category = req.params.category.toLowerCase();
    const folderId = sharePointConfig.folderIds[category];
    if (!folderId) return res.status(400).json({ message: `Ukendt kategori: ${category}` });
    try {
        const graphClient = await getGraphClient();
        const listPath = `/drives/${sharePointConfig.driveId}/items/${folderId}/children`;
        const response = await graphClient.api(listPath).select('id,name,size,webUrl').get();
        const documents = response.value.map(item => ({ id: item.id, name: item.name, path: item.webUrl, size: item.size }));
        res.json(documents);
    } catch (error) { res.status(500).json({ message: 'Kunne ikke hente dokumenter fra SharePoint.' }); }
});

app.post('/api/upload/:category', upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Ingen fil blev uploadet.' });
    const category = req.params.category.toLowerCase();
    const folderId = sharePointConfig.folderIds[category];
    if (!folderId) return res.status(400).json({ message: `Ukendt upload-kategori: ${category}` });
    try {
        const graphClient = await getGraphClient();
        const uploadPath = `/drives/${sharePointConfig.driveId}/items/${folderId}:/${req.file.originalname}:/content`;
        const response = await graphClient.api(uploadPath).put(req.file.buffer);
        res.status(201).json({ message: 'Fil uploadet succesfuldt til SharePoint!', file: { name: response.name, path: response.webUrl, size: response.size } });
    } catch (error) { res.status(500).json({ message: 'Der skete en serverfejl under upload.' }); }
});

app.get('/api/partners/:category', async (req, res) => {
    const category = req.params.category;
    console.log(`[LOG] Modtog anmodning for partner-kategori: ${category}`);

    if (!category) {
        console.log("[FEJL] Kategori mangler i anmodning.");
        return res.status(400).json({ message: `Kategori mangler.` });
    }
    try {
        console.log("[LOG] Opretter Graph Client...");
        const graphClient = await getGraphClient();
        console.log("[LOG] Forsøger at hente alle items fra partner-listen...");
        const response = await graphClient.api(`/sites/${sharePointConfig.siteId}/lists/${PARTNERS_LIST_ID}/items`)
            .expand('fields')
            .get();
        
        console.log(`[LOG] Modtog ${response.value.length} partnere fra SharePoint.`);
        const allPartners = response.value.map(item => item.fields);
        
        console.log(`[LOG] Filtrerer for kategori: '${category}'`);
        const filteredPartners = allPartners.filter(p => p.Kategori === category);
        
        console.log(`[LOG] Fandt ${filteredPartners.length} matchende partnere.`);
        res.json(filteredPartners);
    } catch (error) {
        console.error("[KRITISK FEJL] Fejl under hentning af partnere:", error);
        res.status(500).json({ message: 'Kunne ikke hente partnere.' });
    }
});

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) { return res.status(400).json({ message: 'Søgeord mangler.' }); }
    try {
        const graphClient = await getGraphClient();
        const allFiles = [];
        for (const folderId of Object.values(sharePointConfig.folderIds)) {
            if (folderId) {
                const listPath = `/drives/${sharePointConfig.driveId}/items/${folderId}/children`;
                const response = await graphClient.api(listPath).select('name,webUrl').get();
                allFiles.push(...response.value);
            }
        }
        const lowerCaseQuery = query.toLowerCase();
        const filteredFiles = allFiles.filter(file => file.name.toLowerCase().includes(lowerCaseQuery));
        const documentResults = filteredFiles.map(item => ({ type: 'Dokument', title: item.name, description: 'Dokument fundet i SharePoint.', link: item.webUrl }));
        res.json(documentResults);
    } catch (error) { res.status(500).json({ message: 'Der skete en fejl under søgningen.' }); }
});

app.get('/api/hash/:secret/:password', (req, res) => {
    const { secret, password } = req.params;
    if (!HASH_SECRET) { return res.status(500).send('HASH_SECRET er ikke konfigureret på serveren.'); }
    if (secret !== HASH_SECRET) { return res.status(403).send('Adgang nægtet.'); }
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    res.send(`<p>Krypteret password for '${password}':</p><p style="font-family:monospace; background:#eee; padding:10px; border:1px solid #ddd;">${hash}</p>`);
});

app.get('/api/planning-sheet', async (req, res) => {
    if (!PLANNING_SHEET_ID) {
        return res.status(500).json({ message: 'Planlægnings-ark er ikke konfigureret på serveren.' });
    }
    try {
        const graphClient = await getGraphClient();
        const itemUrl = `/drives/${sharePointConfig.driveId}/items/${PLANNING_SHEET_ID}`;
        const response = await graphClient.api(itemUrl).select('webUrl').get();
        const embedUrl = `${response.webUrl}?action=embedview`;
        res.json({ embedUrl: embedUrl });
    } catch (error) {
        res.status(500).json({ message: 'Kunne ikke hente indlejrings-link.' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));