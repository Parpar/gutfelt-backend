require('dotenv').config(); // Læser hemmeligheder fra .env-filen

// --- 1. IMPORTER VÆRKTØJER ---
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// --- 2. KONFIGURATION (LÆSER FRA SIKRE ENVIRONMENT VARIABLES) ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Tjek om nøglerne er indlæst korrekt
if (!supabaseUrl || !supabaseKey) {
    console.error("Fejl: Supabase URL eller Key mangler. Tjek dine .env eller Environment Variables.");
    process.exit(1); // Stop serveren, hvis konfigurationen mangler
}
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 3. SERVER OPSÆTNING ---
const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

// --- 4. API ENDPOINTS ---

// Simpelt test-endpoint
app.get('/', (req, res) => {
    res.send('Hej fra Gutfelt Back-end Server! Forbundet til Supabase.');
});

// LOGIN ENDPOINT - Med database og kryptering
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email og password er påkrævet.' });
    }

    try {
        // Find brugeren i Supabase-databasen baseret på email
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            // Her var fejlen før. Nu er den korrekt.
            console.log(`Login-forsøg for ukendt bruger: ${email}`);
            return res.status(401).json({ message: 'Forkert email eller password.' });
        }

        // Sammenlign det indtastede password med det krypterede password i databasen
        const passwordIsValid = bcrypt.compareSync(password, user.password);

        if (!passwordIsValid) {
            console.log(`Login fejlede: Forkert password for bruger: ${email}`);
            return res.status(401).json({ message: 'Forkert email eller password.' });
        }

        // SUCCES!
        console.log(`Login succesfuldt for: ${user.name}`);
        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        });

    } catch (err) {
        console.error('Serverfejl under login:', err);
        res.status(500).json({ message: 'Der skete en fejl på serveren.' });
    }
});

// --- 5. START SERVER ---
app.listen(PORT, () => {
    console.log(`Back-end serveren kører nu på port ${PORT}`);
});