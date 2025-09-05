```javascript
require('dotenv').config();

// --- 1. IMPORTER VÆRKTØJER ---
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

// --- 2. KONFIGURATION (LÆSER ALLE NØGLER FRA ENVIRONMENT VARIABLES) ---
// Supabase Konfiguration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Microsoft Konfiguration
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
        personale: process.env.FOLDER_ID_PERSONALE,
        medarbejdere: process.env.FOLDER_ID_MEDARBEJDERE,
        // Tilføj flere her efter behov
    }
};

// Tjek om alle nøgler er indlæst korrekt
if (!supabaseUrl || !supabaseKey || !msalConfig.auth.clientId || !msalConfig.auth.clientSecret) {
    console.error("Fejl: En eller flere kritiske Environment Variables mangler.");
    process.exit(1);
}

// Initialiser klienter
const supabase = createClient(supabaseUrl, supabaseKey);
const cca = new ConfidentialClientApplication(msalConfig);

async function getGraphClient() {
    const authResponse = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
    });
    return Client.init({
        authProvider: (done) => done(null, authResponse.accessToken),
    });
}

// --- 3. SERVER OPSÆTNING ---
const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());
const upload = multer({ storage: multer.memoryStorage() });

// --- 4. API ENDPOINTS ---
app.get('/', (req, res) => res.send('Gutfelt Back-end Server er live. Forbundet til Supabase og klar til SharePoint.'));

// LOGIN ENDPOINT (bruger Supabase)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email og password er påkrævet.' });

    try {
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();
        if (error || !user) return res.status(401).json({ message: 'Forkert email eller password.' });
        
        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) return res.status(401).json({ message: 'Forkert email eller password.' });

        console.log(`Login succesfuldt for: ${user.name}`);
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (err) {
        console.error('Serverfejl under login:', err);
        res.status(500).json({ message: 'Der skete en fejl på serveren.' });
    }
});

// UPLOAD ENDPOINT (bruger SharePoint)
app.post('/api/upload/:category', upload.single('document'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Ingen fil blev uploadet.' });
    
    const category = req.params.category;
    const folderId = sharePointConfig.folderIds[category];
    if (!folderId) return res.status(400).json({ message: `Ukendt upload-kategori: ${category}` });

    try {
        const graphClient = await getGraphClient();
        const uploadPath = `/drives/${sharePointConfig.driveId}/items/${folderId}:/${req.file.originalname}:/content`;
        const response = await graphClient.api(uploadPath).put(req.file.buffer);

        console.log('Fil uploadet succesfuldt til SharePoint!');
        res.status(201).json({
            message: 'Fil uploadet succesfuldt til SharePoint!',
            file: {
                name: response.name,
                path: response['@microsoft.graph.downloadUrl'],
                size: response.size
            }
        });
    } catch (error) {
        console.error('Fejl under upload til SharePoint:', error);
        res.status(500).json({ message: 'Der skete en serverfejl under upload.' });
    }
});

// --- 5. START SERVER ---
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));
```