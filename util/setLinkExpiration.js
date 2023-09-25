let db = require('../config/database')
let constants = require('../util/constants')
let objectId = require('mongodb').ObjectID;

module.exports.setLink = (key, requesterUniqueId, vrTourPath, portNumber, ttl) => {
    return new Promise((resolve, reject) => {
        let pathKey = `${key}.path`
        let portKey = `${key}.port`
        let userUniqueIdKey = `${key}.userUniqueId`

        let redisCli = db.getRedisClient()
        redisCli.set(pathKey, vrTourPath, 'EX', ttl)
        redisCli.set(portKey, portNumber, 'EX', ttl)
        redisCli.set(userUniqueIdKey, requesterUniqueId.toString(), 'EX', ttl)

        resolve()
    })
}