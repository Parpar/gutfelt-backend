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
app.post('/api/upload/:category', async (req, res) => { /* Koden er uændret, men vil nu også opdatere Supabase */ });

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ message: 'Søgeord mangler.' });
    try {
        const { data, error } = await supabase
            .from('documents')
            .select('name, link')
            .ilike('name', `%${query}%`); // Søger efter filnavne, der indeholder søgeordet
        
        if (error) throw error;

        const results = data.map(item => ({
            type: 'Dokument',
            title: item.name,
            description: 'Dokument fundet i SharePoint.',
            link: item.link
        }));
        res.json(results);
    } catch (error) {
        res.status(500).json({ message: 'Der skete en fejl under søgningen.' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));

// Funktion til at synkronisere filer fra SharePoint til Supabase
async function syncSharePointToSupabase() {
    console.log("Starter synkronisering af SharePoint-filer...");
    try {
        const graphClient = await getGraphClient();
        const allFiles = [];

        for (const [category, folderId] of Object.entries(sharePointConfig.folderIds)) {
            const listPath = `/drives/${sharePointConfig.driveId}/items/${folderId}/children`;
            const response = await graphClient.api(listPath).select('id,name,webUrl').get();
            const documents = response.value.map(item => ({
                name: item.name,
                link: item.webUrl,
                category: category
            }));
            allFiles.push(...documents);
        }

        // Slet den gamle liste i Supabase
        const { error: deleteError } = await supabase.from('documents').delete().neq('id', 0);
        if (deleteError) throw deleteError;

        // Indsæt den nye, friske liste
        const { error: insertError } = await supabase.from('documents').insert(allFiles);
        if (insertError) throw insertError;
        
        console.log(`Synkronisering fuldført. ${allFiles.length} filer blev indekseret.`);
    } catch (error) {
        console.error("Fejl under synkronisering af SharePoint:", error);
    }
}

// Kør synkroniseringen én gang, når serveren starter
syncSharePointToSupabase();
// Sæt den til at køre igen hver time
setInterval(syncSharePointToSupabase, 3600000); 
```*(Husk at indsætte den fulde kode for de forkortede funktioner).*

**Fase 3: Opdater din Front-end (`searchresults.js`)**
**Handling:** Erstat **ALT** indholdet i din `gutfelt-intranet/src/pages/searchresults.js`-fil.

```jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (query) {
      const fetchResults = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`https://gutfelt-backend.onrender.com/api/search?q=${query}`);
          const data = await response.json();
          setResults(data);
        } catch (error) {
          console.error("Søgning fejlede:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchResults();
    }
  }, [query]);
  
  const getIcon = (type) => (type === 'Dokument' ? 'fa-file-alt' : 'fa-newspaper');

  return (
    <div className="widget" style={{ margin: '2rem' }}>
      <h2>Søgeresultater for "{query}"</h2>
      {isLoading ? ( <p>Søger i dokumentarkivet...</p> ) : 
      ( results.length > 0 ? (
          <table className="document-table">
            <thead><tr><th>Type</th><th>Titel</th><th>Beskrivelse</th></tr></thead>
            <tbody>
              {results.map((result, index) => (
                <tr key={index}>
                  <td className="file-name-cell"><div className="file-icon"><i className={`fas ${getIcon(result.type)}`}></i></div><span>{result.type}</span></td>
                  <td><a href={result.link} target="_blank" rel="noopener noreferrer">{result.title}</a></td>
                  <td>{result.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : ( <p>Ingen dokumenter matchede din søgning.</p> )
      )}
      <Link to="/" className="back-link" style={{marginTop: '2rem'}}>← Tilbage til forsiden</Link>
    </div>
  );
}

export default SearchResultsPage;