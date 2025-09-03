// --- 1. IMPORTER VÆRKTØJER ---
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch'); // Nødvendig polyfill for Graph Client

// --- 2. KONFIGURATION (LÆSER FRA SIKRE ENVIRONMENT VARIABLES) ---
// Disse værdier skal du indsætte i "Environment"-sektionen på Render.com
const config = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    },
    sharePoint: {
        siteId: process.env.SITE_ID,
        driveId: process.env.DRIVE_ID,
        // Vi opretter et "opslagsværk" (map) for at finde den rigtige mappe-ID
        // baseret på, hvilken side brugeren uploader fra.
        folderIds: {
            personale: process.env.FOLDER_ID_PERSONALE,
            medarbejdere: process.env.FOLDER_ID_MEDARBEJDERE,
            // Tilføj flere her, f.eks.:
            // gdpr: process.env.FOLDER_ID_GDPR, 
        }
    }
};

// --- 3. INITIALISER MICROSOFT AUTH OG GRAPH CLIENT ---
const cca = new ConfidentialClientApplication(config.auth);

// Funktion til at få en "autentificeret" Graph Client, der kan tale med Microsoft
async function getGraphClient() {
    // Anskaf en "adgangsbillet" (token) fra Microsoft ved hjælp af vores hemmeligheder
    const authResponse = await cca.acquireTokenByClientCredential({
        scopes: ['https://graph.microsoft.com/.default'],
    });

    // Initialiser Graph Client med adgangsbilletten
    return Client.init({
        authProvider: (done) => {
            done(null, authResponse.accessToken);
        },
    });
}

// --- 4. SERVER OPSÆTNING ---
const app = express();
// Render sætter selv PORT-variablen. Vi lytter til den, ellers bruger vi 8000 lokalt.
const PORT = process.env.PORT || 8000; 

app.use(cors());
app.use(express.json());

// Multer konfigureres til at holde den uploadede fil i hukommelsen
const upload = multer({ storage: multer.memoryStorage() });

// Falsk bruger-database til vores simple login
const users = [
    { id: 1, email: 'peter@gutfelt.com', password: '123', name: 'Peter Jensen', role: 'Medarbejder' },
    { id: 2, email: 'susanne@gutfelt.com', password: '123', name: 'Susanne Nielsen', role: 'HR-redaktør' }
];

// --- 5. API ENDPOINTS ---

// Simpelt test-endpoint
app.get('/', (req, res) => {
    res.send('Hej fra Gutfelt Back-end Server! Serveren er live.');
});

// Login endpoint (uændret)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (user && user.password === password) {
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } else {
        res.status(401).json({ message: 'Forkert email eller password.' });
    }
});

// UPLOAD ENDPOINT - Med SharePoint integration
// URL'en indeholder nu en "kategori", f.eks. /api/upload/personale
app.post('/api/upload/:category', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Ingen fil blev uploadet.' });
    }
    
    // Find den rigtige Folder ID baseret på kategorien i URL'en
    const category = req.params.category;
    const folderId = config.sharePoint.folderIds[category];

    if (!folderId) {
        return res.status(400).json({ message: `Ukendt upload-kategori: ${category}` });
    }

    try {
        console.log(`Modtog fil til kategori '${category}'. Forsøger upload til SharePoint...`);
        const graphClient = await getGraphClient();
        
        // Byg den korrekte sti i SharePoint til upload
        const uploadPath = `/drives/${config.sharePoint.driveId}/items/${folderId}:/${req.file.originalname}:/content`;

        // Upload filens buffer (indholdet) til SharePoint
        const response = await graphClient.api(uploadPath).put(req.file.buffer);

        console.log('Fil uploadet succesfuldt til SharePoint!');
        
        res.status(201).json({
            message: 'Fil uploadet succesfuldt til SharePoint!',
            file: {
                name: response.name,
                path: response['@microsoft.graph.downloadUrl'], // Et sikkert, midlertidigt download-link
                size: response.size
            }
        });

    } catch (error) {
        console.error('Fejl under upload til SharePoint:', error.message);
        res.status(500).json({ message: 'Der skete en serverfejl under upload.' });
    }
});


// --- 6. START SERVER ---
app.listen(PORT, () => {
    console.log(`Back-end serveren kører nu på port ${PORT}`);
});