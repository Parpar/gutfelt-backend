require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// --- MERE DETALJERET TJEK AF NØGLER ---
console.log("--- Server starter op ---");
console.log("Modtaget Supabase URL:", supabaseUrl ? `...${supabaseUrl.slice(-10)}` : "IKKE FUNDET");
console.log("Modtaget Supabase Key:", supabaseKey ? "Ja, nøgle er til stede" : "IKKE FUNDET");
// ------------------------------------

if (!supabaseUrl || !supabaseKey) {
    console.error("Fejl: Supabase URL eller Key mangler. Stopper server.");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 8000;
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Gutfelt Back-end Server er live. Forbundet til Supabase.'));

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(`--- Modtog login-forsøg for: ${email} ---`);

    if (!email || !password) {
        return res.status(400).json({ message: 'Email og password er påkrævet.' });
    }

    try {
        console.log("1. Søger efter bruger i databasen...");
        const { data: user, error } = await supabase.from('users').select('*').eq('email', email).single();

        if (error || !user) {
            console.log("2. FEJL: Bruger blev ikke fundet i databasen.");
            return res.status(401).json({ message: 'Forkert email eller password.' });
        }
        console.log(`2. SUCCES: Bruger fundet med ID: ${user.id}`);
        
        console.log("3. Sammenligner passwords...");
        const passwordIsValid = bcrypt.compareSync(password, user.password);

        if (!passwordIsValid) {
            console.log("4. FEJL: Passwords matcher IKKE.");
            console.log("   - Indtastet (ukrypteret):", password);
            console.log("   - Gemt (krypteret):", user.password);
            return res.status(401).json({ message: 'Forkert email eller password.' });
        }

        console.log("4. SUCCES: Passwords matcher.");
        res.json({ id: user.id, name: user.name, email: user.email, role: user.role });

    } catch (err) {
        console.error('5. SERVERFEJL under login:', err);
        res.status(500).json({ message: 'Der skete en fejl på serveren.' });
    }
});

app.listen(PORT, () => console.log(`Back-end serveren kører nu på port ${PORT}`));