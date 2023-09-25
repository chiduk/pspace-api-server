let express = require('express');
let objectId = require('mongodb').ObjectID;
let axios = require('axios')
let router = express.Router();
let db = require('../config/database')
let constants = require('../util/constants')
let alimtalk = require('../util/alimtalk')
const {DANAL_PAYMENT_METHOD, DANAL_PAYMENT_STATUS} = require("../util/constants");
const {sendFilmingDateNotice} = require("../util/alimtalk");

router.post('/result', (req, res) => {

    let impUid = req.body.imp_uid
    let merchantUid = req.body.merchant_uid
    let status = req.body.status
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)

    paymentCollection.findOne({impUid: impUid})
        .then(payment => {
            if (payment) {
                paymentCollection.findOneAndUpdate(
                    {impUid: impUid},
                    {$set: {'result.status': status}}
                )
                    .then(_ => {
                        if (payment.result.pay_method === DANAL_PAYMENT_METHOD.VBANK && status === DANAL_PAYMENT_STATUS.PAID) {

                            let info = {
                                receiverPhoneNumber: payment.result.buyer_tel,
                                order_date: getLocalDate(payment.transactionDate),
                                order_id: payment.impUid.replace('imp_', ''),
                                deposit_date: getLocalDate(new Date()),
                                amount: payment.result.paid_amount,
                                vbank_num: payment.result.vbank_num,
                                vbank_date: payment.result.vbank_date,
                                vbank_holder: payment.result.vbank_holder,
                                vbank_name: payment.result.vbank_name
                            }

                            propertyCollection.findOneAndUpdate({_id: payment.propertyUniqueId}, {$set: {isScanFeePaid: true}})

                            alimtalk.sendVBankPaidNotice(info)
                        } else if (status === DANAL_PAYMENT_STATUS.CANCELLED) {
                            propertyCollection.findOneAndUpdate({_id: payment.propertyUniqueId}, {$set: {isScanFeePaid: false}})
                        }
                    })
            } else {
                paymentCollection.insertOne({
                    impUid: impUid,
                    'result.merchant_uid': merchantUid,
                    'result.status': status
                })
            }
        })

    if (status === 'paid') {
        paymentCollection.findOne({impUid: impUid})
            .then(payment => {
                if (payment) {

                }
            })
    }

    res.status(200).send()
})

router.post('/save/result', (req, res) => {

    let realEstateAgentUniqueId = req.body.userUniqueId

    let payResult = req.body.result
    let impUid = req.body.result.imp_uid
    let merchantUid = req.body.result.merchant_uid
    let paymentDetail = req.body.paymentDetail
    let propertyUniqueId = payResult.custom_data
    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)
    let reqCancel = req.body.reqCancel
    let isCanceled = req.body.isCanceled

    paymentCollection.findOne({impUid: impUid, propertyUniqueId: new objectId(propertyUniqueId)})
        .then(payment => {
            if (payment) {
                paymentCollection.findOneAndUpdate(
                    {impUid: impUid, propertyUniqueId: new objectId(propertyUniqueId)},
                    {$set: {'result.status': status}}
                )
                    .then(_ => {
                        sendAlimTalk(payResult, propertyUniqueId, impUid)
                    })
            } else {
                paymentCollection.insertOne({
                    realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
                    propertyUniqueId: new objectId(propertyUniqueId),
                    impUid: impUid,
                    result: payResult,
                    paymentDetail: paymentDetail,
                    transactionDate: new Date(),
                    reqCancel: reqCancel,
                })
                    .then(_ => {
                        sendAlimTalk(payResult, propertyUniqueId, impUid)
                    })
            }
        })


    res.status(200).send()
})

router.post('/adm/fetch/pay/history', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let startDate = req.body.startDate
    let endDate = req.body.endDate
    let limit = req.body.limit
    let skip = req.body.skip

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)

    let transStartDate = new Date(startDate)
    let transEndDate = new Date(endDate)

    paymentCollection.aggregate([
        {$match: {$and: [{transactionDate: {$gte: transStartDate}}, {transactionDate: {$lte: transEndDate}},{'result.success' : true}]}},
        {
            $facet: {
                count: [{$count: 'totalCount'}],
                list: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'propertyUniqueId',
                            foreignField: '_id',
                            as: 'property'
                        }
                    },
                    {
                        $unwind: {
                            path: '$property',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.USER,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: '_id',
                            as: 'realEstateAgent'
                        }
                    },
                    {
                        $unwind: {
                            path: '$realEstateAgent',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.REAL_ESTATE_AGENT_INFO,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'agency'
                        }
                    },
                    {
                        $unwind: {
                            path: '$agency',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.SCAN_AGREEMENT,
                            localField: 'propertyUniqueId',
                            foreignField: 'propertyUniqueId',
                            as: 'scanAgreement'
                        }
                    },
                    {
                        $unwind: {
                            path : '$scanAgreement',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            paymentUniqueId: '$_id',
                            amount: '$paymentDetail.totalPrice',
                            'property.propertyUniqueId': '$property._id',
                            'property.title': {$concat: ['$property.title', ' ', '$property.address_2']},
                            'property.filmingDate': '$property.filmingDate',
                            'realEstate.realEstateAgentUniqueId': '$realEstateAgent._id',
                            'realEstate.agentName': '$realEstateAgent.name',
                            'realEstate.companyName': '$agency.companyName',
                            'status.value': {$cond: ['$result.success', '$result.status', 'etc']},
                            'status.reason': {$cond: ['$result.success', null, '$result.error_msg']},
                            transactionDate: '$transactionDate',
                            method: '$result.pay_method',
                            'filmingLocation': {$concat: ['$paymentDetail.address_1', ' ', '$paymentDetail.address_2']},
                            'scanAgreement.ownerName' : '$scanAgreement.ownerName',
                            'scanAgreement.ownerPhoneNumber' : '$scanAgreement.ownerPhoneNumber',
                            'biz' : '$paymentDetail.biz'
                        }
                    },
                    {
                        $sort: {_id: -1}
                    }
                ]
            }
        },
        {$unwind: '$count'}
    ], (err, cursor) => {
        if (err) {
            throw err
        }

        cursor.toArray()
            .then(docs => {
                let response = {
                    totalCount: 0,
                    list: []
                }

                if (docs.length > 0) {
                    let result = docs[0]
                    response.totalCount = result.count
                    response.list = result.list
                }

                res.json(response)
            })
    })
})

router.post('/request/refund', (req, res) => {
    let {userUniqueId, paymentUniqueId, refundAmount, refundReason, refundHolder, refundBank, refundAccount} = req.body

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)

    paymentCollection.findOne({_id: new objectId(paymentUniqueId)})
        .then(payment => {
            if (payment) {
                let amount = payment.result.paid_amount

                if (payment.cancelDetail) {
                    amount = payment.result.paid_amount - parseInt(payment.cancelDetail.cancel_amount)
                }

                let checksum = payment.result.paid_amount

                if (amount <= 0) {
                    return res.json({error: {message: '이미 전액환불된 주문입니다.'}})
                }

                axios.post('https://api.iamport.kr/users/getToken', {
                    imp_key: process.env.IMP_KEY,
                    imp_secret: process.env.IMP_PWD
                })
                    .then(async response => {
                        let access_token = response.data.response.access_token

                        let data

                        if (payment.result.pay_method === DANAL_PAYMENT_METHOD.VBANK) {
                            data = {

                                imp_uid: payment.impUid,
                                reason: (refundReason) ? refundReason : '',
                                amount: refundAmount,
                                checksum: checksum,
                                refund_holder: refundHolder,
                                refund_bank: refundBank,
                                refund_account: refundAccount
                            }
                        } else {
                            data = {

                                imp_uid: payment.impUid,
                                reason: (refundReason) ? refundReason : '',
                                amount: refundAmount,
                                checksum: checksum
                            }
                        }

                        const getCancelData = await axios({
                            url: 'https://api.iamport.kr/payments/cancel',
                            method: 'post',
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": access_token
                            },
                            data
                        })


                        let cancelResult = getCancelData.data.response

                        if (cancelResult) {
                            let leftover = payment.result.paid_amount - parseInt(cancelResult.cancel_amount)

                            paymentCollection.findOneAndUpdate({_id: new objectId(paymentUniqueId)},
                                {
                                    $set: {
                                        cancelDetail: getCancelData.data.response,
                                        'result.status': cancelResult.status,
                                        'result.paid_amount': leftover
                                    }
                                }
                            )
                                .then(_ => {
                                    res.json({error: null})

                                })

                        } else {
                            res.json({error: {message: getCancelData.data.message}})
                        }


                    })
            }
        })
})

router.post('/fetch/payment/detail', (req, res) => {
    const {userUniqueId, paymentUniqueId} = req.body

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)
    paymentCollection.findOne({_id: new objectId(paymentUniqueId)})
        .then(payment => {
            if (payment) {
                let response = {
                    detail: {
                        success: payment.result.success,
                        pay_method: payment.result.pay_method,
                        paid_amount: payment.result.paid_amount
                    },
                    error: null
                }

                res.json(response)
            } else {
                let response = {
                    detail: null,
                    error: {
                        message: '결제내역이 존재하지 않습니다.'
                    }
                }

                res.json(response)
            }
        })
})

router.post('/fetch/estate/payment/list', (req, res) => {

    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let skip = req.body.skip;
    let limit = req.body.limit;
    let payStatus = req.body.payStatus;

    let matchList = {}

    if (payStatus !== null) {
        matchList = {$match: {$and: [{realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}, {'result.success': true}, {'result.status': payStatus}]}}
    } else {
        matchList = {$match: {$and: [{realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}, {'result.success': true}]}}
    }

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT);

    paymentCollection.aggregate([
        matchList,
        {
            $facet: {
                count: [{$count: 'totalCount'}],
                list: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'propertyUniqueId',
                            foreignField: '_id',
                            as: 'property'
                        }
                    },
                    {
                        $unwind: {
                            path: '$property',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.USER,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: '_id',
                            as: 'realEstateAgent'
                        }
                    },
                    {
                        $unwind: {
                            path: '$realEstateAgent',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.REAL_ESTATE_AGENT_INFO,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'agency'
                        }
                    },
                    {
                        $unwind: {
                            path: '$agency',
                            preserveNullAndEmptyArrays: true
                        }
                    },

                    {
                        $project: {
                            paymentUniqueId: '$_id',
                            'amount': '$paymentDetail.totalPrice',
                            'property.propertyUniqueId': '$property._id',
                            'property.title': '$property.title',
                            'property.price': '$property.price',
                            'property.thumbnail': '$property.thumbnail',
                            'property.deposit': '$property.deposit',
                            'property.currDeposit': '$property.currDeposit',
                            'property.currRent': '$property.currRent',
                            'property.category': '$property.category',
                            'property.salesMethod': '$property.salesMethod',
                            'property.address': {$concat: ['$property.address_1', ' ', '$property.address_2']},
                            'property.filmingDate': '$property.filmingDate',
                            'realEstate.realEstateAgentUniqueId': '$realEstateAgent._id',
                            'realEstate.agentName': '$realEstateAgent.name',
                            'realEstate.companyName': '$agency.companyName',
                            'payStatus': '$result.status',
                            'memo': '$paymentDetail.memo',
                            transactionDate: '$transactionDate',
                            method: '$result.pay_method',
                            'vbank.num': '$result.vbank_num',
                            'vbank.date': '$result.vbank_date',
                            'vbank.holder': '$result.vbank_holder',
                            'vbank.name': '$result.vbank_name',
                            'card.num': '$result.card_number',
                            'card.name': '$result.card_name',
                            'reqCancel': '$reqCancel',
                            'refundAmount' : '$cancelDetail.cancel_amount',
                            'adminRefundReason' : '$cancelDetail.cancel_reason'
                        },

                    },
                    {
                        $sort: {_id: -1}
                    },
                    {
                        $skip: skip
                    },
                    {
                        $limit: limit
                    },

                ]
            }
        },

        {$unwind: '$count'},

    ], (err, cursor) => {
        if (err) {
            throw  err
        }

        cursor.toArray()
            .then(docs => {
                let response = {
                    totalCount: 0,
                    list: []
                }
                if (docs.length > 0) {
                    let result = docs[0]
                    response.totalCount = result.count.totalCount
                    response.list = result.list
                }

                res.json(response)
            })
    })
})

router.post('/req/estate/cancel/payment', (req, res) => {
    let paymentUniqueId = req.body.paymentUniqueId
    let refundReason = req.body.refundReason;
    let bankCode = req.body.bankCode ? req.body.bankCode : '';
    let bankNum = req.body.bankNum ? req.body.bankNum : '';
    let bankHolder = req.body.bankHolder ? req.body.bankHolder : '';
    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT);

    let refund = {
        refundReason: refundReason,
        bankCode: bankCode,
        bankNum: bankNum,
        bankHolder: bankHolder,
        reqRefundDate: new Date(),
        refundSuccess: null
    }

    paymentCollection.findOne({_id: new objectId(paymentUniqueId)}).then((payment) => {
        if (payment.result.pay_method === constants.DANAL_PAYMENT_METHOD.CARD) {
            refund = {
                ...refund,
                cardName: payment.result.card_name,
                cardNumber: payment.result.card_number
            }
        }

        if (payment.reqCancel) {
            res.json({
                error: {
                    message: '이미 결제 취소 요청한 매물 입니다.'
                }
            })

        } else {
            paymentCollection.findOneAndUpdate({_id: new objectId(paymentUniqueId)},
                {
                    $set: {reqCancel: true, refund: refund}
                })
                .then(() => {
                    res.json({
                        reqCancel: true
                    })
                })
        }
    })
        .catch((err) => {
            res.json({
                reqCancel: false,
                error: "서버에러"
            })
            throw err
        })
})

router.post('/adm/fetch/reqcancel/payment/list', (req, res) => {
    let adminUserUniqueId = req.body.userUniqueId;
    let skip = req.body.skip;
    let limit = req.body.limit;

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT);

    let callback = (isAdmin) => {
        if (!isAdmin) {

            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }
        paymentCollection.aggregate([
            {$match: {$and: [{reqCancel: true}, {'result.success': true}, {$or: [{'result.status': DANAL_PAYMENT_STATUS.PAID}, {'result.status': DANAL_PAYMENT_STATUS.CANCELLED}]}]}},
            {
                $facet: {
                    count: [{$count: 'totalCount'}],
                    list: [
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'propertyUniqueId',
                                foreignField: '_id',
                                as: 'property'
                            }
                        },
                        {
                            $unwind: {
                                path: '$property',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.USER,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: '_id',
                                as: 'realEstateAgent'
                            }
                        },
                        {
                            $unwind: {
                                path: '$realEstateAgent',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'agency'
                            }
                        },
                        {
                            $unwind: {
                                path: '$agency',
                                preserveNullAndEmptyArrays: true
                            }
                        },

                        {
                            $project: {
                                paymentUniqueId: '$_id',
                                'amount': '$result.paid_amount',
                                'property.propertyUniqueId': '$property._id',
                                'property.title': '$property.title',
                                'property.price': '$property.price',
                                'property.thumbnail': '$property.thumbnail',
                                'property.deposit': '$property.deposit',
                                'property.currDeposit': '$property.currDeposit',
                                'property.currRent': '$property.currRent',
                                'property.category': '$property.category',
                                'property.salesMethod': '$property.salesMethod',
                                'property.filmingDate': '$property.filmingDate',
                                'property.address': {$concat: ['$property.address_1', ' ', '$property.address_2']},
                                'realEstate.realEstateAgentUniqueId': '$realEstateAgent._id',
                                'realEstate.agentName': '$realEstateAgent.name',
                                'realEstate.companyName': '$agency.companyName',
                                'payStatus': '$result.status',
                                'memo': '$paymentDetail.memo',
                                transactionDate: '$transactionDate',
                                method: '$result.pay_method',
                                'vbank.num': '$result.vbank_num',
                                'vbank.date': '$result.vbank_date',
                                'vbank.holder': '$result.vbank_holder',
                                'vbank.name': '$result.vbank_name',
                                'card.num': '$result.card_number',
                                'card.name': '$result.card_name',
                                'reqCancel': '$reqCancel',
                                'buyer': '$result.buyer_name',
                                'refund': '$refund',
                                'refundAmount' : '$cancelDetail.cancel_amount',
                                'cancelReason' : '$cancelDetail.cancel_reason',
                                'biz' : '$paymentDetail.biz'
                            },

                        },
                        {
                            $sort: {_id: -1}
                        },
                        {
                            $skip: skip
                        },
                        {
                            $limit: limit
                        },

                    ]
                }
            },
            {$unwind: '$count'},
        ], (err, cursor) => {
            if (err) {
                throw  err
            }

            cursor.toArray()
                .then(docs => {
                    let response = {
                        totalCount: 0,
                        list: []
                    }
                    if (docs.length > 0) {
                        let result = docs[0]
                        response.totalCount = result.count.totalCount
                        response.list = result.list
                    }

                    res.json(response)
                })
        })

    }

    ifAdminThenExecute(adminUserUniqueId, callback)

})

ifAdminThenExecute = (userUniqueId, callback) => {
    let userCollection = db.getDb().collection(constants.collection.USER)
    userCollection.findOne({_id: new objectId(userUniqueId)})
        .then(user => {
            if (user !== null) {
                if (user.isAdmin) {
                    callback(true)
                } else {
                    callback(false)
                }
            } else {
                callback(false)
            }
        })
        .catch(err => {
            callback(false)
            throw err
        })
}


const getLocalDate = (date) => {

    let year = date.getFullYear()
    let day = ("0" + date.getDate()).slice(-2)
    let month = ("0" + (date.getMonth() + 1)).slice(-2)
    let hour = ("0" + (date.getHours())).slice(-2)
    let min = ("0" + (date.getMinutes())).slice(-2)
    return `${year}-${month}-${day} ${hour}:${min}`
}

const sendAlimTalk = (payResult, propertyUniqueId, impUid) => {
    if ((payResult.pay_method === DANAL_PAYMENT_METHOD.CARD || payResult.pay_method === DANAL_PAYMENT_METHOD.TRANS) && payResult.status === DANAL_PAYMENT_STATUS.PAID) {
        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
        propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: {isScanFeePaid: true}}, {upsert: true})
            .then(_ => {
                let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)
                paymentCollection.findOne({impUid: impUid, propertyUniqueId: new objectId(propertyUniqueId)})
                    .then(payment => {


                        let info = {
                            receiverPhoneNumber: payResult.buyer_tel,
                            order_date: getLocalDate(payment.transactionDate),
                            order_id: payment.impUid.replace('imp_', ''),
                            amount: payResult.paid_amount,
                            card_name: payResult.card_name,
                            card_number: payResult.card_number,
                            buyer_name: payResult.buyer_name,
                        }

                        alimtalk.sendCardBankPaidNotice(info)
                    })
            })
    }

    if (payResult.pay_method === DANAL_PAYMENT_METHOD.VBANK && payResult.status === DANAL_PAYMENT_STATUS.READY) {
        let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)
        paymentCollection.findOne({impUid: impUid, propertyUniqueId: new objectId(propertyUniqueId)})
            .then(payment => {


                let info = {
                    buyer_name: payResult.buyer_name,
                    receiverPhoneNumber: payResult.buyer_tel,
                    order_date: getLocalDate(payment.transactionDate),
                    order_id: payment.impUid.replace('imp_', ''),
                    amount: payResult.paid_amount,
                    vbank_num: payResult.vbank_num,
                    vbank_date: payResult.vbank_date,
                    vbank_holder: payResult.vbank_holder,
                    vbank_name: payResult.vbank_name
                }

                alimtalk.sendVBankInfoAlimTalk(info)
            })
    }

    if (payResult.pay_method === DANAL_PAYMENT_METHOD.VBANK && payResult.status === DANAL_PAYMENT_STATUS.PAID) {
        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
        propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: {isScanFeePaid: true}}, {upsert: true})
            .then(_ => {
                let paymentCollection = db.getDb().collection(constants.collection.PAYMENT)
                paymentCollection.findOne({impUid: impUid, propertyUniqueId: new objectId(propertyUniqueId)})
                    .then(payment => {


                        let info = {
                            receiverPhoneNumber: payResult.buyer_tel,
                            order_date: getLocalDate(payment.transactionDate),
                            order_id: payment.impUid.replace('imp_', ''),
                            amount: payResult.paid_amount,
                            vbank_num: payResult.vbank_num,
                            vbank_date: payResult.vbank_date,
                            vbank_holder: payResult.vbank_holder,
                            vbank_name: payResult.vbank_name
                        }

                        alimtalk.sendVBankPaidNotice(info)
                    })
            })
    }

}

router.post('/adm/request/refund', (req, res) => {
    let {paymentUniqueId,refundAmount ,refundReason} = req.body;

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT);
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
    let realEstateCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
    paymentCollection.findOne({_id: new objectId(paymentUniqueId)})
        .then((payment) => {

            let amount = payment.result.paid_amount;
            let checksum = payment.result.paid_amount

            if(amount <= 0) {
                return res.json({error : {message : '이미 전액환불된 주문입니다.'}})
            }

            if (payment.cancelDetail) {
                amount = payment.result.paid_amount - parseInt(refundAmount)
                if (amount < 0) {
                    return res.json({error: {message: '환불요청 금액이 남은 금액보다 많습니다.'}})
                }
            }



            axios.post('https://api.iamport.kr/users/getToken', {
                imp_key: process.env.IMP_KEY,
                imp_secret: process.env.IMP_PWD
            }).then(async response => {

                try {
                    let access_token = response.data.response.access_token

                    let data = {
                        // reason: payment.refund.refundReason,
                        // imp_uid: payment.impUid,
                        // amount: amount,
                        // checksum: amount,
                        // refund_holder: payment.refund.bankHolder,
                        // refund_bank: payment.refund.bankCode,
                        // refund_account : payment.refund.bankNum,
                        // refund_tel : ''
                        imp_uid: payment.impUid,
                        reason: refundReason,
                        amount: refundAmount,
                        checksum: checksum,
                    }

                    const getCancelData = await axios({
                        url: 'https://api.iamport.kr/payments/cancel',
                        method: 'POST',
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": access_token
                        },
                        data: data
                    })


                    let cancelResult = getCancelData.data.response

                    if (cancelResult) {
                        let leftover = payment.result.paid_amount - parseInt(refundAmount)

                        paymentCollection.findOneAndUpdate({_id: new objectId(paymentUniqueId)},
                            {
                                $set: {
                                    cancelDetail: getCancelData.data.response,
                                    'result.status': cancelResult.status,
                                    'result.paid_amount' : leftover,
                                    'refund.refundSuccess': true,
                                }
                            }
                        )
                            .then(async (payment) => {
                                try {
                                    const payInfo = payment.value;
                                    let property = await propertyCollection.findOneAndUpdate({_id: payInfo.propertyUniqueId}, {$set: {isScanFeePaid: false}})
                                        .then((property) => {
                                            return property.value
                                        });
                                    let realEstate = await realEstateCollection.findOne({realEstateAgentUniqueId: payInfo.realEstateAgentUniqueId})

                                    let info = {
                                        payMethod: payInfo.result.pay_method,
                                        receiverPhoneNumber: realEstate.phoneNumber,
                                        realEstateAgent: realEstate.ceoName,
                                        propertyTitle: property.title,
                                        amount: refundAmount,
                                        reason: cancelResult.cancel_reason,
                                        order_id: payInfo.impUid.replace('imp_', ''),
                                    }

                                    switch (payInfo.result.pay_method) {
                                        case constants.DANAL_PAYMENT_METHOD.CARD :
                                            info = {
                                                ...info,
                                                cardName: payInfo.refund.cardName,
                                                cardNumber: payInfo.refund.cardNumber,
                                            }
                                            break
                                        case constants.DANAL_PAYMENT_METHOD.VBANK :
                                            info = {
                                                ...info,
                                                bankCode: payInfo.refund.bankCode,
                                                bankNum: payInfo.refund.bankNum,
                                                bankHolder: payInfo.refund.bankHolder
                                            }
                                            break
                                        case constants.DANAL_PAYMENT_METHOD.TRANS :
                                            break
                                        default :
                                            console.error('payment.result.pay_method error')
                                    }

                                    alimtalk.sendRefundNotice(info)

                                    res.json({error: null, refundSuccess: true})
                                } catch (e) {
                                    throw e
                                }

                            })

                    } else {
                        res.json({error: {message: getCancelData.data.message}, refundSuccess: false})
                    }
                } catch (e) {
                    throw e
                }

            })
        })
})

router.post('/adm/select/filmingDate', (req, res) => {
    let paymentUniqueId = req.body.paymentUniqueId;
    let filmingDate = req.body.filmingDate;

    let paymentCollection = db.getDb().collection(constants.collection.PAYMENT);
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY);
    let realEstateCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

    paymentCollection.findOne({_id: new objectId(paymentUniqueId)})
        .then(async (payment) => {

            try {

                const realEstate = await realEstateCollection.findOne({realEstateAgentUniqueId: payment.realEstateAgentUniqueId})
                const property = await propertyCollection.findOneAndUpdate({_id: payment.propertyUniqueId}, {$set: {filmingDate: filmingDate}})
                let dateAndTime = property.value.filmingDate.replace('T', ' ')
                let info = {
                    propertyTitle: property.value.title,
                    filmingDate: dateAndTime,
                    receiverPhoneNumber: realEstate.phoneNumber,
                    realEstateAgent: realEstate.ceoName,
                    address: payment.paymentDetail.address_1 + ' ' + payment.paymentDetail.address_2
                }

                alimtalk.sendFilmingDateNotice(info)
                res.json({filmingDateSave: true})

            } catch (e) {
                res.json({filmingDateSave: false})
            }
        })
})

router.post('/adm/vbank/refund/success',  async (req, res)=> {
    const paymentUniqueId = req.body.paymentUniqueId;
    const refundAmount = req.body.amount;
    const refundReason = req.body.refundReason;

    const paymentCollection = db.getDb().collection(constants.collection.PAYMENT);
    const payment = await paymentCollection.findOne({_id : new objectId(paymentUniqueId)});

    let amount = payment.result.paid_amount;
    let cancelAmount;

    if(amount <= 0) {
        return res.json({error : {message : '이미 전액환불된 주문입니다.'}})
    }

    if (payment.cancelDetail) {
        amount = payment.result.paid_amount - parseInt(refundAmount)
        cancelAmount = parseInt(payment.cancelDetail.cancel_amount) + parseInt(refundAmount)
    } else {

        amount = payment.result.paid_amount - parseInt(refundAmount)
        cancelAmount = parseInt(refundAmount);

    }

    if (amount < 0) {
        return res.json({isVbankCancelled: false, error : {message : '남은 금액이 마이너스가 될 수 없습니다.'}})
    }


     paymentCollection.findOneAndUpdate({_id : new objectId(paymentUniqueId)},
         {$set : {'result.status' : constants.DANAL_PAYMENT_STATUS.CANCELLED ,'result.paid_amount' : amount , 'cancelDetail.cancel_amount' : cancelAmount, 'cancelDetail.cancel_reason': refundReason }})
         .then(()=> {
             res.json({isVbankCancelled : true})
         }).catch((e)=> {
             res.json({isVbankCancelled : false})
     })
})


module.exports = router