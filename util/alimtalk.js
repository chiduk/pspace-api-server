let db = require('../config/database')
let constants = require('../util/constants')
let objectId = require('mongodb').ObjectID;
let axios = require('axios')

module.exports.sendAlimTalkToVrTourRequester = (vrTourUniqueId, isRealEstateAgent=false) => {
    let vrTourCollection

    if(isRealEstateAgent){
        vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)
    }else{
        vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)
    }

    vrTourCollection.aggregate([
        {
            $match: {_id: new objectId(vrTourUniqueId)}
        },
        {
            $lookup: {
                from: constants.collection.USER,
                localField: 'userUniqueId',
                foreignField: '_id',
                as: 'requester'
            }
        },
        {
            $unwind: '$requester'
        },
        {
            $lookup: {
                from: constants.collection.PROPERTY,
                localField: 'propertyUniqueId',
                foreignField: '_id',
                as: 'property'
            }
        },
        {
            $unwind: '$property'
        }

    ], (err, cursor) => {
        if(err){
            throw err
        }

        cursor.toArray()
            .then(docs => {
                if(docs.length > 0){
                    let result = docs[0]

                    let requesterPhoneNumber = result.requester.phoneNumber

                    if(requesterPhoneNumber.startsWith('0')){
                        requesterPhoneNumber = `82${requesterPhoneNumber.substring(1, requesterPhoneNumber.length)}`

                    }else{
                        requesterPhoneNumber = `82${requesterPhoneNumber}`
                    }

                    let requesterName = result.requester.name
                    let propertyTitle = `${result.property.title}`
                    if(result.property.dongNumber !== null && result.property.dongNumber !== undefined) {
                        propertyTitle = propertyTitle + ' ' + result.property.dongNumber
                    }
                    let vrTourLink = `https://pspace.ai/v/${result.vrTourKey}/`

                    // let vrTourLink = `http://125.131.177.217:8888/v/${result.vrTourKey}/`


                    let content = `안녕하세요 ${requesterName}님,\n\n저희 평행공간에 요청하신 매물\n${propertyTitle}의 VR TOUR를\n보실 수 있습니다.\n${vrTourLink}\n감사합니다.`

                    axios({
                        method: 'post',
                        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
                        headers: {
                            'Content-type': 'application/json;charset=UTF-8',
                            'Accept': 'application/json',
                            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
                        }
                    })
                        .then(response => {


                            let authorization = response.data.schema + ' ' + response.data.accessToken

                            axios({
                                method: 'post',
                                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                                headers: {
                                    'Content-type': 'application/json;charset=UTF-8',
                                    'Accept': 'application/json',
                                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                                    'Authorization': authorization
                                },
                                data: {
                                    "msg_type" : "AL",
                                    "mt_failover": "Y",
                                    "msg_attr":{
                                        "sender_key": process.env.SENDER_KEY,
                                        "template_code":"vrTourApprovalAddBtn",
                                        "response_method":"push",
                                        "ad_flag":"Y",
                                        "attachment": {
                                            "button": [
                                                {
                                                    "name": "VR 투어 보러가기",
                                                    "type": "WL",
                                                    "url_pc": vrTourLink,
                                                    "url_mobile": vrTourLink
                                                },
                                            ]
                                        }
                                    },
                                    "msg_data":{
                                        "senderid":"0261010909",
                                        "to": requesterPhoneNumber,
                                        "content": content
                                    }
                                }
                            })
                                .then(result2 => {
                                    console.log(JSON.parse(result2.config.data))
                                })
                                .catch(e3 => {

                                    throw e3
                                })

                        })
                        .catch(err => {
                            throw err
                        })
                }
            })
    })
}

module.exports.sendAgreementSignRequest = (info) => {

    let receiverPhoneNumber = info.ownerPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let rename = info.reAgencyCompanyName
            let propertyTitle = info.propertyTitle
            let url = info.urlLink

            let content = `안녕하세요 평행공간입니다.\n\n${rename}에서 ${propertyTitle}의\n촬영건에 관한 촬영동의서를 보내드립니다.\n아래 버튼을 클릭하셔서 동의서를 확인하시고\n서명 부탁드리겠습니다.\n\n감사합니다.`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"agreementSignRequestAddBtn",
                        "response_method":"push",
                        "ad_flag":"Y",
                        "attachment": {
                            "button": [
                                {
                                    "name": "서명 하러가기",
                                    "type": "WL",
                                    "url_pc": url,
                                    "url_mobile": url
                                },
                            ]
                        }
                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })

        })
        .catch(err => {
            throw err
        })
}

module.exports.sendDocSaveAlert = (info) => {
    let receiverPhoneNumber = info.ownerPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let url = info.urlLink

            let content = `안녕하세요 평행공간입니다.\n\n서명하신 촬영동의서를 저장하실 수 있습니다.\n아래 버튼을 클릭해주세요.\n\n감사합니다.`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"saveDocAlertAddBtn",
                        "response_method":"push",
                        "ad_flag":"Y",
                        "attachment": {
                            "button": [
                                {
                                    "name": "촬영동의서 저장",
                                    "type": "WL",
                                    "url_pc": url,
                                    "url_mobile": url
                                },
                            ]
                        }

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })

        })
        .catch(err => {
            throw err
        })
}

module.exports.sendAlimTalkNewREJoined = (info) => {
    let receiverPhoneNumber = '821025903717'
    if(process.env.NODE_ENV === 'development'){
        receiverPhoneNumber = '821091120275'
    }


    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let content = `공인중개사 신규가입 안내\n\n${info.name} ${info.company} ${info.phoneNumber}\n${info.dateTime}에 신규 가입하였습니다.`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"newRealEstateAgentJoined",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })

        })
        .catch(err => {
            throw err
        })
}

module.exports.sendReservationRequestAlimTalk = (info) => {
    console.log(info)

    let receiverPhoneNumber = info.agentPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    let daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']

    let date = info.appointmentDate

    let year = date.getFullYear()
    let day = ("0" + date.getDate()).slice(-2)
    let month = ("0" + (date.getMonth() + 1)).slice(-2)
    let hour = ("0" + (date.getHours() )).slice(-2)
    let min = ("0" + (date.getMinutes() )).slice(-2)
    let dayOfWeek = date.getDay()

    let appointmentDate = `${year}-${month}-${day} ${hour}:${min} ${daysOfWeek[dayOfWeek]}요일`

    let confirmUrl = `https://pspace.ai/api/repage/autoConfirmReservation/${info.redisKey}`
    let cancelUrl = `https://pspace.ai/api/repage/autoCancelReservation/${info.redisKey}`
    let template = 'visitRequestAddBtn'
    if(process.env.NODE_ENV === 'development'){
        confirmUrl = `http://10.0.1.102:64040/api/repage/autoConfirmReservation/${info.redisKey}`
        cancelUrl = `http://10.0.1.102:64040/api/repage/autoCancelReservation/${info.redisKey}`
        template = 'visitRequestAddBtnTest'
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            // let content = `안녕하세요 평행공간입니다.\n\n매물 방문예약 요청 안내드립니다.\n방문자: ${info.visitor.name}\n전화번호: ${info.visitor.phoneNumber}\n매물: ${info.title} ${info.address}\n방문일시: ${appointmentDate}\n\n방문예약 승인은 아래 링크를 클릭해주세요:\n${confirmUrl}\n방문예약 거절은 아래 링크를 클릭해주세요:\n${cancelUrl}`
            let content = `안녕하세요 평행공간입니다.\n\n매물 방문예약 요청 안내드립니다.\n방문자: ${info.visitor.name}\n전화번호: ${info.visitor.phoneNumber}\n매물: ${info.title} ${info.address}\n방문일시: ${appointmentDate}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code": template,
                        "response_method":"push",
                        "ad_flag":"Y",
                        "attachment": {
                            "button": [
                                {
                                    "name": "승인",
                                    "type": "WL",
                                    "url_pc": confirmUrl,
                                    "url_mobile": confirmUrl
                                },
                                {
                                    "name": "거절",
                                    "type": "WL",
                                    "url_pc": cancelUrl,
                                    "url_mobile": cancelUrl
                                },
                            ]
                        }
                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })

        })
        .catch(err => {
            throw err
        })
}

module.exports.sendVisitApproveAlimTalk = (info) => {


    let receiverPhoneNumber = info.agentPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    let appointmentDate = formatDate(info.appointmentDate)

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let content = `안녕하세요 평행공간입니다.\n매물 방문요청이 승인되었습니다.\n\n매물명: ${info.title}\n매물주소: ${info.address},\n공인중개사무소명: ${info.companyName},\n공인중개사무소 연락처: ${info.agentPhoneNumber}\n공인중개사무소 주소: ${info.officeAddress}\n방문일시: ${appointmentDate}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"visitApproval",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })

        })
        .catch(err => {
            throw err
        })
}

module.exports.sendVBankInfoAlimTalk = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {


            let content = `${info.buyer_name}님\n주문하신 촬영비의 입금정보를 보내드립니다.\n\n[주문정보]\n주문일자: ${info.order_date}\n주문번호: ${info.order_id}\n주문금액: ${info.amount}\n\n[결제정보]\n입금은행: ${info.vbank_name}\n계좌번호: ${info.vbank_num}\n입금기한: ${info.vbank_date}\n입금금액: ${info.amount}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"vBankInfo",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })
        })
}

module.exports.sendVBankPaidNotice = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {
            let content = `${info.buyer_name}님\n주문하신 촬영비 결제가 완료되었습니다.\n\n[주문정보]\n주문일자: ${info.order_date}\n주문번호: ${info.order_id}\n주문금액: ${info.amount}\n\n[결제정보]\n입금은행: ${info.vbank_name}\n계좌번호: ${info.vbank_num}\n입금일자: ${info.deposit_date}\n입금금액: ${info.amount}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"vBankPaidNotice",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })
        })

}

module.exports.sendCardBankPaidNotice = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {
            let content = `${info.buyer_name}님\n주문하신 촬영비 결제가 완료되었습니다.\n\n[주문정보]\n주문일자: ${info.order_date}\n주문번호: ${info.order_id}\n주문금액: ${info.amount}\n카드: ${info.card_name}\n카드번호: ${info.card_number}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"cardBankPaidNotice",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })
        })
}

module.exports.sendFilmingDateNotice = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {
            let content = `${info.realEstateAgent}님\n촬영 요청하신 ${info.propertyTitle}의 촬영날짜 ${info.filmingDate}에 방문예정입니다.\n\n[촬영정보]\n매물명: ${info.propertyTitle}\n촬영날짜: ${info.filmingDate}\n촬영지: ${info.address}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"cardBankPaidNotice",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })
        })
}

module.exports.sendRefundNotice = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let refundInfo = '';

            switch (info.payMethod) {

                case constants.DANAL_PAYMENT_METHOD.CARD :
                    refundInfo = `카드: ${info.cardName}\n카드번호: ${info.cardNumber}`
                    break
                case constants.DANAL_PAYMENT_METHOD.VBANK :
                    refundInfo = ``
                    break
                case constants.DANAL_PAYMENT_METHOD.TRANS :
                    const bank = constants.BANK_CODE.filter((bank)=> bank.code === info.bankCode)
                    refundInfo = `은행: ${bank[0].name}\n계좌번호: ${info.bankNum}\n계좌주: ${info.bankHolder}`
                    break
                default:
                    console.error('info.payMethod error')
            }


            let content = `${info.realEstateAgent}님\n 요청하신 ${info.propertyTitle}의 환불요청 완료되었습니다.\n결제사의 응답에 따라 1~2일정도의 걸릴 수 있습니다.\n\n[환불정보]\n주문번호: ${info.order_id}\n환불금액: ${info.amount}\n${refundInfo}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"cardBankPaidNotice",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })
        })
}

module.exports.sendJoinApprovalNotice = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let content = `${info.username}님의 평행공간\n가입이 승인됐습니다.\n가입 ID는 ${info.email}입니다.`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"realEstateJoinApproval",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })
        })

}

module.exports.sendResultCancelVrTour = (info) => {
    let receiverPhoneNumber = info.receiverPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    let content = `안녕하세요 ${info.requesterName}님,\n\n저희 평행공간에 요청하신 매물\n${info.propertyTitle}의 VR TOUR 신청이\n거절되었습니다.\n\n 공인중개사무소명: ${info.reagentCompanyName}\n공인중개사무소 연락처: ${info.reagentPhoneNumber}\n\n감사합니다.`

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"vrTourCanceled",
                        "response_method":"push",
                        "ad_flag":"Y"
                    },
                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))
                })
                .catch(e3 => {

                    throw e3
                })
        })
}

module.exports.sendVisitCancelAlimTalk = (info) => {


    let receiverPhoneNumber = info.agentPhoneNumber

    if(receiverPhoneNumber.startsWith('0')){
        receiverPhoneNumber = `82${receiverPhoneNumber.substring(1, receiverPhoneNumber.length)}`
    }else{
        receiverPhoneNumber = `82${receiverPhoneNumber}`
    }

    let appointmentDate = formatDate(info.appointmentDate)

    axios({
        method: 'post',
        url:'https://msggw-auth.supersms.co:9440/auth/v1/token',
        headers: {
            'Content-type': 'application/json;charset=UTF-8',
            'Accept': 'application/json',
            'X-IB-Client-Id' : process.env.ALIMTALK_ID,
            'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
        }
    })
        .then(response => {



            let content = `안녕하세요 평행공간입니다.\n매물 방문요청이 거절되었습니다.\n\n매물명: ${info.title}\n매물주소: ${info.address},\n공인중개사무소명: ${info.companyName},\n공인중개사무소 연락처: ${info.agentPhoneNumber}\n공인중개사무소 주소: ${info.officeAddress}\n방문일시: ${appointmentDate}`

            let authorization = response.data.schema + ' ' + response.data.accessToken

            axios({
                method: 'post',
                url: 'https://msggw.supersms.co:9443/v1/send/kko',
                headers: {
                    'Content-type': 'application/json;charset=UTF-8',
                    'Accept': 'application/json',
                    'X-IB-Client-Id' : process.env.ALIMTALK_ID,
                    'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                    'Authorization': authorization
                },
                data: {
                    "msg_type" : "AL",
                    "mt_failover": "Y",
                    "msg_attr":{
                        "sender_key": process.env.SENDER_KEY,
                        "template_code":"visitCancel",
                        "response_method":"push",
                        "ad_flag":"Y"

                    },

                    "msg_data":{
                        "senderid":"0261010909",
                        "to": receiverPhoneNumber,
                        "content": content
                    }
                }
            })
                .then(result2 => {
                    console.log(JSON.parse(result2.config.data))

                })
                .catch(e3 => {

                    throw e3
                })

        })
        .catch(err => {
            throw err
        })
}

formatDate = (date) => {
    let daysOfWeek = ['일', '월', '화', '수', '목', '금', '토']

    let year = date.getFullYear()
    let day = ("0" + date.getDate()).slice(-2)
    let month = ("0" + (date.getMonth() + 1)).slice(-2)
    let hour = ("0" + (date.getHours() )).slice(-2)
    let min = ("0" + (date.getMinutes() )).slice(-2)
    let dayOfWeek = date.getDay()

    let appointmentDate = `${year}-${month}-${day} ${hour}:${min} ${daysOfWeek[dayOfWeek]}요일`

    return appointmentDate
}