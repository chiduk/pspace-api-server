let db = require('../config/database')
let bcrypt = require('bcrypt')
let saltRounds = 10
let objectId = require('mongodb').ObjectID;

exports.passwordUpdate = (id, newpasswd) => {
    let userCollection = db.getDb().collection('USER')
    bcrypt.genSalt(saltRounds, (err, salt) => {
        bcrypt.hash(newpasswd, salt, (e2, hash) => {
            userCollection.findOneAndUpdate({_id: new objectId(id)}, {$set: {password: hash}})
        } )
    })
}