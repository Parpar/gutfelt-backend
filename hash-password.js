const bcrypt = require('bcryptjs');
const password = '123'; // <--- Indtast det password, du vil kryptere
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log('Krypteret password:', hash);