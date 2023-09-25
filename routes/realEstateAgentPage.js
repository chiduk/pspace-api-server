let db = require('../config/database')
let express = require('express');
let objectId = require('mongodb').ObjectID;
let bcrypt = require('bcrypt');
let kakaocert = require('kakaocert')
let axios = require('axios')
let fs = require('fs')
let saltRounds = 10
let router = express.Router();
let error = require('../util/error')
let constants = require('../util/constants')
let shortid = require('shortid')
let multer = require('multer')
let alimtalk = require('../util/alimtalk')
let linkExpirer = require('../util/setLinkExpiration')
let htmlBuilder = require('../util/htmlBuilder')


let sizeof = require('image-size')

let propertyImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        let destination = process.env.PROP_IMAGE_PATH
        cb(null, destination)
    },
    filename: (req, file, cb) => {
        let extension = 'jpg'

        if (file.mimetype === 'image/png') {
            extension = 'png'
        }

        cb(null, shortid.generate() + '.' + extension)
    }
})

let propImageUpload = multer({storage: propertyImageStorage})

ifRealEstateAgentThenExecute = (realEstateAgentUniqueId, callback) => {
    let realEstateAgentInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
    realEstateAgentInfoCollection.findOne({realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)})
        .then(realEstate => {
            if (realEstate !== null) {
                let realEstatePhoneNumber = realEstate.phoneNumber
                callback(true, realEstatePhoneNumber)
            } else {
                callback(false)
            }
        })
        .catch(err => {
            callback(false)
            throw err
        })
}

router.post('/inquiry/reply', (req, res) => {
    let inquiryUniqueId = req.body.inquiryUniqueId
    let responderUniqueId = req.body.responderUniqueId
    let title = req.body.title
    let message = req.body.message

    let inquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_ANSWER)
    let insertObj = {
        inquiryUniqueId: new objectId(inquiryUniqueId),
        responderUniqueId: new objectId(responderUniqueId),
        title: title,
        message: message
    }

    inquiryAnswerCollection.findOne({
        inquiryUniqueId: new objectId(inquiryUniqueId),
        responderUniqueId: new objectId(responderUniqueId)
    })
        .then(answer => {
            if (answer !== null) {
                let response = {
                    isReplied: false,
                    error: {code: 'IR001', message: '이미 답변하였습니다.'}
                }

                res.json(response)
            } else {
                inquiryAnswerCollection.insertOne(insertObj)
                    .then(() => {
                        let response = {
                            isReplied: true,
                            error: null
                        }

                        res.json(response)
                    })
                    .catch(err => {
                        let response = {
                            isReplied: false,
                            error: {code: 'S500', message: '서버에러'}
                        }

                        res.json(response)

                        throw err
                    })
            }
        })
        .catch(err => {
            let response = {
                isReplied: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(response)

            throw err
        })
})

router.post('/check/password', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let password = req.body.password

    let userCollection = db.getDb().collection(constants.collection.USER)

    userCollection.findOne({_id: new objectId(realEstateAgentUniqueId)})
        .then(user => {


            if (user) {
                bcrypt.compare(password, user.password)
                    .then(isMatching => {
                        if (isMatching) {

                            res.json({isMatching: true})

                        } else {
                            res.json({isMatching: false})

                        }

                    })
            } else {
                res.json({isMatching: false})
            }
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

router.post('/fetch/reagent/info', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId

    let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

    realEstateInfoCollection.aggregate([
        {$match: {realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}},
        {
            $lookup: {
                from: 'USER',
                localField: 'realEstateAgentUniqueId',
                foreignField: '_id',
                as: 'reAgentUser'
            }
        },
        {
            $unwind: '$reAgentUser'
        }
    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {
                if (docs.length > 0) {
                    let info = docs[0]

                    let response = {
                        userUniqueId: info.realEstateAgentUniqueId,
                        licenseNumber: info.licenseNumber,
                        companyName: info.companyName,
                        name: info.ceoName,
                        email: info.email,
                        address_1: info.address_1,
                        address_2: info.address_2,
                        phoneNumber: info.phoneNumber,
                        isSubscribedToMarketingNews: info.reAgentUser.isSubscribedToMarketingNews
                    }

                    res.json(response)
                } else {
                    res.json({})
                }
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })

    })

})

router.post('/signout', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let userCollection = db.getDb().collection(constants.collection.USER)
    userCollection.findOneAndUpdate({_id: new objectId(realEstateAgentUniqueId)}, {
        $set: {
            isSignedOut: true,
            signedOutDate: new Date()
        }
    })
        .then(() => {
            res.json({isSignedOut: true})
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

router.post('/fetch/property/list', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)
    let salesStatus = req.body.salesStatus
    let salesStatusObj = {
        $match: {'status.type': salesStatus}
    }

    if (salesStatus === constants.salesStatus.ALL.type) {
        salesStatusObj = {
            $match: {
                $or: [
                    {'status.type': {$eq: constants.salesStatus.SELLING.type}},
                    {'status.type': {$eq: constants.salesStatus.COMPLETED.type}},
                    {'status.type': {$eq: constants.salesStatus.WITHDRAWN.type}},
                    {'status.type': {$eq: constants.salesStatus.OTHER.type}},
                    {'status.type': {$eq: constants.salesStatus.CLOSED.type}}
                ]
            }
        }
    }

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    propertyCollection.aggregate([
        {
            $facet: {
                count: [
                    {$match: {realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}},
                    salesStatusObj,
                    {$count: 'totalCount'}
                ],
                propertyList: [
                    {$match: {realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}},
                    salesStatusObj,
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
                    },
                    {
                        $sort: {_id: -1}
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
                        $project: {
                            _id: 0,
                            propertyUniqueId: '$_id',
                            category: '$category',
                            title: '$title',
                            address_1: '$address_1',
                            address_2: '$address_2',
                            size: '$size',
                            price: '$price',
                            deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                            currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                            currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                            salesMethod: '$salesMethod',
                            owner: '$owner',
                            'realEstateAgent.realEstateUniqueId': '$agency._id',
                            'realEstateAgent.name': '$agency.ceoName',
                            'realEstateAgent.companyName': '$agency.companyName',
                            status: '$status',
                            thumbnail: '$thumbnail',
                            savedProperty: {$size: '$savedProperty'}
                        }
                    },
                    {
                        $skip: skip
                    },
                    {
                        $limit: limit
                    }
                ]
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

        cursor.toArray()
            .then(docs => {

                let response = {
                    totalCount: 0,
                    propertyList: []
                }

                if (docs.length > 0) {
                    let result = docs[0]
                    response.totalCount = result.count.totalCount
                    response.propertyList = result.propertyList
                }

                res.json(response)
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })
    })
})

router.post('/fetch/property/info', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    propertyCollection.aggregate([
        {$match: {_id: new objectId(propertyUniqueId), realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}},
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
        },
        {
            $lookup: {
                from: constants.collection.IMAGE,
                localField: '_id',
                foreignField: 'propertyUniqueId',
                as: 'images'
            }
        },
        {
            $unwind: '$images'
        },
        {$sort: {'images._id': 1}},
        {
            $project: {
                _id: 1,
                category: '$category',
                title: '$title',
                address_1: '$address_1',
                address_2: '$address_2',
                size: '$size',
                mortgage: '$mortgage',
                numberOfRooms: '$numberOfRooms',
                numberOfBathrooms: '$numberOfBathrooms',
                facingDirection: '$facingDirection',
                price: '$price',
                deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                maintenanceFee: '$maintenanceFee',
                salesMethod: '$salesMethod',
                owner: '$owner',
                realEstateAgent: {
                    'realEstateAgentUniqueId': '$realEstateAgent.realEstateAgentUniqueId',
                    'name': '$realEstateAgent.ceoName',
                    'companyName': '$realEstateAgent.companyName',
                },
                status: '$status',
                moveinDate: '$moveinDate',
                numOfMonths: {$cond: [{$or: [{$eq: ['$numOfMonths', null]}, {$eq: ['$numOfMonths', ""]}, {$eq: ['$numOfMonths', "null"]}]}, null, '$numOfMonths']},
                note: '$note',
                doroAddress: '$doroAddress',
                kaptCode: '$kaptCode',
                dongNumber: '$dongNumber',
                hoNumber: '$hoNumber',

                codeHeatNm: '$codeHeatNm',
                fuel: '$fuel',
                hoCnt: '$hoCnt',
                codeHallNm: '$codeHallNm',
                loft: '$loft',
                dateOfApproval: '$dateOfApproval',
                principalUser: '$principalUser',
                totalParkingLotCount: '$totalParkingLotCount',
                parkingAvailability: '$parkingAvailability',
                officetelUse: '$officetelUse',
                kaptBcompany: '$kaptBcompany',

                images: {
                    filename: '$images.filename',
                    isThumbnail: '$images.isThumbnail'
                }
            }
        },
        {
            $group: {
                _id: '$_id',
                propertyUniqueId: {$first: '$_id'},
                category: {$first: '$category'},
                title: {$first: '$title'},
                address_1: {$first: '$address_1'},
                address_2: {$first: '$address_2'},
                size: {$first: '$size'},
                mortgage: {$first: '$mortgage'},
                numberOfRooms: {$first: '$numberOfRooms'},
                numberOfBathrooms: {$first: '$numberOfBathrooms'},
                facingDirection: {$first: '$facingDirection'},
                price: {$first: '$price'},
                deposit: {$first: '$deposit'},
                currDeposit: {$first: '$currDeposit'},
                currRent: {$first: '$currRent'},
                maintenanceFee: {$first: '$maintenanceFee'},
                salesMethod: {$first: '$salesMethod'},
                owner: {$first: '$owner'},
                realEstateAgent: {$first: '$agency'},
                status: {$first: '$status'},
                moveinDate: {$first: '$moveinDate'},
                numOfMonths: {$first: '$numOfMonths'},
                note: {$first: '$note'},
                doroAddress: {$first: '$doroAddress'},
                kaptCode: {$first: '$kaptCode'},
                dongNumber: {$first: '$dongNumber'},
                hoNumber: {$first: '$hoNumber'},

                codeHeatNm: {$first: '$codeHeatNm'},
                fuel: {$first: '$fuel'},
                hoCnt: {$first: '$hoCnt'},
                codeHallNm: {$first: '$codeHallNm'},
                loft: {$first: '$loft'},
                dateOfApproval: {$first: '$dateOfApproval'},
                principalUser: {$first: '$principalUser'},
                totalParkingLotCount: {$first: '$totalParkingLotCount'},
                parkingAvailability: {$first: '$parkingAvailability'},
                officetelUse: {$first: '$officetelUse'},
                kaptBcompany: {$first: '$kaptBcompany'},

                images: {$push: '$images'}
            }
        }


    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {
                let response = {
                    property: {}
                }

                if (docs.length > 0) {
                    response.property = docs[0]
                }

                res.json(response)
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })
    })
})

router.post('/edit/property/info', propImageUpload.any(), (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let callback = async (isRealEstate, realEstatePhoneNumber) => {
        if (!isRealEstate) {
            res.json({error: {code: 'RE001', message: '접근권한이 없습니다.'}})

            return
        }

        let price = Number(req.body.price)
        let deposit = req.body.deposit
        let currDeposit = req.body.currDeposit
        let currRent = req.body.currRent

        let category = {
            type: req.body.category,
            value: constants.category[req.body.category]
        }

        let salesMethod = {
            type: req.body.salesMethod,
            value: constants.salesMethod[req.body.salesMethod]
        }

        let mortgage = {
            type: req.body.mortgage,
            value: constants.mortgage[req.body.mortgage]
        }

        let numberOfRooms = req.body.numberOfRooms
        let numberOfBathrooms = req.body.numberOfBathrooms
        let loft = req.body.loft

        let parkingAvailability = req.body.parkingAvailability
        let totalParkingLotCount = req.body.totalParkingLotCount

        let facingDirection = {
            type: req.body.facingDirection,
            value: constants.facingDirection[req.body.facingDirection]
        }

        let codeHeatNm = {
            type: req.body.codeHallNm,
            value: constants.codeHeatNm[req.body.codeHeatNm]
        }
        let fuel = {
            type: req.body.fuel,
            value: constants.fuel[req.body.fuel]
        }
        let codeHallNm = {
            type: req.body.codeHallNm,
            value: constants.codeHallNm[req.body.codeHallNm]
        }

        let maintenanceFee = req.body.maintenanceFee
        let note = req.body.note
        let title = req.body.title
        let address_1 = req.body.address_1
        let address_2 = req.body.address_2
        let dongNumber = req.body.dongNumber
        let hoNumber = req.body.hoNumber
        let doroAddress = req.body.doroAddress

        let principalUser = {
            type: req.body.principalUser,
            value: constants.principalUser[req.body.principalUser]
        }
        let hoCnt = req.body.hoCnt
        let officetelUse = {
            type: req.body.principalUser,
            value: constants.officetelUse[req.body.officetelUse]
        }
        let kaptBcompany = req.body.kaptBcompany

        let latitude = req.body.latitude
        let longitude = req.body.longitude

        let jsonSize = JSON.parse(req.body.size)

        let size = {
            location: {
                type: jsonSize.location,
                value: constants.height[jsonSize.location]
            },
            floor: jsonSize.floor,
            groundFloor: jsonSize.groundFloor,
            basement: jsonSize.basement,
            totalFloor: jsonSize.totalFloor,
            actualSize: jsonSize.actualSize,
            totalSize: jsonSize.totalSize,
            buildingCoverage: (jsonSize.buildingCoverage !== null) ? parseFloat(jsonSize.buildingCoverage) : null,
            floorAreaRatio: (jsonSize.floorAreaRatio !== null) ? parseFloat(jsonSize.floorAreaRatio) : null,
            siteArea: (jsonSize.siteArea !== null) ? parseFloat(jsonSize.siteArea) : null,
            totalFloorArea: (jsonSize.totalFloorArea !== null) ? parseFloat(jsonSize.totalFloorArea) : null,
        }

        let jsonMoveinDate = JSON.parse(req.body.moveinDate)
        let numOfMonths = req.body.numOfMonths
        let dateOfApproval = req.body.dateOfApproval

        let moveinDate = constants.MOVE_IN_DATE[jsonMoveinDate.type]

        if (jsonMoveinDate.type === constants.MOVE_IN_DATE.DATE.type) {
            if (jsonMoveinDate.end === undefined) {
                moveinDate = {
                    ...moveinDate,
                    start: new Date(jsonMoveinDate.start)
                }
            } else {
                moveinDate = {
                    ...moveinDate,
                    start: new Date(jsonMoveinDate.start),
                    end: new Date(jsonMoveinDate.end)
                }
            }
        }


        let owner = req.body.owner

        let prevThumbnailImage = req.body.prevThumbnail
        let prevPropImages = JSON.parse(req.body.prevPropImages)

        let location = (address_1 !== null && address_1 !== undefined) ? address_1.split(/[\s,"]+/) : null

        if (location[0].includes('서울')) {
            location[0] = '서울시'
        }
        let locations = {
            firstArea: location[0],
            secondArea: location[1],
            thirdArea: location[2]
        }

        let thumbnail = ''

        req.files.forEach(file => {

            if (file.fieldname === 'thumbnail') {
                thumbnail = file.filename
            }
        })

        let property = {

            price: price,
            deposit: (deposit !== "null") ? deposit : null,
            currDeposit: (currDeposit !== "null") ? currDeposit : null,
            currRent: (currRent !== "null") ? currRent : null,
            title: title,
            principalUser: principalUser,
            category: category,
            salesMethod: salesMethod,
            mortgage: mortgage,
            numberOfRooms: parseInt(numberOfRooms),
            numberOfBathrooms: parseInt(numberOfBathrooms),
            loft: (loft === "true") ? true : false,
            parkingAvailability: (parkingAvailability === "true") ? true : false,
            totalParkingLotCount: (totalParkingLotCount !== "null") ? parseInt(totalParkingLotCount) : null,
            facingDirection: facingDirection,
            codeHeatNm: codeHeatNm,
            fuel: fuel,
            codeHallNm: codeHallNm,
            maintenanceFee: parseInt(maintenanceFee),
            note: note,
            address_1: address_1,
            address_2: address_2,
            dongNumber: (dongNumber !== "null") ? parseInt(dongNumber) : null,
            hoNumber: (hoNumber !== "null") ? parseInt(hoNumber) : null,
            doroAddress: (doroAddress !== "null") ? doroAddress : null,
            hoCnt: (hoCnt !== "null") ? parseInt(hoCnt) : null,
            officetelUse: officetelUse,
            size: size,
            moveinDate: moveinDate,
            numOfMonths: (numOfMonths !== "null") ? parseInt(numOfMonths) : null,
            dateOfApproval: (dateOfApproval !== "null") ? dateOfApproval : null,
            owner: (owner !== "null") ? owner : null,
            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
            realEstateAgentPhoneNumber: realEstatePhoneNumber,
            thumbnail: (thumbnail !== "" || thumbnail === null) ? thumbnail : prevThumbnailImage,
            status: constants.salesStatus.SELLING,
            latitude: latitude,
            longitude: longitude,
            location: locations,
            kaptBcompany: (kaptBcompany !== "null") ? kaptBcompany : null,
        }

        property.status.reason = ''

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)


        propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: property})
            .then(inserted => {

                let imageCollection = db.getDb().collection(constants.collection.IMAGE)

                prevPropImages.push(prevThumbnailImage)

                imageCollection.find({propertyUniqueId: new objectId(propertyUniqueId)}).toArray()
                    .then(images => {
                        images.forEach(image => {
                            if (!prevPropImages.includes(image.filename)) {
                                imageCollection.deleteOne({
                                    propertyUniqueId: new objectId(propertyUniqueId),
                                    filename: image.filename
                                })
                            }
                        })

                        let index = 1

                        let response = {
                            isEdited: true,
                            error: null
                        }

                        req.files.forEach(file => {

                            let filepath = process.env.PROP_IMAGE_PATH + '/' + file.filename

                            if (file.fieldname !== 'thumbnail') {

                                let imageObject = {
                                    filename: file.filename,
                                    encoding: file.encoding,
                                    mimetype: file.mimetype,
                                    size: file.size,
                                    dimensions: sizeof(filepath),
                                    order: index,
                                    isThumbnail: false,
                                    propertyUniqueId: new objectId(propertyUniqueId)
                                }

                                imageCollection.insertOne(imageObject)

                                index++

                            } else {
                                let imageObject = {
                                    filename: file.filename,
                                    encoding: file.encoding,
                                    mimetype: file.mimetype,
                                    size: file.size,
                                    dimensions: sizeof(filepath),

                                    isThumbnail: true,
                                    propertyUniqueId: new objectId(propertyUniqueId)
                                }

                                imageCollection.insertOne(imageObject)
                            }
                        })

                        res.json(response)
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err
                    })


            })
            .catch(err => {
                res.status(500).send()

                throw err
            })
    }

    ifRealEstateAgentThenExecute(realEstateAgentUniqueId, callback)
})

router.post('/delete/vrTour', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let status = {
        type: req.body.status.type,
        value: constants.salesStatus[req.body.status.type].value,
        reason: req.body.status.reason
    }

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: {status: status}})
        .then(() => {
            res.json({isRequested: true})
        })
        .catch(err => {
            res.status(500).send()

            throw err
        })

    // let vrDeleteRequestCollection = db.getDb().collection(constants.collection.VR_DELETE_REQUEST)
    //
    // let requestObj = {
    //     requestedDate: new Date(),
    //     realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
    //     propertyUniqueId: new objectId(propertyUniqueId),
    //     status: status,
    //     isConfirmed: false,
    //     isEnabled: null
    // }
    //
    // vrDeleteRequestCollection.findOne({realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId), propertyUniqueId: new objectId(propertyUniqueId)})
    //     .then(request => {
    //         if(request === null){
    //             vrDeleteRequestCollection.insertOne(requestObj)
    //         }
    //
    //         res.json({isRequested: true})
    //     })
    //     .catch(err => {
    //         res.status(500).send()
    //         throw err
    //     })
})

router.post('/fetch/vrTour/list', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let realEstateAgentCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

    realEstateAgentCollection.aggregate([
        {$match: {realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)}},
        {
            $facet: {
                userCount: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'property'
                        }
                    },
                    {
                        $unwind: '$property'
                    },
                    {
                        $lookup: {
                            from: constants.collection.VR_TOUR,
                            localField: 'property._id',
                            foreignField: 'propertyUniqueId',
                            as: 'userVrTour'
                        }
                    },
                    {
                        $unwind: '$userVrTour'
                    },
                    {
                        $count: 'userCount'
                    }
                ],
                reCount: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'property'
                        }
                    },
                    {
                        $unwind: '$property'
                    },
                    {
                        $lookup: {
                            from: constants.collection.VR_TOUR_RE_AGENT,
                            localField: 'property._id',
                            foreignField: 'propertyUniqueId',
                            as: 'reVrTour'
                        }
                    },
                    {
                        $unwind: '$reVrTour'
                    },
                    {
                        $count: 'reCount'
                    }
                ],
                userVrTourList: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'property'
                        }
                    },
                    {
                        $unwind: '$property'
                    },
                    {
                        $lookup: {
                            from: constants.collection.VR_TOUR,
                            localField: 'property._id',
                            foreignField: 'propertyUniqueId',
                            as: 'userVrTour'
                        }
                    },
                    {
                        $unwind: '$userVrTour'
                    },
                    {
                        $lookup: {
                            from: constants.collection.USER,
                            localField: 'userVrTour.userUniqueId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $unwind: '$user'
                    },
                    {
                        $project: {
                            _id: '$realEstateAgentUniqueId',
                            vrTourUniqueId: '$userVrTour._id',
                            propertyUniqueId: '$property._id',
                            price: '$property.price',
                            deposit: {$cond: [{$or: [{$eq: ['$property.deposit', null]}, {$eq: ['$property.deposit', ""]}, {$eq: ['$property.deposit', "null"]}]}, null, '$property.deposit']},
                            currDeposit: {$cond: [{$or: [{$eq: ['$property.currDeposit', null]}, {$eq: ['$property.currDeposit', ""]}, {$eq: ['$property.currDeposit', "null"]}]}, null, '$property.currDeposit']},
                            currRent: {$cond: [{$or: [{$eq: ['$property.currRent', null]}, {$eq: ['$property.currRent', ""]}, {$eq: ['$property.currRent', "null"]}]}, null, '$property.currRent']},
                            category: '$property.category',
                            address_1: '$property.address_1',
                            address_2: '$property.address_2',
                            title: '$property.title',
                            salesMethod: '$property.salesMethod',
                            size: '$property.size',
                            thumbnail: '$property.thumbnail',
                            date: '$userVrTour.date',
                            isConfirmed: '$userVrTour.isConfirmed',
                            isEnabled: '$userVrTour.isEnabled',
                            propertyOwnerName: '$property.owner',
                            vrTourRequester: {
                                'name': '$user.name',
                                'phoneNumber': '$user.phoneNumber',
                                'address': '$user.address_1',
                                'isRealEstateAgent': '$user.isRealEstateAgent'
                            },
                        }
                    }
                ],
                reVrTourList: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'realEstateAgentUniqueId',
                            foreignField: 'realEstateAgentUniqueId',
                            as: 'property'
                        }
                    },
                    {
                        $unwind: '$property'
                    },
                    {
                        $lookup: {
                            from: constants.collection.VR_TOUR_RE_AGENT,
                            localField: 'property._id',
                            foreignField: 'propertyUniqueId',
                            as: 'reVrTour'
                        }
                    },
                    {
                        $unwind: '$reVrTour'
                    },
                    {
                        $lookup: {
                            from: constants.collection.USER,
                            localField: 'reVrTour.userUniqueId',
                            foreignField: '_id',
                            as: 'realEstateAgent'
                        }
                    },
                    {
                        $unwind: '$realEstateAgent'
                    },
                    {
                        $project: {
                            _id: '$realEstateAgentUniqueId',
                            vrTourUniqueId: '$reVrTour._id',
                            propertyUniqueId: '$property._id',
                            price: '$property.price',
                            deposit: {$cond: [{$or: [{$eq: ['$property.deposit', null]}, {$eq: ['$property.deposit', ""]}, {$eq: ['$property.deposit', "null"]}]}, null, '$property.deposit']},
                            currDeposit: {$cond: [{$or: [{$eq: ['$property.currDeposit', null]}, {$eq: ['$property.currDeposit', ""]}, {$eq: ['$property.currDeposit', "null"]}]}, null, '$property.currDeposit']},
                            currRent: {$cond: [{$or: [{$eq: ['$property.currRent', null]}, {$eq: ['$property.currRent', ""]}, {$eq: ['$property.currRent', "null"]}]}, null, '$property.currRent']},
                            category: '$property.category',
                            address_1: '$property.address_1',
                            address_2: '$property.address_2',
                            title: '$property.title',
                            salesMethod: '$property.salesMethod',
                            size: '$property.size',
                            thumbnail: '$property.thumbnail',
                            date: '$reVrTour.date',
                            isConfirmed: '$reVrTour.isConfirmed',
                            isEnabled: '$reVrTour.isEnabled',
                            propertyOwnerName: '$property.owner',
                            vrTourRequester: {
                                'name': '$realEstateAgent.name',
                                'phoneNumber': '$realEstateAgent.phoneNumber',
                                'address': '$realEstateAgent.address_1',
                                'isRealEstateAgent': '$realEstateAgent.isRealEstateAgent'
                            }
                        }
                    }
                ]
            }
        },
        {
            $project: {
                userCount: {$cond: [{$eq: [{$size: '$userCount'}, 0]}, 0, '$userCount.userCount']},
                reCount: {$cond: [{$eq: [{$size: '$reCount'}, 0]}, 0, '$reCount.reCount']},
                vrTourList: {$setUnion: ['$userVrTourList', '$reVrTourList']}
            }
        },
        {
            $unwind: '$userCount'
        },
        {
            $unwind: '$reCount'
        },
        {
            $project: {
                totalCount: {$add: ['$userCount', '$reCount']},
                vrTourList: 1
            }
        },
        {
            $unwind: {
                path: '$vrTourList',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $sort: {'vrTourList.date': -1}
        },
        {
            $skip: skip
        },
        {
            $limit: limit
        },
        {
            $group: {
                _id: '$vrTourList._id',
                totalCount: {$first: '$totalCount'},
                vrTourList: {$push: '$vrTourList'},
            }
        },
        {
            $project: {
                _id: 0,
                totalCount: 1,
                vrTourList: 1
            }
        },

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

async function aprroveVrTour(realEstateAgentUniqueId, vrTourUniqueId, res, isAuto) {

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)
    const realEstateVrTourCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

    const reVrTourResult = await realEstateVrTourCollection.findOne({_id: new objectId(vrTourUniqueId)})

    if(reVrTourResult !== null) {
        realEstateVrTourCollection.aggregate([
            {$match: {_id: new objectId(vrTourUniqueId)}},
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
            $lookup:  {
                from : constants.collection.REAL_ESTATE_AGENT_INFO,
                localField:  'property.realEstateAgentUniqueId',
                foreignField: 'realEstateAgentUniqueId',
                as : "realEstateAgent"
            }
            },
            {
                $unwind: '$realEstateAgent'
            },
            {
                $lookup:  {
                    from : constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField:  'userUniqueId',
                    foreignField: 'realEstateAgentUniqueId',
                    as : "requester"
                }
            },
            {
                $unwind: '$requester'
            },
            {
                $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {

                    if (docs.length > 0) {
                        //해당 중개사의 매물이 맞음

                        let vrTourRequest = docs[0]

                        if(vrTourRequest.isEnabled !== null && vrTourRequest.isEnabled ) {
                            if(isAuto) {
                                return res.sendFile('/public/approved.html', {root : '.'})
                            } else {
                                return res.json({isApproved: false})
                            }
                        }

                        if (vrTourRequest.property.vrTourPath && vrTourRequest.property.vrTourPort) {
                            let vrTourKey = shortid.generate()

                            realEstateVrTourCollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
                                $set: {
                                    isConfirmed: true,
                                    isEnabled: true,
                                    vrTourKey: vrTourKey,
                                    grantedTime: new Date()
                                }
                            })
                                .then(() => {

                                    let requesterUniqueId = vrTourRequest.userUniqueId

                                    linkExpirer.setLink(vrTourKey, requesterUniqueId, vrTourRequest.property.vrTourPath, vrTourRequest.property.vrTourPort, constants.VR_TOUR_LINK_TTL)
                                        .then(() => {


                                            alimtalk.sendAlimTalkToVrTourRequester(vrTourUniqueId, true)
                                        })
                                        .catch(err => {
                                            throw err
                                        })


                                })
                                .catch(e2 => {

                                    throw e2
                                })
                            if (isAuto) {
                                res.sendFile('/public/approveVrTour.html', {root : '.'})
                            } else {
                                res.json({isApproved: true})
                            }


                        } else {
                            if (isAuto) {
                                res.sendFile('/public/failApproveVrTour.html', {root : '.'})
                            } else {
                                res.json({isApproved: false})
                            }

                        }


                    } else {
                        if (isAuto) {
                            res.sendFile('/public/failApproveVrTour.html', {root : '.'})
                        } else {
                            res.json({isApproved: false})
                        }
                    }
                })
                .catch(err => {
                    res.status(500).send()
                    throw err
                })
        })
    } else {
        approveRegVrTour(realEstateAgentUniqueId,vrTourUniqueId, res, isAuto);
    }

}

function approveRegVrTour (realEstateAgentUniqueId,vrTourUniqueId , res, isAuto) {

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)

    vrTourCollection.aggregate([
        {$match: {_id: new objectId(vrTourUniqueId)}},
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
            $lookup:  {
                from : constants.collection.REAL_ESTATE_AGENT_INFO,
                localField:  'property.realEstateAgentUniqueId',
                foreignField: 'realEstateAgentUniqueId',
                as : "realEstateAgent"
            }
        },
        {
            $unwind: '$realEstateAgent'
        },
        {
            $lookup:  {
                from : constants.collection.USER,
                localField:  'userUniqueId',
                foreignField: '_id',
                as : "requester"
            }
        },
        {
            $unwind: '$requester'
        },
        {
            $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
        }
    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {

                if (docs.length > 0) {
                    //해당 중개사의 매물이 맞음

                    let vrTourRequest = docs[0]

                    if(vrTourRequest.isEnabled !== null && vrTourRequest.isEnabled ) {
                        if(isAuto) {
                            return res.sendFile('/public/approved.html', {root : '.'})
                        } else {
                            return  res.json({isApproved: false})
                        }
                    }

                    if (vrTourRequest.property.vrTourPath && vrTourRequest.property.vrTourPort) {
                        let vrTourKey = shortid.generate()

                        vrTourCollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
                            $set: {
                                isConfirmed: true,
                                isEnabled: true,
                                vrTourKey: vrTourKey,
                                grantedTime: new Date()
                            }
                        })
                            .then(() => {

                                let requesterUniqueId = vrTourRequest.userUniqueId

                                linkExpirer.setLink(vrTourKey, requesterUniqueId, vrTourRequest.property.vrTourPath, vrTourRequest.property.vrTourPort, constants.VR_TOUR_LINK_TTL)
                                    .then(() => {


                                        alimtalk.sendAlimTalkToVrTourRequester(vrTourUniqueId)
                                    })
                                    .catch(err => {
                                        throw err
                                    })


                            })
                            .catch(e2 => {

                                throw e2
                            })
                        if (isAuto) {
                            res.sendFile('/public/approveVrTour.html', {root : '.'})
                        } else {
                            res.json({isApproved: true})
                        }


                    } else {
                        if (isAuto) {
                            res.sendFile('/public/failApproveVrTour.html', {root : '.'})
                        } else {
                            res.json({isApproved: false})
                        }

                    }


                } else {
                    if (isAuto) {
                        res.sendFile('/public/failApproveVrTour.html', {root : '.'})
                    } else {
                        res.json({isApproved: false})
                    }
                }
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    })
}

router.post('/approve/vrTour', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    aprroveVrTour(realEstateAgentUniqueId, vrTourUniqueId, res, false);

})

router.post('/cancel/vrTour', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    cancelVrTour(realEstateAgentUniqueId, vrTourUniqueId, res, false)
})

cancelVrTour = async (realEstateAgentUniqueId, vrTourUniqueId, res, isAuto) => {

    try {
        let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)
        const realEstateAgentVrTourCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT);

        const reVrTourResult = await realEstateAgentVrTourCollection.findOne({_id : new objectId(vrTourUniqueId)})
        if(reVrTourResult !== null) {
            realEstateAgentVrTourCollection.aggregate([
                {$match: {_id: new objectId(vrTourUniqueId)}},
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
                    $lookup:  {
                        from : constants.collection.REAL_ESTATE_AGENT_INFO,
                        localField:  'property.realEstateAgentUniqueId',
                        foreignField: 'realEstateAgentUniqueId',
                        as : "realEstateAgent"
                    }
                },
                {
                    $unwind: '$realEstateAgent'
                },
                {
                    $lookup:  {
                        from : constants.collection.REAL_ESTATE_AGENT_INFO,
                        localField:  'userUniqueId',
                        foreignField: 'realEstateAgentUniqueId',
                        as : "requester"
                    }
                },
                {
                    $unwind: '$requester'
                },
                {
                    $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
                }
            ], (err, cursor) => {
                if (err) {
                    res.status(500).send()
                    throw err
                }
                cursor.toArray()
                    .then(docs => {

                        if (docs.length > 0) {
                            //해당 중개사의 매물이 맞음

                            const result = docs[0]

                            if(result.isEnabled !== null && !result.isEnabled ) {
                                if(isAuto) {
                                    return res.sendFile('/public/canceled.html', {root : '.'})
                                } else {
                                    return  res.json({isCanceled: false})
                                }
                            }

                            realEstateAgentVrTourCollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
                                $set: {
                                    grantedTime: null,
                                    isConfirmed: false,
                                    isEnabled: false
                                }
                            }).then(() => {
                                const info = {
                                    receiverPhoneNumber : result.requester.phoneNumber,
                                    reagentCompanyName : result.realEstateAgent.companyName,
                                    reagentPhoneNumber : result.realEstateAgent.phoneNumber,
                                    requesterName : result.requester.ceoName,
                                    propertyTitle : result.property.title
                                }
                                alimtalk.sendResultCancelVrTour(info)
                            })
                            if(isAuto) {
                                res.sendFile('/public/cancelVrTour.html', {root : '.'})
                            } else {
                                res.json({isCanceled: true})
                            }

                        } else {
                            if(isAuto) {
                                res.sendFile('/public/failCancelVrTour.html', {root : '.'})
                            } else {
                                res.json({isCanceled: false})
                            }

                        }
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err
                    })
            })
        } else {
            vrTourCollection.aggregate([
                {$match: {_id: new objectId(vrTourUniqueId)}},
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
                    $lookup:  {
                        from : constants.collection.REAL_ESTATE_AGENT_INFO,
                        localField:  'property.realEstateAgentUniqueId',
                        foreignField: 'realEstateAgentUniqueId',
                        as : "realEstateAgent"
                    }
                },
                {
                    $unwind: '$realEstateAgent'
                },
                {
                    $lookup:  {
                        from : constants.collection.USER,
                        localField:  'userUniqueId',
                        foreignField: '_id',
                        as : "requester"
                    }
                },
                {
                    $unwind: '$requester'
                },
                {
                    $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
                }
            ], (err, cursor) => {
                if (err) {
                    res.status(500).send()
                    throw err
                }

                cursor.toArray()
                    .then(docs => {

                        if (docs.length > 0) {
                            //해당 중개사의 매물이 맞음

                            const result = docs[0]

                            if(result.isEnabled !== null && !result.isEnabled ) {
                                if(isAuto) {
                                    return res.sendFile('/public/canceled.html', {root : '.'})
                                } else {
                                    return  res.json({isCanceled: false})
                                }
                            }

                            vrTourCollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
                                $set: {
                                    grantedTime: null,
                                    isConfirmed: false,
                                    isEnabled: false
                                }
                            }).then(() => {
                                const info = {
                                    receiverPhoneNumber : result.requester.phoneNumber,
                                    reagentCompanyName : result.realEstateAgent.companyName,
                                    reagentPhoneNumber : result.realEstateAgent.phoneNumber,
                                    requesterName : result.requester.name,
                                    propertyTitle : result.property.title
                                }
                                alimtalk.sendResultCancelVrTour(info)
                            })
                            if(isAuto) {
                                res.sendFile('/public/cancelVrTour.html', {root : '.'})
                            } else {
                                res.json({isCanceled: true})
                            }

                        } else {
                            if(isAuto) {
                                res.sendFile('/public/failCancelVrTour.html', {root : '.'})
                            } else {
                                res.json({isCanceled: false})
                            }

                        }
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err
                    })
            })
        }

    } catch (e) {
        throw e
    }


}

router.post('/fetch/inquiry/list', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)
    let getRepliedOnly = req.body.getRepliedOnly

    let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

    inquiryCollection.aggregate([
        {
            $facet: {
                count: [
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
                        $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
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
                        $group: {
                            _id: '$_id',

                            date: {$first: '$date'},
                            inquirerUniqueId: {$first: '$userUniqueId'},
                            title: {$first: '$title'},
                            inquiry: {$first: '$inquiry'},
                            inquiryType: {$first: '$inquiryType'},
                            reply: {$first: '$reply'},

                            inquirer: {$first: '$inquirer'},
                            property: {$first: '$property'}

                        }
                    },
                    {
                        $project: {
                            inquiry: {
                                $cond: [getRepliedOnly,
                                    {
                                        $cond: [{$eq: ['$reply', null]}, null,
                                            {
                                                inquiryUniqueId: '$_id',
                                                date: '$date',
                                                inquirerUniqueId: '$userUniqueId',
                                                title: '$title',
                                                inquiry: '$inquiry',
                                                inquiryType: '$inquiryType',
                                                'replyUniqueId': '$reply._id',
                                                'replyResponderUniqueId': '$reply.responderUniqueId',
                                                'replyTitle': '$reply.title',
                                                'replyMessage': '$reply.message',
                                                userName: '$inquirer.name',
                                                'propertyUniqueId': '$property._id',
                                                'propertyTitle': '$property.title',
                                                'propertyAddress_1': '$property.address_1',
                                                'propertyAddress_2': '$property.address_2'
                                            }
                                        ]
                                    },
                                    {
                                        inquiryUniqueId: '$_id',
                                        date: '$date',
                                        inquirerUniqueId: '$userUniqueId',
                                        title: '$title',
                                        inquiry: '$inquiry',
                                        inquiryType: '$inquiryType',
                                        'replyUniqueId': '$reply._id',
                                        'replyResponderUniqueId': '$reply.responderUniqueId',
                                        'replyTitle': '$reply.title',
                                        'replyMessage': '$reply.message',
                                        userName: '$inquirer.name',
                                        'propertyUniqueId': '$property._id',
                                        'propertyTitle': '$property.title',
                                        'propertyAddress_1': '$property.address_1',
                                        'propertyAddress_2': '$property.address_2'
                                    }
                                ]
                            }
                        }
                    },
                    {$match: {'inquiry': {'$ne': null}}},
                    {
                        $count: 'totalCount'
                    }
                ],
                inquiries: [
                    {
                        $lookup: {
                            from: constants.collection.USER,
                            localField: 'userUniqueId',
                            foreignField: '_id',
                            as: 'inquirer'
                        }
                    },
                    {
                        $unwind: '$inquirer'
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
                    },
                    {
                        $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
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
                        $group: {
                            _id: '$_id',

                            date: {$first: '$date'},
                            inquirerUniqueId: {$first: '$userUniqueId'},
                            title: {$first: '$title'},
                            inquiry: {$first: '$inquiry'},
                            inquiryType: {$first: '$inquiryType'},
                            reply: {$first: '$reply'},

                            inquirer: {$first: '$inquirer'},
                            property: {$first: '$property'}

                        }
                    },
                    {
                        $project: {
                            inquiry: {
                                $cond: [getRepliedOnly,
                                    {
                                        $cond: [{$eq: ['$reply', null]}, null,
                                            {
                                                inquiryUniqueId: '$_id',
                                                date: '$date',
                                                inquirerUniqueId: '$userUniqueId',
                                                title: '$title',
                                                inquiry: '$inquiry',
                                                inquiryType: '$inquiryType',
                                                'replyUniqueId': '$reply._id',
                                                'replyResponderUniqueId': '$reply.responderUniqueId',
                                                'replyTitle': '$reply.title',
                                                'replyMessage': '$reply.message',
                                                userName: '$inquirer.name',
                                                'propertyUniqueId': '$property._id',
                                                'propertyTitle': '$property.title',
                                                'propertyAddress_1': '$property.address_1',
                                                'propertyAddress_2': '$property.address_2'
                                            }
                                        ]
                                    },
                                    {
                                        inquiryUniqueId: '$_id',
                                        date: '$date',
                                        inquirerUniqueId: '$userUniqueId',
                                        title: '$title',
                                        inquiry: '$inquiry',
                                        inquiryType: '$inquiryType',
                                        'replyUniqueId': '$reply._id',
                                        'replyResponderUniqueId': '$reply.responderUniqueId',
                                        'replyTitle': '$reply.title',
                                        'replyMessage': '$reply.message',
                                        userName: '$inquirer.name',
                                        'propertyUniqueId': '$property._id',
                                        'propertyTitle': '$property.title',
                                        'propertyAddress_1': '$property.address_1',
                                        'propertyAddress_2': '$property.address_2'
                                    }
                                ]
                            }
                        }
                    },
                    {$match: {'inquiry': {'$ne': null}}},
                    {
                        $sort: {_id: -1}
                    },
                    {
                        $project:
                            {
                                _id: 0,
                                userName: '$inquiry.userName',
                                inquiryUniqueId: '$inquiry.inquiryUniqueId',
                                date: '$inquiry.date',
                                inquirerUniqueId: '$inquiry.inquirerUniqueId',
                                title: '$inquiry.title',
                                inquiry: '$inquiry.inquiry',
                                inquiryType: '$inquiry.inquiryType',
                                'reply.replyUniqueId': '$inquiry.replyUniqueId',
                                'reply.responderUniqueId': '$inquiry.replyResponderUniqueId',
                                'reply.title': '$inquiry.replyTitle',
                                'reply.message': '$inquiry.replyMessage',
                                'property.propertyUniqueId': '$inquiry.propertyUniqueId',
                                'property.title': '$inquiry.propertyTitle',
                                'property.address_1': '$inquiry.propertyAddress_1',
                                'property.address_2': '$inquiry.propertyAddress_2'
                            }
                    },
                    {
                        $skip: skip
                    },
                    {
                        $limit: limit
                    }
                ]
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

        cursor.toArray()
            .then(docs => {
                let response = {
                    totalCount: 0,
                    inquiries: []
                }

                if (docs.length > 0) {
                    let result = docs[0]
                    response.totalCount = result.count.totalCount
                    response.inquiries = result.inquiries
                }

                res.json(response)
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })
    })
})

router.post('/answer/inquiry', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let inquiryUniqueId = req.body.inquiryUniqueId
    let message = req.body.message

    let inquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_ANSWER)

    let answer = {
        date: new Date(),
        inquiryUniqueId: new objectId(inquiryUniqueId),
        responderUniqueId: new objectId(realEstateAgentUniqueId),
        message: message
    }

    inquiryAnswerCollection.insertOne(answer)
        .then(() => {
            res.json({isAnswered: true})
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

router.post('/modify/reagent/info', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let password = req.body.password
    let licenseNumber = req.body.licenseNumber
    let companyName = req.body.companyName
    let ceoName = req.body.name
    let email = req.body.email
    let address_1 = req.body.address_1
    let address_2 = req.body.address_2
    let phoneNumber = req.body.phoneNumber
    let isSubscribedToMarketingNews = req.body.isSubscribedToMarketingNews

    let userCollection = db.getDb().collection(constants.collection.USER)
    let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

    userCollection.findOneAndUpdate({_id: new objectId(userUniqueId)}, {
        $set: {
            isSubscribedToMarketingNews: isSubscribedToMarketingNews,
            email: email,
            phoneNumber: phoneNumber,
            address_1: address_1,
            address_2: address_2
        }
    })
        .then(() => {
            if (password.length > 0) {
                bcrypt.genSalt(saltRounds, (err, salt) => {
                    if (err) {

                        throw err
                    }

                    bcrypt.hash(password, salt, (e2, hash) => {
                        if (e2) {

                            throw e2
                        }

                        userCollection.findOneAndUpdate({_id: new objectId(userUniqueId)}, {$set: {password: hash}})
                    })
                })
            }

            realEstateInfoCollection.findOneAndUpdate(
                {realEstateAgentUniqueId: new objectId(userUniqueId)},
                {
                    $set: {
                        companyName: companyName, ceoName: ceoName, phoneNumber: phoneNumber, email: email,
                        address_1: address_1, address_2: address_2
                    }
                })

            res.json({isSuccessful: true})

        })
})

router.post('/request/vr/tour', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let vrTourReAgentCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)
    let userCollection = db.getDb().collection(constants.collection.USER)
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    propertyCollection.findOne({
        _id: new objectId(propertyUniqueId),
        realEstateAgentUniqueId: new objectId(userUniqueId)
    })
        .then(property => {
            if (property !== null) {
                let response = {
                    isRequested: false,
                    error: {code: 'R001', message: '소유하고 있는 중개매물입니다.'},
                    isEnabled: property.isEnabled
                }

                res.json(response)
            } else {
                vrTourReAgentCollection.findOne({
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

                            vrTourReAgentCollection.insertOne(obj)
                                .then((insertedResult) => {

                                    propertyCollection.findOne({_id: new objectId(propertyUniqueId)})
                                        .then(property => {
                                            if (property) {
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

                                                                            if (rePhoneNumber.startsWith('0')) {
                                                                                rePhoneNumber = `82${rePhoneNumber.substring(1, rePhoneNumber.length)}`

                                                                            } else {
                                                                                rePhoneNumber = `82${rePhoneNumber}`
                                                                            }

                                                                            if (process.env.NODE_ENV === 'development') {
                                                                                rePhoneNumber = '821035064429'
                                                                            }

                                                                            //let propertyTitle = `${result.title} ${result.dongNumber}동 ${result.hoNumber}호`

                                                                            let propertyTitle = result.title

                                                                            propertyTitle += propertyTitle + (result.dongNumber) ? result.dongNumber + '동' : ''
                                                                            propertyTitle += propertyTitle + (result.hoNumber) ? result.hoNumber + '호' : ''

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
                                                                                            "msg_data": {
                                                                                                "senderid": "0261010909",
                                                                                                "to": rePhoneNumber,
                                                                                                "content": content
                                                                                            },
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
            }
        })
})

router.post('/fetch/vr/tour/detail/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let limit = req.body.limit
    let skip = req.body.skip
    let status = req.body.status

    let vrTourReAgentCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

    let statusObj = {}

    if (status === 'ALL') {
        statusObj = {$match: {$or: [{'property.status.type': {$eq: 'SELLING'}}, {'property.status.type': {$eq: 'CLOSED'}}]}}
    } else {
        statusObj = {$match: {'property.status.type': status}}
    }

    vrTourReAgentCollection.aggregate([
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
                            'property.deposit': {$cond: [{$or: [{$eq: ['$properties.deposit', null]}, {$eq: ['$properties.deposit', ""]}, {$eq: ['$properties.deposit', "null"]}]}, null, '$properties.deposit']},
                            'property.currDeposit': {$cond: [{$or: [{$eq: ['$properties.currDeposit', null]}, {$eq: ['$properties.currDeposit', ""]}, {$eq: ['$properties.currDeposit', "null"]}]}, null, '$properties.currDeposit']},
                            'property.currRent': {$cond: [{$or: [{$eq: ['$properties.currRent', null]}, {$eq: ['$properties.currRent', ""]}, {$eq: ['$properties.currRent', "null"]}]}, null, '$properties.currRent']},
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
                            'property.numOfMonths': {$cond: [{$or: [{$eq: ['$properties.numOfMonths', null]}, {$eq: ['$properties.numOfMonths', ""]}, {$eq: ['$properties.numOfMonths', "null"]}]}, null, '$properties.numOfMonths']},
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

router.post('/fetch/property/appointment/list', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)
    visitAppointmentCollection.aggregate([
        {
            $facet: {
                count: [
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
                        $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
                    },
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
                        $count: 'totalCount'
                    }
                ],
                appointmentList: [
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
                        $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
                    },
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
                        $sort: {_id: -1}
                    },
                    {
                        $project: {
                            _id: 0,
                            appointmentUniqueId: '$_id',
                            propertyUniqueId: '$property._id',
                            appointmentRequester: {
                                'name': '$user.name',
                                'phoneNumber': '$user.phoneNumber',
                                'address': '$user.address_1',
                                'isRealEstateAgent': '$user.isRealEstateAgent'
                            },
                            appointmentDate: '$appointmentDate',
                            price: '$property.price',
                            deposit: {$cond: [{$or: [{$eq: ['$property.deposit', null]}, {$eq: ['$property.deposit', ""]}, {$eq: ['$property.deposit', "null"]}]}, null, '$property.deposit']},
                            currDeposit: {$cond: [{$or: [{$eq: ['$property.currDeposit', null]}, {$eq: ['$property.currDeposit', ""]}, {$eq: ['$property.currDeposit', "null"]}]}, null, '$property.currDeposit']},
                            currRent: {$cond: [{$or: [{$eq: ['$property.currRent', null]}, {$eq: ['$property.currRent', ""]}, {$eq: ['$property.currRent', "null"]}]}, null, '$property.currRent']},
                            category: '$property.category',
                            address_1: '$property.address_1',
                            address_2: '$property.address_2',
                            title: '$property.title',
                            salesMethod: '$property.salesMethod',
                            size: '$property.size',
                            thumbnail: '$thumbnail',
                            isConfirmed: '$isConfirmed',
                            isEnabled: {$cond: [{$or: [{$eq: ['$isEnabled', true]}, {$eq: ['$isEnabled', false]}]}, '$isEnabled', null]},
                            propertyOwnerName: "$property.owner"
                        }
                    },
                    {
                        $skip: skip
                    },
                    {
                        $limit: limit
                    }
                ]
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

        cursor.toArray()
            .then(docs => {
                let response = {
                    totalCount: 0,
                    appointmentList: []
                }

                if (docs.length > 0) {
                    let result = docs[0]

                    response.totalCount = result.count.totalCount
                    response.appointmentList = result.appointmentList
                }

                res.json(response)
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })
    })

})

router.post('/delete/vr/tour', (req, res) => {
    let vrTourUniqueId = req.body.vrTourUniqueId
    let realEstateAgentUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let vrTourReAgentCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

    vrTourReAgentCollection.deleteOne({
        _id: new objectId(vrTourUniqueId),
        userUniqueId: new objectId(realEstateAgentUniqueId),
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

router.post('/request/agreement/sign', (req, res) => {
    let ownerPhoneNumber = req.body.ownerPhoneNumber
    let ownerName = req.body.ownerName
    let propertyUniqueId = req.body.propertyUniqueId
    let realEstateAgentUniqueId = req.body.userUniqueId


    let key = shortid.generate()
    let filename = shortid.generate()

    db.getRedisClient().set(key, filename, 'EX', 1000)

    let scanAgreementCollection = db.getDb().collection(constants.collection.SCAN_AGREEMENT)

    let stream = fs.createWriteStream(`${process.env.AGREEMENT_DOC_HTML_FILE_PATH}/${filename}.html`)
    stream.once('open', (fd) => {


        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
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

                        let reCompanyName = result.agency.companyName
                        let propertyTitle = result.title
                        let urlLink = ''

                        let address = `${result.address_1} ${result.address_2}`

                        let html = htmlBuilder.generateAgreementDoc({
                            ownerName: ownerName,
                            reAgencyCompanyName: reCompanyName,
                            address: address,
                            key: key,
                            filename: filename
                        })
                        stream.end(html)


                        if (process.env.NODE_ENV === 'development') {
                            urlLink = `http://localhost:4000/api/agreement/${key}`
                        } else if (process.env.NODE_ENV === 'production') {
                            urlLink = `https://pspace.ai/api/agreement/${key}`
                        }

                        let info = {
                            reAgencyCompanyName: reCompanyName,
                            propertyTitle: propertyTitle,
                            urlLink: urlLink,
                            ownerPhoneNumber: ownerPhoneNumber
                        }


                        scanAgreementCollection.findOne({
                            propertyUniqueId: new objectId(propertyUniqueId),
                            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)
                        })
                            .then((agreement) => {
                                if (agreement) {
                                    if (!agreement.isSigned) {
                                        scanAgreementCollection.findOneAndUpdate(
                                            {
                                                propertyUniqueId: new objectId(propertyUniqueId),
                                                realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId)
                                            },
                                            {$set: {key: key, filename: filename}}
                                        )
                                            .then(() => {
                                                alimtalk.sendAgreementSignRequest(info)
                                            })


                                    } else {
                                        res.send('이미 서명하였습니다.')
                                    }
                                } else {
                                    alimtalk.sendAgreementSignRequest(info)

                                    let insertDoc = {
                                        propertyUniqueId: new objectId(propertyUniqueId),
                                        realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
                                        key: key,
                                        filename: filename,
                                        isSigned: false,
                                        ownerName: ownerName,
                                        ownerPhoneNumber: ownerPhoneNumber,
                                        requestedDate: new Date()
                                    }

                                    scanAgreementCollection.insertOne(insertDoc)

                                    res.send('OK')
                                }
                            })
                        //res.send('OK')
                    }
                })
        })


    })

})


router.post('/confirm/reservation', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let appointmentUniqueId = req.body.appointmentUniqueId

    confirmReservation(realEstateAgentUniqueId, appointmentUniqueId, res, false)
})

confirmReservation = (realEstateAgentUniqueId, appointmentUniqueId, res, isAuto) => {

    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    visitAppointmentCollection.aggregate([
        {$match: {_id: new objectId(appointmentUniqueId)}},
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
                from: constants.collection.USER,
                localField: 'userUniqueId',
                foreignField: '_id',
                as: 'visitor'
            }
        },
        {
            $unwind: '$visitor'
        },
        {
            $lookup: {
                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                localField: 'property.realEstateAgentUniqueId',
                foreignField: 'realEstateAgentUniqueId',
                as: 'agency'
            }
        },
        {
            $unwind: '$agency'
        },
        {
            $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
        }
    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {

                if (docs.length > 0) {
                    //해당 중개사의 매물이 맞음
                    let result = docs[0]

                    if(result.isEnabled !== undefined && result.isEnabled ) {
                        if(isAuto) {
                            return res.sendFile('/public/approved.html', {root : '.'})
                        } else {
                            return res.json({isConfirmed: false})
                        }
                    }

                    visitAppointmentCollection.findOneAndUpdate({_id: new objectId(appointmentUniqueId)}, {
                        $set: {
                            isConfirmed: true,
                            isEnabled: true
                        }
                    })

                    let info = {
                        title: result.property.title,
                        address: result.property.address_1,
                        companyName: result.agency.companyName,
                        agentPhoneNumber: result.agency.phoneNumber,
                        officeAddress: result.agency.address_1 + ' ' + result.agency.address_2,
                        appointmentDate: result.appointmentDate
                    }

                    alimtalk.sendVisitApproveAlimTalk(info)

                    if(isAuto) {
                        res.sendFile('/public/confirmReservation.html', {root : '.'})
                    } else {
                        res.json({isConfirmed: true})
                    }

                } else {
                    if(isAuto) {
                        res.sendFile('/public/failConfirmReservation.html', {root : '.'})
                    } else {
                        res.json({isConfirmed: false})
                    }

                }
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    })

}

router.post('/cancel/reservation', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let appointmentUniqueId = req.body.appointmentUniqueId

    cancelReservation(realEstateAgentUniqueId,appointmentUniqueId,res,false)
})

cancelReservation = (realEstateAgentUniqueId, appointmentUniqueId, res, isAuto) => {

    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)
    visitAppointmentCollection.aggregate([
        {$match: {_id: new objectId(appointmentUniqueId)}},
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
                localField: 'property.realEstateAgentUniqueId',
                foreignField: 'realEstateAgentUniqueId',
                as: 'realEstateAgent'
            }
        },
        {
            $unwind: '$realEstateAgent'
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
            $match: {'property.realEstateAgentUniqueId': new objectId(realEstateAgentUniqueId)}
        }
    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {

                if (docs.length > 0) {
                    //해당 중개사의 매물이 맞음
                    const result = docs[0]

                    if(result.isEnabled !== undefined && !result.isEnabled ) {
                        if(isAuto) {
                            return res.sendFile('/public/canceled.html', {root : '.'})
                        } else {
                            return  res.json({isCanceled: false})
                        }
                    }

                    visitAppointmentCollection.findOneAndUpdate({_id: new objectId(appointmentUniqueId)}, {
                        $set: {
                            isConfirmed: false,
                            isEnabled: false
                        }
                    })

                    let info = {
                        title: result.property.title,
                        address: result.property.address_1,
                        companyName: result.realEstateAgent.companyName,
                        agentPhoneNumber: result.realEstateAgent.phoneNumber,
                        officeAddress: result.realEstateAgent.address_1 + ' ' + result.realEstateAgent.address_2,
                        appointmentDate: result.appointmentDate
                    }

                    alimtalk.sendVisitCancelAlimTalk(info);


                    if(isAuto) {
                        res.sendFile('/public/cancelReservation.html', {root : '.'})
                    } else {
                        res.json({isCanceled: true})
                    }

                } else {
                    if(isAuto) {
                        res.sendFile('/public/failCancelReservation.html', {root : '.'})
                    } else {
                        res.json({isCanceled: false})
                    }
                }
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    })

}

router.post('/add/new/property', propImageUpload.any(), (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId

    let callback = async (isRealEstate, realEstatePhoneNumber) => {
        if (!isRealEstate) {
            res.json({error: {code: 'RE001', message: '접근권한이 없습니다.'}})

            return
        }

        let kaptCode = req.body.kaptCode

        let price = Number(req.body.price)
        let deposit = req.body.deposit
        let currDeposit = req.body.currDeposit
        let currRent = req.body.currRent

        let principalUser = {
            type: req.body.principalUser,
            value: constants.principalUser[req.body.principalUser]
        }
        let category = {
            type: req.body.category,
            value: constants.category[req.body.category]
        }

        let salesMethod = {
            type: req.body.salesMethod,
            value: constants.salesMethod[req.body.salesMethod]
        }

        let mortgage = {
            type: req.body.mortgage,
            value: constants.mortgage[req.body.mortgage]
        }

        let numberOfRooms = req.body.numberOfRooms
        let numberOfBathrooms = req.body.numberOfBathrooms
        let loft = req.body.loft

        let parkingAvailability = req.body.parkingAvailability
        let totalParkingLotCount = req.body.totalParkingLotCount

        let facingDirection = {
            type: req.body.facingDirection,
            value: constants.facingDirection[req.body.facingDirection]
        }

        let codeHeatNm = {
            type: req.body.codeHeatNm,
            value: constants.codeHeatNm[req.body.codeHeatNm]
        }
        let fuel = {
            type: req.body.fuel,
            value: constants.fuel[req.body.fuel]
        }
        let codeHallNm = {
            type: req.body.codeHallNm,
            value: constants.codeHallNm[req.body.codeHallNm]
        }

        let maintenanceFee = req.body.maintenanceFee
        let note = req.body.note
        let title = req.body.title
        let address_1 = req.body.address_1
        let address_2 = req.body.address_2
        let dongNumber = req.body.dongNumber
        let hoNumber = req.body.hoNumber
        let doroAddress = req.body.doroAddress
        let hoCnt = req.body.hoCnt
        let officetelUse = {
            type: req.body.officetelUse,
            value: constants.officetelUse[req.body.officetelUse]
        }
        let kaptBcompany = req.body.kaptBcompany

        let jsonSize = JSON.parse(req.body.size)

        let size = {
            location: {
                type: jsonSize.location,
                value: constants.height[jsonSize.location]
            },
            floor: jsonSize.floor,
            groundFloor: jsonSize.groundFloor,
            basement: jsonSize.basement,
            totalFloor: jsonSize.totalFloor,
            actualSize: jsonSize.actualSize,
            totalSize: jsonSize.totalSize,
            buildingCoverage: (jsonSize.buildingCoverage !== null) ? parseFloat(jsonSize.buildingCoverage) : null,
            floorAreaRatio: (jsonSize.floorAreaRatio !== null) ? parseFloat(jsonSize.floorAreaRatio) : null,
            siteArea: (jsonSize.siteArea !== null) ? parseFloat(jsonSize.siteArea) : null,
            totalFloorArea: (jsonSize.totalFloorArea !== null) ? parseFloat(jsonSize.totalFloorArea) : null,
        }

        let jsonMoveinDate = JSON.parse(req.body.moveinDate)
        let numOfMonths = req.body.numOfMonths
        let dateOfApproval = req.body.dateOfApproval

        let moveinDate = constants.MOVE_IN_DATE[jsonMoveinDate.type];

        if (jsonMoveinDate.type === constants.MOVE_IN_DATE.DATE.type) {
            if (jsonMoveinDate.end === undefined) {
                moveinDate = {
                    ...moveinDate,
                    start: new Date(jsonMoveinDate.start)
                }
            } else {
                moveinDate = {
                    ...moveinDate,
                    start: new Date(jsonMoveinDate.start),
                    end: new Date(jsonMoveinDate.end)
                }
            }
        }

        let owner = req.body.owner

        let latitude = req.body.latitude
        let longitude = req.body.longitude

        let loc = {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
        }

        let location = (address_1 !== null && address_1 !== undefined) ? address_1.split(/[\s,"]+/) : null

        if (location[0].includes('서울')) {
            location[0] = '서울시'
        }
        let locations = {
            firstArea: location[0],
            secondArea: location[1],
            thirdArea: location[2]
        }

        let thumbnail = ''

        req.files.forEach(file => {
            if (file.fieldname === 'thumbnail') {
                thumbnail = file.filename
            }
        })

        let newProperty = {
            kaptCode: kaptCode,
            price: price,
            deposit: (deposit !== "null") ? deposit : null,
            currDeposit: (currDeposit !== "null") ? currDeposit : null,
            currRent: (currRent !== "null") ? currRent : null,
            title: title,
            principalUser: principalUser,
            category: category,
            salesMethod: salesMethod,
            mortgage: mortgage,
            numberOfRooms: parseInt(numberOfRooms),
            numberOfBathrooms: parseInt(numberOfBathrooms),
            loft: (loft === "true") ? true : false,
            parkingAvailability: (parkingAvailability === "true") ? true : false,
            totalParkingLotCount: (totalParkingLotCount !== "null") ? parseInt(totalParkingLotCount) : null,
            facingDirection: facingDirection,
            codeHeatNm: codeHeatNm,
            fuel: fuel,
            codeHallNm: codeHallNm,
            maintenanceFee: parseInt(maintenanceFee),
            note: note,
            address_1: address_1,
            address_2: address_2,
            dongNumber: (dongNumber !== "null") ? parseInt(dongNumber) : null,
            hoNumber: (hoNumber !== "null") ? parseInt(hoNumber) : null,
            doroAddress: (doroAddress !== "null") ? doroAddress : null,
            hoCnt: (hoCnt !== "null") ? parseInt(hoCnt) : null,
            officetelUse: officetelUse,
            kaptBcompany: (kaptBcompany !== "null") ? kaptBcompany : null,
            size: size,
            moveinDate: moveinDate,
            numOfMonths: (numOfMonths !== "null") ? parseInt(numOfMonths) : null,
            dateOfApproval: (dateOfApproval !== "null") ? dateOfApproval : null,
            owner: (owner !== "null") ? owner : null,
            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
            realEstateAgentPhoneNumber: realEstatePhoneNumber,
            thumbnail: thumbnail,
            status: constants.salesStatus.SELLING,
            latitude: latitude,
            longitude: longitude,
            loc: loc,
            location: locations,
            coordinate: [longitude, latitude],
            isScanFeePaid: false
        }

        newProperty.status.reason = ''

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.findOne({
            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
            title: title,
            address_1: address_1
        })
            .then(property => {
                if (!property) {
                    propertyCollection.insertOne(newProperty)
                        .then(inserted => {
                            let response = {
                                isAdded: true,
                                error: null
                            }

                            let imageCollection = db.getDb().collection(constants.collection.IMAGE)
                            let index = 1
                            req.files.forEach(file => {

                                let filepath = process.env.PROP_IMAGE_PATH + '/' + file.filename

                                if (file.fieldname !== 'thumbnail') {

                                    let imageObject = {
                                        filename: file.filename,
                                        encoding: file.encoding,
                                        mimetype: file.mimetype,
                                        size: file.size,
                                        dimensions: sizeof(filepath),
                                        order: index,
                                        isThumbnail: false,
                                        propertyUniqueId: inserted.insertedId
                                    }

                                    imageCollection.insertOne(imageObject)

                                    index++

                                } else {
                                    let imageObject = {
                                        filename: file.filename,
                                        encoding: file.encoding,
                                        mimetype: file.mimetype,
                                        size: file.size,
                                        dimensions: sizeof(filepath),

                                        isThumbnail: true,
                                        propertyUniqueId: inserted.insertedId
                                    }

                                    imageCollection.insertOne(imageObject)
                                }
                            })

                            res.json(response)
                        })
                        .catch(err => {
                            res.status(500).send()

                            throw err
                        })
                }
            })


    }

    ifRealEstateAgentThenExecute(realEstateAgentUniqueId, callback)

})

router.post('/check/vr/tour', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

    vrTourCollection.findOne({
        userUniqueId: new objectId(userUniqueId),
        propertyUniqueId: new objectId(propertyUniqueId)
    })
        .then(tour => {
            if (tour) {
                let response = {
                    isRequested: true,
                    vrTourKey: (tour.vrTourKey === undefined) ? null : tour.vrTourKey,
                    isExpired: false

                }

                if (tour.grantedTime) {
                    let nowTime = new Date().getTime()
                    let expirationTime = tour.grantedTime.getTime() + (24 * 60 * 60 * 1000)

                    if (expirationTime < nowTime) {
                        response.isExpired = true
                    }
                }

                res.json(response)
            } else {
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

router.post('/search/apartment', (req, res) => {
    let realEstateAgentUniqueId = req.body.userUniqueId
    let keyword = req.body.keyword

    let kaptCollection = db.getDb().collection(constants.collection.KAPT)

    kaptCollection.aggregate([
        {$match: {$or: [{kaptName: {$regex: keyword}}, {kaptAddr: {$regex: keyword}}]}},
        {
            $lookup: {
                from: constants.collection.BUILDING_REGISTRY_PYOJEBU,
                localField: 'doroJuso',
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
                kaptCode: '$kaptCode',
                title: '$kaptName',
                address: '$kaptAddr',
                doroAddress: '$doroJuso',
                buildingCoverage: '$buildingRegistry.bcRat',
                floorAreaRatio: '$buildingRegistry.vlRat',
                hoCnt: '$hoCnt',
                kaptBcompany: '$kaptBcompany'
            }
        },
        {
            $group: {
                _id: '$_id',
                kaptUniqueId: {$first: '$_id'},
                kaptCode: {$first: '$kaptCode'},
                title: {$first: '$title'},
                address: {$first: '$address'},
                doroAddress: {$first: '$doroAddress'},
                buildingCoverage: {$first: '$buildingCoverage'},
                floorAreaRatio: {$first: '$floorAreaRatio'},
                hoCnt: {$first: '$hoCnt'},
                kaptBcompany: {$first: '$kaptBcompany'}
            }
        }
    ], (err, cursor) => {
        if (err) {
            res.status(500).send()
            throw err
        }

        cursor.toArray()
            .then(docs => {
                let result = {}
                if (docs.length > 0) {
                    result = {
                        apartments: docs
                    }
                } else {
                    result = {
                        apartments: []
                    }
                }

                res.json(result)
            })
            .catch(e2 => {
                res.status(500).send()
                throw e2
            })
    })
})

router.get('/autoApproveVrTour/:key', async (req, res) => {
    const redisKey = req.params.key

    let redisCli = db.getRedisClient()

    redisCli.get(`${redisKey}.realEstateAgentUniqueId`, (e, realEstateAgentUniqueId) => {
        if (e) throw e

        redisCli.get(`${redisKey}.vrTourUniqueId`, (e, vrTourUniqueId) => {
            if (e) throw e

            aprroveVrTour(realEstateAgentUniqueId, vrTourUniqueId, res, true);
        })

    })
})

router.get('/autoCancelVrTour/:key', async (req, res) => {
    const redisKey = req.params.key
    let redisCli = db.getRedisClient()

    redisCli.get(`${redisKey}.realEstateAgentUniqueId`, (e, realEstateAgentUniqueId) => {
        if (e) throw e

        redisCli.get(`${redisKey}.vrTourUniqueId`, (e, vrTourUniqueId) => {
            if (e) throw e

            cancelVrTour(realEstateAgentUniqueId, vrTourUniqueId, res, true);
        })

    })
})

router.get('/autoConfirmReservation/:key', async (req, res) => {
    const redisKey = req.params.key

    let redisCli = db.getRedisClient()

    redisCli.get(`${redisKey}.realEstateAgentUniqueId`, (e, realEstateAgentUniqueId) => {
        if (e) throw e

        redisCli.get(`${redisKey}.appointmentUniqueId`, (e, appointmentUniqueId) => {
            if (e) throw e

            confirmReservation(realEstateAgentUniqueId, appointmentUniqueId, res, true);
        })
    })
})

router.get('/autoCancelReservation/:key', async (req, res) => {
    const redisKey = req.params.key

    let redisCli = db.getRedisClient()

    redisCli.get(`${redisKey}.realEstateAgentUniqueId`, (e, realEstateAgentUniqueId) => {
        if (e) throw e

        redisCli.get(`${redisKey}.appointmentUniqueId`, (e, appointmentUniqueId) => {
            if (e) throw e

            cancelReservation(realEstateAgentUniqueId, appointmentUniqueId, res, true);
        })
    })
})

module.exports = router