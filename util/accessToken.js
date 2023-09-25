let jwt = require('jsonwebtoken')

module.exports.generate = (userUniqueId) => {
    return jwt.sign({
        exp:  Math.floor(Date.now() / 1000) + (60 * 60),
        data: userUniqueId}, process.env.TOKEN_SECRET)
}

module.exports.generateSecret = () => {
    let secret = require('crypto').randomBytes(64).toString('hex')
    console.log(secret)
    return secret
}