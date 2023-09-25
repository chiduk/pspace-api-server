let db = require('../config/database')
let constants = require('../util/constants')
let objectId = require('mongodb').ObjectID;
let express = require('express');
let bcrypt = require('bcrypt');
let shortid = require('shortid');
let saltRounds = 10
let router = express.Router();
let axios = require('axios')
let alimtalk = require('../util/alimtalk')



router.post('/check/password', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let password = req.body.password

    let userCollection = db.getDb().collection('USER')

    userCollection.findOne({_id: new objectId(userUniqueId)})
        .then(user => {
            if (user !== null) {
                bcrypt.compare(password, user.password)
                    .then(isMatching => {
                        if (isMatching) {
                            delete user._id
                            delete user.password


                            let obj = {
                                userData: user,
                                error: null
                            }

                            res.json(obj)

                        } else {
                            let obj = {
                                userData: null,
                                error: {code: 'M001', message: '비밀번호가 일치하지 않습니다.'}
                            }

                            res.json(obj)

                        }

                    })

            } else {
                let obj = {
                    userData: null,
                    error: {code: 'M002', message: '사용자가 존재하지 않습니다.'}
                }

                res.json(obj)
            }
        })
        .catch(err => {
            let obj = {
                userData: null,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(obj)

            throw err
        })
})


router.post('/signout', (req, res) => {
    let userUniqueId = req.body.userUniqueId

    let userCollection = db.getDb().collection('USER')
    userCollection.updateOne({_id: new objectId(userUniqueId)}, {$set: {isSignedOut: true, signedOutDate: new Date()}})
        .then(() => {
            let response = {
                isSignedOut: true,
                error: null
            }

            res.json(response)
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

//매물등록 알림 리스트 요청
router.post('/fetch/interested/property', (req, res) => {
    let userUniqueId = req.body.userUniqueId

    let interestedAreaCollection = db.getDb().collection(constants.collection.INTERESTED_PROPERTY)

    interestedAreaCollection.aggregate([
        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {
            $lookup: {
                from: constants.collection.PROPERTY,
                localField: 'propertyUniqueId',
                foreignField: '_id',
                as: 'interestedProperties'
            }
        },
        {
            $unwind: '$interestedProperties'
        }
    ], (err, cursor) => {
        if (err) {

            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {

                throw e2
            }

            let result = {
                propertyList: [],
                error: null
            }

            docs.forEach(property => {
                let obj = {
                    propertyUniqueId: property._id,
                    title: property.interestedProperties.title,
                    address: property.interestedProperties.address_1
                }

                result.propertyList.push(obj)
            })

            res.json(result)

        })
    })
})

router.post('/fetch/authorized/vr/tour/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)

    vrTourCollection.aggregate([
        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {$match: {isConfirmed: true}},
        {
            $lookup: {
                from: constants.collection.PROPERTY,
                localField: 'propertyUniqueId',
                foreignField: '_id',
                as: 'vrTourProperty'
            }
        },
        {
            $unwind: '$vrTourProperty'
        }
    ], (err, cursor) => {
        if (err) {

            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {

                throw e2
            }

            let result = {
                vrTourList: [],
                error: null
            }

            docs.forEach(tour => {
                let obj = {
                    vrTourUniqueId: tour._id,
                    propertyUniqueId: tour.propertyUniqueId,
                    propertyTitle: tour.vrTourProperty.title,
                    address: tour.vrTourProperty.address_2
                }

                result.vrTourList.push(obj)
            })


            res.json(result)
        })

    })
})

router.post('/fetch/appointment/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId

    let appointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    appointmentCollection.aggregate([
        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {$match: {isConfirmed: true}},
        {
            $lookup: {
                from: constants.collection.PROPERTY,
                localField: 'propertyUniqueId',
                foreignField: '_id',
                as: 'appointmentProperty'
            }
        },
        {
            $unwind: '$appointmentProperty'
        }
    ], (err, cursor) => {
        if (err) {

            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {

                throw e2
            }

            let result = {
                appointmentList: [],
                error: null
            }

            docs.forEach(appointment => {
                let obj = {
                    propertyUniqueId: appointment.propertyUniqueId,
                    title: appointment.appointmentProperty.title,
                    address: appointment.appointmentProperty.address_2
                }

                result.appointmentList.push(obj)
            })


            res.json(result)
        })
    })
})

router.post('/update/info', (req, res) => {


    let userUniqueId = req.body.userUniqueId
    let password = req.body.password
    let address_1 = req.body.address_1
    let address_2 = req.body.address_2
    let name = req.body.name
    let phoneNumber = req.body.phoneNumber
    let gender = req.body.gender
    let interestedArea = req.body.interestedArea
    let isSubscribedToMarketingNews = req.body.isSubscribedToMarketingNews

    let userCollection = db.getDb().collection(constants.collection.USER)

    let updateObj = {}

    updateObj.name = name
    updateObj.address_1 = address_1
    updateObj.address_2 = address_2
    updateObj.phoneNumber = phoneNumber
    updateObj.gender = gender
    updateObj.interestedArea = interestedArea
    updateObj.isSubscribedToMarketingNews = isSubscribedToMarketingNews

    if (password.length === 0) {


        userCollection.findOneAndUpdate({_id: new objectId(userUniqueId)}, {$set: updateObj})
            .then(() => {
                let response = {
                    isUpdated: true,
                    error: null
                }

                res.json(response)
            })
    } else {
        bcrypt.genSalt(saltRounds, (err, salt) => {
            if (err) {
                let obj = {
                    userData: null,
                    error: {code: 'S500', message: '서버에러'}
                }

                res.json(obj)
                throw err
            }

            bcrypt.hash(password, salt, (e2, hash) => {
                if (e2) {
                    let obj = {
                        userData: null,
                        error: {code: 'S500', message: '서버에러'}
                    }

                    res.json(obj)
                    throw e2
                }

                updateObj.password = hash

                userCollection.findOneAndUpdate({_id: new objectId(userUniqueId)}, {$set: updateObj})
                    .then(() => {
                        let response = {
                            isUpdated: true,
                            error: null
                        }

                        res.json(response)
                    })
            })
        })
    }
})

router.post('/fetch/interested/property/detail/', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    propertyCollection.findOne({_id: new objectId(propertyUniqueId)})
        .then(property => {
            if (property !== null) {
                property.propertyUniqueId = property._id
                delete property._id

                res.json({
                    property: property,
                    error: null
                })


            } else {
                res.json({error: '현재 볼 수 없는 매물입니다.'})
            }
        })
        .catch(err => {
            res.json({error: '서버에러'})
            throw err
        })


})

router.post('/fetch/saved/property/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let skip = req.body.skip
    let limit = req.body.limit
    let status = req.body.status

    let savedPropertyCollection = db.getDb().collection(constants.collection.SAVED_PROPERTY)

    let statusObj = {}

    if (status === 'ALL') {
        statusObj = {$match: {'property.status.type': {$ne: 'COMPLETED'}}}
    } else if (status === "CLOSED") {
        statusObj = {$match: {'property.status.type': {$nin: ['COMPLETED', 'SELLING']}}}
    } else {
        statusObj = {$match: {'property.status.type': status}}
    }

    savedPropertyCollection.aggregate([
        {
            $sort: {_id: -1}
        },

        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {
            $facet: {
                count: [{
                    $lookup: {
                        from: constants.collection.PROPERTY,
                        localField: 'propertyUniqueId',
                        foreignField: '_id',
                        as: 'property'
                    }
                },
                    {
                        $unwind: '$property'
                    },
                    statusObj,
                    {
                        $group: {
                            _id: null,
                            totalCount: {$sum: 1}
                        }
                    }

                ],
                prop: [
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
                    },
                    statusObj,
                    {$skip: parseInt(skip)},
                    {$limit: parseInt(limit)},
                    {

                        $sort: {'property._id': -1}
                    },
                    {
                        $lookup: {
                            from: constants.collection.VISIT_APPOINTMENT,
                            localField: 'propertyUniqueId',
                            foreignField: 'propertyUniqueId',
                            as: 'appointment'
                        }
                    },
                    {
                        $unwind: {
                            path: '$appointment',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            propertyUniqueId: {$first: "$property._id"},
                            status: {$first: "$property.status"},
                            price: {$first: "$property.price"},
                            deposit: {$first: '$property.deposit'},
                            currDeposit: {$first: '$property.currDeposit'},
                            currRent: {$first: '$property.currRent'},
                            category: {$first: "$property.category"},
                            salesMethod: {$first: "$property.salesMethod"},
                            mortgage: {$first: "$property.mortgage"},
                            numberOfRooms: {$first: "$property.numberOfRooms"},
                            numberOfBathrooms: {$first: "$property.numberOfBathrooms"},
                            facingDirection: {$first: "$property.facingDirection"},
                            maintenanceFee: {$first: "$property.maintenanceFee"},
                            note: {$first: "$property.note"},
                            title: {$first: "$property.title"},
                            address_1: {$first: "$property.address_1"},
                            address_2: {$first: "$property.address_2"},
                            size: {$first: "$property.size"},
                            moveinDate: {$first: "$property.moveinDate"},
                            numOfMonths: {$first: '$property.numOfMonths'},
                            thumbnail: {$first: "$property.thumbnail"},
                            appointment: {$push: "$appointment"},
                            realEstateAgentUniqueId: {$first: "$property.realEstateAgentUniqueId"}
                        }
                    },
                    {$sort: {_id: -1}},
                    {
                        $project: {
                            _id: 0,
                            propertyUniqueId: 1,
                            status: {
                                type: {
                                    $cond: {
                                        if: {$ne: ["$status.type", "SELLING"]},
                                        then: "CLOSED",
                                        else: "SELLING"
                                    }
                                },
                                value: {$cond: {if: {$ne: ["$status.value", "거래중"]}, then: "거래종료", else: "거래중"}}
                            },
                            price: 1,
                            deposit: {$cond: [{$or : [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                            currDeposit: {$cond: [{$or : [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                            currRent: {$cond: [{$or : [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                            category: 1,
                            salesMethod: 1,
                            mortgage: 1,
                            numberOfRooms: 1,
                            numberOfBathrooms: 1,
                            facingDirection: 1,
                            maintenanceFee: 1,
                            note: 1,
                            title: 1,
                            address_1: 1,
                            address_2: 1,
                            size: 1,
                            moveinDate: 1,
                            numOfMonths: {$cond: [{$or : [{$eq: ['$numOfMonths', null]}, {$eq: ['$numOfMonths', ""]}, {$eq: ['$numOfMonths', "null"]} ]}, null, '$numOfMonths']},
                            thumbnail: 1,
                            appointment: 1,
                            realEstateAgentUniqueId: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: '$property.thumbnail',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: '$count'
        }

    ], (err, cursor) => {
        if (err) {
            res.status(500).send()

            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {

                res.status(500).send()
                throw e2
            }

            let response = {
                propertyList: [],
                totalCount: 0,
                error: null
            }

            if (docs.length > 0) {
                let result = docs[0]

                response.totalCount = result.count.totalCount
                response.propertyList = result.prop

            }

            res.json(response)
        })
    })
})

router.post('/request/vr/tour', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)
    let userCollection = db.getDb().collection(constants.collection.USER)
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    vrTourCollection.findOne({
        userUniqueId: new objectId(userUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId),
        "$or": [{'grantedTime': {'$gt': new Date(Date.now() - 24 * 60 * 60 * 1000)}}, {'grantedTime': null}]
    })
        .then(tour => {
            if (tour !== null) {
                let response = {
                    isRequested: false,
                    error: {code: 'V001', message: '이미 신청한 투어입니다.'},
                    isEnabled: tour.isEnabled
                }

                res.json(response)
            } else {
                let obj = {
                    userUniqueId: new objectId(userUniqueId),
                    propertyUniqueId: new objectId(propertyUniqueId),
                    date: new Date(),
                    isConfirmed: false,
                    isEnabled: null
                }

                vrTourCollection.insertOne(obj)
                    .then(insertedResult => {


                        propertyCollection.findOne({_id: new objectId(propertyUniqueId)})
                            .then(property => {
                                if(property) {
                                    let redisCli = db.getRedisClient();
                                    const key = shortid.generate();
                                    redisCli.set(`${key}.realEstateAgentUniqueId`, property.realEstateAgentUniqueId.toString())
                                    redisCli.set(`${key}.vrTourUniqueId`, insertedResult.insertedId.toString())


                                    let response = {
                                        isRequested: true,
                                        error: null
                                    }


                                    res.json(response)
                                    /*
                                                          * 알림톡 보내기
                                                          * */
                                    userCollection.findOne({_id: new objectId(userUniqueId)})
                                        .then(user => {
                                            if (user) {
                                                let requesterName = user.name
                                                let requesterPhoneNumber = user.phoneNumber
                                                propertyCollection.aggregate([
                                                    {$match: {_id: new objectId(propertyUniqueId)}},
                                                    {
                                                        $lookup: {
                                                            from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                                            localField: 'realEstateAgentUniqueId',
                                                            foreignField: 'realEstateAgentUniqueId',
                                                            as: 'agency'
                                                        }
                                                    },
                                                    {
                                                        $unwind: '$agency'
                                                    }
                                                ], (err, cursor) => {
                                                    if (err) {
                                                        throw err
                                                    }

                                                    cursor.toArray()
                                                        .then(docs => {
                                                            if (docs.length > 0) {
                                                                let result = docs[0]



                                                                let rePhoneNumber = result.agency.phoneNumber

                                                                if(rePhoneNumber.startsWith('0')){
                                                                    rePhoneNumber = `82${rePhoneNumber.substring(1, rePhoneNumber.length)}`

                                                                }else{
                                                                    rePhoneNumber = `82${rePhoneNumber}`
                                                                }

                                                                if(process.env.NODE_ENV === 'development'){
                                                                    rePhoneNumber = '821035064429'
                                                                }

                                                                //let propertyTitle = `${result.title} ${result.dongNumber}동 ${result.hoNumber}호`

                                                                let propertyTitle = result.title

                                                                propertyTitle += propertyTitle + (result.dongNumber) ? result.dongNumber+'동' : ''
                                                                propertyTitle += propertyTitle + (result.hoNumber) ? result.hoNumber+'호' : ''

                                                                let approvalLink = `https://pspace.ai/api/repage/autoApproveVrTour/${key}`
                                                                let cancelLink = `https://pspace.ai/api/repage/autoCancelVrTour/${key}`
                                                                let template = 'vrTourRequestProductServer'

                                                                if(process.env.NODE_ENV === 'development'){
                                                                    approvalLink = `http://10.0.1.102:64040/api/repage/autoApproveVrTour/${key}`
                                                                    cancelLink = `http://10.0.1.102:64040/api/repage/autoCancelVrTour/${key}`
                                                                    template = 'vrTourRequestDevServer'
                                                                }

                                                                let content = `안녕하세요 평행공간입니다.\n\n${requesterName}[${requesterPhoneNumber}]님 께서 ${propertyTitle}의\nVR TOUR를 요청하셨습니다.`


                                                                axios({
                                                                    method: 'post',
                                                                    url: 'https://msggw-auth.supersms.co:9440/auth/v1/token',
                                                                    headers: {
                                                                        'Content-type': 'application/json;charset=UTF-8',
                                                                        'Accept': 'application/json',
                                                                        'X-IB-Client-Id': process.env.ALIMTALK_ID,
                                                                        'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET
                                                                    }
                                                                })
                                                                    .then(response => {
                                                                        //console.log(response)

                                                                        //알림톡 보내기 API
                                                                        //https://msggw.supersms.co:9443/v1/send/kko

                                                                        let authorization = response.data.schema + ' ' + response.data.accessToken

                                                                        axios({
                                                                            method: 'post',
                                                                            url: 'https://msggw.supersms.co:9443/v1/send/kko',
                                                                            headers: {
                                                                                'Content-type': 'application/json;charset=UTF-8',
                                                                                'Accept': 'application/json',
                                                                                'X-IB-Client-Id': process.env.ALIMTALK_ID,
                                                                                'X-IB-Client-Passwd': process.env.ALIMTALK_SECRET,
                                                                                'Authorization': authorization
                                                                            },
                                                                            data: {
                                                                                "msg_type": "AL",
                                                                                "mt_failover": "Y",
                                                                                "msg_attr": {
                                                                                    "sender_key": process.env.SENDER_KEY,
                                                                                    "template_code": template,
                                                                                    "response_method": "push",
                                                                                    "ad_flag": "Y",
                                                                                    "attachment": {
                                                                                        "button": [
                                                                                            {
                                                                                                "name": "승인",
                                                                                                "type": "WL",
                                                                                                "url_pc": approvalLink,
                                                                                                "url_mobile": approvalLink
                                                                                            },
                                                                                            {
                                                                                                "name": "거절",
                                                                                                "type": "WL",
                                                                                                "url_pc": cancelLink,
                                                                                                "url_mobile": cancelLink
                                                                                            },
                                                                                        ]
                                                                                    }
                                                                                },
                                                                                "msg_data": {
                                                                                    "senderid": "0261010909",
                                                                                    "to": rePhoneNumber,
                                                                                    "content": content
                                                                                }
                                                                            }
                                                                        })
                                                                            .then(result2 => {
                                                                                console.log(result2)
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
                                                        .catch(e2 => {
                                                            throw e2
                                                        })
                                                })

                                            }
                                        })
                                        .catch(err => {

                                            throw err
                                        })

                                }
                            })

                    })
            }
        })
})

clickEvent = (href) => {
    window.location.href = href
}

router.post('/fetch/vr/tour/detail/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let limit = req.body.limit
    let skip = req.body.skip
    let status = req.body.status

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)

    let statusObj = {}

    if (status === 'ALL') {
        statusObj = {$match: {$or: [{'property.status.type': {$eq: 'SELLING'}}, {'property.status.type': {$eq: 'CLOSED'}}]}}
    } else {
        statusObj = {$match: {'property.status.type': status}}
    }

    vrTourCollection.aggregate([
        {

            $sort: {_id: -1}
        },
        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {

            $facet: {
                count: [{
                    $lookup: {
                        from: constants.collection.PROPERTY,
                        localField: 'propertyUniqueId',
                        foreignField: '_id',
                        as: 'property'
                    }
                },
                    {
                        $unwind: '$property'
                    },

                    statusObj,
                    {
                        $group: {
                            _id: null,
                            totalCount: {$sum: 1}
                        }
                    }

                ],
                prop: [


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
                    },
                    statusObj,
                    {$skip: parseInt(skip)},
                    {$limit: parseInt(limit)},
                    {

                        $sort: {'property._id': -1}
                    },
                    {
                        $group: {
                            _id: '$_id',
                            vrTourKey: {$first: '$vrTourKey'},
                            isEnabled: {$first: '$isEnabled'},
                            userUniqueId: {$first: '$userUniqueId'},
                            grantedTime: {$first: '$grantedTime'},
                            properties: {$addToSet: '$property'}
                        }
                    },
                    {
                        $project: {
                            userUniqueId: 1,
                            'property.vrTourKey': '$vrTourKey',
                            'property.vrTourUniqueId': '$_id',
                            'property.propertyUniqueId': '$properties._id',
                            'property.realEstateAgentUniqueId': '$properties.realEstateAgentUniqueId',
                            'property.status': '$properties.status',
                            'property.price': '$properties.price',
                            'property.deposit': {$cond: [{$or : [{$eq: ['$properties.deposit', null]}, {$eq: ['$properties.deposit', ""]}, {$eq: ['$properties.deposit', "null"]} ]}, null, '$properties.deposit']},
                            'property.currDeposit': {$cond: [{$or : [{$eq: ['$properties.currDeposit', null]}, {$eq: ['$properties.currDeposit', ""]}, {$eq: ['$properties.currDeposit', "null"]} ]}, null, '$properties.currDeposit']},
                            'property.currRent': {$cond: [{$or : [{$eq: ['$properties.currRent', null]}, {$eq: ['$properties.currRent', ""]}, {$eq: ['$properties.currRent', "null"]}]}, null, '$properties.currRent']},
                            'property.category': '$properties.category',
                            'property.salesMethod': '$properties.salesMethod',
                            'property.mortgage': '$properties.mortgage',
                            'property.numberOfRooms': '$properties.numberOfRooms',
                            'property.numberOfBathrooms': '$properties.numberOfBathrooms',
                            'property.facingDirection': '$properties.facingDirection',
                            'property.maintenanceFee': '$properties.maintenanceFee',
                            'property.note': '$properties.note',
                            'property.title': '$properties.title',
                            'property.address_1': '$properties.address_1',
                            'property.address_2': '$properties.address_2',
                            'property.size': '$properties.size',
                            'property.moveinDate': '$properties.moveinDate',
                            'property.numOfMonths': {$cond: [{$or : [{$eq: ['$properties.numOfMonths', null]}, {$eq: ['$properties.numOfMonths', ""]}, {$eq: ['$properties.numOfMonths', "null"]}]}, null, '$properties.numOfMonths']},
                            'property.grantedTime': '$grantedTime',
                            'property.thumbnail': '$properties.thumbnail',
                            'property.isEnabled': '$isEnabled',
                        }
                    },
                    {
                        $unwind: '$property.propertyUniqueId'
                    },
                    {
                        $unwind: {
                            path: '$property.vrTourKey',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: '$property.realEstateAgentUniqueId'
                    },
                    {
                        $unwind: '$property.status'

                    },
                    {
                        $unwind: '$property.price'
                    },
                    {
                        $unwind: {
                            path: '$property.deposit',
                            preserveNullAndEmptyArrays: true
                        }

                    },
                    {
                        $unwind: {
                            path: '$property.currDeposit',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: {
                            path: '$property.currRent',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: '$property.category'
                    },
                    {
                        $unwind: '$property.salesMethod'
                    },
                    {
                        $unwind: '$property.mortgage'
                    },
                    {
                        $unwind: '$property.numberOfRooms'
                    },
                    {
                        $unwind: '$property.numberOfBathrooms'
                    },
                    {
                        $unwind: '$property.facingDirection'
                    },
                    {
                        $unwind: '$property.maintenanceFee'
                    },
                    {
                        $unwind: '$property.note'
                    },
                    {
                        $unwind: '$property.title'
                    },
                    {
                        $unwind: '$property.address_1'
                    },
                    {
                        $unwind: '$property.address_2'
                    },
                    {
                        $unwind: '$property.size'
                    },
                    {
                        $unwind: '$property.moveinDate'
                    },
                    {
                        $unwind: {
                            path: '$property.numOfMonths',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: {
                            path: '$property.grantedTime',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: {
                            path: '$property.thumbnail',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: {
                            path: '$property.isEnabled',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $sort: {_id: -1}

                    },
                    {
                        $group: {
                            _id: '$userUniqueId',
                            properties: {$push: '$property'}

                        }
                    },
                    {
                        $project: {
                            properties: 1

                        }
                    }

                ]
            }
        },
        {
            $unwind: '$count'
        },
        {
            $unwind: '$prop'
        }
    ], (err, cursor) => {
        if (err) {
            let obj = {

                error: {code: 'S500', message: '서버에러'}
            }

            res.json(obj)
            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {
                let obj = {

                    error: {code: 'S500', message: '서버에러'}
                }

                res.json(obj)
                throw e2
            }

            let response = {
                propertyList: [],
                totalCount: 0,
                error: null
            }

            if (docs.length > 0) {
                let result = docs[0]

                response.totalCount = result.count.totalCount
                response.propertyList = result.prop.properties

            }

            res.json(response)
        })
    })
})

router.post('/fetch/appointment/detail/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let limit = req.body.limit
    let skip = req.body.skip
    let status = req.body.status

    let appointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    let statusObj = {}

    if (status === 'ALL') {
        statusObj = {$match: {$or: [{'property.status.type': {$eq: 'SELLING'}}, {'property.status.type': {$eq: 'CLOSED'}}]}}
    } else {
        statusObj = {$match: {'property.status.type': status}}
    }

    appointmentCollection.aggregate([
        {

            $sort: {_id: -1}
        },
        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {

            $facet: {
                count: [{
                    $lookup: {
                        from: constants.collection.PROPERTY,
                        localField: 'propertyUniqueId',
                        foreignField: '_id',
                        as: 'property'
                    }
                },
                    {$unwind: '$property'},
                    statusObj,
                    {
                        $group: {
                            _id: null,
                            totalCount: {$sum: 1}
                        }
                    }

                ],
                prop: [

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
                    },
                    {
                        $lookup: {
                            from: constants.collection.REAL_ESTATE_AGENT_INFO,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'agency'

                        }
                    },
                    {$unwind: '$agency'},
                    statusObj,
                    {$skip: parseInt(skip)},
                    {$limit: parseInt(limit)},
                    {

                        $sort: {'property._id': -1}
                    },
                    {
                        $group: {
                            _id: '$_id',
                            appointmentUniqueId: {$first: '$_id'},
                            userUniqueId: {$first: '$userUniqueId'},
                            appointmentDate: {$first: '$appointmentDate'},
                            isEnabled: {$first: '$isEnabled'},
                            realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                            properties: {$addToSet: '$property'},
                            agencies: {$addToSet: '$agency'}
                        }
                    },
                    {
                        $project: {
                            userUniqueId: 1,
                            'property.appointmentUniqueId': '$appointmentUniqueId',
                            'property.propertyUniqueId': '$properties._id',
                            'property.realEstateAgentUniqueId': '$properties.realEstateAgentUniqueId',
                            'property.status': '$properties.status',
                            'property.price': '$properties.price',
                            'property.deposit': {$cond: [{$or : [{$eq: ['$properties.deposit', null]}, {$eq: ['$properties.deposit', ""]}, {$eq: ['$properties.deposit', "null"]}]}, null, '$properties.deposit']},
                            'property.currDeposit': {$cond: [{$or : [{$eq: ['$properties.currDeposit', null]}, {$eq: ['$properties.currDeposit', ""]}, {$eq: ['$properties.currDeposit', "null"]}]}, null, '$properties.currDeposit']},
                            'property.currRent': {$cond: [{$or : [{$eq: ['$properties.currRent', null]}, {$eq: ['$properties.currRent', ""]}, {$eq: ['$properties.currRent', "null"]} ]}, null, '$properties.currRent']},
                            'property.category': '$properties.category',
                            'property.salesMethod': '$properties.salesMethod',
                            'property.mortgage': '$properties.mortgage',
                            'property.numberOfRooms': '$properties.numberOfRooms',
                            'property.numberOfBathrooms': '$properties.numberOfBathrooms',
                            'property.facingDirection': '$properties.facingDirection',
                            'property.maintenanceFee': '$properties.maintenanceFee',
                            'property.note': '$properties.note',
                            'property.title': '$properties.title',
                            'property.address_1': '$properties.address_1',
                            'property.address_2': '$properties.address_2',
                            'property.size': '$properties.size',
                            'property.moveinDate': '$properties.moveinDate',
                            'property.numOfMonths': {$cond: [{$or : [{$eq: ['$properties.numOfMonths', null]}, {$eq: ['$properties.numOfMonths', ""]}, {$eq: ['$properties.numOfMonths', "null"]} ]}, null, '$properties.numOfMonths']},
                            'property.appointmentDate': '$appointmentDate',
                            'property.companyName': '$agencies.companyName',
                            'property.ceoName': '$agencies.ceoName',
                            'property.thumbnail': '$properties.thumbnail',
                            'property.isEnabled': '$isEnabled'
                        }
                    },
                    {
                        $unwind: '$property.propertyUniqueId'
                    },
                    {
                        $unwind: '$property.price'
                    },
                    {
                        $unwind: {
                            path: '$property.deposit',
                            preserveNullAndEmptyArrays: true
                        }

                    },
                    {
                        $unwind: {
                            path: '$property.currDeposit',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: {
                            path: '$property.currRent',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: '$property.category'
                    },
                    {
                        $unwind: '$property.salesMethod'
                    },
                    {
                        $unwind: '$property.mortgage'
                    },
                    {
                        $unwind: '$property.numberOfRooms'
                    },
                    {
                        $unwind: '$property.numberOfBathrooms'
                    },
                    {
                        $unwind: '$property.facingDirection'
                    },
                    {
                        $unwind: '$property.maintenanceFee'
                    },
                    {
                        $unwind: '$property.note'
                    },
                    {
                        $unwind: '$property.title'
                    },
                    {
                        $unwind: '$property.address_1'
                    },
                    {
                        $unwind: '$property.address_2'
                    },
                    {
                        $unwind: '$property.size'
                    },
                    {
                        $unwind: '$property.moveinDate'
                    },
                    {
                        $unwind: {
                            path: '$property.numOfMonths',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: '$property.realEstateAgentUniqueId'
                    },
                    {
                        $unwind: '$property.status'

                    },
                    {
                        $unwind: '$property.appointmentDate'
                    },
                    {
                        $unwind: '$property.companyName'
                    },
                    {
                        $unwind: '$property.ceoName'
                    },
                    {
                        $unwind: {
                            path: '$property.thumbnail',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $unwind: {
                            path: '$property.isEnabled',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $sort: {_id: -1}

                    },
                    {
                        $group: {
                            _id: '$userUniqueId',
                            properties: {$push: '$property'}

                        }
                    },
                    {
                        $project: {
                            properties: 1

                        }
                    }

                ]
            }
        },
        {
            $unwind: '$count'
        },
        {
            $unwind: '$prop'
        }
    ], (err, cursor) => {
        if (err) {
            let obj = {

                error: {code: 'S500', message: '서버에러'}
            }

            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {
                let obj = {

                    error: {code: 'S500', message: '서버에러'}
                }

                res.json(obj)
                throw e2
            }

            let response = {
                propertyList: [],
                totalCount: 0,
                error: null
            }

            if (docs.length > 0) {
                let result = docs[0]

                response.totalCount = result.count.totalCount
                response.propertyList = result.prop.properties

                console.log(response.propertyList.length)
            }

            res.json(response)
        })
    })
})

router.post('/fetch/property/visit/schedule', (req, res) => {
    let propertyUniqueId = req.body.propertyUniqueId
    let userUniqueId = req.body.userUniqueId
    let year = req.body.year
    let month = req.body.month
    let day = req.body.day

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    propertyCollection.aggregate([
        {
            $facet: {

                myappointment: [
                    {$match: {_id: new objectId(propertyUniqueId)}},
                    {
                        $lookup: {
                            from: 'VISIT_APPOINTMENT',
                            localField: '_id',
                            foreignField: 'propertyUniqueId',
                            as: 'visitSchedule'

                        }
                    },
                    {
                        $unwind:
                            {
                                path: '$visitSchedule',
                                preserveNullAndEmptyArrays: true
                            }
                    },
                    {
                        $project: {
                            visitUniqueId: '$visitSchedule._id',
                            propertyUniqueId: '$_id',
                            userUniqueId: '$visitSchedule.userUniqueId',
                            appointmentDate: '$visitSchedule.appointmentDate',
                            realEstateAgentUniqueId: '$visitSchedule.realEstateAgentUniqueId',
                            month: {$month: '$visitSchedule.appointmentDate'},
                            year: {$year: '$visitSchedule.appointmentDate'},
                            day: {$dayOfMonth: '$visitSchedule.appointmentDate'},
                            hour: {$hour: {date: '$visitSchedule.appointmentDate', timezone: '+0900'}}
                        }
                    },
                    {
                        $match: {
                            year: parseInt(year),
                            month: parseInt(month),
                            day: parseInt(day)
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: '$year',
                                month: '$month',
                                day: '$day'
                            },
                            appointments: {$addToSet: {visitUniqueId: '$visitUniqueId', hour: '$hour'}}

                        }
                    }

                ],

                unavailableDate: [
                    {$match: {_id: new objectId(propertyUniqueId)}},
                    {
                        $lookup: {
                            from: 'VISIT_UNAVAILABLE_DATE',
                            localField: '_id',
                            foreignField: 'propertyUniqueId',
                            as: 'unavailableDate'

                        }
                    },
                    {
                        $unwind: '$unavailableDate'
                    },

                    {
                        $project: {
                            visitUniqueId: 1,
                            propertyUniqueId: 1,
                            userUniqueId: 1,
                            appointmentDate: 1,
                            realEstateAgentUniqueId: 1,
                            date: '$unavailableDate.unavailableDate',
                            'unavailableDate.month': {$month: '$unavailableDate.unavailableDate'},
                            'unavailableDate.year': {$year: '$unavailableDate.unavailableDate'},
                            'unavailableDate.day': {$dayOfMonth: '$unavailableDate.unavailableDate'},
                            'unavailableDate.hour': {
                                $hour: {
                                    date: '$unavailableDate.unavailableDate',
                                    timezone: '+0900'
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            'unavailableDate.month': parseInt(month),
                            'unavailableDate.year': parseInt(year),
                            'unavailableDate.day': parseInt(day)
                        }
                    },
                    {
                        $group: {
                            _id: {
                                year: {$year: '$date'},
                                month: {$month: '$date'},
                                day: {$dayOfMonth: '$date'}
                            },

                            hours: {
                                $addToSet: {
                                    realEstateAgentUniqueId: '$realEstateAgentUniqueId',
                                    hour: '$unavailableDate.hour'
                                }
                            }
                        }
                    }
                ]
            }
        }

    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {


                res.status(500).send()
                throw e2
            }

            if (docs.length > 0) {
                let doc = docs[0]

                let schedule = {
                    date: {
                        year: year,
                        month: month,
                        day: day,
                    },
                    availability: []
                }


                for (let index = 0; index < 24; index++) { //24 hours
                    let elem = {
                        isAvailable: true,
                        visitUniqueId: null,
                        visitorUniqueId: null,
                        realEstateAgentUniqueId: null
                    }

                    schedule.availability.push(elem)
                }

                let myappointments = doc.myappointment

                let unavailableDates = doc.unavailableDate

                if (myappointments.length > 0) {
                    let appointments = myappointments[0].appointments

                    appointments.forEach(elem => {
                        let index = parseInt(elem.hour)

                        schedule.availability[index].isAvailable = true
                        schedule.availability[index].visitUniqueId = elem.visitUniqueId
                        schedule.availability[index].visitorUniqueId = userUniqueId
                        schedule.availability[index].realEstateAgentUniqueId = null
                    })
                }


                if (unavailableDates.length > 0) {
                    let hours = unavailableDates[0].hours

                    hours.forEach(elem => {
                        let index = parseInt(elem.hour)

                        schedule.availability[index].isAvailable = false
                        schedule.availability[index].visitorUniqueId = null
                        schedule.availability[index].realEstateAgentUniqueId = elem.realEstateAgentUniqueId
                    })
                }


                let response = {
                    schedule: schedule,
                    error: null
                }

                res.json(response)

            } else {

                let response = {
                    schedule: [],
                    error: null
                }

                res.json(response)

            }

        })
    })

})

router.post('/request/visit', async (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId

    let dateTimes = req.body.dateTime

    let visitUniqueIds = []

    let userCollection = db.getDb().collection(constants.collection.USER)
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
    let alertAdminCollection = db.getDb().collection(constants.collection.ALERT_ADMIN)

    let insertion = () => {
        return new Promise(async (resolve, reject) => {

            let ix = 0
            for(let index = 0; index < dateTimes.length; index++){

                ix = index
                let date = dateTimes[index]
                let appointmentDate = new Date(date)

                let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

                let query = {
                    userUniqueId: new objectId(userUniqueId),
                    propertyUniqueId: new objectId(propertyUniqueId),
                    appointmentDate: appointmentDate,
                    isConfirmed: false
                }

                visitAppointmentCollection.find({
                    propertyUniqueId: new objectId(propertyUniqueId),
                    userUniqueId: new objectId(userUniqueId)
                }).toArray()
                    .then(appointments => {
                        if (appointments.length >= constants.MAX_VISIT) {
                            let response = {
                                isRequested: false,
                                visitUniqueId: [],
                                error: {code: 'RV001', message: '해당 매물에 방문예약은 최대 5건 까지입니다.'}
                            }
                            res.json(response)
                            reject('MAX_OUT')
                        } else {

                            if (appointments.length + dateTimes.length > constants.MAX_VISIT) {
                                let response = {
                                    isRequested: false,
                                    visitUniqueId: [],
                                    error: {code: 'RV001', message: '해당 매물에 방문예약은 최대 5건 까지입니다.'}
                                }
                                res.json(response)
                                reject('MAX_OUT')
                            } else {
                                return visitAppointmentCollection.findOne(query)

                            }


                        }
                    })
                    .then(appointment => {
                        if (appointment !== null) {
                            return resolve('OK')
                        } else {
                            query.realEstateAgentUniqueId = new objectId(realEstateAgentUniqueId)

                            return visitAppointmentCollection.insertOne(query)

                        }
                    })
                    .then(async inserted => {

                        let obj = {
                            dateTime: appointmentDate,
                            visitUniqueId: inserted.insertedId
                        }

                        visitUniqueIds.push(obj)

                        let user = await userCollection.findOne({_id: new objectId(userUniqueId)})
                            .then(user => {
                                return user
                            })

                        return {visitUniqueId: inserted.insertedId, user: user}

                    })
                    .then(async data => {
                        return await propertyCollection.findOne({_id: new objectId(propertyUniqueId)})
                            .then(property => {
                                return {user: data.user, property: property, visitUniqueId: data.visitUniqueId}
                            })
                    })
                    .then(data => {
                        let user = data.user
                        let property = data.property

                        if (property !== null) {
                            let propertyName = property.title

                            let message = `${user.name}님 방문예약 - ${propertyName}`

                            let obj = {
                                alertType: constants.ALERT_ADMIN.ALERT_VISIT_APPOINTMENT,
                                message: message
                            }

                            alertAdminCollection.insertOne(obj)

                            return data

                        }
                    })
                    .then(async data => {

                        let realEstateAgentInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
                        data.agency = await realEstateAgentInfoCollection.findOne({realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)})
                            .then(agency => {
                                return agency
                            })
                        return data
                    })
                    .then(data => {
                        let agency = data.agency
                        let user = data.user
                        let property = data.property


                        if(agency){
                            let agentPhoneNumber = agency.phoneNumber
                            let visitor = { name : user.name, phoneNumber: user.phoneNumber}

                            let propertyTitle = property.title

                            propertyTitle += propertyTitle + (property.dongNumber) ? property.dongNumber+'동' : ''
                            propertyTitle += propertyTitle + (property.hoNumber) ? property.hoNumber+'호' : ''

                            let address = `${property.address_1} ${property.address_2}`

                            let redisCli = db.getRedisClient();
                            const key = shortid.generate();


                            redisCli.set(`${key}.realEstateAgentUniqueId`, agency.realEstateAgentUniqueId.toString())
                            redisCli.set(`${key}.appointmentUniqueId`, data.visitUniqueId.toString())

                            let info = {
                                agentPhoneNumber: agentPhoneNumber,
                                visitor: visitor,
                                title: propertyTitle,
                                address: address,
                                appointmentDate: appointmentDate,
                                visitUniqueId: data.visitUniqueId,
                                redisKey : key
                            }

                            alimtalk.sendReservationRequestAlimTalk(info)


                        }
                    })
                    .catch(err => {
                        reject(err)
                        throw err
                    })


            }



            if(ix === dateTimes.length - 1){
                return resolve()
            }
        })
    }


    await insertion()

    let response = {
        isRequested: true,
        visitUniqueId: visitUniqueIds,
        error: null
    }

    res.json(response)


})

router.post('/delete/visit', (req, res) => {
    let visitUniqueId = req.body.visitUniqueId
    let userUniqueId = req.body.userUniqueId

    let visitAppointmentCollection = db.getDb().collection('VISIT_APPOINTMENT')

    visitAppointmentCollection.deleteOne({_id: new objectId(visitUniqueId), userUniqueId: new objectId(userUniqueId)})
        .then(() => {
            let response = {
                isDeleted: true,
                error: null
            }

            res.json(response)
        })
        .catch(err => {

            res.status(500).send()
            throw err
        })
})

router.post('/fetch/my/visit/schedule', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    visitAppointmentCollection.find({
        userUniqueId: new objectId(userUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId)
    }).toArray()
        .then(result => {


            let response = {
                dateTime: [],
                error: null
            }

            result.forEach(appointment => {
                let obj = {
                    visitUniqueId: appointment._id,
                    dateTime: appointment.appointmentDate
                }

                response.dateTime.push(obj)
            })

            res.json(response)
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

router.post('/add/property/to/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let savedPropertyCollection = db.getDb().collection(constants.collection.SAVED_PROPERTY)

    let query = {
        userUniqueId: new objectId(userUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId)
    }

    savedPropertyCollection.findOne(query)
        .then(saved => {
            if (saved === null) {
                savedPropertyCollection.insertOne(query)
                    .then(inserted => {
                        let response = {
                            isAdded: true,
                            error: null
                        }

                        res.json(response)
                    })
                    .catch(err => {
                        let response = {
                            isAdded: false,
                            error: {code: 'S500', message: '서버에러'}
                        }

                        res.json(response)
                        throw err
                    })
            } else {
                let response = {
                    isAdded: false,
                    error: {code: 'P001', message: '이미 관심매물에 추가되어 있습니다.'}
                }

                res.json(response)
            }
        })

})

router.post('/delete/property/from/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let savedPropertyCollection = db.getDb().collection(constants.collection.SAVED_PROPERTY)

    savedPropertyCollection.deleteOne({
        userUniqueId: new objectId(userUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId)
    })
        .then(removed => {

            let response = {
                isRemoved: true,
                error: null
            }

            res.json(response)
        })
        .catch(err => {
            let response = {
                isRemoved: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)


            throw err
        })
})

router.post('/request/tour/link', (req, res) => {
    let vrTourUniqueId = req.body.vrTourUniqueId
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)

    vrTourCollection.findOne({_id: new objectId(vrTourUniqueId)})
        .then(vrTour => {
            if (vrTour !== null) {
                let grantedTime = new Date(vrTour.grantedTime)
                let currentTime = new Date()

                let timeDiff = currentTime - grantedTime

                console.log(timeDiff)

                let oneday = 60 * 60 * 24 * 1000

                if (timeDiff < oneday) {
                    //send the link
                    //Todo: link the url to the vr project path

                    //express.use('/vt/abcd', express.static('/Users/chiduk/Desktop/600fbb7b7d34943a3165792b.jpg'))

                    let response = {
                        vrTourUrl: '/vt/abcd',
                        error: null
                    }

                    res.redirect('/vt/abcd')


                } else {
                    //nope too late. expired

                    let response = {
                        vrTourUrl: null,
                        error: {code: 'VT002', message: '투어 유효기간이 만료되었습니다.'}
                    }

                    res.json(response)
                }

            } else {
                let response = {
                    vrTourUrl: null,
                    error: {code: 'VT001', message: '존재하지 않는 투어입니다.'}
                }

                res.json(response)
            }
        })
        .catch(err => {
            let response = {
                vrTourUrl: null,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)

            throw err;
        })
})

router.post('/delete/vr/tour', (req, res) => {
    let vrTourUniqueId = req.body.vrTourUniqueId
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)

    vrTourCollection.deleteOne({
        _id: new objectId(vrTourUniqueId),
        userUniqueId: new objectId(userUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId)
    })
        .then(removed => {
            let response = {
                isRemoved: true,
                error: null
            }

            res.json(response)
        })
        .catch(err => {
            let response = {
                isRemoved: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)

            throw err
        })
})

router.post('/inquire/visit/reschedule/', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let appointmentUniqueId = req.body.appointmentUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let title = req.body.title
    let inquiry = req.body.inquiry
    let inquiryType = req.body.inquiryType

    let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

    let insertObj = {
        date: new Date(),
        userUniqueId: new objectId(userUniqueId),
        appointmentUniqueId: new objectId(appointmentUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId),
        title: title,
        inquiry: inquiry,
        inquiryType: inquiryType
    }

    inquiryCollection.insertOne(insertObj)
        .then(() => {
            let response = {
                isInquired: true,
                error: null
            }

            res.json(response)
        })
        .catch(err => {
            let response = {
                isInquired: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)

            throw err
        })
})

router.post('/fetch/inquiry/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let limit = req.body.limit
    let skip = req.body.skip
    let getRepliedOnly = req.body.getRepliedOnly

    if (getRepliedOnly === undefined) {
        res.status(500).send()
        return

    }

    let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

    let query = []

    if (limit === undefined) {
        query = [

            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'userUniqueId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: constants.collection.INQUIRY_ANSWER,
                    localField: '_id',
                    foreignField: 'inquiryUniqueId',
                    as: 'reply'
                }
            },
            {
                $unwind: {
                    path: '$reply',
                    preserveNullAndEmptyArrays: true
                }
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
                $unwind: {
                    path: '$property',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$_id',
                    date: {$first: '$date'},
                    userUniqueId: {$first: '$userUniqueId'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    inquiryType: {$first: '$inquiryType'},
                    reply: {$first: '$reply'},
                    user: {$first: '$user'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    inquiry: {
                        $cond: [getRepliedOnly,
                            {
                                $cond: [{$eq: ['$reply', null]}, null, {
                                    userName: '$user.name',
                                    inquiryUniqueId: '$_id',
                                    date: '$date',
                                    userUniqueId: '$userUniqueId',
                                    title: '$title',
                                    inquiry: '$inquiry',
                                    inquiryType: '$inquiryType',

                                    reply: {
                                        replyUniqueId: '$reply._id',
                                        responderUniqueId: '$reply.responderUniqueId',
                                        title: '$reply.title',
                                        message: '$reply.message'
                                    },
                                    propertyUniqueId: '$property._id',
                                    propertyAddress_2: '$property.address_2',
                                    propertyName: '$property.title'
                                }]
                            },
                            {
                                userName: '$user.name',
                                inquiryUniqueId: '$_id',
                                date: '$date',
                                userUniqueId: '$userUniqueId',
                                title: '$title',
                                inquiry: '$inquiry',
                                inquiryType: '$inquiryType',
                                reply: {
                                    replyUniqueId: '$reply._id',
                                    responderUniqueId: '$reply.responderUniqueId',
                                    title: '$reply.title',
                                    message: '$reply.message'
                                },
                                propertyUniqueId: '$property._id',
                                propertyAddress_2: '$property.address_2',
                                propertyName: '$property.title'
                            }
                        ]
                    }
                }
            },
            {$match: {'inquiry': {'$ne': null}}},
            {
                $project:
                    {

                        userName: '$inquiry.userName',
                        inquiryUniqueId: '$inquiry._id',
                        date: '$inquiry.date',
                        userUniqueId: '$inquiry.userUniqueId',
                        title: '$inquiry.title',
                        inquiry: '$inquiry.inquiry',
                        inquiryType: '$inquiry.inquiryType',
                        reply: '$inquiry.reply',
                        propertyUniqueId: '$inquiry.propertyUniqueId',
                        propertyAddress_2: '$inquiry.propertyAddress_2',
                        propertyName: '$inquiry.propertyName'
                    }
            },
            {$sort: {_id: -1}},
            {$skip: parseInt(skip)}
        ]
    } else {
        query = [

            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'userUniqueId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: constants.collection.INQUIRY_ANSWER,
                    localField: '_id',
                    foreignField: 'inquiryUniqueId',
                    as: 'reply'
                }
            },
            {
                $unwind: {
                    path: '$reply',
                    preserveNullAndEmptyArrays: true
                }
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
                $unwind: {
                    path: '$property',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$_id',
                    date: {$first: '$date'},
                    userUniqueId: {$first: '$userUniqueId'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    inquiryType: {$first: '$inquiryType'},
                    reply: {$first: '$reply'},
                    user: {$first: '$user'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    inquiry: {
                        $cond: [getRepliedOnly,
                            {
                                $cond: [{$eq: ['$reply', null]}, null, {
                                    userName: '$user.name',
                                    inquiryUniqueId: '$_id',
                                    date: '$date',
                                    userUniqueId: '$userUniqueId',
                                    title: '$title',
                                    inquiry: '$inquiry',
                                    inquiryType: '$inquiryType',

                                    reply: {
                                        replyUniqueId: '$reply._id',
                                        responderUniqueId: '$reply.responderUniqueId',
                                        title: '$reply.title',
                                        message: '$reply.message'
                                    },
                                    propertyUniqueId: '$property._id',
                                    propertyAddress_2: '$property.address_2',
                                    propertyName: '$property.title'
                                }]
                            },
                            {
                                userName: '$user.name',
                                inquiryUniqueId: '$_id',
                                date: '$date',
                                userUniqueId: '$userUniqueId',
                                title: '$title',
                                inquiry: '$inquiry',
                                inquiryType: '$inquiryType',
                                reply: {
                                    replyUniqueId: '$reply._id',
                                    responderUniqueId: '$reply.responderUniqueId',
                                    title: '$reply.title',
                                    message: '$reply.message'
                                },
                                propertyUniqueId: '$property._id',
                                propertyAddress_2: '$property.address_2',
                                propertyName: '$property.title'
                            }
                        ]
                    }
                }
            },
            {$match: {'inquiry': {'$ne': null}}},
            {
                $project:
                    {

                        userName: '$inquiry.userName',
                        inquiryUniqueId: '$inquiry._id',
                        date: '$inquiry.date',
                        userUniqueId: '$inquiry.userUniqueId',
                        title: '$inquiry.title',
                        inquiry: '$inquiry.inquiry',
                        inquiryType: '$inquiry.inquiryType',
                        reply: '$inquiry.reply',
                        propertyUniqueId: '$inquiry.propertyUniqueId',
                        propertyAddress_2: '$inquiry.propertyAddress_2',
                        propertyName: '$inquiry.propertyName'
                    }
            },
            {$sort: {_id: -1}},
            {$skip: parseInt(skip)},
            {$limit: parseInt(limit)}

        ]
    }


    let countQuery = []

    if (getRepliedOnly) {
        countQuery = [
            {
                $lookup: {
                    from: constants.collection.INQUIRY_ANSWER,
                    localField: '_id',
                    foreignField: 'inquiryUniqueId',
                    as: 'reply'
                }
            },
            {
                $unwind: {
                    path: '$reply',
                    preserveNullAndEmptyArrays: true
                }
            },
            {$match: {reply: {$ne: null}}},
            {$count: 'totalCount'}
        ]
    } else {
        countQuery = [
            {
                $lookup: {
                    from: constants.collection.INQUIRY_ANSWER,
                    localField: '_id',
                    foreignField: 'inquiryUniqueId',
                    as: 'reply'
                }
            },
            {
                $unwind: {
                    path: '$reply',
                    preserveNullAndEmptyArrays: true
                }
            },
            {$count: 'totalCount'}

            // {
            //     $group: {
            //         _id: null,
            //         totalCount: {$sum: 1}
            //     }
            // }
        ]
    }

    inquiryCollection.aggregate([
        {$sort: {_id: -1}},
        {$match: {userUniqueId: new objectId(userUniqueId)}},
        {

            $facet: {
                count: countQuery,

                prop: query
            }
        },
        {$unwind: '$count'}
    ], (err, cursor) => {
        if (err) {

            throw err
        }

        cursor.toArray((e2, docs) => {
            if (e2) {

                throw e2
            }

            let date = new Date()

            let offsetMs = date.getTimezoneOffset() * 60 * 1000;
            let msLocal = date.getTime() - offsetMs;
            let dateLocal = new Date(msLocal);
            let iso = dateLocal.toISOString();
            let localTile = iso.replace(/([^T]+)T([^\.]+).*/g, '$1 $2')

            console.log(iso.replace(/([^T]+)T([^\.]+).*/g, '$1 $2'))

            if (docs.length > 0) {

                let response = {
                    totalCount: docs[0].count.totalCount,
                    inquiries: docs[0].prop,
                    error: null
                }
                res.json(response)
            } else {

                let response = {
                    totalCount: 0,
                    inquiries: [],
                    error: null
                }
                res.json(response)
            }

        })
    })

})

router.post('/make/inquiry', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let title = req.body.title
    let inquiry = req.body.inquiry
    let inquiryType = req.body.inquiryType

    let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

    let insertedObj = {
        userUniqueId: new objectId(userUniqueId),
        date: new Date(),
        title: title,
        inquiry: inquiry,
        inquiryType: inquiryType
    }

    if (inquiryType === 'INQUIRY_PROPERTY') {
        insertedObj.propertyUniqueId = new objectId(propertyUniqueId)
    }

    inquiryCollection.insertOne(insertedObj)
        .then(() => {
            let response = {

                isInquired: true,
                error: null

            }

            res.json(response)
        })
        .catch(err => {
            let response = {

                isInquired: false,
                error: {code: 'S500', message: '서버에러'}

            }

            res.json(response)


            throw err
        })
})

router.post('/modify/inquiry', (req, res) => {
    let inquiryUniqueId = req.body.inquiryUniqueId
    let userUniqueId = req.body.userUniqueId
    let title = req.body.title
    let inquiry = req.body.inquiry
    let inquiryType = req.body.inquiryType

    let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

    inquiryCollection.findOneAndUpdate({_id: new objectId(inquiryUniqueId)}, {
        $set: {
            title: title,
            inquiry: inquiry,
            inquiryType: inquiryType
        }
    })
        .then(() => {
            let response = {
                isModified: true,
                error: null
            }

            res.json(response)
        })
        .catch(err => {
            let response = {
                isModified: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)

            throw err
        })
})

router.post('/delete/inquiry', (req, res) => {
    let inquiryUniqueId = req.body.inquiryUniqueId
    let userUniqueId = req.body.userUniqueId

    let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)
    let inquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_ANSWER)

    inquiryAnswerCollection.deleteMany({inquiryUniqueId: new objectId(inquiryUniqueId)})
        .then(() => {
            inquiryCollection.deleteOne({_id: new objectId(inquiryUniqueId), userUniqueId: new objectId(userUniqueId)})
                .then(() => {
                    let response = {
                        isRemoved: true,
                        error: null
                    }

                    res.json(response)
                })
                .catch(err => {

                    let response = {
                        isRemoved: false,
                        error: {code: 'S500', message: '서버에러'}
                    }

                    res.json(response)

                    throw err
                })
        })
        .catch(err => {
            let response = {
                isRemoved: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)

            throw err
        })
})

router.post('/fetch/property/list', (req, res) => {
    // let userUniqueId = req.body.userUniqueId

    // let firstArea = req.body.firstArea
    // let secondArea = req.body.secondArea
    // let thirdArea = req.body.thirdArea
    // let category = req.body.category
    // let salesMethod = req.body.salesMethod
    // let mortgage = req.body.mortgage
    // let facingDirection = req.body.facingDirection
    // let numberOfRooms = req.body.numberOfRooms
    // let numberOfBathrooms = req.body.numberOfBathrooms
    // let priceRange = req.body.priceRange
    // let size = req.body.size
    // let Keyword = req.body.keyword
    // let Keywords = (Keyword !== null && Keyword !== undefined) ? Keyword.split(/[\s,"]+/) : null

    let limit = req.body.limit
    let skip = req.body.skip


    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)


    let matchQuery = []
    let totalCountQuery = []

    // if (firstArea !== null) {
    //     let firstAreaQuery = {$match: {'location.firstArea': firstArea}}
    //
    //     matchQuery.push(firstAreaQuery)
    //     totalCountQuery.push(firstAreaQuery)
    //
    //     if (secondArea !== null) {
    //
    //         let secondAreaQuery = {$match: {'location.secondArea': secondArea}}
    //
    //         matchQuery.push(secondAreaQuery)
    //         totalCountQuery.push(secondAreaQuery)
    //
    //         if (thirdArea !== null) {
    //
    //             let thirdAreaQuery = {$match: {'location.thirdArea': thirdArea}}
    //
    //             matchQuery.push(thirdAreaQuery)
    //             totalCountQuery.push(thirdAreaQuery)
    //
    //         }
    //     }
    // }
    //
    // if (category !== null) {
    //
    //     let query = {$match: {'category.type': category}}
    //     matchQuery.push(query)
    //     totalCountQuery.push(query)
    // }
    //
    // if (salesMethod !== null) {
    //     let query = {$match: {'salesMethod.type': salesMethod}}
    //     matchQuery.push(query)
    //     totalCountQuery.push(query)
    // }
    //
    // if (mortgage !== null) {
    //     let query = {$match: {'mortgage.type': mortgage}}
    //     matchQuery.push(query)
    //     totalCountQuery.push(query)
    // }
    //
    // if (facingDirection !== null) {
    //     let query = {$match: {'facingDirection.type': facingDirection}}
    //     matchQuery.push(query)
    //     totalCountQuery.push(query)
    // }
    //
    // if (numberOfRooms !== null) {
    //     let number = parseInt(numberOfRooms)
    //     let query = {$match: {numberOfRooms: number}}
    //
    //
    //     if (number === 4) {
    //         query = {$match: {numberOfRooms: {$gte: number}}}
    //     }
    //
    //     matchQuery.push(query)
    //     totalCountQuery.push(query)
    // }
    //
    // if (numberOfBathrooms !== null) {
    //     let number = parseInt(numberOfBathrooms)
    //     let query = {$match: {numberOfBathrooms: number}}
    //
    //
    //     if (number === 3) {
    //         query = {$match: {numberOfBathrooms: {$gte: number}}}
    //     }
    //
    //     matchQuery.push(query)
    //     totalCountQuery.push(query)
    // }
    //
    //
    // if (priceRange !== null) {
    //
    //     let priceHigh = parseInt(priceRange.high)
    //
    //     let priceQuery = {
    //         $match: {$and: [{price: {$gte: parseInt(priceRange.low)}}, {price: {$lte: priceHigh}}]}
    //     }
    //
    //     if (priceHigh === 1500000000) { //15억 이면 무제한으로 검색
    //         priceQuery = {
    //             $match: {price: {$gte: parseInt(priceRange.low)}}
    //         }
    //     }
    //
    //
    //     matchQuery.push(priceQuery)
    //     totalCountQuery.push(priceQuery)
    // }
    //
    //
    // if (size !== null) {
    //
    //     let sizeHigh = parseInt(size.high)
    //
    //     let sizeQuery = {
    //         $match: {$and: [{'size.totalSize': {$gte: parseInt(size.low)}}, {'size.totalSize': {$lte: sizeHigh}}]}
    //     }
    //
    //     if (sizeHigh === 231) { //231 square meter 이면 무제한 으로 검색
    //         sizeQuery = {
    //             $match: {'size.totalSize': {$gte: parseInt(size.low)}}
    //         }
    //     }
    //
    //     matchQuery.push(sizeQuery)
    //     totalCountQuery.push(sizeQuery)
    // }
    //
    // let inArray = []
    //
    // if (Keyword !== null && Keyword !== undefined) {
    //     let keywords = Keyword.split(/[\s,"]+/)
    //     keywords.forEach(word => {
    //         let regex = new RegExp([word].join(''), 'i')
    //         inArray.push(regex)
    //     })
    //
    //     let keywordQuery = {$match: {'title': {$in: inArray}}}
    //     matchQuery.push(keywordQuery)
    //     totalCountQuery.push(keywordQuery)
    // }


    let countGrouping = {
        $group: {
            _id: null,
            count: {$sum: 1}
        }
    }
    totalCountQuery.push(countGrouping)

    let isSavedQuery = [
        {
            $lookup: {
                from: constants.collection.SAVED_PROPERTY,
                localField: '_id',
                foreignField: 'propertyUniqueId',
                as: 'savedProperty'
            }
        },
        {
            $unwind: {
                path: '$savedProperty',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 1,
                category: 1,
                salesMethod: 1,
                mortgage: 1,
                numberOfRooms: 1,
                numberOfBathrooms: 1,
                facingDirection: 1,
                maintenanceFee: 1,
                note: 1,
                title: 1,
                address_1: 1,
                address_2: 1,
                size: 1,
                moveinDate: 1,
                numOfMonths: {$cond: [{$or : [{$eq: ['$numOfMonths', null]}, {$eq: ['$numOfMonths', ""]}, {$eq: ['$numOfMonths', "null"]} ]}, null, '$numOfMonths']},
                price: 1,
                deposit: {$cond: [{$or : [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]} ]}, null, '$deposit']},
                currDeposit: {$cond: [{$or : [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                currRent: {$cond: [{$or : [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                realEstateAgentUniqueId: 1,
                status: 1,
                // isSaved: {
                //     $cond: [{$eq: ['$savedProperty.userUniqueId', new objectId(userUniqueId)]}, true, false]
                // },
                // savedProperty: 1,
                latitude: 1,
                longitude: 1,
                thumbnail: 1
            }
        },
        {$sort: {'isSaved': -1}}
    ]

    isSavedQuery.forEach(query => {
        matchQuery.push(query)
    })

    let firstGrouping = {
        $group: {
            _id: '$_id',
            propertyUniqueId: {$first: '$_id'},
            category: {$first: '$category'},
            salesMethod: {$first: '$salesMethod'},
            mortgage: {$first: '$mortgage'},
            numberOfRooms: {$first: '$numberOfRooms'},
            numberOfBathrooms: {$first: '$numberOfBathrooms'},
            facingDirection: {$first: '$facingDirection'},
            maintenanceFee: {$first: '$maintenanceFee'},
            note: {$first: '$note'},
            title: {$first: '$title'},
            address_1: {$first: '$address_1'},
            address_2: {$first: '$address_2'},
            size: {$first: '$size'},
            moveinDate: {$first: '$moveinDate'},
            numOfMonths: {$first: '$numOfMonths'},
            price: {$first: '$price'},
            deposit: {$first: '$deposit'},
            currDeposit: {$first: '$currDeposit'},
            currRent: {$first: '$currRent'},
            realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
            status: {$first: '$status'},
            // isSaved: {$first: '$isSaved'},
            // savedProperty: {$addToSet: '$savedProperty'},
            latitude: {$first: '$latitude'},
            longitude: {$first: '$longitude'},
            coordinate: {$push: {latitude: '$latitude', longitude: '$longitude'}},
            thumbnail: {$first: '$thumbnail'}
        }
    }

    matchQuery.push(firstGrouping)
    matchQuery.push({$unwind: '$coordinate'})
    let sortQuery = {
        $sort: {_id: -1}
    }

    matchQuery.push(sortQuery)


    let secondGrouping = {
        $group: {
            _id: '$_id',
            property: {
                $addToSet: {
                    propertyUniqueId: '$_id',
                    category: '$category',
                    salesMethod: '$salesMethod',
                    mortgage: '$mortgage',
                    numberOfRooms: '$numberOfRooms',
                    numberOfBathrooms: '$numberOfBathrooms',
                    facingDirection: '$facingDirection',
                    maintenanceFee: '$maintenanceFee',
                    note: '$note',
                    title: '$title',
                    address_1: '$address_1',
                    address_2: '$address_2',
                    size: '$size',
                    moveinDate: '$moveinDate',
                    numOfMonths: '$numOfMonths',
                    price: '$price',
                    deposit: '$deposit',
                    currDeposit: '$currDeposit',
                    currRent: '$currRent',
                    realEstateAgentUniqueId: '$realEstateAgentUniqueId',
                    status: '$status',
                    // isSaved: '$isSaved',
                    // savedPropertyCount: {$size: '$savedProperty'},
                    coordinate: '$coordinate',
                    thumbnail: '$thumbnail'

                }
            }


        }
    }

    matchQuery.push(secondGrouping)
    matchQuery.push({$unwind: '$property'})

    let secondSortQuery = {
        $sort: {_id: -1}
    }

    matchQuery.push(secondSortQuery)

    let skipAndLimit = {
        limit: {$limit: parseInt(limit)},
        skip: {$skip: parseInt(skip)}
    }
    matchQuery.push(skipAndLimit.skip)
    matchQuery.push(skipAndLimit.limit)
    matchQuery.push({
        $group: {
            _id: null,
            propertyList: {
                $push: '$property'
            }
        }

    })
    let project = {
        $project: {
            totalCount: 1,
            propertyList: 1

        }
    }

    matchQuery.push(project)

    propertyCollection.aggregate(
        [
            {$match: {'status.type': constants.property.status.type.SELLING}},
            {
                $facet:
                    {
                        count: totalCountQuery,
                        property: matchQuery
                    }
            },
            {
                $unwind: '$count'
            },
            {
                $unwind: '$property'
            },
        ],


        (err, cursor) => {
            if (err) {


                throw err
            }

            cursor.toArray((e2, docs) => {
                if (e2) {

                    throw e2
                }

                if (docs.length > 0) {
                    let result = docs[0]


                    let response = {
                        totalCount: result.count.count,
                        propertyList: result.property.propertyList,
                        error: null
                    }

                    res.json(response)
                } else {
                    let response = {
                        totalCount: 0,
                        propertyList: [],
                        error: {code: 'PL001', message: '매물이 없습니다.'}
                    }

                    res.json(response)
                }
            })
        })


})

router.post('/fetch/property/detail', (req, res) => {

    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
    let key = shortid.generate()

    let userUniqueIdKey = `${key}.userUniqueId`
    let portKey = `${key}.port`
    let pathKey = `${key}.path`


    propertyCollection.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [constants.PSPACE_LONG, constants.PSPACE_LAT]
                },
                maxDistance: 500 * 1609,
                spherical: true,
                distanceField: 'distance'

            }
        },
        {$match: {'_id': new objectId(propertyUniqueId)}},

        {
            $facet: {
                savedProperty: [
                    {
                        $lookup: {
                            from: constants.collection.SAVED_PROPERTY,
                            localField: '_id',
                            foreignField: 'propertyUniqueId',
                            as: 'savedProperty'
                        }
                    },
                    {$count: 'totalCount'}
                ],
                propertyInfo: [

                    {
                        $lookup: {
                            from: constants.collection.IMAGE,
                            localField: '_id',
                            foreignField: 'propertyUniqueId',
                            as: 'images'
                        }

                    },
                    {
                        $unwind: {
                            path: '$images',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.SAVED_PROPERTY,
                            localField: '_id',
                            foreignField: 'propertyUniqueId',
                            as: 'savedProperty'
                        }
                    },
                    {
                        $unwind: {
                            path: '$savedProperty',
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
                    {$addFields: {distance: '$distance'}},
                    {
                        $project: {
                            _id: 1,
                            category: 1,
                            title: 1,
                            salesMethod: 1,
                            price: 1,
                            deposit: {$cond: [{$eq: ['$deposit', "null"]}, null, '$deposit']},
                            currDeposit: {$cond: [{$eq: ['$currDeposit', "null"]}, null, '$currDeposit']},
                            currRent: {$cond: [{$eq: ['$currRent', "null"]}, null, '$currRent']},
                            size: 1,
                            mortgage: 1,
                            facingDirection: 1,
                            codeHeatNm: 1,
                            fuel: 1,
                            hoCnt: 1,
                            officetelUse: 1,
                            kaptBcompany: 1,
                            codeHallNm: 1,
                            numberOfRooms: 1,
                            numberOfBathrooms: 1,
                            moveinDate: 1,
                            numOfMonths: 1,
                            totalParkingLotCount: 1,
                            images: 1,
                            isSaved: {
                                $cond: [{$eq: ['$savedProperty.userUniqueId', new objectId(userUniqueId)]}, true, false]
                            },
                            'agency.realEstateAgentUniqueId': 1,
                            'agency.companyName': 1,
                            'agency.ceoName': 1,
                            'agency.phoneNumber': 1,
                            'agency.address': {
                                address_1: '$agency.address_1',
                                address_2: '$agency.address_2',
                            },
                            'agency.licenseNumber': 1,

                            loft: 1,
                            dateOfApproval:1,
                            principalUser: 1,
                            parkingAvailability: 1,
                            address_1: 1,
                            address_2: {$cond: [ {$or: [{$eq: ['$address_2', ""]}, {$eq: ['$address_2', "null"]} ]}, null, '$address_2' ]},
                            doroAddress: 1,
                            maintenanceFee: 1,
                            note: {$cond: [ {$or: [{$eq: ['$note', ""]}, {$eq: ['$note', "null"]} ]}, null, '$note' ]},
                            permanentKey: 1,
                            distance: 1,
                            isScanFeePaid: 1
                        }
                    },
                    {$sort: {'isSaved': -1}},
                    {
                        $group: {
                            _id: '$images._id',
                            propertyUniqueId: {$first: '$_id'},
                            realEstateAgentUniqueId: {$first: '$agency.realEstateAgentUniqueId'},
                            category: {$first: '$category'},
                            title: {$first: '$title'},
                            salesMethod: {$first: '$salesMethod'},
                            price: {$first: '$price'},
                            currDeposit: {$first: '$currDeposit'},
                            deposit: {$first: '$deposit'},
                            currRent: {$first: '$currRent'},
                            size: {$first: '$size'},
                            mortgage: {$first: '$mortgage'},
                            facingDirection: {$first: '$facingDirection'},
                            codeHeatNm: {$first: '$codeHeatNm'},
                            fuel: {$first: '$fuel'},
                            hoCnt: {$first: '$hoCnt'},
                            officetelUse: {$first: '$officetelUse'},
                            kaptBcompany: {$first: '$kaptBcompany'},
                            codeHallNm: {$first: '$codeHallNm'},
                            numberOfRooms: {$first: '$numberOfRooms'},
                            numberOfBathrooms: {$first: '$numberOfBathrooms'},
                            moveinDate: {$first: '$moveinDate'},
                            numOfMonths: {$first: '$numOfMonths'},
                            totalParkingLotCount: {$first: '$totalParkingLotCount'},
                            image: {$addToSet: '$images.filename'},
                            isSaved: {$first: '$isSaved'},

                            companyName: {$first: '$agency.companyName'},
                            ceoName: {$first: '$agency.ceoName'},
                            phoneNumber: {$first: '$agency.phoneNumber'},
                            realEstateAddress: {$first: '$agency.address'},
                            licenseNumber: {$first: '$agency.licenseNumber'},

                            loft: {$first: '$loft'},
                            dateOfApproval: {$first: '$dateOfApproval'},
                            principalUser: {$first: '$principalUser'},
                            parkingAvailability: {$first: '$parkingAvailability'},
                            address_1: {$first: '$address_1'},
                            address_2: {$first: '$address_2'},
                            doroAddress: {$first: '$doroAddress'},
                            maintenanceFee: {$first: "$maintenanceFee"},
                            note: {$first: '$note'},
                            permanentKey: {$first: '$permanentKey'},
                            distance: {$first: '$distance'},
                            isScanFeePaid: {$first: '$isScanFeePaid'}
                        }
                    },
                    {
                        $unwind: {
                            path: '$image',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $sort: {'image': -1}
                    },
                    {
                        $group: {
                            _id: '$propertyUniqueId',
                            propertyUniqueId: {$first: '$propertyUniqueId'},
                            category: {$first: '$category'},
                            title: {$first: '$title'},
                            salesMethod: {$first: '$salesMethod'},
                            price: {$first: '$price'},
                            currDeposit: {$first: '$currDeposit'},
                            deposit: {$first: '$deposit'},
                            currRent: {$first: '$currRent'},
                            size: {$first: '$size'},
                            mortgage: {$first: '$mortgage'},
                            facingDirection: {$first: '$facingDirection'},
                            codeHeatNm: {$first: '$codeHeatNm'},
                            fuel: {$first: '$fuel'},
                            hoCnt: {$first: '$hoCnt'},
                            officetelUse: {$first: '$officetelUse'},
                            kaptBcompany: {$first: '$kaptBcompany'},
                            codeHallNm: {$first: '$codeHallNm'},
                            numberOfRooms: {$first: '$numberOfRooms'},
                            numberOfBathrooms: {$first: '$numberOfBathrooms'},
                            moveinDate: {$first: '$moveinDate'},
                            numOfMonths: {$first: '$numOfMonths'},
                            totalParkingLotCount: {$first: '$totalParkingLotCount'},
                            image: {$push: '$image'},
                            isSaved: {$first: '$isSaved'},
                            realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                            companyName: {$first: '$companyName'},
                            ceoName: {$first: '$ceoName'},
                            phoneNumber: {$first: '$phoneNumber'},
                            realEstateAddress: {$first: '$realEstateAddress'},
                            licenseNumber: {$first: '$licenseNumber'},

                            loft: {$first: '$loft'},
                            dateOfApproval: {$first: '$dateOfApproval'},
                            principalUser: {$first: '$principalUser'},
                            parkingAvailability: {$first: '$parkingAvailability'},
                            address_1: {$first: '$address_1'},
                            address_2: {$first: '$address_2'},
                            doroAddress: {$first: '$doroAddress'},
                            maintenanceFee: {$first: "$maintenanceFee"},
                            note: {$first: '$note'},
                            permanentKey: {$first: '$permanentKey'},
                            distance: {$first: '$distance'},
                            isScanFeePaid: {$first: '$isScanFeePaid'}
                        }
                    },
                    {
                        $lookup: {
                            from: constants.collection.ACTUAL_SALES_OF_APARTMENTS,
                            localField: 'title',
                            foreignField: '아파트',
                            as: 'actualSales'
                        }
                    },
                    {
                        $unwind: {
                            path: '$actualSales',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            propertyUniqueId: 1,
                            category: 1,
                            title: 1,
                            salesMethod: 1,
                            price: 1,
                            currDeposit: 1,
                            deposit: 1,
                            currRent: 1,
                            size: 1,
                            mortgage: 1,
                            facingDirection: 1,
                            codeHeatNm: 1,
                            fuel: 1,
                            hoCnt: 1,
                            officetelUse: 1,
                            kaptBcompany: 1,
                            codeHallNm: 1,
                            numberOfRooms: 1,
                            numberOfBathrooms: 1,
                            moveinDate: 1,
                            numOfMonths: 1,
                            totalParkingLotCount: 1,
                            image: 1,
                            isSaved: 1,
                            realEstateAgentUniqueId: 1,
                            companyName: 1,
                            ceoName: 1,
                            phoneNumber: 1,
                            realEstateAddress: 1,
                            licenseNumber: 1,

                            loft: 1,
                            dateOfApproval: 1,
                            principalUser: 1,
                            parkingAvailability: 1,
                            address_1: 1,
                            address_2: 1,
                            doroAddress: 1,
                            maintenanceFee: 1,
                            note: 1,
                            permanentKey: 1,
                            'actualSales.actualPrice': '$actualSales.거래금액',
                            'actualSales.day': {
                                $concat: [
                                    '$actualSales.년',
                                    {$cond: [ {$eq: [ {$strLenCP:'$actualSales.월'}, 1]}, {$concat: ['0', '$actualSales.월']}, '$actualSales.월' ]},
                                    {$cond: [ {$eq: [ {$strLenCP:'$actualSales.일'}, 1]}, {$concat: ['0', '$actualSales.일']}, '$actualSales.일' ]},
                                ]
                            },
                            'actualSales.floor': '$actualSales.층',
                            'actualSales.actualSize': '$actualSales.전용면적',
                            distance: 1,
                            isScanFeePaid: 1
                        }
                    },
                    {
                        $sort: { 'actualSales.day': -1 }
                    },
                    {
                        $group: {
                            _id: '$propertyUniqueId',
                            propertyUniqueId: {$first: '$propertyUniqueId'},
                            category: {$first: '$category'},
                            title: {$first: '$title'},
                            salesMethod: {$first: '$salesMethod'},
                            price: {$first: '$price'},
                            currDeposit: {$first: '$currDeposit'},
                            deposit: {$first: '$deposit'},
                            currRent: {$first: '$currRent'},
                            size: {$first: '$size'},
                            mortgage: {$first: '$mortgage'},
                            facingDirection: {$first: '$facingDirection'},
                            codeHeatNm: {$first: '$codeHeatNm'},
                            fuel: {$first: '$fuel'},
                            hoCnt: {$first: '$hoCnt'},
                            officetelUse: {$first: '$officetelUse'},
                            kaptBcompany: {$first: '$kaptBcompany'},
                            codeHallNm: {$first: '$codeHallNm'},
                            numberOfRooms: {$first: '$numberOfRooms'},
                            numberOfBathrooms: {$first: '$numberOfBathrooms'},
                            moveinDate: {$first: '$moveinDate'},
                            numOfMonths: {$first: '$numOfMonths'},
                            totalParkingLotCount: {$first: '$totalParkingLotCount'},
                            image: {$first: '$image'},
                            isSaved: {$first: '$isSaved'},
                            realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                            companyName: {$first: '$companyName'},
                            ceoName: {$first: '$ceoName'},
                            phoneNumber: {$first: '$phoneNumber'},
                            realEstateAddress: {$first: '$realEstateAddress'},
                            licenseNumber: {$first: '$licenseNumber'},

                            loft: {$first: '$loft'},
                            dateOfApproval: {$first: '$dateOfApproval'},
                            principalUser: {$first: '$principalUser'},
                            parkingAvailability: {$first: '$parkingAvailability'},

                            address_1: {$first: '$address_1'},
                            address_2: {$first: '$address_2'},
                            doroAddress: {$first: '$doroAddress'},
                            maintenanceFee: {$first: "$maintenanceFee"},
                            note: {$first: '$note'},
                            permanentKey: {$first: '$permanentKey'},
                            actualSales: {$push: '$actualSales'},
                            distance: {$first: '$distance'},
                            isScanFeePaid: {$first: '$isScanFeePaid'}
                        }
                    }
                ]
            }
        },
        {
          $unwind: '$savedProperty'
        },
        {
            $unwind: '$propertyInfo'
        }
    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {
                if (docs.length > 0) {
                    let result = docs[0]

                    res.json(result)
                }
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })
    })

})

router.post('/check/vr/tour', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)

    vrTourCollection.findOne({ userUniqueId: new objectId(userUniqueId), propertyUniqueId: new objectId(propertyUniqueId)})
        .then(tour => {
            if(tour) {
                let response = {
                    isRequested: true,
                    vrTourKey: (tour.vrTourKey === undefined) ? null : tour.vrTourKey,
                    isExpired: false
                }

                if(tour.grantedTime){
                    let nowTime = new Date().getTime()
                    let expirationTime = tour.grantedTime.getTime() + (24 * 60 * 60 * 1000)

                    if(expirationTime < nowTime){
                        response.isExpired = true
                    }
                }

                res.json(response)
            }else{
                let response = {
                    isRequested: false,
                    vrTourKey: null,
                    isExpired: false
                }

                res.json(response)

            }
        })
        .catch(err => {
            throw err
        })
})

router.post('/fetch/property/group', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let SW = req.body.SW
    let NE = req.body.NE

    let firstArea = req.body.firstArea
    let secondArea = req.body.secondArea
    let thirdArea = req.body.thirdArea
    let category = req.body.category
    let salesMethod = req.body.salesMethod
    let mortgage = req.body.mortgage
    let facingDirection = req.body.facingDirection
    let numberOfRooms = req.body.numberOfRooms
    let numberOfBathrooms = req.body.numberOfBathrooms
    let priceRange = req.body.priceRange
    let size = req.body.size
    let Keyword = req.body.keyword
    let Keywords = (Keyword !== null && Keyword !== undefined) ? Keyword.split(/[\s,"]+/) : null

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    let matchQuery = []
    let totalCountQuery = []

    if(SW !== null && Keyword === null){
        let locationQuery = {
            $match: {
                'loc': {
                    $geoWithin: {
                        $box: [[SW.longitude, SW.latitude],[NE.longitude, NE.latitude]]
                    }
                }
            }
        }

        matchQuery.push(locationQuery)
        totalCountQuery.push(locationQuery)
    }

    if (firstArea !== null) {
        let firstAreaQuery = {$match: {'location.firstArea': firstArea}}

        matchQuery.push(firstAreaQuery)
        totalCountQuery.push(firstAreaQuery)

        if (secondArea !== null) {

            let secondAreaQuery = {$match: {'location.secondArea': secondArea}}

            matchQuery.push(secondAreaQuery)
            totalCountQuery.push(secondAreaQuery)

            if (thirdArea !== null) {

                let thirdAreaQuery = {$match: {'location.thirdArea': thirdArea}}

                matchQuery.push(thirdAreaQuery)
                totalCountQuery.push(thirdAreaQuery)

            }
        }
    }

    if (category !== null) {

        let query = {$match: {'category.type': category}}
        matchQuery.push(query)
        totalCountQuery.push(query)
    }

    if (salesMethod !== null) {
        let query = {$match: {'salesMethod.type': salesMethod}}
        matchQuery.push(query)
        totalCountQuery.push(query)
    }

    if (mortgage !== null) {
        let query = {$match: {'mortgage.type': mortgage}}
        matchQuery.push(query)
        totalCountQuery.push(query)
    }

    if (facingDirection !== null) {
        let query = {$match: {'facingDirection.type': facingDirection}}
        matchQuery.push(query)
        totalCountQuery.push(query)
    }

    if (numberOfRooms !== null) {
        let number = parseInt(numberOfRooms)
        let query = {$match: {numberOfRooms: number}}


        if (number === 4) {
            query = {$match: {numberOfRooms: {$gte: number}}}
        }

        matchQuery.push(query)
        totalCountQuery.push(query)
    }

    if (numberOfBathrooms !== null) {
        let number = parseInt(numberOfBathrooms)
        let query = {$match: {numberOfBathrooms: number}}


        if (number === 3) {
            query = {$match: {numberOfBathrooms: {$gte: number}}}
        }

        matchQuery.push(query)
        totalCountQuery.push(query)
    }


    if (priceRange !== null) {

        let priceHigh = parseInt(priceRange.high)

        let priceQuery = {
            $match: {$and: [{price: {$gte: parseInt(priceRange.low)}}, {price: {$lte: priceHigh}}]}
        }

        if (priceHigh === 1500000000) { //15억 이면 무제한으로 검색
            priceQuery = {
                $match: {price: {$gte: parseInt(priceRange.low)}}
            }
        }


        matchQuery.push(priceQuery)
        totalCountQuery.push(priceQuery)
    }


    if (size !== null) {

        let sizeHigh = parseInt(size.high)

        let sizeQuery = {
            $match: {$and: [{'size.totalSize': {$gte: parseInt(size.low)}}, {'size.totalSize': {$lte: sizeHigh}}]}
        }

        if (sizeHigh === 231) { //231 square meter 이면 무제한 으로 검색
            sizeQuery = {
                $match: {'size.totalSize': {$gte: parseInt(size.low)}}
            }
        }

        matchQuery.push(sizeQuery)
        totalCountQuery.push(sizeQuery)
    }

    let inArray = []

    if (Keyword !== null && Keyword !== undefined) {
        let keywords = Keyword.split(/[\s,"]+/)
        keywords.forEach(word => {
            let regex = new RegExp([word].join(''), 'i')
            inArray.push(regex)
        })

        let keywordQuery = {$match: {'title': {$in: inArray}}}
        matchQuery.push(keywordQuery)
        totalCountQuery.push(keywordQuery)
    }

     let countQuery = {
            $group: {
                _id: '$address_1',
                count: {$sum: 1}
            }
        }

    totalCountQuery.push(countQuery)

    let groupingQuery = [{
            $project: {
                _id: 1,
                title: 1,
                address_1: 1,
                category: 1,
                forSaleNum: {$cond: [ {$eq: ['$salesMethod.type', 'FOR_SALE']}, 1, null]},
                depositRentNum: {$cond: [{$eq: ['$salesMethod.type', 'KEY_DEPOSIT_RENT']}, 1, null]},
                monthlyRentNum: {$cond: [{$eq: ['$salesMethod.type', 'MONTHLY_RENT']}, 1, null]},
                FOR_SALE: {$cond:[ {$eq: ['$salesMethod.type', "FOR_SALE"]}, '$price',  null]},
                KEY_DEPOSIT_RENT: {$cond:[ {$eq: ['$salesMethod.type', "KEY_DEPOSIT_RENT"]}, '$price',  null]},
                MONTHLY_RENT: {$cond:[ {$eq: ['$salesMethod.type', "MONTHLY_RENT"]}, '$price',  null]},
                loc: 1
            }
        },
        {
            $group: {
                _id: '$address_1',
                propertyUniqueId: {$push: '$_id'},
                title: {$first: '$title'},
                category: {$first: '$category'},
                forSaleNum: {$push: '$forSaleNum'},
                depositRentNum: {$push: '$depositRentNum'},
                monthlyRentNum: {$push: '$monthlyRentNum'},
                FOR_SALE: {$push: '$FOR_SALE'},
                KEY_DEPOSIT_RENT: {$push: '$KEY_DEPOSIT_RENT'},
                MONTHLY_RENT: {$push: '$MONTHLY_RENT'},
                loc: {$first: '$loc'}
            }
        },
        {
            $project: {
                title: 1,
                propertyUniqueId: 1,
                category: 1,
                FOR_SALE: {
                    'max': {$max: '$FOR_SALE'},
                    'min': {$min: '$FOR_SALE'},
                    'totalCount' : {$sum: '$forSaleNum'}
                },
                KEY_DEPOSIT_RENT: {
                    'max': {$max: '$KEY_DEPOSIT_RENT'},
                    'min': {$min: '$KEY_DEPOSIT_RENT'},
                    'totalCount': {$sum: '$depositRentNum'}
                },
                MONTHLY_RENT: {
                    'max': {$max: '$MONTHLY_RENT'},
                    'min': {$min: '$MONTHLY_RENT'},
                    'totalCount': {$sum: '$monthlyRentNum'}
                },
                loc: 1,
            }
        },
        {
            $unwind: '$propertyUniqueId'
        },
        {
            $unwind: '$FOR_SALE'
        },
        {
            $unwind: '$KEY_DEPOSIT_RENT'
        },
        {
            $unwind: '$MONTHLY_RENT'
        },
        {
            $unwind: '$loc'
        },
        {
            $group: {
                _id: '$_id',
                propertyUniqueId: {$addToSet: '$propertyUniqueId'},
                title: {$first: '$title'},
                category: {$first: '$category'},
                FOR_SALE: {$first: '$FOR_SALE'},
                KEY_DEPOSIT_RENT: {$first: '$KEY_DEPOSIT_RENT'},
                MONTHLY_RENT: {$first: '$MONTHLY_RENT'},
                loc: {$first: '$loc'}
            }
        },
        {
            $unwind: '$propertyUniqueId'
        },
        {
            $sort: {propertyUniqueId: -1}
        },
        {
            $group: {
                _id: '$_id',
                propertyUniqueId: {$push: '$propertyUniqueId'},
                title: {$first: '$title'},
                category: {$first: '$category'},
                FOR_SALE: {$first: '$FOR_SALE'},
                KEY_DEPOSIT_RENT: {$first: '$KEY_DEPOSIT_RENT'},
                MONTHLY_RENT: {$first: '$MONTHLY_RENT'},
                loc: {$first: '$loc'}
            }
        },
        {$sort: {_id: -1}}
    ]

    groupingQuery.forEach(query => {
        matchQuery.push(query)
    })

    propertyCollection.aggregate([
        {$match: {'status.type': 'SELLING'}},
        {
            $facet: {
                totalCount: totalCountQuery,
                propertyList: matchQuery
            }
        },
        {
            $project: {
                totalCount: {$size: '$totalCount'},
                propertyList: 1
            }
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send()

            throw err
        }

        cursor.toArray()
            .then(docs => {
                let result = {}
                if(docs.length > 0){
                    result = docs[0]
                }else{
                    result = {
                        message: "일치하는 매물이 없습니다."
                    }
                }
                res.json(result)
            })
            .catch(e2 => {
                throw e2
            })

    })


})

router.post('/fetch/property/propertyList', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let address_1 = req.body.address_1
    let salesMethod = req.body.salesMethod //거래방식
    let dongNumber = req.body.dongNumber //동

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    let matchQuery = []

    if(salesMethod !== null){
        let salesQuery = {
            $match: {'salesMethod.type': salesMethod }
        }

        matchQuery.push(salesQuery)
    }

    if(dongNumber !== null){
        let dongQuery = {
            $match: {'dongNumber' : dongNumber}
        }

        matchQuery.push(dongQuery)
    }

    let projectQuery = [{
            $lookup: {
                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                localField: 'realEstateAgentUniqueId',
                foreignField: 'realEstateAgentUniqueId',
                as: 'agencyInfo'
            }
        },
        {
            $unwind: '$agencyInfo'
        },
        {
            $lookup: {
                from: constants.collection.SAVED_PROPERTY,
                localField: '_id',
                foreignField: 'propertyUniqueId',
                as: 'savedProperty'
            }
        },
        {
            $unwind: {
                path: '$savedProperty',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                _id: 1,
                title: 1,
                dongNumber: 1,
                hoNumber: 1,
                salesMethod: 1,
                price: 1,
                deposit: 1,
                currDeposit: 1,
                currRent: 1,
                category: 1,
                size: 1,
                facingDirection: 1,
                note: 1,
                realEstateAgentUniqueId: 1,
                companyName: '$agencyInfo.companyName',
                thumbnail: 1,
                isSaved: { $cond: [{$eq: ['$savedProperty.userUniqueId', new objectId(userUniqueId)]}, true, false]},
                savedProperty: 1
            }
        },
        {$sort: {'isSaved': -1}},
        {
            $group: {
                _id: '$_id',
                title: {$first: '$title'},
                dongNumber: {$first: '$dongNumber'},
                hoNumber: {$first: '$hoNumber'},
                salesMethod: {$first: '$salesMethod'},
                price: {$first: '$price'},
                deposit: {$first: '$deposit'},
                currDeposit: {$first: '$currDeposit'},
                currRent: {$first: '$currRent'},
                category: {$first: '$category'},
                size: {$first: '$size'},
                facingDirection: {$first: '$facingDirection'},
                note: {$first: '$note'},
                realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                companyName: {$first: '$companyName'},
                thumbnail: {$first: '$thumbnail'},
                isSaved: {$first: '$isSaved'},
                savedProperty: {$addToSet: '$savedProperty'}
            }
        },
        {
            $project: {
                _id: 0,
                propertyUniqueId: '$_id',
                title: 1,
                dongNumber: 1,
                hoNumber: 1,
                salesMethod: 1,
                price: 1,
                deposit: 1,
                currDeposit: 1,
                currRent: 1,
                category: 1,
                size: 1,
                facingDirection: 1,
                note: 1,
                realEstateAgentUniqueId: 1,
                companyName: 1,
                thumbnail: 1,
                isSaved: 1,
                savedProperty: {$size: '$savedProperty'}
            }
        },
        {$sort: {'propertyUniqueId': -1}}
    ]


    projectQuery.forEach(query => {
        matchQuery.push(query)
    })


    propertyCollection.aggregate([
        {$match: {$and:[{'address_1': address_1}, {'status.type': 'SELLING'}]} },
        {
            $facet: {
                apartmentComplex: [
                    {
                        $lookup: {
                            from: constants.collection.KAPT,
                            localField: 'kaptCode',
                            foreignField: 'kaptCode',
                            as: 'kapt'
                        }
                    },
                    {
                        $unwind: '$kapt'
                    },
                    {
                        $lookup: {
                            from: constants.collection.BUILDING_REGISTRY_PYOJEBU,
                            localField: 'kapt.doroJuso',
                            foreignField: 'newPlatPlc',
                            as: 'buildingRegistry'
                        }
                    },
                    {
                        $unwind: {
                            path: '$buildingRegistry',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            category: 1,
                            title: 1,
                            address_1: 1,
                            doroAddress: 1,
                            fuel: 1,
                            kapt: 1,
                            buildingRegistry: 1,
                            dongNumber: 1,

                            dateOfApproval: {$split: ["$dateOfApproval", "."]},
                            size: 1,
                            totalParkingLotCount: 1
                        }
                    },
                    {
                        $group: {
                            _id: '$address_1',
                            category: {$first: '$category'},
                            title: {$first: '$title'},
                            hoCnt: {$first: '$kapt.kaptdaCnt'}, //세대수
                            dongCnt: {$first: '$kapt.kaptDongCnt'}, //동

                            grndFlrCnt: {$push: '$buildingRegistry.grndFlrCnt'}, //지상층
                            dateOfApproval: {$first: '$buildingRegistry.useAprDay'}, //사용승인일
                            propertyGrndFlrCnt: {$push: '$size.groundFloor'}, //지상층
                            propertyDateOfApproval: {$first: '$dateOfApproval'}, //사용승인일

                            totalParkingLotCount: {$first: '$totalParkingLotCount'},

                            floorAreaRatio: {$first: '$buildingRegistry.vlRat'}, //용적률
                            buildingCoverage: {$first: '$buildingRegistry.bcRat'}, //건폐율
                            propertyFloorAreaRatio: {$first: '$size.floorAreaRatio'}, //용적률
                            propertyBuildingCoverage: {$first: '$size.buildingCoverage'}, //건폐율

                            fuel: {$first: '$fuel'},
                            kaptBcompany: {$first: '$kapt.kaptBcompany'},
                            codeHeatNm: {$first: '$kapt.codeHeatNm'},
                            kaptTel: {$first: '$kapt.kaptTel'},
                            address_1: {$first: '$address_1'},
                            doroAddress: {$first: '$doroAddress'},
                            area60: {$first: '$kapt.kaptMparea_60'},
                            area85: {$first: '$kapt.kaptMparea_85'},
                            area135: {$first: '$kapt.kaptMparea_135'},
                            area136: {$first: '$kapt.kaptMparea_136'},
                            dongNumber: {$addToSet: '$dongNumber'}
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            category: 1,
                            title: 1,
                            houseCnt: {
                                hoCnt: '$hoCnt',
                                dongCnt: '$dongCnt'
                            },
                            floor: {
                                lowFloor: {$ifNull: [{$min: '$grndFlrCnt'}, {$ifNull: [ {$min:'$propertyGrndFlrCnt'}, '-']}]},
                                highFloor: {$ifNull: [{$max: '$grndFlrCnt'}, {$ifNull: [ {$max:'$propertyGrndFlrCnt'}, '-']}]},
                            },
                            dateOfApproval:
                                {$ifNull: [
                                    '$dateOfApproval',
                                        {$ifNull:[
                                                {$concat:[
                                                        {$arrayElemAt: ['$propertyDateOfApproval', 0]},
                                                        {$arrayElemAt: ['$propertyDateOfApproval', 1]},
                                                        {$arrayElemAt: ['$propertyDateOfApproval', 2]}
                                                    ]},
                                                '-'
                                            ]}
                                    ]},
                            totalParkingLotCount: 1,
                            floorAreaRatio: {$ifNull: ['$floorAreaRatio', {$ifNull: ['$propertyFloorAreaRatio', '-']} ]},
                            buildingCoverage: {$ifNull: ['$buildingCoverage', {$ifNull: ['$propertyBuildingCoverage', '-']} ]},
                            fuel: 1,
                            kaptBcompany: 1,
                            codeHeatNm: 1,
                            propertyTel: '$kaptTel',
                            address: {
                                address_1: '$address_1',
                                doroAddress: '$doroAddress'
                            },
                            areaSize: {
                                area60: '$area60',
                                area85: '$area85',
                                area135: '$area135',
                                area136: '$area136'
                            },
                            dongNumber: 1
                        }
                    },
                    {
                        $unwind: '$dongNumber'
                    },
                    {$sort: {'dongNumber': 1}},
                    {
                        $group: {
                            _id: '$_id',
                            category: {$first: '$category'},
                            title: {$first: '$title'},
                            totalParkingLotCount: {$first: '$totalParkingLotCount'},
                            fuel: {$first: '$fuel'},
                            kaptBcompany: {$first: '$kaptBcompany'},
                            codeHeatNm: {$first: '$codeHeatNm'},
                            dongNumber: {$push: '$dongNumber'},
                            houseCnt: {$first: '$houseCnt'},
                            floor: {$first: '$floor'},
                            dateOfApproval: {$first: '$dateOfApproval'},
                            floorAreaRatio: {$first: '$floorAreaRatio'},
                            buildingCoverage: {$first: '$buildingCoverage'},
                            propertyTel: {$first: '$propertyTel'},
                            address: {$first: '$address'},
                            areaSize: {$first: '$areaSize'}
                        }
                    }
                ],
                apartmentInfo: [
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            address_1: 1,
                            category: 1,
                            forSaleNum: {$cond: [ {$eq: ['$salesMethod.type', 'FOR_SALE']}, 1, null]},
                            depositRentNum: {$cond: [{$eq: ['$salesMethod.type', 'KEY_DEPOSIT_RENT']}, 1, null]},
                            monthlyRentNum: {$cond: [{$eq: ['$salesMethod.type', 'MONTHLY_RENT']}, 1, null]},
                            FOR_SALE: {$cond:[ {$eq: ['$salesMethod.type', "FOR_SALE"]}, '$price',  null]},
                            KEY_DEPOSIT_RENT: {$cond:[ {$eq: ['$salesMethod.type', "KEY_DEPOSIT_RENT"]}, '$price',  null]},
                            MONTHLY_RENT: {$cond:[ {$eq: ['$salesMethod.type', "MONTHLY_RENT"]}, '$price',  null]},
                            loc: 1
                        }
                    },
                    {
                        $group: {
                            _id: '$address_1',
                            propertyUniqueId: {$push: '$_id'},
                            title: {$first: '$title'},
                            category: {$first: '$category'},
                            forSaleNum: {$push: '$forSaleNum'},
                            depositRentNum: {$push: '$depositRentNum'},
                            monthlyRentNum: {$push: '$monthlyRentNum'},
                            FOR_SALE: {$push: '$FOR_SALE'},
                            KEY_DEPOSIT_RENT: {$push: '$KEY_DEPOSIT_RENT'},
                            MONTHLY_RENT: {$push: '$MONTHLY_RENT'},
                            loc: {$first: '$loc'}
                        }
                    },
                    {
                        $project: {
                            title: 1,
                            category: 1,
                            FOR_SALE: {
                                'max': {$max: '$FOR_SALE'},
                                'min': {$min: '$FOR_SALE'},
                                'totalCount' : {$sum: '$forSaleNum'}
                            },
                            KEY_DEPOSIT_RENT: {
                                'max': {$max: '$KEY_DEPOSIT_RENT'},
                                'min': {$min: '$KEY_DEPOSIT_RENT'},
                                'totalCount': {$sum: '$depositRentNum'}
                            },
                            MONTHLY_RENT: {
                                'max': {$max: '$MONTHLY_RENT'},
                                'min': {$min: '$MONTHLY_RENT'},
                                'totalCount': {$sum: '$monthlyRentNum'}
                            }
                        }
                    },
                    {
                        $unwind: '$FOR_SALE'
                    },
                    {
                        $unwind: '$KEY_DEPOSIT_RENT'
                    },
                    {
                        $unwind: '$MONTHLY_RENT'
                    },
                    {
                        $group: {
                            _id: '$_id',
                            title: {$first: '$title'},
                            category: {$first: '$category'},
                            FOR_SALE: {$first: '$FOR_SALE'},
                            KEY_DEPOSIT_RENT: {$first: '$KEY_DEPOSIT_RENT'},
                            MONTHLY_RENT: {$first: '$MONTHLY_RENT'},
                        }
                    },
                    {$sort: {'propertyUniqueId': -1}}
                ],
                propertyList: matchQuery
            }
        },
        {
            $unwind: {
            path: '$apartmentComplex',
            preserveNullAndEmptyArrays: true
            }
        },
        {
            $unwind: {
                path: '$apartmentInfo',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                apartmentComplex:  {$ifNull: ['$apartmentComplex', {}]},
                apartmentInfo: {$ifNull: [
                        {
                            _id: '$_id',
                            title: '$apartmentInfo.title',
                            category: '$apartmentInfo.category',
                            houseCnt: '$apartmentComplex.houseCnt',
                            dateOfApproval: '$apartmentComplex.dateOfApproval',
                            totalSize: {
                                max: {$max: '$propertyList.size.totalSize'},
                                min: {$min: '$propertyList.size.totalSize'},
                            },
                            FOR_SALE:  '$apartmentInfo.FOR_SALE',
                            KEY_DEPOSIT_RENT: '$apartmentInfo.KEY_DEPOSIT_RENT',
                            MONTHLY_RENT: '$apartmentInfo.MONTHLY_RENT',
                        }
                        , {}]},
                propertyList: 1
            }

        },
    ], (err, cursor) => {
        if(err){
            res.status(500).send()

            throw  err
        }

        cursor.toArray()
            .then(docs => {
                let result = {}
                if(docs.length > 0){
                    result = docs[0]
                }else{
                    result = {
                        message: "일치하는 매물이 없습니다."
                    }
                }
                res.json(result)
            })
            .catch(e2 => {
                throw e2
            })
    })
})

router.post('/fetch/firstArea', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let bjdongCollection = db.getDb().collection(constants.collection.BJDONG)

    bjdongCollection.aggregate([
        {
            $group: {
                _id: '$firstArea',
                firstArea: {$first: '$firstArea'}
            }
        },
        {
            $sort: { 'firstArea': 1}
        },
        {
            $group: {
                _id: null,
                firstAreas: {$push: {name: '$firstArea'} }
            }
        },
        {
            $sort: { 'firstAreas.name': -1}
        }
    ], (err, cursor) => {
        if(err) {
            throw err
        }

        cursor.toArray()
            .then(docs => {
                let response = {
                    firstAreas: [],
                    error: null
                }

                if(docs.length > 0){
                    let result = docs[0]

                    response.firstAreas = result.firstAreas
                }

                res.json(response)
            })
    })
})

router.post('/fetch/secondArea', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let firstArea = req.body.firstArea

    let bjdongCollection = db.getDb().collection(constants.collection.BJDONG)

    bjdongCollection.aggregate([
        {
            $match: {firstArea: firstArea}
        },
        {
            $group: {
                _id: '$secondArea',
                secondArea: {$first: '$secondArea'}
            }
        },
        {
            $sort: { 'secondArea': 1}
        },
        {
            $group: {
                _id: null,
                secondAreas: {$push: {name: '$secondArea'} }
            }
        },
        {
            $sort: { 'secondAreas.name': -1}
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {
                let response = {
                    secondAreas: [],
                    error: null
                }

                if( docs.length > 0){
                    let result = docs[0]

                    response.secondAreas = result.secondAreas
                }

                res.json(response)
            })
    })
})

router.post('/fetch/thirdArea', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let firstArea = req.body.firstArea
    let secondArea = req.body.secondArea

    let bjdongCollection = db.getDb().collection(constants.collection.BJDONG)

    bjdongCollection.aggregate([
        {
            $match: {
                firstArea: firstArea,
                secondArea: secondArea
            }
        },
        {
            $group: {
                _id: '$thirdArea',
                thirdArea: {$first: '$thirdArea'}
            }
        },
        {
            $sort: { 'thirdArea': 1}
        },
        {
            $group: {
                _id: null,
                thirdAreas: {$push: {name: '$thirdArea'} }
            }
        },
        {
            $sort: { 'thirdAreas.name': -1}
        }
    ], (err, cursor) => {
        if(err){
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {
                let response = {
                    thirdAreas: [],
                    error: null
                }

                if(docs.length > 0){
                    let result = docs[0]

                    response.thirdAreas = result.thirdAreas
                }

                res.json(response)
            })
    })
})

module.exports = router