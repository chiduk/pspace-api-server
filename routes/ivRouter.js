let express = require('express');
let router = express.Router();
let db = require('../config/database')
let jwt = require('jsonwebtoken')
let httpProxy = require('../config/httpProxy')
let harmon = require('harmon')
let connect = require('connect')
const {createProxyMiddleware, responseInterceptor} = require("http-proxy-middleware");
const fs = require("fs");


//
// router.get('/:id', (req, res) => {
//     let url = req.url
//     let id = req.params.id
//     let subpath = req.params['0']
//     let pathKey = id + '.path'
//     let portKey = id + '.port'
//     let userUniqueIdKey = `${id}.userUniqueId`
//     let userUniqueId = req.query.userUniqueId
//
//     let splitUrl = url.split('?')
//     let query = splitUrl[1]
//     let authHeader = req.headers['authorization']
//
//     if(userUniqueId !== undefined){
//         let token = authHeader && authHeader.split(' ')[1]
//         console.log(token)
//         if(token === null || token === undefined) return res.status(401).send()
//
//         jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
//             if(err) return res.status(403).send()
//
//             console.log(user)
//
//             db.getRedisClient().get(userUniqueIdKey, (err, requesterUniqueId) => {
//                 console.log('requesterUniqueId', requesterUniqueId)
//
//
//                 if(requesterUniqueId === userUniqueId){
//
//
//
//                     db.getRedisClient().get(pathKey, (err, path) => {
//                         if(err){
//                             throw err
//                         }
//
//
//
//                         if(path){
//                             db.getRedisClient().get(portKey, (e2, port) => {
//                                 if(e2){
//                                     throw e2
//                                 }
//
//
//
//                                 if(port) {
//                                     httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {
//                                         //proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br')
//                                     })
//
//
//                                     let target = `http://localhost:${port}/${path}/${subpath}?${query}`
//
//                                     if (query === undefined) {
//                                         target = `http://localhost:${port}/${path}/${subpath}`
//                                     }
//
//                                     console.log('vm target', target)
//
//                                     res.format({
//                                         'text/html' : () => {
//                                             res.send('<!doctype html><html><head><title>평행공간</title><link rel="icon" type="image/x-icon" href="https://pspace.ai/images/favicon.png"/><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,user-scalable=no,minimum-scale=1,maximum-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"></head><body><!--[if lt IE 10]>\n' +
//                                                 '\t\t<p class="browsehappy">You are using an <strong>outdated</strong> browser. Please <a href="http://browsehappy.com/">upgrade your browser</a> to improve your experience.</p>\n' +
//                                                 '\t<![endif]--><indoorviewer class="indoorViewerFull"></indoorviewer><div id="splash-screen" style="background-color:rgb(17,17,17); position:fixed; top:0; left:0; right:0; bottom:0; z-index:1000"><img src="data:image/svg+xml;base64,PCEtLSBCeSBTYW0gSGVyYmVydCAoQHNoZXJiKSwgZm9yIGV2ZXJ5b25lLiBNb3JlIEAgaHR0cDovL2dvby5nbC83QUp6YkwgLS0+Cjxzdmcgd2lkdGg9IjM4IiBoZWlnaHQ9IjM4IiB2aWV3Qm94PSIwIDAgMzggMzgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgICA8ZGVmcz4KICAgICAgICA8bGluZWFyR3JhZGllbnQgeDE9IjguMDQyJSIgeTE9IjAlIiB4Mj0iNjUuNjgyJSIgeTI9IjIzLjg2NSUiIGlkPSJhIj4KICAgICAgICAgICAgPHN0b3Agc3RvcC1jb2xvcj0iIzM5YyIgc3RvcC1vcGFjaXR5PSIwIiBvZmZzZXQ9IjAlIi8+CiAgICAgICAgICAgIDxzdG9wIHN0b3AtY29sb3I9IiMzOWMiIHN0b3Atb3BhY2l0eT0iLjYzMSIgb2Zmc2V0PSI2My4xNDYlIi8+CiAgICAgICAgICAgIDxzdG9wIHN0b3AtY29sb3I9IiMzOWMiIG9mZnNldD0iMTAwJSIvPgogICAgICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8L2RlZnM+CiAgICA8ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPgogICAgICAgIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEgMSkiPgogICAgICAgICAgICA8cGF0aCBkPSJNMzYgMThjMC05Ljk0LTguMDYtMTgtMTgtMTgiIGlkPSJPdmFsLTIiIHN0cm9rZT0idXJsKCNhKSIgc3Ryb2tlLXdpZHRoPSIyIj4KICAgICAgICAgICAgICAgIDxhbmltYXRlVHJhbnNmb3JtCiAgICAgICAgICAgICAgICAgICAgYXR0cmlidXRlTmFtZT0idHJhbnNmb3JtIgogICAgICAgICAgICAgICAgICAgIHR5cGU9InJvdGF0ZSIKICAgICAgICAgICAgICAgICAgICBmcm9tPSIwIDE4IDE4IgogICAgICAgICAgICAgICAgICAgIHRvPSIzNjAgMTggMTgiCiAgICAgICAgICAgICAgICAgICAgZHVyPSIxLjVzIgogICAgICAgICAgICAgICAgICAgIHJlcGVhdENvdW50PSJpbmRlZmluaXRlIiAvPgogICAgICAgICAgICA8L3BhdGg+CiAgICAgICAgICAgIDxjaXJjbGUgZmlsbD0iIzRhZCIgY3g9IjM2IiBjeT0iMTgiIHI9IjEiPgogICAgICAgICAgICAgICAgPGFuaW1hdGVUcmFuc2Zvcm0KICAgICAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lPSJ0cmFuc2Zvcm0iCiAgICAgICAgICAgICAgICAgICAgdHlwZT0icm90YXRlIgogICAgICAgICAgICAgICAgICAgIGZyb209IjAgMTggMTgiCiAgICAgICAgICAgICAgICAgICAgdG89IjM2MCAxOCAxOCIKICAgICAgICAgICAgICAgICAgICBkdXI9IjEuNXMiCiAgICAgICAgICAgICAgICAgICAgcmVwZWF0Q291bnQ9ImluZGVmaW5pdGUiIC8+CiAgICAgICAgICAgIDwvY2lyY2xlPgogICAgICAgIDwvZz4KICAgIDwvZz4KPC9zdmc+Cg==" style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:50px"></div><script>setTimeout(instantiate, 200);\n' +
//                                                 '\n' +
//                                                 '\t\tfunction instantiate()\n' +
//                                                 '\t\t{\n' +
//                                                 '\t\t\tif (!window.IV)\n' +
//                                                 '\t\t\t{\n' +
//                                                 '\t\t\t\tsetTimeout(instantiate, 200);\n' +
//                                                 '\t\t\t}\n' +
//                                                 '\t\t\telse\n' +
//                                                 '\t\t\t{\n' +
//                                                 '\t\t\t\twindow.IV.loaded(function()\n' +
//                                                 '\t\t\t\t{\n' +
//                                                 '\t\t\t\t\tnew IndoorViewer();\n' +
//                                                 '\t\t\t\t});\n' +
//                                                 '\t\t\t}\n' +
//                                                 '\t\t}</script><script src="main.js?3c9b492cab2c84778313"></script></body></html>')
//                                         }
//                                     })
//
//
//                                     httpProxy.getProxy().web(req, res, {
//
//                                         ignorePath: true,
//                                         target: target
//                                     }, (err) => {
//                                         if (err) {
//                                             console.log(err)
//                                         }
//                                     })
//
//                                 }else{
//
//                                     res.send('접근할 수 없는 페이지입니다.')
//                                 }
//                             })
//                         }else{
//                             res.send('접근할 수 없는 페이지입니다.')
//                         }
//                     })
//                 }else{
//                     res.send('접근할 수 없는 페이지입니다.')
//                 }
//             })
//
//         })
//
//
//     }else{
//         console.log('url', req.url)
//
//         if(req.url !== '/hYGa/'){
//             getProxy(req, res, pathKey, portKey, subpath, query)
//         }
//
//     }
// })

router.get('/:id/*', (req, res, next) => {

    let url = req.url
    let id = req.params.id
    let subpath = req.params['0']
    let pathKey = id + '.path'
    let portKey = id + '.port'
    let userUniqueIdKey = `${id}.userUniqueId`
    let userUniqueId = req.query.userUniqueId

    console.log('vm tour get all', id, userUniqueId)

    console.log('vm tour headers', req.headers)

    let splitUrl = url.split('?')
    let query = splitUrl[1]
    let authHeader = req.headers['authorization']
    console.log('query ----------------------->', query, userUniqueId)

    if(userUniqueId !== undefined){
        let token = authHeader && authHeader.split(' ')[1]
        console.log(token)
        if(token === null || token === undefined) return res.status(401).send()

        jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
            if(err) return res.status(403).send()

            console.log(user)

            db.getRedisClient().get(userUniqueIdKey, (err, requesterUniqueId) => {
                console.log('requesterUniqueId', requesterUniqueId)


                if(requesterUniqueId === userUniqueId){
                    getProxy(req, res, pathKey, portKey, subpath, query)
                }else{
                    res.send('접근할 수 없는 페이지입니다.')
                }
            })

        })


    }else{
        console.log('url', req.url)

        if(req.url !== '/hYGa/'){
            getProxy(req, res, pathKey, portKey, subpath, query)
        }

    }

})

let getProxy = (req, res, pathKey, portKey, subpath, query) => {



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
                    httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {
                        proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br')
                    })


                    let target = `http://localhost:${port}/${path}/${subpath}?${query}`

                    if (query === undefined) {
                        target = `http://localhost:${port}/${path}/${subpath}`
                    }


                    console.log('getproxy vm target', target)



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
}


router.post('/:id/api/pois/filter', (req, res, next) => {
    console.log('vm filter req.get referer', req.headers.referer )
    let id = req.params.id
    let subpath = req.params['0']
    let pathKey = id + '.path'
    let portKey = id + '.port'
    console.log(pathKey, portKey)

    db.getRedisClient().get(pathKey, (err, path) => {
        if(err){
            throw err
        }

        console.log(path)

        if(path){
            db.getRedisClient().get(portKey, (e2, port) => {
                if(e2){
                    throw e2
                }

                console.log(port)

                if(port){
                    httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {

                        if(req.body){
                            let bodyData = JSON.stringify(req.body);
                            proxyReq.setHeader('Content-Type','application/json');
                            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                            console.log('bodyData', bodyData)
                            proxyReq.write(bodyData);
                        }
                    })

                    let target = `http://localhost:${port}/${path}/api/pois/filter`

                    console.log('target', target)

                    httpProxy.getProxy().web(req, res, {

                        ignorePath: true,
                        target:target}, (err) => {
                        if(err){
                            console.log(err)
                        }
                    })


                }
            })
        }
    })

})

module.exports = router