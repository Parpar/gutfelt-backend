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

const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};

const sharePointConfig = {
    siteId: process.env.SITE_ID,
    driveId: process.env.DRIVE_ID,
    folderIds: {
        fakturering: process.env.FOLDER_ID_FAKTURERING,
        kickoff: process.env.FOLDER_ID_KICKOFF,
        kundehåndtering: process.env.FOLDER_ID_KUNDEHANDTERING,
        kvalitetsstyring: process.env.FOLDER_ID_KVALITETSSTYRING,
        mandagsmøder: process.env.FOLDER_ID_MANDAGSMOEDER,
        personalehåndbog: process.env.FOLDER_ID_PERSONALEHAANDBOG,
        persondatapolitik: process.env.FOLDER_ID_PERSONDATAPOLITIK,
        slettepolitik: process.env.FOLDER_ID_SLETTEPOLITIK,
        whistleblower: process.env.FOLDER_ID_WHISTLEBLOWER,
        fjernlager: process.env.FOLDER_ID_FJERNLAGER,
        kompetenceskema: process.env.FOLDER_ID_KOMPETENCESKEMA,
        kursusmaterialer: process.env.FOLDER_ID_KURSUSMATERIALER,
        planlægning: process.env.FOLDER_ID_PLANLAEGNING,
        bygning: process.env.FOLDER_ID_BYGNING,
        rådgivere: process.env.FOLDER_ID_RAADGIVERE,
        systemer: process.env.FOLDER_ID_SYSTEMER,
        aftalebreve: process.env.FOLDER_ID_AFTALEBREVE,
        engagement: process.env.FOLDER_ID_ENGAGEMENT,
        habilitet: process.env.FOLDER_ID_HABILITET,
        protokollat: process.env.FOLDER_ID_PROTOKOLLAT,
        tjeklister: process.env.FOLDER_ID_TJEKLISTER,
        oevrige: process.env.FOLDER_ID_OEVRIGE
    }
};

if (!supabaseUrl || !supabaseKey || !msalConfig.auth.clientId) {
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
    } catch (err) {
        console.error('Serverfejl under login:', err);
        res.status(500).json({ message: 'Der skete en serverfejl.' });
    }
});

app.get('/api/documents/:category', async (req, res) => {
    const category = req.params.category.toLowerCase();
    const folderId = sharePointConfig.folderIds[category];
    if (!folderId) return res.status(400).json({ message: `Ukendt kategori: ${category}` });

    try {
        const graphClient = await getGraphClient();
        const listPath = `/drives/${sharePointConfig.driveId}/items/${folderId}/children`;
        const response = await graphClient.api(listPath)
            .select('id,name,size,@microsoft.graph.downloadUrl')
            .get();
        const documents = response.value.map(item => ({
            id: item.id,
            name: item.name,
            path: item['@microsoft.graph.downloadUrl'],
            size: item.size
        }));
        res.json(documents);
    } catch (error) {
        console.error(`Fejl under hentning af dokumenter for kategori ${category}:`, error);
        res.status(500).json({ message: 'Kunne ikke hente dokumenter fra SharePoint.' });
    }
});

app.post('/api/upload/:category', upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Ingen fil blev uploadet.' });
    
    const category = req.params.category.toLowerCase();
    const folderId = sharePointConfig.folderIds[category];
    if (!folderId) {
        console.error(`Ukendt kategori modtaget: ${category}`);
        return res.status(400).json({ message: `Ukendt upload-kategori: ${category}` });
    }

    try {
        const graphClient = await getGraphClient();
        const uploadPath = `/drives/${sharePointConfig.driveId}/items/${folderId}:/${req.file.originalname}:/content`;
        const response = await graphClient.api(uploadPath).put(req.file.buffer);
        console.log(`Fil uploadet til SharePoint i kategori: ${category}`);
        res.status(201).json({
            message: 'Fil uploadet succesfuldt til SharePoint!',
            file: { name: response.name, path: response['@microsoft.graph.downloadUrl'], size: response.size }
        });
    } catch (error) {
        console.error(`Fejl under upload til SharePoint for kategori ${category}:`, error);
        res.status(500).json({ message: 'Der skete en serverfejl under upload.' });
    }
});

app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));