const bcrypt = require('bcrypt');
const password = 'ELEok2EUCYXzByL10XGFQssQVL0GYrYfHW&gS&$qlH@nA9pl9AarNH$gOiVeFt9m3^kP^Z2$xfvBPmp!X*x@0V@5zsrmZGy5d3Prx6xyEnn96b$Zmwa@S&f7e@z4o&xn';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);
console.log('Krypteret password:', hash);