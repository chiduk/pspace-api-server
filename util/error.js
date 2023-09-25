let db = require('../config/database')
let bcrypt = require('bcrypt')
let saltRounds = 10

let error = {
    code: '',
    message: ''
}

module.exports = error