let db = require('../config/database')
let express = require('express');
let objectId = require('mongodb').ObjectID;
let router = express.Router();
let constants = require('../util/constants')

router.post('/visit/', (req, res) => {
    let ipAddressV4 = req.body.ipAddressV4
    let ipAddressV6 = req.body.ipAddressV6
    let userUniqueId = req.body.userUniqueId
    let macAddress = req.body.macAddress
    let visitDateTime = new Date()

    let visitYear = visitDateTime.getUTCFullYear()
    let visitMonth = visitDateTime.getUTCMonth() + 1
    let visitDate = visitDateTime.getUTCDate()



    let websiteVisitorCollection = db.getDb().collection(constants.collection.WEBSITE_VISITOR)

    websiteVisitorCollection.findOne({ipAddressV4: ipAddressV4, macAddress: macAddress, visitYear: visitYear, visitMonth: visitMonth, visitDate: visitDate})
        .then(record => {
            if(record === null){
                let visitRecord = {
                    ipAddressV4: ipAddressV4,
                    ipAddressV6: ipAddressV6,
                    userUniqueId: (userUniqueId === undefined) ? null : new objectId(userUniqueId),
                    macAddress: macAddress,
                    visitYear: visitYear,
                    visitMonth: visitMonth,
                    visitDate: visitDate,
                    visitDateTime: visitDateTime
                }

                websiteVisitorCollection.insertOne(visitRecord)
                    .then(() => {
                        res.send('OK')
                    })
                    .catch(err => {
                        res.status(500).send()

                        throw err
                    })


            }

            res.status(200).send()
        })
        .catch(err => {

            res.status(500).send()

            throw err
        })


})

router.get('/visit', (req, res) => {
    res.send('OK')
})

router.post('/update/token', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let token = req.body.token

    let userCollection = db.getDb().collection(constants.collection.USER)
    userCollection.findOneAndUpdate({_id: new objectId(userUniqueId)}, {$set: {firebaseToken: token}}, {upsert:true})
        .then(() => {
            res.status(200).send()
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

module.exports = router