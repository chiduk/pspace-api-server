let express = require('express');
let router = express.Router();
let db = require('../config/database')
let fs = require('fs')

router.get('/result', (req, res) => {


    fs.writeFile('log/sms.log', JSON.stringify(req.body) + '\n', { flag: 'a' }, function (err) {
        if (err) throw err;

    })
})

router.post('/result', (req, res) => {


    fs.writeFile('log/sms.log', JSON.stringify(req.body) + '\n', { flag: 'a' }, function (err) {
        if (err) throw err;

    })
})

module.exports = router