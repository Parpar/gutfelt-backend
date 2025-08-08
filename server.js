// 1. Importer de værktøjer, vi skal bruge
const express = require('express');
const cors = require('cors');

// 2. Opret en instans af vores Express-app (vores server)
const app = express();
const PORT = 8000; // Vi vælger, at vores back-end skal køre på port 8000

// 3. Konfiguration
// Tillad, at vores front-end (fra en anden port) kan sende forespørgsler
app.use(cors()); 
// Tillad, at serveren kan modtage og læse JSON-data i forespørgsler
app.use(express.json()); 

// 4. Vores FALSKE bruger-database
// I en rigtig app ville dette komme fra en rigtig database
const users = [
  { id: 1, email: 'peter@gutfelt.com', password: '123', name: 'Peter Jensen', role: 'Medarbejder' },
  { id: 2, email: 'susanne@gutfelt.com', password: '123', name: 'Susanne Nielsen', role: 'HR-redaktør' }
];

// 5. DEFINER VORES API ENDPOINTS (vores "døre")

// Et simpelt test-endpoint på rod-URL'en
app.get('/', (req, res) => {
  res.send('Hej fra Gutfelt Back-end Server!');
});

// Vores rigtige LOGIN endpoint
// Den lytter efter POST-forespørgsler på adressen /api/login
app.post('/api/login', (req, res) => {
  // Hent email og password fra den forespørgsel, som front-end'en sender
  const { email, password } = req.body;

  console.log(`Modtog login-forsøg for email: ${email}`);

  // Find en bruger i vores falske database, der matcher email'en
  const user = users.find(u => u.email === email);

  // Tjek, om brugeren blev fundet, og om passwordet matcher
  if (user && user.password === password) {
    // SUCCES! Brugeren findes, og password er korrekt.
    console.log(`Login succesfuldt for: ${user.name}`);
    // Send brugerens data (uden password!) tilbage til front-end'en
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } else {
    // FEJL! Enten forkert email eller password.
    console.log('Login fejlede: Forkert email eller password.');
    // Send en fejlstatus (401 Unauthorized) og en fejlbesked tilbage
    res.status(401).json({ message: 'Forkert email eller password.' });
  }
});

// 6. Start serveren, så den lytter efter forespørgsler
app.listen(PORT, () => {
  console.log(`Back-end serveren kører nu på http://localhost:${PORT}`);
});