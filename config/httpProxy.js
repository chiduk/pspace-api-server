let http = require('http')
let httpProxy = require('http-proxy')
let connect = require('connect')
let _proxy;

module.exports = {
    createProxyServer: () => {
        _proxy = httpProxy.createProxyServer()
    },

    getProxy : () => {
        return _proxy
    }
}