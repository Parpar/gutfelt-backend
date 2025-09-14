const bcrypt = require('bcrypt');
const password = 'test';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log('Krypteret password:', hash);