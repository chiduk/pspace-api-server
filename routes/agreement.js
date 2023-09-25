let express = require('express');
let kakaocert = require('kakaocert')
let puppeteer = require('puppeteer')
let shortid = require('shortid')
let router = express.Router();
let db = require('../config/database')
let constants = require('../util/constants')
let alimtalk = require('../util/alimtalk')

kakaocert.config({

    LinkID :process.env.KAKAOCERT_LINK_ID,
    SecretKey : process.env.KAKAOCERT_SECRET_KEY,


    IPRestrictOnOff: true,


    UseLocalTimeYN: true,

    defaultErrorHandler: function (Error) {
        console.log('Error Occur : [' + Error.code + '] ' + Error.message);
    }
})

let kakaocertService = kakaocert.KakaocertService()


router.get('/:key', (req, res) => {
    let key = req.params.key


    db.getRedisClient().get(key, (err, filename) => {
        if(err){
            throw err
        }

        if(filename){

            res.sendFile(`${process.env.AGREEMENT_DOC_HTML_FILE_PATH}/${filename}.html`)
        }else{
            res.send('존재하지 않거나 시간이 만료된 문서입니다.')
        }
    })
})

router.get('/doc/:key', (req, res) => {
    let key = req.params.key

    db.getRedisClient().get(key, (err, filename) => {
        if(err){
            throw err
        }

        if(filename){

            res.sendFile(`${process.env.AGREEMENT_DOC_PDF_FILE_PATH}/${filename}`)
        }else{
            res.send('존재하지 않거나 시간이 만료된 문서입니다.')
        }
    })
})

router.post('/sign/agreement', (req, res) => {
    let ownerName = req.body.ownerName
    let ownerPhoneNumber = req.body.ownerPhoneNumber
    let ownerBirthDate = req.body.birthYear + req.body.birthMonth + req.body.birthDate
    let key = req.body.key
    let filename = req.body.filename

    let scanAgreementCollection = db.getDb().collection(constants.collection.SCAN_AGREEMENT)

    scanAgreementCollection.findOne({key: key, filename: filename})
        .then(agreement => {
            if(agreement){
                if(agreement.receiptId === undefined){
                    sendESignRequest({ownerName: ownerName, ownerBirthDate: ownerBirthDate, ownerPhoneNumber: ownerPhoneNumber, key: key, filename: filename})
                    res.send('서명 요청이 전송되었습니다. 카카오톡 메시지를 확인해주세요.')
                }else{
                    kakaocertService.getESignState(process.env.KAKAOCERT_CLIENT_CODE, agreement.receiptId,
                        (rsp) =>{
                            if(rsp.state === 1){
                                scanAgreementCollection.findOneAndUpdate({key: key, filename: filename}, {$set: {isSigned: true}})
                                    .then(() => {
                                        res.send('이미 서명완료 되었습니다.')
                                    })
                            }else if(rsp.state === 0){
                                sendESignRequest({ownerName: ownerName, ownerBirthDate: ownerBirthDate, ownerPhoneNumber: ownerPhoneNumber, key: key, filename: filename})
                                res.send('서명 요청이 전송되었습니다. 카카오톡 메시지를 확인해주세요.')
                            }else{
                                res.send('서명기한이 만료되었습니다. 중개사사무소에 서명 재요청 해주세요.')
                            }
                        },
                        (err) => {
                            throw err
                        })

                }

            }else{
                res.send('잘못된 정보입니다. 다시 시도해주세요.')
            }
        })


})

let sendESignRequest = (info) => {
    let request = {
        CallCenterNum: '02-6101-0909',
        Expires_in : 1000,
        ReceiverBirthDay : info.ownerBirthDate,
        ReceiverHP : info.ownerPhoneNumber,
        ReceiverName : info.ownerName,
        SubClientID : '',
        TMSMessage : '촬영 동의서',
        TMSTitle : '촬영동의서 서명 요청',
        isAllowSimpleRegistYN : false,
        isVerifyNameYN : true,
        Token : 'http://localhost:3000/estateRequest3DScan',
        PayLoad : 'memo info',
        isAppUseYN : false,
    }

    kakaocertService.requestESign(process.env.KAKAOCERT_CLIENT_CODE, request, (result) => {
            console.log(result)
            let scanAgreementCollection = db.getDb().collection(constants.collection.SCAN_AGREEMENT)
            scanAgreementCollection.findOneAndUpdate({key: info.key, filename: info.filename}, {$set: {receiptId: result.receiptId, tx_id: result.tx_id}},{upsert: true})

            let timer = () => {
                kakaocertService.getESignState(process.env.KAKAOCERT_CLIENT_CODE, result.receiptId,
                    (rsp) => {
                        if(rsp.state === 1){
                            stopTimer()

                            saveDoc(info.key)
                                .then(filename => {
                                    let key = shortid.generate()

                                    db.getRedisClient().set(key, filename)
                                    let urlLink = ''

                                    if(process.env.NODE_ENV === 'development'){
                                        urlLink = `http://10.0.1.100:4000/api/agreement/doc/${key}`
                                    }else{
                                        urlLink = `https://pspace.ai/api/agreement/doc/${key}`
                                    }
                                    let params= {
                                        ownerPhoneNumber: info.ownerPhoneNumber,
                                        urlLink: urlLink
                                    }
                                    alimtalk.sendDocSaveAlert(params)
                                })
                        }else if(rsp.state === 2){
                            stopTimer()
                        }
                    },
                    (err) => {
                        throw err;
                    })
            }

            let checkInterval = setInterval(() => {
                timer()
            },60000)

            let stopTimer = () => {
                clearInterval(checkInterval)
            }

        },
        (err) => {
            console.log(err)
        })
}

router.post('/isSigned', (req, res) => {
    let key = req.body.key

    db.getRedisClient().get(key, (err, filename) => {
        if(err){
            throw err
        }

        let scanCollection = db.getDb().collection(constants.collection.SCAN_AGREEMENT)

        scanCollection.findOne({key: key, filename: filename})
            .then(agreement => {
                if(agreement){
                    if(agreement.receiptId === undefined){
                        if(agreement.isSigned){
                            res.json({isSigned: true})
                        }else {
                            res.json({isSigned: false})
                        }
                    }else{
                        kakaocertService.getESignState(process.env.KAKAOCERT_CLIENT_CODE, agreement.receiptId,
                            (rsp) => {
                                if(rsp.state === 1){
                                    res.json({isSigned: true, receiverName: rsp.ReceiverName})
                                    scanCollection.findOneAndUpdate({key: key, filename: filename}, {$set: {isSigned: true}}, {upsert: true})
                                }else{
                                    res.json({isSigned: false})
                                }
                            },
                            (err) => {
                                throw err;
                            })
                    }
                }else{
                    res.json({isSigned: false})
                }


            })
    })
})

router.post('/save',  (req, res) => {
    let key = req.body.key
    saveDoc(key)
        .then(() => {
            res.send('OK')
        })

})

let saveDoc = (key) => {

    return new Promise((resolve, reject) => {
        db.getRedisClient().get(key, async (err, filename) => {
            if (err) {
                throw err
            }

            let browser = await puppeteer.launch({ headless: true , slowMo: 250})
            let page = await browser.newPage()
            if(process.env.NODE_ENV === 'development'){
                await page.goto(`http://10.0.1.100:4000/api/agreement/${key}`, {
                    waitUntil: 'networkidle2'
                })
            }else{
                await page.goto(`https://pspace.ai/api/agreement/${key}`)
            }

            await page.pdf({path:`${process.env.AGREEMENT_DOC_PDF_FILE_PATH}/${filename}.pdf`, format: 'a4'})
            await browser.close()

            return resolve(`${filename}.pdf`)

        })
    })


}

module.exports = router