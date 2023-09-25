let db = require('../config/database')
let express = require('express');
let objectId = require('mongodb').ObjectID;
let router = express.Router();
let constants = require('../util/constants')
let mailer = require('../util/mailer')

router.post('/make/inquiry', (req, res) => {
    let nonmemberInquiryCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER)

    req.body.date = new Date()

    let {name, phoneNumber, email, inquiry, date} = req.body

    nonmemberInquiryCollection.insertOne(req.body)
        .then(() => {
            let response = {
                isInquired: true,
                error: null
            }

            let html = `<div style="display:flex; flex-direction: column"><div>문의일자: ${date.toLocaleString()}</div><div>이름: ${name}</div><div>전화번호: ${phoneNumber}</div><div>email: ${email}</div><div>문의내용: ${inquiry}</div></div>`

            mailer.sendEmail({ receiver: 'pspace@pspace.ai', title: `${name}님의 문의가 도착했습니다.`, html: html })

            res.json(response)
        })
        .catch(err => {
            let response = {
                isInquired: false,
                error: {code: 'S500', message:'서버에러'}
            }

            res.json(response)

            throw err
        })
})

module.exports = router