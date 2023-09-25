let express = require('express');
let router = express.Router();
let db = require('../config/database')
let jwt = require('jsonwebtoken')
let httpProxy = require('../config/httpProxy')
const {createProxyMiddleware, responseInterceptor} = require("http-proxy-middleware");

// router.post('/:id', (req, res, next) => {
//
//
//     let url = req.url
//     let id = req.params.id
//     let subpath = req.params['0']
//     let pathKey = id + '.path'
//     let portKey = id + '.port'
//
//     console.log('vt post', id)
//
//     let splitUrl = url.split('?')
//     let query = splitUrl[1]
//
//
//
//     db.getRedisClient().get(pathKey, (err, path) => {
//         if(err){
//             throw err
//         }
//
//
//
//         if(path){
//             db.getRedisClient().get(portKey, (e2, port) => {
//                 if(e2){
//                     throw e2
//                 }
//
//
//
//                 if(port) {
//                     httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {
//                         proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br')
//                     })
//
//
//                     let target = `http://localhost:${port}/${path}/${subpath}?${query}`
//
//                     if (query === undefined) {
//                         target = `http://localhost:${port}/${path}/${subpath}`
//                     }
//
//                     console.log('vt target', target)
//
//                     httpProxy.getProxy().web(req, res, {
//
//                         ignorePath: true,
//                         target: target
//                     }, (err) => {
//                         if (err) {
//                             console.log(err)
//                         }
//                     })
//                 }else{
//                     res.send('접근할 수 없는 페이지입니다.')
//                 }
//             })
//         }else{
//             res.send('접근할 수 없는 페이지입니다.')
//         }
//     })
// })

router.get('/:id/*', (req, res, next) => {

    let url = req.url
    let id = req.params.id
    let subpath = req.params['0']
    let pathKey = id + '.path'
    let portKey = id + '.port'

    console.log('vt tour get all', id)

    console.log('vt tour headers', req.headers)

    let splitUrl = url.split('?')
    let query = splitUrl[1]
    let authHeader = req.headers['authorization']
    console.log(authHeader)

    let token = authHeader && authHeader.split(' ')[1]
    console.log(token)
    if(token === null || token === undefined) return res.status(401).send()

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if(err) return res.status(403).send()

        console.log(user)


        db.getRedisClient().get(pathKey, (err, path) => {
            if(err){
                throw err
            }



            if(path){
                db.getRedisClient().get(portKey, (e2, port) => {
                    if(e2){
                        throw e2
                    }



                    if(port) {
                        // httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {
                        //     //proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br')
                        // })


                        let target = `http://localhost:${port}/${path}/${subpath}?${query}`

                        if (query === undefined) {
                            target = `http://localhost:${port}/${path}/${subpath}`
                        }

                        console.log('vt target', target)

                        httpProxy.getProxy().web(req, res, {

                            ignorePath: true,
                            target: target
                        }, (err) => {
                            if (err) {
                                console.log(err)
                            }
                        })
                    }else{
                        res.send('접근할 수 없는 페이지입니다.')
                    }
                })
            }else{
                res.send('접근할 수 없는 페이지입니다.')
            }
        })
    })


})



module.exports = router