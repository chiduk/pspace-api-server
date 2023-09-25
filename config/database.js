let MongoClient = require('mongodb').MongoClient
let _db;
let _redisClient;
let dbName = 'pspace'
let redis = require('redis')


module.exports = {
    mongodb_url: process.env.PSPACE_MONGODB_URL,
    db: 'pspace',
    connect: (callback) => MongoClient.connect(process.env.PSPACE_MONGODB_URL, {useNewUrlParser: true, useUnifiedTopology: true }, (err, db) => {
        _db = db.db(dbName)
        return callback(err)
    }),

    getDb: () => {
        return _db
    },

    createRedisClient: () => {
        _redisClient = redis.createClient(process.env.REDIS_URL, {password:process.env.REDIS_PASS})
    },
    getRedisClient: () => {
        return _redisClient
    }

}




