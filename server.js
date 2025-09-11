require('dotenv').config();

// --- 1. IMPORTER ALLE NØDVENDIGE VÆRKTØJER ---
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

// --- 2. KONFIGURATION (LÆSER ALLE NØGLER) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};

// --- FULDT OPDATERET SHAREPOINT KONFIGURATION ---
const sharePointConfig = {
    siteId: process.env.SITE_ID,
    driveId: process.env.DRIVE_ID,
    folderIds: {
        // Firmapolitikker
        fakturering: process.env.FOLDER_ID_FAKTURERING,
        kickoff: process.env.FOLDER_ID_Kickoff,
        kundehåndtering: process.env.FOLDER_ID_Kundehaandtering,
        kvalitetsstyring: process.env.FOLDER_ID_Kvalitetsstyringsmanuel,
        mandagsmøder: process.env.FOLDER_ID_Mandagsmoeder,
        personalehåndbog: process.env.FOLDER_ID_Personalehaandbog,
        persondatapolitik: process.env.FOLDER_ID_Persondatapolitik,
        slettepolitik: process.env.FOLDER_ID_Slettepolitik,
        whistleblower: process.env.FOLDER_ID_Whistleblowordning,
        // Medarbejdere
        fjernlager: process.env.FOLDER_ID_Fjernlager,
        kompetenceskema: process.env.FOLDER_ID_Kompetenceskema,
        kursusmaterialer: process.env.FOLDER_ID_Kursusmaterialer,
        planlægning: process.env.FOLDER_ID_Planlaegning,
        // Samarbejdspartnere
        bygning: process.env.FOLDER_ID_Bygning_faciliteter_frokost,
        rådgivere: process.env.FOLDER_ID_Raadgivere,
        systemer: process.env.FOLDER_ID_Systemer,
        // Standarder
        aftalebreve: process.env.FOLDER_ID_Aftalebreve,
        engagement: process.env.FOLDER_ID_Engagementsforespørgsel,
        habilitet: process.env.FOLDER_ID_Habilitet_og_hvidvask,
        protokollat: process.env.FOLDER_ID_Protokollat_erklaering_og_referat,
        tjeklister: process.env.FOLDER_ID_Tjeklister_og_indeks,
        oevrige: process.env.FOLDER_ID_Oevrige_skabeloner
    }
};

if (!supabaseUrl || !supabaseKey || !msalConfig.auth.clientId) {
    console.error("Fejl: Kritiske Environment Variables mangler. Tjek Supabase & Azure nøgler.");
    process.exit(1);
}

// Initialiser klienter
const supabase = createClient(supabaseUrl, supabaseKey);
const cca = new ConfidentialClientApplication(msalConfig);

async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({ scopes: ['https://graph.microsoft.com/.default'] });
    return Client.init({ authProvider: (done) => done(null, authResponse.accessToken) });
}

// --- 3. SERVER OPSÆTNING ---
const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// --- 4. API ENDPOINTS ---
app.get('/', (req, res) => res.send('Gutfelt Back-end er live. Forbundet til Supabase og klar til SharePoint.'));

// LOGIN ENDPOINT (bruger Supabase)
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

// UPLOAD ENDPOINT (bruger SharePoint)
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

// --- 5. START SERVER ---
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));