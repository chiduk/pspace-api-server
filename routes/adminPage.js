let db = require('../config/database')
let express = require('express');
let objectId = require('mongodb').ObjectID;
let router = express.Router();
let constants = require('../util/constants')
let multer = require('multer')
let shortid = require('shortid')
let sizeof = require('image-size')
let bcrypt = require('bcrypt')
let saltRounds = 10
let alimtalk = require('../util/alimtalk')
let linkExpirer = require('../util/setLinkExpiration')

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

router.post('/fetch/visit/list/month', (req, res) => {
    let adminUserUniqueId = req.body.userUniqueId
    let year = req.body.year
    let month = req.body.month

    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    let callback = (isAdmin) => {
        if (!isAdmin) {

            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        visitAppointmentCollection.aggregate([
            {
                $project: {
                    userUniqueId: 1,
                    appointmentDate: 1,
                    realEstateAgentUniqueId: 1,
                    propertyUniqueId: 1,
                    month: {$month: '$appointmentDate'},
                    year: {$year: '$appointmentDate'},
                    day: {$dayOfMonth: '$appointmentDate'}
                }

            },
            {
                $match: {
                    year: parseInt(year),
                    month: parseInt(month)
                }
            },
            {
                $lookup: {
                    from: 'PROPERTY',
                    localField: 'propertyUniqueId',
                    foreignField: '_id',
                    as: 'property'
                }
            },
            {
                $unwind: '$property'
            },

            {
                $group: {
                    _id: {
                        year: {$year: '$appointmentDate'},
                        month: {$month: '$appointmentDate'},
                        day: {$dayOfMonth: '$appointmentDate'}
                    },
                    date: {$first: '$appointmentDate'},
                    count: {$sum: 1},
                    list: {$push: {propertyUniqueId: '$property._id', name: '$property.title', dong: '33동'}}

                }
            },
            {
                $sort: {_id: 1}
            },

            {
                $project: {
                    _id: 0,
                    day: {$dayOfMonth: '$date'},
                    count: 1,
                    list: {$slice: ['$list', 3]}

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

                let response = {
                    appointmentList: docs,
                    error: null
                }

                res.json(response)

            })

        })

    }

    ifAdminThenExecute(adminUserUniqueId, callback)
})

router.post('/fetch/property/top3', (req, res) => {
    let adminUserUniqueId = req.body.userUniqueId

    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    let callback = (isAdmin) => {
        if (!isAdmin) {

            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        propertyCollection.aggregate([
            {$match: {'status.type': constants.property.status.type.SELLING}},
            {
                $lookup: {
                    from: constants.collection.VR_TOUR,
                    localField: '_id',
                    foreignField: 'propertyUniqueId',
                    as: 'vrTour'
                }
            },
            {
                $lookup: {
                    from: constants.collection.VR_TOUR_RE_AGENT,
                    localField: '_id',
                    foreignField: 'propertyUniqueId',
                    as: 'vrReTour'
                }
            },
            {
                $lookup: {
                    from: constants.collection.VISIT_APPOINTMENT,
                    localField: '_id',
                    foreignField: 'propertyUniqueId',
                    as: 'visitAppointment'
                }
            },
            {
                $project: {
                    _id: 1,
                    title: 1,
                    address_1: 1,
                    address_2: 1,
                    size: 1,
                    price: 1,
                    deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                    currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                    currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                    category: 1,
                    salesMethod: 1,
                    vrTourCount: {$size: '$vrTour'}, //Todo: VR Tour 링크 클릭한 수로 변경
                    vrReTourCount: {$size: '$vrReTour'},
                    appointmentCount: {$size: '$visitAppointment'},  //Todo: 승인된 방문예약만 카운트 되게 변경
                    score: {$sum: [{$size: '$vrTour'}, {$size: '$vrReTour'}, {$size: '$visitAppointment'}]}
                }
            },
            {
                $sort: {score: -1}
            },
            {
                $limit: 3
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
                    propertyList: docs,
                    error: null
                }

                res.json(response)
            })
        })
    }


    ifAdminThenExecute(adminUserUniqueId, callback)

})

router.post('/fetch/member/status', (req, res) => {
    let adminUserUniqueId = req.body.userUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {
                $facet: {
                    count: [{$count: 'total'}],
                    male:
                        [
                            {$match: {$or: [{gender: '1'}, {gender: '3'}, {gender: '5'}]}},
                            {
                                $group: {
                                    _id: null,
                                    count: {$sum: 1}
                                }
                            }
                        ],
                    female: [
                        {$match: {$or: [{gender: '2'}, {gender: '4'}, {gender: '6'}]}},
                        {
                            $group: {
                                _id: null,
                                count: {$sum: 1}
                            }
                        }

                    ],
                    byAge: [
                        {
                            $project: {
                                convertedDate: {
                                    $dateFromString: {
                                        dateString: '$birthDate',
                                        format: '%Y%m%d'
                                    }
                                }
                            }
                        },
                        {
                            $project: {
                                birthYear: {$year: '$convertedDate'},
                                birthMonth: {$month: '$convertedDate'}
                            }
                        },
                        {
                            $project: {
                                age: {$subtract: [2021, '$birthYear']}
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    $concat: [

                                        {$cond: [{$and: [{$gte: ["$age", 20]}, {"$lt": ["$age", 30]}]}, "twenties", ""]},
                                        {$cond: [{$and: [{$gte: ["$age", 30]}, {"$lt": ["$age", 40]}]}, "thirties", ""]},
                                        {$cond: [{$and: [{$gte: ["$age", 40]}, {"$lt": ["$age", 50]}]}, "forties", ""]},
                                        {$cond: [{$and: [{$gte: ["$age", 50]}, {"$lt": ["$age", 60]}]}, "fifties", ""]},
                                        {$cond: [{$and: [{$gte: ["$age", 60]}, {"$lt": ["$age", 70]}]}, "sixties", ""]},
                                        {$cond: [{$gte: ["$age", 70]}, "over_seventies", ""]}
                                    ]
                                },
                                "count": {"$sum": 1}
                            }
                        }
                    ]
                }
            },
            {
                $unwind: '$count'
            },
            {
                $unwind: '$male'
            },
            {
                $unwind: '$female'
            }
        ], (err, cursor) => {
            if (err) {

                throw err
            }

            cursor.toArray((e2, docs) => {
                if (e2) {

                    throw e2
                }

                console.log(docs)

                if (docs.length > 0) {
                    let status = docs[0]

                    let response = {
                        members: {
                            total: status.count.total,
                            byGender: {
                                male: status.male.count,
                                female: status.female.count
                            },
                            byAge: {}
                        },
                        error: null

                    }

                    status.byAge.forEach(elem => {


                        response.members.byAge[elem._id] = elem.count
                    })

                    if (!response.members.byAge.hasOwnProperty('twenties')) {
                        response.members.byAge['twenties'] = 0
                    }

                    if (!response.members.byAge.hasOwnProperty('thirties')) {
                        response.members.byAge['thirties'] = 0
                    }

                    if (!response.members.byAge.hasOwnProperty('forties')) {
                        response.members.byAge['forties'] = 0
                    }

                    if (!response.members.byAge.hasOwnProperty('fifties')) {
                        response.members.byAge['fifties'] = 0
                    }

                    if (!response.members.byAge.hasOwnProperty('sixties')) {
                        response.members.byAge['sixties'] = 0
                    }

                    if (!response.members.byAge.hasOwnProperty('over_seventies')) {
                        response.members.byAge['over_seventies'] = 0
                    }


                    res.json(response)
                }


            })
        })
    }

    ifAdminThenExecute(adminUserUniqueId, callback)
})


router.post('/fetch/graph/data', async (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let year = req.body.year
    let month = req.body.month
    let day = req.body.day

    let today = new Date()
    today.setFullYear(year)
    today.setMonth(parseInt(month) - 1)
    today.setDate(day)

    today.setHours(23, 59, 59, 999)


    let websiteVisitors = []
    let vrTourRegUsers = []
    let vrTourREAgents = []
    let visitAppointments = []


    let callback = async (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let websiteVisitCollection = db.getDb().collection(constants.collection.WEBSITE_VISITOR)
        let vrTourRegUserCollection = db.getDb().collection(constants.collection.VR_TOUR)
        let vrTourREAgentCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)
        let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

        let today = new Date()

        let websiteVisitorCount = () => {
            return new Promise((resolve, reject) => {
                websiteVisitCollection.aggregate([
                    {
                        $match:
                            {
                                $and: [
                                    {visitDateTime: {$gte: new Date(new Date().getTime() - 5 * 24 * 3600 * 1000)}},
                                    {visitDateTime: {$lte: new Date()}}
                                ]
                            }
                    },
                    {
                        $group: {
                            _id: {
                                year: {$year: '$visitDateTime'},
                                month: {$month: '$visitDateTime'},
                                day: {$dayOfMonth: '$visitDateTime'}
                            },
                            count: {$sum: 1}

                        }
                    },
                    {
                        $sort: {_id: 1}
                    }

                ], (err, cursor) => {
                    if (err) {
                        res.status(500).send()

                        reject(err)
                        throw err
                    }

                    cursor.toArray()
                        .then(docs => {


                            docs.forEach(elem => {
                                let data = {
                                    date: elem._id,
                                    count: elem.count
                                }

                                websiteVisitors.push(data)
                            })

                            return resolve('OK')

                        })
                        .catch(e2 => {
                            res.status(500).send()
                            reject(e2)
                            throw e2
                        })
                })
            })

        }

        let vrTourRegUserCount = () => {
            return new Promise((resolve, reject) => {
                vrTourRegUserCollection.aggregate([
                    {
                        $match:
                            {
                                $and: [
                                    {grantedTime: {$gte: new Date(new Date().getTime() - 5 * 24 * 3600 * 1000)}},
                                    {grantedTime: {$lte: new Date()}}
                                ]
                            }
                    },
                    {
                        $group: {
                            _id: {
                                year: {$year: '$grantedTime'},
                                month: {$month: '$grantedTime'},
                                day: {$dayOfMonth: '$grantedTime'}
                            },
                            count: {$sum: 1}

                        }
                    },
                    {
                        $sort: {_id: 1}
                    }
                ], (err, cursor) => {
                    if (err) {
                        res.status(500).send()
                        reject(err)
                        throw err
                    }

                    cursor.toArray()
                        .then(docs => {
                            docs.forEach(doc => {
                                let obj = {
                                    date: doc._id,
                                    count: doc.count
                                }

                                vrTourRegUsers.push(obj)
                            })

                            return resolve('OK')
                        })
                        .catch(e2 => {
                            res.status(500).send()
                            reject(e2)
                            throw e2
                        })

                })
            })

        }

        let vrTourREAgentCount = () => {
            return new Promise((resolve, reject) => {
                vrTourREAgentCollection.aggregate([
                    {
                        $match:
                            {
                                $and: [
                                    {grantedTime: {$gte: new Date(new Date().getTime() - 5 * 24 * 3600 * 1000)}},
                                    {grantedTime: {$lte: new Date()}}
                                ]
                            }
                    },
                    {
                        $group: {
                            _id: {
                                year: {$year: '$grantedTime'},
                                month: {$month: '$grantedTime'},
                                day: {$dayOfMonth: '$grantedTime'}
                            },
                            count: {$sum: 1}

                        }
                    },
                    {
                        $sort: {_id: 1}
                    }
                ], (err, cursor) => {
                    if (err) {
                        res.status(500).send()
                        reject(err)
                        throw err
                    }

                    cursor.toArray()
                        .then(docs => {
                            docs.forEach(doc => {
                                let obj = {
                                    date: doc._id,
                                    count: doc.count
                                }

                                vrTourREAgents.push(obj)


                            })

                            return resolve('OK')
                        })
                        .catch(e2 => {
                            res.status(500).send()
                            reject(e2)
                            throw e2
                        })
                })
            })
        }


        let visitCount = () => {
            return new Promise((resolve, reject) => {
                visitAppointmentCollection.aggregate([
                    {
                        $match:
                            {
                                $and: [
                                    {appointmentDate: {$gte: new Date(new Date().getTime() - 5 * 24 * 3600 * 1000)}},
                                    {appointmentDate: {$lte: new Date()}}
                                ]
                            }
                    },
                    {
                        $group: {
                            _id: {
                                year: {$year: '$appointmentDate'},
                                month: {$month: '$appointmentDate'},
                                day: {$dayOfMonth: '$appointmentDate'}
                            },
                            count: {$sum: 1}

                        }
                    },
                    {
                        $sort: {_id: 1}
                    }
                ], (err, cursor) => {
                    if (err) {
                        res.status(500).send()
                        reject(err)
                        throw err
                    }

                    cursor.toArray()
                        .then(docs => {
                            docs.forEach(doc => {
                                let obj = {
                                    date: doc._id,
                                    count: doc.count
                                }

                                visitAppointments.push(obj)
                            })

                            return resolve('OK')
                        })
                        .catch(e2 => {
                            res.status(500).send()
                            reject(e2)
                            throw e2
                        })
                })

            })
        }


        await websiteVisitorCount()
        await vrTourRegUserCount()
        await vrTourREAgentCount()
        await visitCount()

        let vrTours = []

        vrTourRegUsers.forEach(tour => {
            let filteredArr = vrTourREAgents.filter(x => (x.date.year === tour.date.year && x.date.month === tour.date.month && x.date.day === tour.date.day))

            if (filteredArr.length > 0) {
                let totalCount = tour.count + filteredArr[0].count

                let obj = {
                    date: tour.date,
                    count: totalCount
                }

                vrTours.push(obj)
            } else {
                vrTours.push(tour)
            }

        })

        vrTourREAgents.forEach(tour => {
            let filteredArr = vrTours.filter(x => (x.date.year === tour.date.year && x.date.month === tour.date.month && x.date.day === tour.date.day))

            if (filteredArr.length === 0) {
                vrTours.push(tour)
            }
        })


        let response = {
            data: {
                websiteVisitors,
                vrTours,
                visitAppointments
            },

            error: null
        }

        res.json(response)
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/prop/reservation/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let orderBy = req.body.orderBy.toString().trim()
    let skip = req.body.skip
    let limit = req.body.limit

    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)
    let query = []

    if (orderBy.localeCompare(constants.PROPERTY_RESERVATION_LIST_ORDER_BY.RECENT_RESERVATION) === 0) { //최근예약순
        query = [
            {$sort: {_id: -1}},
            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'userUniqueId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: {
                    path: '$user',
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
                $unwind: '$property'
            },


            // {
            //     $project: {
            //         visitAppointmentUniqueId: '$_id',
            //         userUniqueId: 1,
            //         propertyUniqueId: 1,
            //         appointmentDate: 1,
            //         realEstateAgentUniqueId: 1,
            //         isConfirmed: 1,
            //         user: 1,
            //         property: 1,
            //         visitorName: 1
            //     }
            //
            //
            // },
            {$sort: {'visitAppointmentUniqueId': -1}},

            {
                $group: {
                    _id: '$propertyUniqueId',
                    visitAppointmentUniqueId: {$first: '$_id'},
                    propertyUniqueId: {$first: '$propertyUniqueId'},
                    propertyTitle: {$first: '$property.title'},
                    address_2: {$first: '$property.address_2'},
                    category: {$first: '$property.category'},
                    size: {$first: '$property.size'},
                    salesMethod: {$first: '$property.salesMethod'},
                    price: {$first: '$property.price'},
                    deposit: {$first: '$property.deposit'},
                    currDeposit: {$first: '$property.currDeposit'},
                    currRent: {$first: '$property.currRent'},
                    reservations: {
                        $push: {
                            appointmentDate: '$appointmentDate',
                            userName: {$ifNull: ['$user.name', '$visitorName']}
                        }
                    },
                    thumbnail: {$first: '$property.thumbnail'}
                }
            },
            {$sort: {'visitAppointmentUniqueId': -1}},
            {
                $skip: parseInt(skip)
            },
            {
                $limit: parseInt(limit)
            }

        ]
    } else if (orderBy.localeCompare(constants.PROPERTY_RESERVATION_LIST_ORDER_BY.RECENT_ADDED) === 0) { //최신매물순
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
                $unwind: {
                    path: '$user',
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
                $unwind: '$property'
            },
            {
                $group: {
                    _id: '$propertyUniqueId',
                    visitAppointmentUniqueId: {$first: '$_id'},
                    propertyUniqueId: {$first: '$propertyUniqueId'},
                    propertyTitle: {$first: '$property.title'},
                    address_2: {$first: '$property.address_2'},
                    category: {$first: '$property.category'},
                    size: {$first: '$property.size'},
                    salesMethod: {$first: '$property.salesMethod'},
                    price: {$first: '$property.price'},
                    deposit: {$first: '$property.deposit'},
                    currDeposit: {$first: '$property.currDeposit'},
                    currRent: {$first: '$property.currRent'},
                    reservations: {
                        $push: {
                            appointmentDate: '$appointmentDate',
                            userName: {$ifNull: ['$user.name', '$visitorName']}
                        }
                    },
                    thumbnail: {$first: '$property.thumbnail'}
                }
            },
            {$sort: {_id: -1}},
            {
                $skip: parseInt(skip)
            },
            {
                $limit: parseInt(limit)
            }
        ]
    } else { //최다예약순
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
                $unwind: {
                    path: '$user',
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
                $unwind: '$property'
            },
            {
                $group: {
                    _id: '$propertyUniqueId',
                    visitAppointmentUniqueId: {$first: '$_id'},
                    propertyUniqueId: {$first: '$propertyUniqueId'},
                    propertyTitle: {$first: '$property.title'},
                    address_2: {$first: '$property.address_2'},
                    category: {$first: '$property.category'},
                    size: {$first: '$property.size'},
                    salesMethod: {$first: '$property.salesMethod'},
                    price: {$first: '$property.price'},
                    deposit: {$first: '$property.deposit'},
                    currDeposit: {$first: '$property.currDeposit'},
                    currRent: {$first: '$property.currRent'},
                    reservations: {
                        $push: {
                            appointmentDate: '$appointmentDate',
                            userName: {$ifNull: ['$user.name', '$visitorName']}
                        }
                    },
                    thumbnail: {$first: '$property.thumbnail'},
                    count: {$sum: 1}
                }
            },
            {$sort: {count: -1, _id: -1}},
            {
                $skip: parseInt(skip)
            },
            {
                $limit: parseInt(limit)
            }

        ]
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }


        visitAppointmentCollection.aggregate(
            [
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
                                $group: {
                                    _id: '$propertyUniqueId',

                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    totalCount: {$sum: 1}
                                }
                            }],
                        list: query
                    }
                },
                {
                    $unwind: '$count'
                }

            ], (err, cursor) => {
                if (err) {

                    throw err
                }

                cursor.toArray((e2, docs) => {
                    if (e2) {
                        res.status(500).send()
                        throw e2
                    }

                    let response = {
                        totalCount: 0,
                        reservationList: [],
                        error: null
                    }

                    if (docs.length > 0) {
                        response.totalCount = docs[0].count.totalCount
                        response.reservationList = docs[0].list
                    }

                    res.json(response)


                })
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/alerts', (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let alertCollection = db.getDb().collection(constants.collection.ALERT_ADMIN)

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        alertCollection.find().sort({_id: -1}).limit(10).toArray()
            .then(alerts => {
                let response = {
                    alerts: [],
                    error: null
                }

                alerts.forEach(alert => {
                    let obj = {
                        alertUniqueId: alert._id,
                        alertType: alert.alertType,
                        message: alert.message
                    }

                    response.alerts.push(obj)
                })

                res.json(response)

            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/vr/tour/reg/user', (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let vrTourRegUserCollection = db.getDb().collection(constants.collection.VR_TOUR)
        vrTourRegUserCollection.aggregate([
            {$sort: {_id: -1}},
            {$limit: 10},
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
                    vrTourList: [],
                    error: null
                }

                docs.forEach(doc => {
                    let obj = {
                        vrTourUniqueId: doc._id,
                        name: doc.user.name,
                        propertyName: doc.property.title
                    }

                    response.vrTourList.push(obj)
                })

                res.json(response)
            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})


router.post('/fetch/vr/tour/re/agent', (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let vrTourRegUserCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)
        vrTourRegUserCollection.aggregate([
            {$sort: {_id: -1}},
            {$limit: 10},
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
                    vrTourList: [],
                    error: null
                }

                docs.forEach(doc => {
                    let obj = {
                        vrTourUniqueId: doc._id,
                        name: doc.user.name,
                        propertyName: doc.property.title
                    }

                    response.vrTourList.push(obj)
                })

                res.json(response)
            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/inquiries', (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

        inquiryCollection.find().sort({_id: -1}).limit(10).toArray()
            .then(inquiries => {
                let response = {
                    inquiryList: [],
                    error: null
                }

                inquiries.forEach(inquiry => {
                    let obj = {
                        inquiryUniqueId: inquiry._id,
                        title: inquiry.title
                    }

                    response.inquiryList.push(obj)
                })

                res.json(response)
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/reservation/prop', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

        visitAppointmentCollection.aggregate([
            {
                $facet: {
                    property: [
                        {$match: {propertyUniqueId: new objectId(propertyUniqueId)}},
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
                                localField: 'property.realEstateAgentUniqueId',
                                foreignField: '_id',
                                as: 'realEstateAgent'
                            }
                        },
                        {
                            $unwind: '$realEstateAgent'
                        },
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'realEstateAgent._id',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'officeInfo'
                            }

                        },
                        {
                            $unwind: '$officeInfo'
                        },
                        {
                            $group: {
                                _id: '$propertyUniqueId',
                                property: {$first: '$property'},
                                realEstateAgent: {$first: '$realEstateAgent'},
                                officeInfo: {$first: '$officeInfo'}
                            }
                        }
                    ],
                    reservations: [
                        {$match: {propertyUniqueId: new objectId(propertyUniqueId)}},
                        {
                            $lookup: {
                                from: constants.collection.USER,
                                localField: 'userUniqueId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        {
                            $unwind: {
                                path: '$user',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    year: {$year: '$appointmentDate'},
                                    month: {$month: '$appointmentDate'},
                                    day: {$dayOfMonth: '$appointmentDate'}
                                },
                                appointment: {
                                    $push: {
                                        appointmentUniqueId: '$_id',
                                        appointmentDate: '$appointmentDate',
                                        visitorUniqueId: {$ifNull: ['$user._id', undefined]},
                                        name: {$ifNull: ['$user.name', '$visitorName']},
                                        gender: {$ifNull: ['$user.gender', undefined]},
                                        phoneNumber: {$ifNull: ['$user.phoneNumber', '$visitorPhoneNumber']},
                                        isRealEstateAgent: {$ifNull: ['$user.isRealEstateAgent', undefined]},
                                        address_1: {$ifNull: ['$user.address_1', '$visitorAddress_1']},
                                        address_2: {$ifNull: ['$user.address_2', '$visitorAddress_2']},
                                        isConfirmed: '$isConfirmed',
                                        isEnabled: '$isEnabled'
                                    }
                                }
                            }
                        },
                        {
                            $sort: {
                                _id: -1
                            }
                        },
                        {
                            $skip: parseInt(skip)
                        },
                        {
                            $limit: parseInt(limit)
                        }

                    ]

                }

            },
            {
                $unwind: '$property'
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
                    property: {},
                    reservations: []
                }

                if (docs.length > 0) {
                    response.property = docs[0].property.property
                    response.property.owner = docs[0].property.property.owner
                    response.property.realEstateAgent = {
                        company: docs[0].property.officeInfo.companyName,
                        name: docs[0].property.realEstateAgent.name
                    }


                    docs[0].reservations.forEach(doc => {

                        let tempArr = []

                        doc.appointment.forEach(appointment => {
                            tempArr.push(appointment)
                        })

                        response.reservations.push(tempArr)
                    })
                }

                res.json(response)

            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/confirm/reservation', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let appointmentUniqueId = req.body.appointmentUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

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
                        res.json({isConfirmed: true})

                    } else {

                        res.json({isConfirmed: false})


                    }
                })
                .catch(err => {
                    res.status(500).send()
                    throw err
                })
        })
    }
    ifAdminThenExecute(adminUniqueId, callback)

})


router.post('/cancel/reservation', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let appointmentUniqueId = req.body.appointmentUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

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
                        res.json({isCanceled: true})
                    } else {
                        res.json({isCanceled: false})
                    }
                })
                .catch(err => {
                    res.status(500).send()
                    throw err
                })
        })
    }
    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/reservation/date', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let year = req.body.year
    let month = req.body.month
    let day = req.body.day
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let appointmentDateStart = new Date()

        appointmentDateStart.setFullYear(year)
        appointmentDateStart.setMonth(month - 1)
        appointmentDateStart.setDate(day)
        appointmentDateStart.setHours(0, 0, 0, 0)

        let appointmentDateEnd = new Date()
        appointmentDateEnd.setFullYear(year)
        appointmentDateEnd.setMonth(month - 1)
        appointmentDateEnd.setDate(day)
        appointmentDateEnd.setHours(23, 59, 59, 999)

        let visitAppointCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

        visitAppointCollection.aggregate([
            {$match: {$and: [{appointmentDate: {$gte: appointmentDateStart}}, {appointmentDate: {$lte: appointmentDateEnd}}]}},
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
                    as: 'user'
                }
            },
            {
                $unwind: {
                    path: '$user',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: {
                        year: {$year: '$appointmentDate'},
                        month: {$month: '$appointmentDate'},
                        day: {$dayOfMonth: '$appointmentDate'},
                        hour: {$hour: '$appointmentDate'}

                    },
                    appointments: {
                        $addToSet: {
                            appointmentUniqueId: '$_id',
                            propertyUniqueId: '$property._id',
                            appointmentDate: '$appointmentDate',
                            title: '$property.title',
                            address_2: '$property.address_2',
                            salesMethod: '$property.salesMethod',
                            price: '$property.price',
                            deposit: '$property.deposit',
                            currDeposit: '$property.currDeposit',
                            currRent: '$property.currRent',
                            size: '$property.size',
                            visitorUniqueId: {$ifNull: ['$user._id', null]},
                            name: {$ifNull: ['$user.name', '$visitorName']},
                            isConfirmed: '$isConfirmed',
                            isEnabled: '$isEnabled'
                        }
                    }
                }
            },
            {
                $sort: {'_id.hour': 1}
            },
            {
                $skip: parseInt(skip)
            },
            {
                $limit: parseInt(limit)
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
                    reservations: [],
                    error: null
                }
                docs.forEach(doc => {
                    let dateTime = new Date()
                    dateTime.setUTCFullYear(doc._id.year)
                    dateTime.setUTCMonth(doc._id.month - 1)
                    dateTime.setUTCDate(doc._id.day)
                    dateTime.setUTCHours(doc._id.hour, 0, 0, 0)

                    let obj = {
                        dateTime: dateTime,
                        appointments: doc.appointments
                    }
                    response.reservations.push(obj)
                })

                res.json(response)
            })
        })


    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/visitor/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let sortingOrder = req.body.sortingOrder
    let orderBy = req.body.orderBy
    let visitorType = req.body.visitorType
    let skip = req.body.skip
    let limit = req.body.limit

    let orderByObj = {
        $sort: {_id: -1}
    }

    if (orderBy === 'DEFAULT') {
        orderByObj = {
            $sort: {_id: -1}
        }
    } else if (orderBy === 'GENDER') {
        orderByObj = {
            $sort: {gender: parseInt(sortingOrder)}
        }
    } else if (orderBy === 'NAME') {
        orderByObj = {
            $sort: {name: parseInt(sortingOrder)}
        }
    } else if (orderBy === 'TOTAL_APPOINTMENT_COUNT') {
        orderByObj = {
            $sort: {totalAppointmentCount: parseInt(sortingOrder)}
        }
    }


    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        if (visitorType === "1") { //회원 예약 리스트
            getMemberVisitorList(orderByObj, skip, limit, res)
        } else if (visitorType === "2") { //비회원예약 리스트
            getNonmebmerVisitorList(orderByObj, skip, limit, res)
        } else {
            res.json([])
        }
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

let getMemberVisitorList = (orderBy, skip, limit, res) => {
    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    visitAppointmentCollection.aggregate([
        {
            $facet: {
                count: [
                    {$match: {userUniqueId: {$ne: null}}},
                    {
                        $lookup: {
                            from: 'PROPERTY',
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
                            from: 'USER',
                            localField: 'userUniqueId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $unwind: '$user'
                    },
                    {$count: 'totalCount'}
                ],
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
                        $unwind: '$property'
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
                        $group: {
                            _id: '$userUniqueId',
                            count: {$sum: 1},
                            appointments: {
                                $addToSet: {
                                    appointmentUniqueId: '$_id',
                                    userUniqueId: '$userUniqueId',
                                    user: '$user',
                                    property: '$property'
                                }
                            },
                        }
                    },
                    {
                        $unwind: '$appointments'
                    },
                    {
                        $group: {
                            _id: '$appointments.appointmentUniqueId',
                            count: {$first: '$count'},
                            userUniqueId: {$first: '$appointments.userUniqueId'},
                            user: {$first: '$appointments.user'},
                            property: {$first: '$appointments.property'}

                        }
                    },
                    {
                        $project: {
                            appointmentUniqueId: '$_id',
                            propertyUniqueId: '$property._id',
                            visitorUniqueId: '$user._id',
                            title: '$property.title',
                            category: '$property.category',
                            address_2: '$property.address_2',
                            salesMethod: '$property.salesMethod',
                            price: '$property.price',
                            deposit: '$property.deposit',
                            currDeposit: '$property.currDeposit',
                            currRent: '$property.currRent',
                            size: '$property.size',
                            name: '$user.name',
                            gender: '$user.gender',
                            totalAppointmentCount: '$count'
                        }
                    },
                    orderBy,
                    {
                        $skip: parseInt(skip)
                    },
                    {
                        $limit: parseInt(limit)
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

        cursor.toArray((e2, docs) => {
            if (e2) {

                throw e2
            }

            let response = {
                totalCount: 0,
                reservations: [],
                error: null
            }


            if (docs.length > 0) {
                let result = docs[0]

                response.totalCount = result.count.totalCount
                response.reservations = result.list
            }


            res.json(response)
        })
    })
}

let getNonmebmerVisitorList = (orderBy, skip, limit, res) => {
    let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

    visitAppointmentCollection.aggregate([
        {
            $facet: {
                count: [
                    {$match: {userUniqueId: {$eq: null}}},
                    {$count: 'totalCount'}
                ],
                list: [
                    {$match: {userUniqueId: {$eq: null}}},
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
                        $project: {
                            appointmentUniqueId: '$_id',
                            propertyUniqueId: '$property._id',
                            visitorUniqueId: null,
                            title: '$property.title',
                            category: '$property.category',
                            address_2: '$property.address_2',
                            salesMethod: '$property.salesMethod',
                            price: '$property.price',
                            size: '$property.size',
                            name: '$visitorName',
                            gender: null

                        }
                    },
                    {
                        $set: {totalAppointmentCount: 1}
                    },
                    orderBy,
                    {
                        $skip: parseInt(skip)
                    },
                    {
                        $limit: parseInt(limit)
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

        cursor.toArray((e2, docs) => {
            if (e2) {
                res.status(500).send()
                throw e2
            }

            let response = {
                totalCount: 0,
                reservations: [],
                error: null
            }


            if (docs.length > 0) {
                let result = docs[0]

                response.totalCount = result.count.totalCount
                response.reservations = result.list
            }


            res.json(response)
        })
    })
}

router.post('/fetch/visitor/appointments', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let visitorUniqueId = req.body.visitorUniqueId
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {
                $facet: {
                    user: [
                        {$match: {_id: new objectId(visitorUniqueId)}},
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: '_id',
                                foreignField: 'realEstateAgentUniqueId',
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
                            $project: {
                                userUniqueId: '$_id',
                                name: 1,
                                email: 1,
                                gender: 1,
                                birthDate: {$ifNull: ["$birthDate", null]},
                                phoneNumber: 1,
                                isRealEstateAgent: 1,
                                address_1: 1,
                                address_2: 1,
                                companyName: {$ifNull: ['$realEstateAgent.companyName', null]}
                            }
                        }
                    ],
                    reservations: [
                        {$match: {_id: new objectId(visitorUniqueId)}},

                        {
                            $lookup: {
                                from: constants.collection.VISIT_APPOINTMENT,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'appointment'
                            }
                        },
                        {
                            $unwind: '$appointment'
                        },

                        {
                            $sort: {'appointment.appointmentDate': 1}
                        },
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'appointment.propertyUniqueId',
                                foreignField: '_id',
                                as: 'property'
                            }

                        },
                        {
                            $unwind: '$property'
                        },
                        {
                            $group: {
                                _id: {
                                    year: {$year: '$appointment.appointmentDate'},
                                    month: {$month: '$appointment.appointmentDate'},
                                    day: {$dayOfMonth: '$appointment.appointmentDate'}
                                },
                                list: {
                                    $push: {
                                        appointmentUniqueId: '$appointment._id',
                                        appointmentDate: '$appointment.appointmentDate',
                                        propertyUniqueId: '$property._id',
                                        name: '$name',
                                        gender: '$gender',
                                        phoneNumber: '$phoneNumber',
                                        title: '$property.title',
                                        address_1: '$property.address_1',
                                        address_2: '$property.address_2',
                                        category: '$property.category',
                                        salesMethod: '$property.salesMethod',
                                        price: '$property.price',
                                        deposit: '$property.deposit',
                                        currDeposit: '$property.currDeposit',
                                        currRent: '$property.currRent',
                                        size: '$property.size',
                                        isConfirmed: '$appointment.isConfirmed',
                                        isEnabled: '$appointment.isEnabled'
                                    }
                                }
                            }
                        },
                        {
                            $sort: {_id: 1}
                        },
                        {
                            $skip: parseInt(skip)
                        },
                        {
                            $limit: parseInt(limit)
                        }
                    ]
                }
            },
            {
                $unwind: '$user'
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
                    user: {},
                    reservations: [],
                    error: null
                }

                if (docs.length > 0) {
                    let result = docs[0]

                    response.user = result.user
                    // response.reservations.push(result.reservations.list)

                    result.reservations.forEach(reservation => {
                        response.reservations.push(reservation.list)
                    })
                }

                res.json(response)


            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/search/member', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let keyword = req.body.keyword
    let keywords = keyword.split(/[\s,"]+/);

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let inArray = [];

        keywords.forEach(word => {
            let regex = new RegExp([word].join(''), 'i');
            inArray.push(regex)
        });

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {
                $match: {$or: [{name: {$in: inArray}}, {email: {$in: inArray}}, {phoneNumber: {$in: inArray}}]}
            },
            {
                $sort: {_id: -1}
            },
            {
                $project: {
                    userUniqueId: '$_id',
                    name: 1,
                    gender: 1,
                    phoneNumber: 1,
                    email: 1,
                    address_1: 1,
                    address_2: 1
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray((e2, docs) => {
                let response = {
                    members: docs,
                    error: null
                }

                res.json(response)


            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/search/property', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let keyword = req.body.keyword
    let keywords = keyword.split(/[\s,"]+/);

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let inArray = [];

        keywords.forEach(word => {
            let regex = new RegExp([word].join(''), 'i');
            inArray.push(regex)
        });


        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.aggregate([
            {
                $match: {$or: [{title: {$in: inArray}}, {address_1: {$in: inArray}}]}
            },
            {
                $sort: {_id: -1}
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
                $unwind: '$realEstateAgent'
            },
            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: 'realEstateAgent._id',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'realEstateAgentInfo'
                }
            },
            {
                $unwind: '$realEstateAgentInfo'
            },
            {
                $project: {
                    propertyUniqueId: '$_id',
                    title: 1,
                    address_1: 1,
                    address_2: 1,
                    salesMethod: 1,
                    category: 1,
                    price: 1,
                    deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                    currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                    currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                    size: 1,
                    owner: 1,
                    'realEstateAgent.realEstateAgentUniqueId': '$realEstateAgent._id',
                    'realEstateAgent.name': '$realEstateAgent.name',
                    'realEstateAgent.licenseNumber': '$realEstateAgentInfo.licenseNumber',
                    'realEstateAgent.companyName': '$realEstateAgentInfo.companyName'
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

                let response = {
                    properties: docs,
                    error: null
                }

                res.json(response)
            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/request/visit/member', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let visitorUniqueId = req.body.visitorUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let appointmentDate = req.body.dateTime

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let visitAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

        let appointment = {
            userUniqueId: new objectId(visitorUniqueId),
            propertyUniqueId: new objectId(propertyUniqueId),
            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
            appointmentDate: new Date(appointmentDate),
            isConfirmed: true,
            isEnabled: true
        }

        visitAppointmentCollection.insertOne(appointment)
            .then(inserted => {
                let response = {
                    isRequested: true,
                    error: null
                }

                res.json(response)
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })


    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/request/visit/nonmember', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let visitorName = req.body.visitorName
    let visitorPhoneNumber = req.body.visitorPhoneNumber
    let propertyUniqueId = req.body.propertyUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let appointmentDate = req.body.dateTime
    let address_1 = req.body.address_1
    let address_2 = req.body.address_2

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let appointment = {
            userUniqueId: null,
            visitorName: visitorName,
            visitorPhoneNumber: visitorPhoneNumber,
            propertyUniqueId: new objectId(propertyUniqueId),
            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
            appointmentDate: new Date(appointmentDate),
            isConfirmed: true,
            isEnabled: true,
            visitorAddress_1: address_1,
            visitorAddress_2: address_2
        }

        let visitorAppointmentCollection = db.getDb().collection(constants.collection.VISIT_APPOINTMENT)

        visitorAppointmentCollection.insertOne(appointment)
            .then(inserted => {
                let response = {
                    isRequested: true,
                    error: null
                }

                res.json(response)
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })

    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/prop/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let orderBy = req.body.orderBy
    let salesStatus = req.body.salesStatus
    let skip = req.body.skip
    let limit = req.body.limit

    let orderByObj = {}

    if (orderBy === constants.PROPERTY_LIST_ORDER_BY.MOST_POPULAR) {
        orderByObj = {
            $sort: {popularScore: -1}
        }
    } else if (orderBy === constants.PROPERTY_LIST_ORDER_BY.RECENT_ADDED) {
        orderByObj = {
            $sort: {_id: -1}
        }
    } else if (orderBy === constants.PROPERTY_LIST_ORDER_BY.TITLE) {
        orderByObj = {
            $sort: {title: 1}
        }
    } else if (orderBy === constants.PROPERTY_LIST_ORDER_BY.PRICE) {
        orderByObj = {
            $sort: {price: -1}
        }
    } else if (orderBy === constants.PROPERTY_LIST_ORDER_BY.VIEW_COUNT) {
        orderByObj = {
            $sort: {reservationCount: -1}
        }
    } else if (orderBy === constants.PROPERTY_LIST_ORDER_BY.VR_TOUR_COUNT) {
        orderByObj = {
            $sort: {vrTourCount: -1}
        }
    } else if (orderBy === constants.PROPERTY_LIST_ORDER_BY.MOVE_IN_DATE) {
        orderByObj = {
            $sort: {'moveinDate.start': -1}
        }
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

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

        propertyCollection.aggregate([
            salesStatusObj,
            {
                $facet: {
                    count: [{$count: 'totalCount'}],
                    properties: [

                        {
                            $lookup: {
                                from: constants.collection.VISIT_APPOINTMENT,
                                localField: '_id',
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
                            $lookup: {
                                from: constants.collection.VR_TOUR,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'vrTourRegUser'
                            }
                        },
                        {
                            $unwind: {
                                path: '$vrTourRegUser',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR_RE_AGENT,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'vrTourREAgent'
                            }
                        },
                        {
                            $unwind: {
                                path: '$vrTourREAgent',
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
                            $unwind: '$realEstateAgent'
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
                            $unwind: '$agency'
                        },
                        {
                            $group: {
                                _id: '$_id',

                                appointments: {$addToSet: '$appointment'},
                                vrTourRegUser: {$addToSet: '$vrTourRegUser'},
                                vrTourREAgent: {$addToSet: '$vrTourREAgent'},
                                category: {$first: '$category'},
                                salesMethod: {$first: '$salesMethod'},
                                title: {$first: '$title'},
                                address_1: {$first: '$address_1'},
                                address_2: {$first: '$address_2'},
                                size: {$first: '$size'},
                                price: {$first: '$price'},
                                deposit: {$first: '$deposit'},
                                currDeposit: {$first: '$currDeposit'},
                                currRent: {$first: '$currRent'},
                                moveinDate: {$first: '$moveinDate'},
                                numOfMonths: {$first: '$numOfMonths'},
                                mortgage: {$first: '$mortgage'},
                                numberOfRooms: {$first: '$numberOfRooms'},
                                numberOfBathrooms: {$first: '$numberOfBathrooms'},
                                facingDirection: {$first: '$facingDirection'},
                                maintenanceFee: {$first: '$maintenanceFee'},
                                note: {$first: '$note'},
                                realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                                status: {$first: '$status'},
                                owner: {$first: '$owner'},
                                realEstateAgent: {$first: '$realEstateAgent'},
                                agency: {$first: '$agency'},
                                thumbnail: {$first: '$thumbnail'},
                                //images: {$addToSet: '$image.filename'}
                            }
                        },
                        {
                            $project: {
                                reservationCount: {$size: '$appointments'},
                                vrTourRegUserCount: {$size: '$vrTourRegUser'},
                                vrTourREAgentCount: {$size: '$vrTourREAgent'},
                                propertyUniqueId: '$_id',
                                category: 1,
                                salesMethod: 1,
                                title: 1,
                                address_1: 1,
                                address_2: 1,
                                size: 1,
                                price: 1,
                                deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}]}, null, '$deposit']},
                                currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}]}, null, '$currDeposit']},
                                currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}]}, null, '$currRent']},
                                moveinDate: 1,
                                numOfMonths: {$cond: [{$or: [{$eq: ['$numOfMonths', null]}, {$eq: ['$numOfMonths', ""]}]}, null, '$numOfMonths']},
                                mortgage: 1,
                                numberOfRooms: 1,
                                numberOfBathrooms: 1,
                                facingDirection: 1,
                                maintenanceFee: 1,
                                note: 1,
                                realEstateAgentUniqueId: 1,
                                status: 1,
                                owner: 1,
                                'realEstateAgent.realEstateAgentUniqueId': '$realEstateAgent._id',
                                'realEstateAgent.name': '$agency.ceoName',
                                'realEstateAgent.companyName': '$agency.companyName',
                                'realEstateAgent.realEstateUniqueId': '$agency._id',
                                thumbnail: 1,
                            }
                        },
                        {
                            $project: {
                                propertyUniqueId: 1,
                                reservationCount: 1,
                                popularScore: {$add: ['$reservationCount', '$vrTourRegUserCount', '$vrTourREAgentCount']},
                                vrTourCount: {$add: ['$vrTourRegUserCount', '$vrTourREAgentCount']},
                                category: 1,
                                salesMethod: 1,
                                title: 1,
                                address_1: 1,
                                address_2: 1,
                                size: 1,
                                price: 1,
                                deposit: 1,
                                currDeposit: 1,
                                currRent: 1,
                                moveinDate: 1,
                                numOfMonths: 1,
                                mortgage: 1,
                                numberOfRooms: 1,
                                numberOfBathrooms: 1,
                                facingDirection: 1,
                                maintenanceFee: 1,
                                note: 1,
                                realEstateAgentUniqueId: 1,
                                status: 1,
                                owner: 1,
                                realEstateAgent: 1,
                                thumbnail: 1,
                            }
                        },
                        orderByObj,
                        {
                            $skip: parseInt(skip)
                        },
                        {
                            $limit: parseInt(limit)
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

            cursor.toArray((e2, docs) => {
                if (e2) {
                    res.status(500).send()
                    throw e2
                }

                let response = {
                    totalCount: 0,
                    propertyList: [],
                    error: null
                }


                if (docs.length > 0) {
                    let result = docs[0]

                    response = {
                        totalCount: result.count.totalCount,
                        propertyList: result.properties,
                        error: null
                    }
                }

                res.json(response)
            })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/change/prop/status', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let status = req.body.status
    let reason = req.body.reason

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        let salesStatus = {
            type: status,
            value: constants.salesStatus[status].value
        }

        if (status === 'OTHER') {
            salesStatus.reason = reason
        }

        propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: {status: salesStatus}})
            .then(() => {
                let response = {
                    isChanged: true,
                    error: null
                }

                res.json(response)
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/search/apartment', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let keyword = req.body.keyword

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

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
                $unwind: '$buildingRegistry'
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

    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/add/new/property', propImageUpload.any(), (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let callback = async (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

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

        let realEstateAgent = JSON.parse(req.body.realEstateAgent)

        let realEstateAgentUniqueId = await findRealEstateAgentUniqueId(realEstateAgent)

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

        if (realEstateAgentUniqueId === null) {

            res.status(500).send()

            return
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
            realEstateAgentPhoneNumber: realEstateAgent.phoneNumber,
            thumbnail: thumbnail,
            status: constants.salesStatus.SELLING,
            latitude: latitude,
            longitude: longitude,
            loc: loc,
            location: locations,
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

    ifAdminThenExecute(adminUniqueId, callback)
})

let findRealEstateAgentUniqueId = (realEstateAgentInfo) => {
    return new Promise((resolve, reject) => {
        let realEstateAgentInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
        let userCollection = db.getDb().collection(constants.collection.USER)
        realEstateAgentInfoCollection.findOne({licenseNumber: realEstateAgentInfo.licenseNumber})
            .then(info => {
                if (info !== null) {

                    userCollection.findOne({_id: info.realEstateAgentUniqueId})
                        .then(user => {
                            let realEstateAgentUniqueId = user._id
                            return resolve(realEstateAgentUniqueId)
                        })
                        .catch(err => {
                            reject(err)
                        })

                    return resolve(info.realEstateAgentUniqueId)
                } else {

                    userCollection.insertOne({
                        name: realEstateAgentInfo.name,
                        phoneNumber: realEstateAgentInfo.phoneNumber
                    })
                        .then(inserted => {
                            realEstateAgentInfo.realEstateAgentUniqueId = inserted.insertedId
                            realEstateAgentInfoCollection.insertOne(realEstateAgentInfo)
                                .then(() => {

                                    return resolve(inserted.insertedId)
                                })
                                .catch(err => {
                                    reject()
                                    throw err
                                })
                        })


                }
            })
            .catch(err => {
                reject(err)
            })
    })
}

router.post('/fetch/members', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = req.body.skip
    let limit = req.body.limit
    let sort = req.body.sort
    let Keyword = req.body.keyword

    let sortObj = {
        $sort: {userUniqueId: -1}
    }

    if (sort !== '0') {
        if (sort.type === 'gender') {
            sortObj = {$match: {gender: sort.value}}
        } else {
            let key = sort.type
            sortObj = {$sort: {}}

            sortObj['$sort'][key] = parseInt(sort.value)
        }
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {$match: {$and: [{isRealEstateAgent: false}, {isAdmin: false}, {$or: [{name: {$regex: Keyword}}, {email: {$regex: Keyword}}]}]}},
            {
                $facet: {
                    count: [
                        sortObj,
                        {$count: 'totalCount'}
                    ],
                    members: [
                        {
                            $lookup: {
                                from: constants.collection.SAVED_PROPERTY,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'savedProperty'
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'vrTour'
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.VISIT_APPOINTMENT,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'visitAppointment'
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'inquiry'
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                userUniqueId: '$_id',
                                email: '$email',
                                name: '$name',
                                gender: '$gender',
                                address_1: '$address_1',
                                address_2: '$address_2',
                                savedPropCount: {$size: '$savedProperty'},
                                vrTourCount: {$size: '$vrTour'},
                                visitReservationCount: {$size: '$visitAppointment'},
                                inquiryCount: {$size: '$inquiry'}
                            }
                        },
                        sortObj,
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
                throw err
            }

            cursor.toArray()
                .then(docs => {

                    let response = {
                        totalCount: 0,
                        members: []
                    }

                    if (docs.length > 0) {
                        let result = docs[0]

                        response.totalCount = result.count.totalCount
                        response.members = result.members

                    }

                    res.json(response)
                })
                .catch(e2 => {
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/member/info', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.findOne({_id: new objectId(memberUniqueId)})
            .then(member => {
                if (member !== null) {
                    let response = {
                        userUniqueId: member._id,
                        email: member.email,
                        address_1: member.address_1,
                        address_2: member.address_2,
                        name: member.name,
                        phoneNumber: member.phoneNumber,
                        birthDate: member.birthDate,
                        gender: member.gender,
                        interestedArea: member.interestedArea
                    }

                    res.json(response)
                }
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/modify/member/info', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId
    let email = req.body.email
    let address_1 = req.body.address_1
    let address_2 = req.body.address_2
    let name = req.body.name
    let phoneNumber = req.body.phoneNumber
    let password = req.body.password
    let birthDate = req.body.birthDate
    let gender = req.body.gender
    let interestedArea = req.body.interestedArea

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        if (password.length > 0) {
            bcrypt.genSalt(saltRounds, (err, salt) => {
                if (err) {

                    throw err
                }

                bcrypt.hash(password, salt, (e2, hash) => {
                    if (e2) {
                        res.status(500).send()
                        throw e2
                    }

                    userCollection.findOneAndUpdate({_id: new objectId(memberUniqueId)}, {$set: {password: hash}})
                        .then(() => {

                        })
                        .catch(err => {

                            throw err
                        })
                })
            })
        }

        userCollection.findOneAndUpdate({_id: new objectId(memberUniqueId)}, {
            $set: {
                email: email,
                address_1: address_1,
                address_2: address_2,

                name: name,
                phoneNumber: phoneNumber,
                birthDate: birthDate,
                gender: gender,
                interestedArea: interestedArea
            }
        })
            .then(() => {
                res.json({isModified: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })

    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/delete/member', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return

        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.findOneAndUpdate({_id: new objectId(memberUniqueId)}, {$set: {isDeleted: true}}, {upsert: true})
            .then(() => {
                res.json({isDeleted: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/member/info/detail', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return

        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {$match: {_id: new objectId(memberUniqueId)}},
            {
                $facet: {
                    info: [
                        {
                            $project: {
                                email: '$email',
                                address_1: '$address_1',
                                address_2: '$address_2',
                                name: '$name',
                                phoneNumber: '$phoneNumber',
                                birthDate: '$birthDate',
                                gender: '$gender'


                            }
                        }
                    ],
                    savedProperties: [
                        {
                            $lookup: {
                                from: constants.collection.SAVED_PROPERTY,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'saved'
                            }
                        },
                        {
                            $unwind: '$saved'
                        },
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'saved.propertyUniqueId',
                                foreignField: '_id',
                                as: 'property'
                            }
                        },
                        {
                            $unwind: '$property'
                        },
                        {
                            $project: {
                                _id: 1,
                                propertyUniqueId: '$saved.propertyUniqueId',
                                price: '$property.price',
                                deposit: {$cond: [{$or: [{$eq: ['$property.deposit', null]}, {$eq: ['$property.deposit', ""]}, {$eq: ['$property.deposit', "null"]}]}, null, '$property.deposit']},
                                currDeposit: {$cond: [{$or: [{$eq: ['$property.currDeposit', null]}, {$eq: ['$property.currDeposit', ""]}, {$eq: ['$property.currDeposit', "null"]}]}, null, '$property.currDeposit']},
                                currRent: {$cond: [{$or: [{$eq: ['$property.currRent', null]}, {$eq: ['$property.currRent', ""]}, {$eq: ['$property.currRent', "null"]}]}, null, '$property.currRent']},
                                category: '$property.category',
                                address_1: '$property.address_1',
                                title: '$property.title',
                                salesMethod: '$property.salesMethod',
                                size: '$property.size'
                            }
                        },
                        {$sort: {propertyUniqueId: -1}},
                    ],
                    vrTourRequests: [
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'vrTour'
                            }
                        },
                        {
                            $unwind: '$vrTour'
                        },
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'vrTour.propertyUniqueId',
                                foreignField: '_id',
                                as: 'property'
                            }
                        },
                        {
                            $unwind: '$property'
                        },
                        {
                            $project: {
                                _id: 0,
                                vrTourUniqueId: '$vrTour._id',
                                propertyUniqueId: '$vrTour.propertyUniqueId',
                                price: '$property.price',
                                deposit: '$property.deposit',
                                currDeposit: '$property.currDeposit',
                                currRent: '$property.currRent',
                                category: '$property.category',
                                address_1: '$property.address_1',
                                title: '$property.title',
                                salesMethod: '$property.salesMethod',
                                size: '$property.size',
                                isConfirmed: '$vrTour.isConfirmed',
                                isEnabled: '$vrTour.isEnabled'
                            }
                        },
                        {$sort: {vrTourUniqueId: -1}},
                    ],
                    visitAppointments: [
                        {
                            $lookup: {
                                from: constants.collection.VISIT_APPOINTMENT,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'visitAppointment'
                            }
                        },
                        {
                            $unwind: '$visitAppointment'
                        },
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'visitAppointment.propertyUniqueId',
                                foreignField: '_id',
                                as: 'visitProperty'
                            }
                        },
                        {
                            $unwind: '$visitProperty'
                        },
                        {
                            $project: {
                                _id: 0,
                                visitAppointmentUniqueId: '$visitAppointment._id',
                                appointmentDate: '$visitAppointment.appointmentDate',
                                propertyUniqueId: '$visitProperty._id',
                                price: '$visitProperty.price',
                                deposit: '$visitProperty.deposit',
                                currDeposit: '$visitProperty.currDeposit',
                                currRent: '$visitProperty.currRent',
                                category: '$visitProperty.category',
                                address_1: '$visitProperty.address_1',
                                title: '$visitProperty.title',
                                salesMethod: '$visitProperty.salesMethod',
                                size: '$visitProperty.size',
                                isConfirmed: '$visitAppointment.isConfirmed',
                                isEnabled: '$visitAppointment.isEnabled'
                            }
                        },
                        {$sort: {visitAppointmentUniqueId: -1}},
                    ],
                    inquiries: [
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY,
                                localField: '_id',
                                foreignField: 'userUniqueId',
                                as: 'inquiry'
                            }
                        },
                        {
                            $unwind: '$inquiry'
                        },
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'inquiry.propertyUniqueId',
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
                                from: constants.collection.INQUIRY_ANSWER,
                                localField: 'inquiry._id',
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
                            $project: {
                                _id: 0,
                                inquiryUniqueId: '$inquiry._id',
                                title: '$inquiry.title',
                                inquiryType: '$inquiry.inquiryType',
                                inquiry: '$inquiry.inquiry',
                                name: '$inquiry.name',
                                date: '$inquiry.date',
                                'inquiryReply.responderUniqueId': '$reply.responderUniqueId',
                                'inquiryReply.message': '$reply.message',
                                propertyUniqueId: '$property._id',
                                propertyTitle: '$property.title',
                                propertyAddress_1: '$property.address_1',
                                propertyAddress_2: '$property.address_2',
                                propertyFloor: '$property.size.floor',
                                propertyTotalFloor: '$property.size.totalFloor'
                            }
                        },
                        {$sort: {inquiryUniqueId: -1}},
                    ]
                }
            },
            {
                $project: {
                    info: 1,
                    savedProperties: {$slice: ['$savedProperties', 5]},
                    vrTourRequests: {$slice: ['$vrTourRequests', 5]},
                    visitAppointments: {$slice: ['$visitAppointments', 5]},
                    inquiries: {$slice: ['$inquiries', 5]}
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
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/member/saved/properties', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)


    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {$match: {_id: new objectId(memberUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.SAVED_PROPERTY,
                    localField: '_id',
                    foreignField: 'userUniqueId',
                    as: 'savedProperty'
                }
            },
            {
                $unwind: '$savedProperty'
            },
            {
                $lookup: {
                    from: constants.collection.PROPERTY,
                    localField: 'savedProperty.propertyUniqueId',
                    foreignField: '_id',
                    as: 'property'
                }
            },
            {
                $unwind: '$property'
            },
            {
                $sort: {'property._id': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $group: {
                    _id: '$_id',
                    userUniqueId: {$first: '$_id'},
                    email: {$first: '$email'},
                    address_1: {$first: '$address_1'},
                    address_2: {$first: '$address_2'},
                    name: {$first: '$name'},
                    phoneNumber: {$first: '$phoneNumber'},
                    birthDate: {$first: '$birthDate'},
                    gender: {$first: '$gender'},
                    savedProperties: {$push: '$property'}
                }
            },
            {
                $project: {
                    _id: 0,
                    'info.userUniqueId': '$userUniqueId',
                    'info.email': '$email',
                    'info.address_1': '$address_1',
                    'info.address_2': '$address_2',
                    'info.name': '$name',
                    'info.phoneNumber': '$phoneNumber',
                    'info.birthDate': '$birthDate',
                    'info.gender': '$gender',
                    savedProperties: 1
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()

                throw err
            }

            cursor.toArray()
                .then(docs => {

                    res.json(docs)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/member/vr/tour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {$match: {_id: new objectId(memberUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.VR_TOUR,
                    localField: '_id',
                    foreignField: 'userUniqueId',
                    as: 'vrTour'
                }
            },
            {
                $unwind: '$vrTour'
            },
            {
                $lookup: {
                    from: constants.collection.PROPERTY,
                    localField: 'vrTour.propertyUniqueId',
                    foreignField: '_id',
                    as: 'property'
                }
            },
            {
                $unwind: '$property'
            },
            {
                $sort: {'property._id': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $group: {
                    _id: '$_id',

                    userUniqueId: {$first: '$_id'},
                    email: {$first: '$email'},
                    address_1: {$first: '$address_1'},
                    address_2: {$first: '$address_2'},
                    name: {$first: '$name'},
                    phoneNumber: {$first: '$phoneNumber'},
                    birthDate: {$first: '$birthDate'},
                    gender: {$first: '$gender'},
                    vrTourRequests: {
                        $push: {
                            vrTourUniqueId: '$vrTour._id',
                            propertyUniqueId: '$property._id',
                            price: '$property.price',
                            deposit: '$property.deposit',
                            currDeposit: '$property.currDeposit',
                            currRent: '$property.currRent',
                            category: '$property.category',
                            address_1: '$property.address_1',
                            title: '$property.title',
                            salesMethod: '$property.salesMethod',
                            size: '$property.size',
                            thumbnail: '$property.thumbnail',
                            isConfirmed: '$vrTour.isConfirmed',
                            isEnabled: '$vrTour.isEnabled'
                        }
                    }

                }
            },
            {
                $project: {
                    _id: 0,
                    vrTourUniqueId: 1,
                    propertyUniqueId: 1,
                    'info.userUniqueId': '$userUniqueId',
                    'info.email': '$email',
                    'info.address_1': '$address_1',
                    'info.address_2': '$address_2',
                    'info.name': '$name',
                    'info.phoneNumber': '$phoneNumber',
                    'info.birthDate': '$birthDate',
                    'info.gender': '$gender',
                    vrTourRequests: 1
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    res.json(docs)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })


        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/member/inquiries', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {$match: {_id: new objectId(memberUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.INQUIRY,
                    localField: '_id',
                    foreignField: 'userUniqueId',
                    as: 'inquiry'
                }
            },
            {
                $unwind: '$inquiry'
            },
            {
                $lookup: {
                    from: constants.collection.INQUIRY_ANSWER,
                    localField: 'inquiry._id',
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
                    localField: 'inquiry.propertyUniqueId',
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
                $sort: {'inquiry._id': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            },
            {
                $group: {
                    _id: '$_id',
                    userUniqueId: {$first: '$_id'},
                    email: {$first: '$email'},
                    address_1: {$first: '$address_1'},
                    address_2: {$first: '$address_2'},
                    name: {$first: '$name'},
                    phoneNumber: {$first: '$phoneNumber'},
                    birthDate: {$first: '$birthDate'},
                    gender: {$first: '$gender'},
                    inquiries: {
                        $push:
                            {
                                inquiryUniqueId: '$inquiry._id',
                                title: '$inquiry.title',
                                inquiryType: '$inquiry.inquiryType',
                                inquiry: '$inquiry.inquiry',
                                name: '$inquiry.name',
                                date: '$inquiry.date',
                                inquiryReply: {
                                    replyUniqueId: '$reply._id',
                                    responderUniqueId: '$reply.responderUniqueId',
                                    title: '$reply.title',
                                    message: '$reply.message'
                                },
                                propertyUniqueId: '$property._id',
                                propertyTitle: '$property.title',
                                propertyAddress_1: '$property.address_1',
                                propertyAddress_2: '$property.address_2',
                                propertyFloor: '$property.size.floor',
                                propertyTotalFloor: '$property.size.totalFloor'
                            }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    'info.userUniqueId': '$userUniqueId',
                    'info.email': '$email',
                    'info.address_1': '$address_1',
                    'info.address_2': '$address_2',
                    'info.name': '$name',
                    'info.phoneNumber': '$phoneNumber',
                    'info.birthDate': '$birthDate',
                    'info.gender': '$gender',
                    inquiries: 1
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    res.json(docs)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/delete/inquiry', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let inquiryUniqueId = req.body.inquiryUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)
        let inquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_ANSWER)

        inquiryCollection.deleteOne({_id: new objectId(inquiryUniqueId)})
            .then(() => {
                inquiryAnswerCollection.deleteMany({inquiryUniqueId: new objectId(inquiryUniqueId)})
                res.json({isDeleted: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/answer/inquiry', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let inquiryUniqueId = req.body.inquiryUniqueId
    let message = req.body.message

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let inquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_ANSWER)


        inquiryAnswerCollection.findOne({
            inquiryUniqueId: new objectId(inquiryUniqueId),
            responderUniqueId: new objectId(adminUniqueId)
        })
            .then(answer => {
                if (answer !== null) {
                    res.json({isAnswered: false, error: {code: '001', message: '이미 답변 되었습니다.'}})
                } else {
                    let obj = {
                        inquiryUniqueId: new objectId(inquiryUniqueId),
                        responderUniqueId: new objectId(adminUniqueId),
                        message: message
                    }

                    inquiryAnswerCollection.insertOne(obj)
                        .then(inserted => {
                            res.json({isAnswered: true, error: null})
                        })
                        .catch(err => {
                            res.status(500).send()
                            throw err
                        })
                }
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/nonmember/inquiries', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)
    let sort = req.body.sort

    let sortObj = {
        $sort: {_id: -1}
    }

    if (sort !== '0') {
        sortObj = {$sort: {}}
        sortObj['$sort'][sort.type] = parseInt(sort.value)
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }


        let nonmemberInquiryCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER)

        nonmemberInquiryCollection.aggregate([
            {
                $facet: {
                    count: [{$count: 'totalCount'}],
                    inquiries: [
                        sortObj,
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY_NON_MEMBER_ANSWER,
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
                            $project: {
                                _id: 0,
                                date: '$date',
                                inquiryUniqueId: '$_id',
                                name: '$name',
                                phoneNumber: '$phoneNumber',
                                email: '$email',
                                inquiry: '$inquiry',
                                inquiryType: '$inquiryType',
                                'inquiryReply.message': '$reply.message',
                                'inquiryReply.replyUniqueId': '$reply._id',
                                'inquiryReply.responderUniqueId': '$reply.responderUniqueId'
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
                        inquiries: [],
                        error: null
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
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/nonmember/delete/inquiry', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let inquiryUniqueId = req.body.inquiryUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let nonmemberInquiryCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER)
        let nonmemberInquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER_ANSWER)

        nonmemberInquiryCollection.deleteOne({_id: new objectId(inquiryUniqueId)})
            .then(() => {
                nonmemberInquiryAnswerCollection.deleteOne({inquiryUniqueId: new objectId(inquiryUniqueId)})
                    .then(() => {
                        res.json({isDeleted: true, error: null})
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

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/nonmember/answer/inquiry', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let inquiryUniqueId = req.body.inquiryUniqueId
    let message = req.body.message

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let nonmemberInquiryAnswerCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER_ANSWER)

        let obj = {
            inquiryUniqueId: new objectId(inquiryUniqueId),
            responderUniqueId: new objectId(adminUniqueId),
            message: message
        }

        nonmemberInquiryAnswerCollection.insertOne(obj)
            .then(() => {
                res.json({isAnswered: true, error: null})
            })
            .catch(err => {
                res.status(500).send()

                throw err

            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/property/info', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.aggregate([
            {$match: {_id: new objectId(propertyUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.IMAGE,
                    localField: '_id',
                    foreignField: 'propertyUniqueId',
                    as: 'image'
                }
            },
            {
                $unwind: {
                    path: '$image',
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
                $unwind: '$agency'
            },
            {
                $group: {
                    _id: '$_id',
                    propertyUniqueId: {$first: '$_id'},
                    price: {$first: '$price'},
                    deposit: {$first: '$deposit'},
                    currDeposit: {$first: '$currDeposit'},
                    currRent: {$first: '$currRent'},
                    title: {$first: '$title'},
                    category: {$first: '$category'},
                    salesMethod: {$first: '$salesMethod'},
                    mortgage: {$first: '$mortgage'},
                    numberOfRooms: {$first: '$numberOfRooms'},
                    numberOfBathrooms: {$first: '$numberOfBathrooms'},
                    totalParkingLotCount: {$first: '$totalParkingLotCount'},
                    facingDirection: {$first: '$facingDirection'},
                    maintenanceFee: {$first: '$maintenanceFee'},
                    note: {$first: '$note'},
                    address_1: {$first: '$address_1'},
                    address_2: {$first: '$address_2'},
                    dongNumber: {$first: '$dongNumber'},
                    hoNumber: {$first: '$hoNumber'},
                    doroAddress: {$first: '$doroAddress'},
                    size: {$first: '$size'},
                    moveinDate: {$first: '$moveinDate'},
                    numOfMonths: {$first: '$numOfMonths'},
                    owner: {$first: '$owner'},
                    realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                    realEstateAgentPhoneNumber: {$first: '$realEstateAgentPhoneNumber'},
                    realEstateAgent: {$first: '$agency'},
                    status: {$first: '$status'},
                    images: {$push: {filename: '$image.filename', isThumbnail: '$image.isThumbnail'}},
                    latitude: {$first: '$latitude'},
                    longitude: {$first: '$longitude'},

                    codeHeatNm: {$first: '$codeHeatNm'},
                    fuel: {$first: '$fuel'},
                    codeHallNm: {$first: '$codeHallNm'},
                    hoCnt: {$first: '$hoCnt'},
                    loft: {$first: '$loft'},
                    dateOfApproval: {$first: '$dateOfApproval'},
                    principalUser: {$first: '$principalUser'},
                    parkingAvailability: {$first: '$parkingAvailability'},
                    officetelUse: {$first: '$officetelUse'},
                    kaptBcompany: {$first: '$kaptBcompany'}
                }
            },
            {
                $project: {
                    propertyUniqueId: 1,
                    price: 1,
                    deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', 0]}]}, null, '$deposit']},
                    currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', 0]}]}, null, '$currDeposit']},
                    currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', 0]}]}, null, '$currRent']},
                    title: 1,
                    category: 1,
                    salesMethod: 1,
                    mortgage: 1,
                    numberOfRooms: 1,
                    numberOfBathrooms: 1,
                    totalParkingLotCount: 1,
                    facingDirection: 1,
                    maintenanceFee: 1,
                    note: 1,
                    address_1: 1,
                    address_2: 1,
                    dongNumber: 1,
                    hoNumber: 1,
                    doroAddress: {$cond: [{$or: [{$eq: ['$doroAddress', null]}, {$eq: ['$doroAddress', ""]}]}, false, '$doroAddress']},
                    size: 1,
                    moveinDate: 1,
                    numOfMonths: 1,
                    owner: 1,
                    realEstateAgentUniqueId: 1,
                    realEstateAgentPhoneNumber: 1,
                    realEstateAgent: 1,
                    status: 1,
                    images: 1,
                    latitude: 1,
                    longitude: 1,

                    codeHeatNm: 1,
                    fuel: 1,
                    codeHallNm: 1,
                    hoCnt: 1,
                    loft: 1,
                    dateOfApproval: 1,
                    principalUser: 1,
                    parkingAvailability: 1,
                    officetelUse: 1,
                    kaptBcompany: 1
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send(0)
                throw err
            }

            cursor.toArray()
                .then(docs => {

                    if (docs.length > 0) {
                        res.json(docs[0])
                    } else {
                        res.json([])
                    }

                })
                .catch(e2 => {

                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/edit/property', propImageUpload.any(), (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let callback = async (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

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

        let principalUser = {
            type: req.body.principalUser,
            value: constants.principalUser[req.body.principalUser]

        }
        let hoCnt = req.body.hoCnt
        let officetelUse = {
            type: req.body.officetelUse,
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

        let realEstateAgent = JSON.parse(req.body.realEstateAgent)

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


        let realEstateAgentUniqueId = await findRealEstateAgentUniqueId(realEstateAgent)

        let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
        realEstateInfoCollection.findOneAndUpdate(
            {licenseNumber: realEstateAgent.licenseNumber},
            {
                $set: {
                    companyName: realEstateAgent.companyName,
                    ceoName: realEstateAgent.ceoName,
                    phoneNumber: realEstateAgent.phoneNumber
                }
            })

        if (realEstateAgentUniqueId === null) {

            res.status(500).send()

            return
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
            doroAddress: doroAddress,
            hoCnt: (hoCnt !== "null") ? parseInt(hoCnt) : null,
            officetelUse: officetelUse,
            size: size,
            moveinDate: moveinDate,
            numOfMonths: (numOfMonths !== "null") ? parseInt(numOfMonths) : null,
            dateOfApproval: (dateOfApproval !== "null") ? dateOfApproval : null,
            owner: (owner !== "null") ? owner : null,
            realEstateAgentUniqueId: new objectId(realEstateAgentUniqueId),
            realEstateAgentPhoneNumber: realEstateAgent.phoneNumber,
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

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/realestate/info/all', (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let callback = async (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }


        let approvalList = await getApprovalAwaitingList()
        let vrTourRERequestList = await getVrTourRERequestList()
        let vrTourDeleteRequestList = await getVRDeleteRequestList()
        let inquiryList = await getInquiryList()
        let realEstateList = await getRealEstateList()


        let response = {
            approvalList: approvalList,
            vrTourRequestList: vrTourRERequestList,
            vrDeleteRequestList: vrTourDeleteRequestList,
            inquiryList: inquiryList,
            realEstateList: realEstateList
        }

        res.json(response)
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

let getApprovalAwaitingList = () => {
    return new Promise((resolve, reject) => {
        let userCollection = db.getDb().collection(constants.collection.USER)
        userCollection.aggregate([
            {$match: {isRealEstateAgent: true}},

            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: '_id',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
            },
            {
                $unwind: '$agency'
            },
            {
                $group: {
                    _id: '$_id',
                    realEstateUniqueId: {$first: '$agency._id'},
                    realEstateAgentUniqueId: {$first: '$_id'},
                    companyName: {$first: '$agency.companyName'},
                    ceoName: {$first: '$agency.ceoName'},
                    licenseNumber: {$first: '$agency.licenseNumber'},
                    address_1: {$first: '$agency.address_1'},
                    address_2: {$first: '$agency.address_2'},
                    isConfirmed: {$first: '$isConfirmed'},
                    isEnabled: {$first: '$isEnabled'}
                }
            },
            {
                $sort: {_id: -1}
            },
            {
                $project: {
                    _id: 0,
                    realEstateUniqueId: 1,
                    realEstateAgentUniqueId: 1,
                    companyName: 1,
                    ceoName: 1,
                    licenseNumber: 1,
                    address_1: 1,
                    address_2: 1,
                    isConfirmed: 1,
                    isEnabled: 1
                }
            },
            {
                $limit: 5
            }
        ], (err, cursor) => {
            if (err) {
                reject()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    return resolve(docs)
                })
                .catch(e2 => {
                    reject()
                    throw e2
                })
        })
    })
}

let getVrTourRERequestList = () => {
    return new Promise((resolve, reject) => {
        let vrTourRERequestCollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

        vrTourRERequestCollection.aggregate([

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
                    localField: 'userUniqueId',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
            },
            {
                $unwind: '$agency'
            },
            {
                $group: {
                    _id: '$_id',
                    vrTourUniqueId: {$first: '$_id'},
                    propertyUniqueId: {$first: '$property._id'},
                    realEstateAgentUniqueId: {$first: '$agency.realEstateAgentUniqueId'},
                    ceoName: {$first: '$agency.ceoName'},
                    companyName: {$first: '$agency.companyName'},
                    title: {$first: '$property.title'},
                    category: {$first: '$property.category'},
                    address_1: {$first: '$property.address_1'},
                    address_2: {$first: '$property.address_2'},
                    dongNumber: {$first: '$property.dongNumber'},
                    size: {$first: '$property.size'},
                    salesMethod: {$first: '$property.salesMethod'},
                    price: {$first: '$property.price'},
                    deposit: {$first: '$property.deposit'},
                    currDeposit: {$first: '$property.currDeposit'},
                    currRent: {$first: '$property.currRent'},
                    owner: {$first: '$property.owner'},
                    isConfirmed: {$first: '$isConfirmed'},
                    isEnabled: {$first: '$isEnabled'}
                }
            },
            {
                $sort: {_id: -1}
            },
            {
                $project: {
                    _id: 0,
                    vrTourUniqueId: 1,
                    realEstateAgentUniqueId: 1,
                    ceoName: 1,
                    companyName: 1,
                    propertyUniqueId: 1,
                    title: 1,
                    category: 1,
                    address_1: 1,
                    address_2: 1,
                    dongNumber: 1,
                    size: 1,
                    salesMethod: 1,
                    price: 1,
                    deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                    currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                    currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                    owner: 1,
                    isConfirmed: 1,
                    isEnabled: 1
                }
            },
            {
                $limit: 5
            }
        ], (err, cursor) => {
            if (err) {
                reject()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    return resolve(docs)
                })
                .catch(e2 => {
                    reject()

                    throw e2
                })
        })
    })
}

let getVRDeleteRequestList = () => {
    return new Promise((resolve, reject) => {
        let vrDeleteRequestCollection = db.getDb().collection(constants.collection.VR_DELETE_REQUEST)

        vrDeleteRequestCollection.aggregate([
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
            {
                $unwind: '$agency'
            },
            {
                $group: {
                    _id: '$_id',
                    vrTourDeleteUniqueId: {$first: '$_id'},
                    realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                    propertyUniqueId: {$first: '$property._id'},
                    ceoName: {$first: '$agency.ceoName'},
                    companyName: {$first: '$agency.companyName'},
                    status: {$first: '$property.status'},
                    title: {$first: '$property.title'},
                    category: {$first: '$property.category'},
                    address_1: {$first: '$property.address_1'},
                    address_2: {$first: '$property.address_2'},
                    dongNumber: {$first: '$property.dongNumber'},
                    size: {$first: '$property.size'},
                    salesMethod: {$first: '$property.salesMethod'},
                    price: {$first: '$property.price'},
                    deposit: {$first: '$property.deposit'},
                    currDeposit: {$first: '$property.currDeposit'},
                    currRent: {$first: '$property.currRent'},
                    owner: {$first: '$property.owner'},
                    isConfirmed: {$first: '$isConfirmed'},
                    isEnabled: {$first: '$isEnabled'}
                }
            },
            {
                $sort: {_id: -1}
            },
            {
                $project: {
                    _id: 0,
                    vrTourDeleteUniqueId: 1,
                    realEstateAgentUniqueId: 1,
                    propertyUniqueId: 1,
                    ceoName: 1,
                    companyName: 1,
                    status: 1,
                    title: 1,
                    category: 1,
                    address_1: 1,
                    address_2: 1,
                    dongNumber: 1,
                    size: 1,
                    salesMethod: 1,
                    price: 1,
                    deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                    currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                    currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                    owner: 1,
                    isConfirmed: 1,
                    isEnabled: 1
                }
            },
            {
                $limit: 5
            }
        ], (err, cursor) => {
            if (err) {
                reject()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    return resolve(docs)
                })
                .catch(e2 => {
                    reject()
                    throw e2
                })
        })

    })
}

let getInquiryList = () => {
    return new Promise((resolve, reject) => {
        let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

        inquiryCollection.aggregate([
            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'userUniqueId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $match: {'user.isRealEstateAgent': true}
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: 'userUniqueId',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
            },
            {
                $unwind: '$agency'
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
                    inquiryUniqueId: {$first: '$_id'},
                    realEstateUniqueId: {$first: '$userUniqueId'},
                    companyName: {$first: '$agency.companyName'},
                    ceoName: {$first: '$agency.ceoName'},
                    inquiryType: {$first: '$inquiryType'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    date: {$first: '$date'},
                    reply: {$first: '$reply'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    _id: 0,
                    inquiryUniqueId: 1,
                    realEstateUniqueId: 1,
                    companyName: 1,
                    ceoName: 1,
                    inquiryType: 1,
                    title: 1,
                    inquiry: 1,
                    date: 1,
                    'inquiryReply.responderUniqueId': '$reply.responderUniqueId',
                    'inquiryReply.message': '$reply.message',
                    property: {
                        'propertyUniqueId': '$property._id',
                        'title': '$property.title',
                        'address_1': '$property.address_1',
                        'address_2': '$property.address_2',
                        'floor': '$property.size.floor',
                        'totalFloor': '$property.size.totalFloor'
                    }
                }
            },
            {
                $sort: {'inquiryUniqueId': -1}
            },
            {
                $limit: 5
            }
        ], (err, cursor) => {
            if (err) {
                reject()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    return resolve(docs)
                })
                .catch(e2 => {
                    reject()
                    throw e2
                })
        })
    })
}

let getRealEstateList = () => {
    return new Promise((resolve, reject) => {
        let realEstateCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

        realEstateCollection.aggregate([
            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'realEstateAgentUniqueId',
                    foreignField: '_id',
                    as: 'realEstateAgent'
                }
            },
            {
                $unwind: '$realEstateAgent'
            },
            {$match: {'realEstateAgent.isRealEstateAgent': true}},
            {
                $group: {
                    _id: '$_id',
                    realEstateAgentUniqueId: {$first: '$realEstateAgent._id'},
                    companyName: {$first: '$companyName'},
                    ceoName: {$first: '$ceoName'},
                    licenseNumber: {$first: '$licenseNumber'},
                    phoneNumber: {$first: '$phoneNumber'},
                    email: {$first: '$realEstateAgent.email'},
                    address_1: {$first: '$address_1'},
                    address_2: {$first: '$address_2'}
                }
            },
            {
                $sort: {_id: -1}
            },
            {
                $project: {
                    _id: 0,
                    realEstateUniqueId: '$_id',
                    realEstateAgentUniqueId: 1,
                    companyName: 1,
                    ceoName: 1,
                    licenseNumber: 1,
                    phoneNumber: 1,
                    email: 1,
                    address_1: 1,
                    address_2: 1
                }
            },
            {
                $limit: 4
            }
        ], (err, cursor) => {
            if (err) {
                reject()

                throw err
            }

            cursor.toArray()
                .then(docs => {
                    return resolve(docs)
                })
                .catch(e2 => {

                    reject()
                    throw e2
                })
        })
    })
}

router.post('/fetch/realestate/approval/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.aggregate([
            {$match: {isRealEstateAgent: true}},
            {
                $facet: {
                    count: [{$count: 'totalCount'}],
                    approvalList: [

                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: '_id',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'agency'
                            }
                        },
                        {
                            $unwind: '$agency'
                        },
                        {
                            $group: {
                                _id: '$_id',
                                realEstateUniqueId: {$first: '$agency._id'},
                                realEstateAgentUniqueId: {$first: '$_id'},
                                ceoName: {$first: '$agency.ceoName'},
                                companyName: {$first: '$agency.companyName'},
                                licenseNumber: {$first: '$agency.licenseNumber'},
                                address_1: {$first: '$agency.address_1'},
                                address_2: {$first: '$agency.address_2'},
                                phoneNumber: {$first: '$agency.phoneNumber'},
                                isConfirmed: {$first: '$isConfirmed'},
                                isEnabled: {$first: '$isEnabled'}
                            }
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
                        {
                            $project: {
                                _id: 0,
                                realEstateUniqueId: 1,
                                realEstateAgentUniqueId: 1,
                                ceoName: 1,
                                companyName: 1,
                                licenseNumber: 1,
                                address_1: 1,
                                address_2: 1,
                                phoneNumber: 1,
                                isConfirmed: 1,
                                isEnabled: 1
                            }
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
                        approvalList: []
                    }

                    if (docs.length > 0) {
                        let result = docs[0]

                        response.totalCount = result.count.totalCount
                        response.approvalList = result.approvalList
                    }

                    res.json(response)
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/approve/realestate', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.findOneAndUpdate({_id: new objectId(realEstateAgentUniqueId)}, {
            $set: {
                isConfirmed: true,
                isEnabled: true
            }
        })
            .then(() => {
                userCollection.findOne({_id: new objectId(realEstateAgentUniqueId)})
                    .then(user => {

                        let info = {
                            username: user.name,
                            email: user.email,
                            receiverPhoneNumber: user.phoneNumber
                        }

                        alimtalk.sendJoinApprovalNotice(info)
                    })
                    .catch(err => {
                        res.status(500).send()
                        throw err
                    })

                res.json({isApproved: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })

        //TODO: 승인 카톡 메시지 보내기 (로그인 이메일 주소 포함)
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/cancel/realestate', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)
        userCollection.findOneAndUpdate({_id: new objectId(realEstateAgentUniqueId)}, {
            $set: {
                isConfirmed: false,
                isEnabled: false
            }
        })
            .then(() => {
                res.json({isCanceled: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/vrTour/approval/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourRECollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

        vrTourRECollection.aggregate([
            {
                $facet: {
                    count: [{$count: 'totalCount'}],
                    vrTourRequestList: [
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
                                localField: 'userUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'agency'
                            }
                        },
                        {
                            $unwind: '$agency'
                        },
                        {
                            $group: {
                                _id: '$_id',
                                vrTourUniqueId: {$first: '$_id'},
                                realEstateAgentUniqueId: {$first: '$userUniqueId'},
                                ceoName: {$first: '$agency.ceoName'},
                                companyName: {$first: '$agency.companyName'},
                                title: {$first: '$property.title'},
                                category: {$first: '$property.category'},
                                address_1: {$first: '$property.address_1'},
                                address_2: {$first: '$property.address_2'},
                                dongNumber: {$first: '$property.dongNumber'},
                                size: {$first: '$property.size'},
                                salesMethod: {$first: '$property.salesMethod'},
                                price: {$first: '$property.price'},
                                deposit: {$first: '$property.deposit'},
                                currDeposit: {$first: '$property.currDeposit'},
                                currRent: {$first: '$property.currRent'},
                                owner: {$first: '$property.owner'},
                                isConfirmed: {$first: '$isConfirmed'},
                                isEnabled: {$first: '$isEnabled'}
                            }
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
                        {
                            $project: {
                                _id: 0,
                                vrTourUniqueId: 1,
                                realEstateAgentUniqueId: 1,
                                ceoName: 1,
                                companyName: 1,
                                title: 1,
                                category: 1,
                                address_1: 1,
                                address_2: 1,
                                dongNumber: 1,
                                size: 1,
                                salesMethod: 1,
                                price: 1,
                                deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                                currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                                currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                                owner: 1,
                                isConfirmed: 1,
                                isEnabled: 1
                            }
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
                    let result = docs[0]

                    let response = {
                        totalCount: 0,
                        vrTourRequestList: []
                    }


                    if (docs.length > 0) {
                        response.totalCount = result.count.totalCount
                        response.vrTourRequestList = result.vrTourRequestList

                    }

                    res.json(response)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/approve/realestate/vrTour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourRECollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)

        vrTourRECollection.aggregate([
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
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    if (docs.length > 0) {
                        let vrTourRequest = docs[0]

                        if (vrTourRequest.property.vrTourPath && vrTourRequest.property.vrTourPort) {
                            let vrTourKey = shortid.generate()

                            vrTourRECollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
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
                                            res.json({isApproved: true, error: null})

                                            alimtalk.sendAlimTalkToVrTourRequester(vrTourUniqueId, true)

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
                        } else {
                            res.json({isApproved: false, error: null})
                        }


                    }
                })

        })


    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/cancel/realestate/vrTour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourRECollection = db.getDb().collection(constants.collection.VR_TOUR_RE_AGENT)
        vrTourRECollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
            $set: {
                grantedTime: null,
                isConfirmed: false,
                isEnabled: false
            }
        })
            .then(() => {

                res.json({isCanceled: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/cancel/vrTour/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)
    let realEstateNameSortingOrder = parseInt(req.body.realEstateNameSortingOrder)
    let salesStatus = req.body.salesStatus

    let sortingObj = {
        $sort: {_id: -1}
    }

    if (realEstateNameSortingOrder !== 0) {
        sortingObj = {
            $sort: {'agency.companyName': realEstateNameSortingOrder}
        }
    }

    let salesStatusObj = {
        $match: {'property.status.type': salesStatus}
    }

    if (salesStatus === constants.salesStatus.ALL.type) {
        salesStatusObj = {
            $match: {
                $or: [
                    {'property.status.type': {$eq: constants.salesStatus.SELLING.type}},
                    {'property.status.type': {$eq: constants.salesStatus.COMPLETED.type}},
                    {'property.status.type': {$eq: constants.salesStatus.WITHDRAWN.type}},
                    {'property.status.type': {$eq: constants.salesStatus.OTHER.type}},
                    {'property.status.type': {$eq: constants.salesStatus.CLOSED.type}}
                ]
            }
        }
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourDeleteRequestCollection = db.getDb().collection(constants.collection.VR_DELETE_REQUEST)
        vrTourDeleteRequestCollection.aggregate([
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
                        salesStatusObj,
                        {$count: 'totalCount'}
                    ],
                    vrDeleteRequestList: [
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
                                from: constants.collection.PROPERTY,
                                localField: 'propertyUniqueId',
                                foreignField: '_id',
                                as: 'property'
                            }
                        },
                        {
                            $unwind: '$property'
                        },
                        salesStatusObj,
                        {
                            $group: {
                                _id: '$_id',
                                realEstateAgentUniqueId: {$first: '$realEstateAgentUniqueId'},
                                vrTourDeleteUniqueId: {$first: '$_id'},
                                propertyUniqueId: {$first: '$property._id'},
                                ceoName: {$first: '$agency.ceoName'},
                                companyName: {$first: '$agency.companyName'},
                                status: {$first: '$property.status'},
                                title: {$first: '$property.title'},
                                category: {$first: '$property.category'},
                                address_1: {$first: '$property.address_1'},
                                address_2: {$first: '$property.address_2'},
                                dongNumber: {$first: '$property.dongNumber'},
                                size: {$first: '$property.size'},
                                salesMethod: {$first: '$property.salesMethod'},
                                price: {$first: '$property.price'},
                                deposit: {$first: '$property.deposit'},
                                currDeposit: {$first: '$property.currDeposit'},
                                currRent: {$first: '$property.currRent'},
                                owner: {$first: '$property.owner'},
                                isConfirmed: {$first: '$isConfirmed'},
                                isEnabled: {$first: '$isEnabled'}

                            }
                        },
                        sortingObj,
                        {
                            $skip: skip
                        },
                        {
                            $limit: limit
                        },
                        {
                            $project: {
                                _id: 0,
                                realEstateAgentUniqueId: 1,
                                vrTourDeleteUniqueId: 1,
                                propertyUniqueId: 1,
                                ceoName: 1,
                                companyName: 1,
                                status: 1,
                                title: 1,
                                category: 1,
                                address_1: 1,
                                address_2: 1,
                                dongNumber: 1,
                                size: 1,
                                salesMethod: 1,
                                price: 1,
                                deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                                currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                                currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                                owner: 1,
                                isConfirmed: 1,
                                isEnabled: 1
                            }
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
                        vrDeleteRequestList: []
                    }

                    if (docs.length > 0) {
                        let result = docs[0]
                        response.totalCount = result.count.totalCount
                        response.vrDeleteRequestList = result.vrDeleteRequestList
                    }

                    res.json(response)
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/delete/realestate/vrTour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let vrTourDeleteUniqueId = req.body.vrTourDeleteUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourDeleteRequestCollection = db.getDb().collection(constants.collection.VR_DELETE_REQUEST)
        vrTourDeleteRequestCollection.findOneAndUpdate({_id: new objectId(vrTourDeleteUniqueId)}, {
            $set: {
                isConfirmed: true,
                isEnabled: true
            }
        })
            .then(() => {

                return vrTourDeleteRequestCollection.findOne({_id: new objectId(vrTourDeleteUniqueId)})
            })
            .then(doc => {
                let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
                return propertyCollection.findOneAndUpdate({_id: new objectId(doc.propertyUniqueId)}, {$set: {status: doc.status}})

            })
            .then(result => {

                res.json({isDeleted: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/deny/delete/request/realestate/vrTour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let vrTourDeleteUniqueId = req.body.vrTourDeleteUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourDeleteRequestCollection = db.getDb().collection(constants.collection.VR_DELETE_REQUEST)

        vrTourDeleteRequestCollection.findOneAndUpdate({_id: new objectId(vrTourDeleteUniqueId)}, {
            $set: {
                isConfirmed: false,
                isEnabled: false
            }
        })
            .then(() => {
                res.json({isDenied: true, error: null})
            })
            .catch(err => {

                res.status(500).send()
                return err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/fetch/realestate/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let realEstateCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
        realEstateCollection.aggregate([
            {
                $facet: {
                    count: [{$count: 'totalCount'}],
                    realEstateList: [
                        {
                            $lookup: {
                                from: constants.collection.USER,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: '_id',
                                as: 'realEstateAgent'
                            }
                        },
                        {
                            $unwind: '$realEstateAgent'
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
                        {
                            $project: {
                                _id: 0,
                                realEstateUniqueId: '$_id',
                                realEstateAgentUniqueId: '$realEstateAgent._id',
                                ceoName: '$ceoName',
                                companyName: '$companyName',
                                licenseNumber: '$licenseNumber',
                                phoneNumber: '$phoneNumber',
                                email: '$realEstateAgent.email',
                                address_1: '$address_1',
                                address_2: '$address_2'
                            }
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
                        realEstateList: []

                    }

                    if (docs.length > 0) {
                        let result = docs[0]

                        response.totalCount = result.count.totalCount
                        response.realEstateList = result.realEstateList
                    }

                    res.json(response)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })

        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/get/realEstate/info', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let userCollection = db.getDb().collection(constants.collection.USER)
        userCollection.aggregate([
            {$match: {_id: new objectId(realEstateAgentUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: '_id',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
            },
            {
                $unwind: '$agency'
            },
            {
                $project: {
                    _id: 0,
                    realEstateUniqueId: '$agency._id',
                    licenseNumber: '$agency.licenseNumber',
                    companyName: '$agency.companyName',
                    ceoName: '$agency.ceoName',
                    email: '$email',
                    address_1: '$agency.address_1',
                    address_2: '$agency.address_2',
                    phoneNumber: '$phoneNumber'
                }
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
                    } else {
                        res.json({})
                    }
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })

    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/edit/realEstate/info', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let password = req.body.password
    let companyName = req.body.companyName
    let ceoName = req.body.ceoName
    let email = req.body.email
    let address_1 = req.body.address_1
    let address_2 = req.body.address_2
    let phoneNumber = req.body.phoneNumber

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let newInfo = {
            companyName: companyName,
            ceoName: ceoName,
            email: email,
            address_1: address_1,
            address_2: address_2,
            phoneNumber: phoneNumber
        }

        let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
        realEstateInfoCollection.findOneAndUpdate({_id: new objectId(realEstateUniqueId)}, {$set: newInfo})
            .then(() => {

                let userCollection = db.getDb().collection(constants.collection.USER)

                userCollection.findOneAndUpdate({_id: new objectId(realEstateAgentUniqueId)}, {
                    $set: {
                        name: ceoName,
                        companyName: companyName,
                        email: email,
                        address_1: address_1,
                        address_2: address_2,
                        phoneNumber: phoneNumber
                    }
                })

                if (password.length > 0) {
                    bcrypt.genSalt(saltRounds, (err, salt) => {
                        if (err) {
                            res.status(500).send()
                            throw err
                        }

                        bcrypt.hash(password, salt, (e2, hash) => {
                            if (e2) {
                                res.status(500).send()
                                throw e2
                            }

                            userCollection.findOneAndUpdate({_id: new objectId(realEstateAgentUniqueId)}, {$set: {password: hash}})
                        })
                    })
                }
                res.json({isChanged: true, error: null})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/fetch/realEstate/property/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let realEstateUniqueId = req.body.realEstateUniqueId
    let realEstateAgentUniqueId = req.body.realEstateAgentUniqueId
    let salesStatus = req.body.salesStatus
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)

    let salesStatusQueryObj = {
        $match: {'property.status.type': salesStatus}
    }

    if (salesStatus === constants.salesStatus.ALL.type) {
        salesStatusQueryObj = {
            $match: {
                $or: [
                    {'property.status.type': {$eq: constants.salesStatus.SELLING.type}},
                    {'property.status.type': {$eq: constants.salesStatus.COMPLETED.type}},
                    {'property.status.type': {$eq: constants.salesStatus.WITHDRAWN.type}},
                    {'property.status.type': {$eq: constants.salesStatus.OTHER.type}},
                    {'property.status.type': {$eq: constants.salesStatus.CLOSED.type}}
                ]
            }
        }
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

        realEstateInfoCollection.aggregate([
            {$match: {_id: new objectId(realEstateUniqueId)}},
            {
                $facet: {
                    count: [
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
                        salesStatusQueryObj,
                        {$count: 'totalCount'}

                    ],
                    realEstateInfo: [
                        {
                            $lookup: {
                                from: constants.collection.USER,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: '_id',
                                as: 'realEstateAgent'
                            }
                        },
                        {
                            $unwind: '$realEstateAgent'
                        },
                        {
                            $project: {
                                _id: 0,
                                realEstateUniqueId: '$_id',
                                realEstateAgentUniqueId: '$realEstateAgent._id',
                                companyName: '$companyName',
                                ceoName: '$ceoName',
                                licenseNumber: '$licenseNumber',
                                birthDate: '$realEstateAgent.birthDate',
                                gender: '$realEstateAgent.gender',
                                phoneNumber: '$phoneNumber',
                                email: '$realEstateAgent.email',
                                address_1: '$address_1',
                                address_2: '$address_2'
                            }
                        }
                    ],
                    properties: [
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
                        salesStatusQueryObj,
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR,
                                localField: 'property._id',
                                foreignField: 'propertyUniqueId',
                                as: 'vrTours'
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR_RE_AGENT,
                                localField: 'property._id',
                                foreignField: 'propertyUniqueId',
                                as: 'vrToursRE'
                            }
                        },
                        {
                            $lookup: {
                                from: constants.collection.VISIT_APPOINTMENT,
                                localField: 'property._id',
                                foreignField: 'propertyUniqueId',
                                as: 'visitAppointments'
                            }
                        },
                        {
                            $sort: {'property._id': -1}
                        },
                        {
                            $project: {
                                propertyUniqueId: '$property._id',
                                category: '$property.category',
                                title: '$property.title',
                                address_2: '$property.address_2',
                                size: '$property.size',
                                price: '$property.price',
                                deposit: '$property.deposit',
                                currDeposit: '$property.currDeposit',
                                currRent: '$property.currRent',
                                salesMethod: '$property.salesMethod',
                                owner: '$property.owner',
                                status: '$property.status',
                                moveinDate: '$property.moveinDate',
                                reservationCount: {$size: '$visitAppointments'},
                                vrTourCount: {$size: '$vrTours'},
                                vrTourRECount: {$size: '$vrToursRE'}
                            }
                        },

                        {
                            $skip: skip
                        },
                        {
                            $limit: limit
                        },
                        {
                            $project: {
                                _id: 0,
                                propertyUniqueId: 1,
                                category: 1,
                                title: 1,
                                address_2: 1,
                                size: 1,
                                price: 1,
                                deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                                currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                                currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                                salesMethod: 1,
                                owner: 1,
                                moveinDate: 1,
                                status: 1,
                                reservationCount: 1,
                                vrTourCount: {$sum: ['$vrTourCount', '$vrTourRECount']}
                            }
                        }
                    ]
                }
            },
            {
                $unwind: {
                    path: '$count',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $unwind: '$realEstateInfo'
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
                        realEstateInfo: {},
                        properties: []
                    }

                    if (docs.length > 0) {
                        let result = docs[0]
                        response.totalCount = (result.count === undefined) ? 0 : result.count.totalCount
                        response.realEstateInfo = result.realEstateInfo
                        response.properties = result.properties
                    }

                    res.json(response)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/approve/member/vr/tour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

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
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    if (docs.length > 0) {

                        let vrTourRequest = docs[0]


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

                                            res.json({isApproved: true})
                                            alimtalk.sendAlimTalkToVrTourRequester(vrTourUniqueId)
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
                        } else {
                            res.json({isApproved: false})
                        }

                    }
                })
        })


    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/cancel/member/vr/tour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let vrTourUniqueId = req.body.vrTourUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})
            return
        }

        let vrTourCollection = db.getDb().collection(constants.collection.VR_TOUR)
        vrTourCollection.findOneAndUpdate({_id: new objectId(vrTourUniqueId)}, {
            $set: {
                grantedTime: null,
                isConfirmed: false,
                isEnabled: false
            }
        })
            .then(() => {
                res.json({isCanceled: true})
            })
            .catch(err => {
                res.status(500).send()
                throw err
            })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/aggregate/example', (req, res) => {

    let vrSavedPropertyCollection = db.getDb().collection(constants.collection.SAVED_PROPERTY)

    vrSavedPropertyCollection.aggregate([
        {
            $lookup: {
                from: 'PROPERTY',
                localField: 'propertyUniqueId',
                foreignField: '_id',
                as: 'savedPropertyInfo'
            }
        },
        {
            $unwind: '$savedPropertyInfo'
        }
    ])

})

router.post('/fetch/prop/search', (req, res) => {
    let adminUniqueId = req.body.userUniqueId

    let firstArea = req.body.firstArea
    let secondArea = req.body.secondArea
    let Keyword = req.body.keyword
    let Keywords = (Keyword !== null && Keyword !== undefined) ? Keyword.split(/[\s, "]+/) : null

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        let matchQuery = []
        let totalCountQuery = []

        if (firstArea !== null) {
            let firstAreaQuery = {$match: {'location.firstArea': firstArea}}

            matchQuery.push(firstAreaQuery)
            totalCountQuery.push(firstAreaQuery)

            if (secondArea !== null) {
                let secondAreaQuery = {$match: {'location.secondArea': secondArea}}

                matchQuery.push(secondAreaQuery)
                totalCountQuery.push(secondAreaQuery)
            }
        }

        let inArray = []

        if (Keywords !== null) {
            Keywords.forEach(word => {
                let regex = new RegExp([word].join(''), 'i')
                inArray.push(regex)
            })

            let KeywordQuery = {$match: {'title': {$in: inArray}}}
            matchQuery.push(KeywordQuery)
            totalCountQuery.push(KeywordQuery)
        }

        let countGrouping = {
            $group: {
                _id: null,
                count: {$sum: 1}
            }
        }

        totalCountQuery.push(countGrouping)

        let isSavedQuery = [
            {
                $group: {
                    _id: '$_id',
                    propertyUniqueId: {$first: '$_id'},
                    title: {$first: '$title'},
                    salesMethod: {$first: '$salesMethod'},
                    price: {$first: '$price'},
                    deposit: {$first: '$deposit'},
                    currDeposit: {$first: '$currDeposit'},
                    currRent: {$first: '$currRent'},
                    coordinate: {$first: {latitude: '$latitude', longitude: '$longitude'}}
                }
            },
            {
                $project: {
                    _id: 0,
                    propertyUniqueId: 1,
                    title: 1,
                    salesMethod: 1,
                    price: 1,
                    deposit: {$cond: [{$or: [{$eq: ['$deposit', null]}, {$eq: ['$deposit', ""]}, {$eq: ['$deposit', "null"]}]}, null, '$deposit']},
                    currDeposit: {$cond: [{$or: [{$eq: ['$currDeposit', null]}, {$eq: ['$currDeposit', ""]}, {$eq: ['$currDeposit', "null"]}]}, null, '$currDeposit']},
                    currRent: {$cond: [{$or: [{$eq: ['$currRent', null]}, {$eq: ['$currRent', ""]}, {$eq: ['$currRent', "null"]}]}, null, '$currRent']},
                    coordinate: 1
                }
            }
        ]


        isSavedQuery.forEach(query => {
            matchQuery.push(query)
        })


        propertyCollection.aggregate(
            [
                {
                    $facet:
                        {
                            totalCount: totalCountQuery,
                            properties: matchQuery
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
                            properties: []

                        }

                        if (docs.length > 0) {
                            let result = docs[0]

                            response.totalCount = result.totalCount
                            response.properties = result.properties
                        }

                        res.json(response)
                    })
                    .catch(e2 => {
                        res.status(500).send()
                        throw e2
                    })

            })
    }
    ifAdminThenExecute(adminUniqueId, callback)
})


router.post('/fetch/prop/detail', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return

        }

        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.aggregate([
            {$match: {'_id': new objectId(propertyUniqueId)}},
            {
                $facet: {
                    propertyInfo: [
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
                                _id: 1,
                                category: 1,
                                salesMethod: 1,
                                mortgage: 1,
                                numberOfRooms: 1,
                                numberOfBathrooms: 1,
                                totalParkingLotCount: 1,
                                facingDirection: 1,
                                codeHeatNm: 1,
                                fuel: 1,
                                codeHallNm: 1,
                                hoCnt: 1,
                                maintenanceFee: 1,
                                note: 1,
                                address_1: 1,
                                address_2: {$cond: [{$or: [{$eq: ['$address_2', ""]}, {$eq: ['$address_2', "null"]}]}, null, '$address_2']},
                                doroAddress: 1,
                                title: 1,
                                dongNumber: 1,
                                hoNumber: 1,
                                size: 1,
                                moveinDate: 1,
                                numOfMonths: {$cond: [{$eq: ['$numOfMonths', "null"]}, null, '$numOfMonths']},
                                status: 1,
                                price: 1,
                                deposit: {$cond: [{$eq: ['$deposit', "null"]}, null, '$deposit']},
                                currDeposit: {$cond: [{$eq: ['$currDeposit', "null"]}, null, '$currDeposit']},
                                currRent: {$cond: [{$eq: ['$currRent', "null"]}, null, '$currRent']},
                                kaptCode: 1,
                                kaptBcompany: 1,
                                owner: 1,
                                thumbnail: 1,

                                loft: 1,
                                dateOfApproval: 1,
                                principalUser: 1,
                                parkingAvailability: 1,
                                officetelUse: 1,

                                'actualSales.actualPrice': '$actualSales.거래금액',
                                'actualSales.day': {
                                    $concat: [
                                        '$actualSales.년',
                                        {$cond: [{$eq: [{$strLenCP: '$actualSales.월'}, 1]}, {$concat: ['0', '$actualSales.월']}, '$actualSales.월']},
                                        {$cond: [{$eq: [{$strLenCP: '$actualSales.일'}, 1]}, {$concat: ['0', '$actualSales.일']}, '$actualSales.일']},
                                    ]
                                },
                                'actualSales.floor': '$actualSales.층',
                                'actualSales.actualSize': '$actualSales.전용면적'
                            }
                        },
                        {
                            $sort: {'actualSales.day': -1}
                        },
                        {
                            $group: {
                                _id: '$_id',
                                propertyUniqueId: {$first: '$_id'},
                                category: {$first: '$category'},
                                salesMethod: {$first: '$salesMethod'},
                                mortgage: {$first: '$mortgage'},
                                numberOfRooms: {$first: '$numberOfRooms'},
                                numberOfBathrooms: {$first: '$numberOfBathrooms'},
                                facingDirection: {$first: '$facingDirection'},
                                codeHeatNm: {$first: '$codeHeatNm'},
                                fuel: {$first: '$fuel'},
                                codeHallNm: {$first: '$codeHallNm'},
                                hoCnt: {$first: '$hoCnt'},
                                totalParkingLotCount: {$first: '$totalParkingLotCount'},
                                maintenanceFee: {$first: '$maintenanceFee'},
                                note: {$first: '$note'},
                                address_1: {$first: '$address_1'},
                                address_2: {$first: '$address_2'},
                                doroAddress: {$first: '$doroAddress'},
                                title: {$first: '$title'},
                                dongNumber: {$first: '$dongNumber'},
                                hoNumber: {$first: '$hoNumber'},
                                size: {$first: '$size'},
                                moveinDate: {$first: '$moveinDate'},
                                numOfMonths: {$first: '$numOfMonths'},
                                status: {$first: '$status'},
                                price: {$first: '$price'},
                                deposit: {$first: '$deposit'},
                                currDeposit: {$first: '$currDeposit'},
                                currRent: {$first: '$currRent'},
                                kaptCode: {$first: '$kaptCode'},
                                kaptBcompany: {$first: '$kaptBcompany'},
                                owner: {$first: '$owner'},
                                thumbnail: {$first: '$thumbnail'},

                                loft: {$first: '$loft'},
                                dateOfApproval: {$first: '$dateOfApproval'},
                                principalUser: {$first: '$principalUser'},
                                parkingAvailability: {$first: '$parkingAvailability'},
                                officetelUse: {$first: '$officetelUse'},

                                actualSales: {$push: '$actualSales'}
                            }
                        }
                    ],
                    agencyInfo: [
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
                            $group: {
                                _id: '$_id',
                                realEstateAgentUniqueId: {$first: '$agency.realEstateAgentUniqueId'},
                                companyName: {$first: '$agency.companyName'},
                                ceoName: {$first: '$agency.ceoName'},
                                agencyPhoneNumber: {$first: '$agency.phoneNumber'},
                                email: {$first: '$agency.email'}
                            }
                        },
                        {
                            $project: {
                                _id: 0,
                                realEstateAgentUniqueId: 1,
                                companyName: 1,
                                ceoName: 1,
                                agencyPhoneNumber: 1,
                                email: 1
                            }
                        }
                    ],
                    userVrTourList: [
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR,
                                localField: '_id',
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
                            $group: {
                                _id: '$userVrTour._id',
                                vrTourUniqueId: {$first: '$userVrTour._id'},
                                userUniqueId: {$first: '$userVrTour.userUniqueId'},
                                date: {$first: '$userVrTour.date'},
                                grantedTime: {$first: '$userVrTour.grantedTime'},
                                isConfirmed: {$first: '$userVrTour.isConfirmed'},
                                isEnabled: {$first: '$userVrTour.isEnabled'},
                                userName: {$first: '$user.name'},
                                email: {$first: '$user.email'},
                                phoneNumber: {$first: '$user.phoneNumber'}
                            }
                        },
                        {$sort: {'vrTourUniqueId': -1}},
                        {
                            $project: {
                                _id: 0,
                                vrTourUniqueId: 1,
                                userUniqueId: 1,
                                date: 1,
                                grantedTime: 1,
                                isConfirmed: 1,
                                isEnabled: 1,
                                userName: 1,
                                email: 1,
                                phoneNumber: 1
                            }
                        }
                    ],
                    agencyVrTourList: [
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR_RE_AGENT,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'agencyVrTour'
                            }
                        },
                        {
                            $unwind: '$agencyVrTour'
                        },
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'agencyVrTour.userUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'agencyInfo'
                            }
                        },
                        {
                            $unwind: '$agencyInfo'
                        },
                        {
                            $group: {
                                _id: '$agencyVrTour._id',
                                vrTourUniqueId: {$first: '$agencyVrTour._id'},
                                realEstateAgentUniqueId: {$first: '$agencyVrTour.userUniqueId'},
                                date: {$first: '$agencyVrTour.date'},
                                grantedTime: {$first: '$agencyVrTour.grantedTime'},
                                isConfirmed: {$first: '$agencyVrTour.isConfirmed'},
                                isEnabled: {$first: '$agencyVrTour.isEnabled'},
                                companyName: {$first: '$agencyInfo.companyName'},
                                ceoName: {$first: '$agencyInfo.ceoName'},
                                phoneNumber: {$first: '$agencyInfo.phoneNumber'}
                            }
                        },
                        {$sort: {'vrTourUniqueId': -1}},
                        {
                            $project: {
                                _id: 0,
                                vrTourUniqueId: 1,
                                realEstateAgentUniqueId: 1,
                                date: 1,
                                grantedTime: 1,
                                isConfirmed: 1,
                                isEnabled: 1,
                                companyName: 1,
                                ceoName: 1,
                                phoneNumber: 1
                            }
                        }
                    ],
                    visitAppointmentList: [
                        {
                            $lookup: {
                                from: constants.collection.VISIT_APPOINTMENT,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'visitAppointment'
                            }
                        },
                        {
                            $unwind: '$visitAppointment'
                        },
                        {
                            $lookup: {
                                from: constants.collection.USER,
                                localField: 'visitAppointment.userUniqueId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        {
                            $unwind: '$user'
                        },
                        {
                            $group: {
                                _id: '$visitAppointment._id',
                                visitAppointmentUniqueId: {$first: '$visitAppointment._id'},
                                userUniqueId: {$first: '$visitAppointment.userUniqueId'},
                                appointmentDate: {$first: '$visitAppointment.appointmentDate'},
                                isConfirmed: {$first: '$visitAppointment.isConfirmed'},
                                isEnabled: {$first: '$visitAppointment.isEnabled'},
                                name: {$first: '$user.name'},
                                phoneNumber: {$first: '$user.phoneNumber'},
                                isRealEstateAgent: {$first: '$user.isRealEstateAgent'}
                            }
                        },
                        {$sort: {'visitAppointmentUniqueId': -1}},
                        {
                            $project: {
                                _id: 0,
                                visitAppointmentUniqueId: 1,
                                userUniqueId: 1,
                                appointmentDate: 1,
                                isConfirmed: 1,
                                isEnabled: 1,
                                name: 1,
                                phoneNumber: 1,
                                isRealEstateAgent: 1
                            }
                        }
                    ],
                    inquiryList: [
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'inquiry'
                            }
                        },
                        {
                            $unwind: '$inquiry'
                        },
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY_ANSWER,
                                localField: 'inquiry._id',
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
                                from: constants.collection.USER,
                                localField: 'inquiry.userUniqueId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        {
                            $unwind: '$user'

                        },
                        {
                            $group: {
                                _id: '$inquiry._id',
                                inquiryUniqueId: {$first: '$inquiry._id'},
                                userUniqueId: {$first: '$user._id'},
                                userName: {$first: '$user.name'},
                                isRealEstateAgent: {$first: '$user.isRealEstateAgent'},
                                date: {$first: '$inquiry.date'},
                                title: {$first: '$inquiry.title'},
                                inquiry: {$first: '$inquiry.inquiry'},
                                inquiryType: {$first: '$inquiry.inquiryType'},
                                inquiryReply: {$first: '$reply'}
                            }
                        },
                        {$sort: {'inquiryUniqueId': -1}},
                        {
                            $project: {
                                _id: 0,
                                inquiryUniqueId: 1,
                                userUniqueId: 1,
                                userName: 1,
                                isRealEstateAgent: 1,
                                date: 1,
                                title: 1,
                                inquiry: 1,
                                inquiryType: 1,
                                inquiryReply: {$cond: [{$eq: ['$inquiryReply', null]}, {}, '$inquiryReply']}
                            }
                        }
                    ]
                }
            },
            {
                $unwind: '$propertyInfo'
            },
            {
                $unwind: '$agencyInfo'
            },
            {
                $project: {
                    propertyInfo: 1,
                    agencyInfo: 1,
                    userVrTourList: {$slice: ['$userVrTourList', 5]},
                    agencyVrTourList: {$slice: ['$agencyVrTourList', 5]},
                    visitAppointmentList: {$slice: ['$visitAppointmentList', 5]},
                    inquiryList: {$slice: ['$inquiryList', 5]}
                }
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
    }
    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/fetch/realestate/inquiries', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let skip = parseInt(req.body.skip)
    let limit = parseInt(req.body.limit)
    let inquiryType = req.body.inquiryType
    let getRepliedOnly = req.body.getRepliedOnly

    let inquiryStatusObj = {}

    if (inquiryType === 'ALL') {
        inquiryStatusObj = {
            $match: {
                $or: [
                    {'inquiryType': {$eq: 'INQUIRY_MEMBER'}},
                    {'inquiryType': {$eq: 'INQUIRY_APPOINTMENT'}},
                    {'inquiryType': {$eq: 'INQUIRY_PROPERTY'}},
                    {'inquiryType': {$eq: 'INQUIRY_OTHER'}}
                ]
            }
        }
    } else {
        inquiryStatusObj = {$match: {'inquiryType': inquiryType}}
    }

    let replyStatusObj = {}

    if (getRepliedOnly) {
        replyStatusObj = {$match: {'reply': {$ne: null}}}
    } else if (getRepliedOnly === false) {
        replyStatusObj = {$match: {'reply': null}}
    } else {
        replyStatusObj = {$match: {$or: [{'reply': {$ne: null}}, {'reply': null}]}}
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)

        inquiryCollection.aggregate([
            inquiryStatusObj,
            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'userUniqueId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $match: {'user.isRealEstateAgent': true}
            },
            {
                $unwind: '$user'
            },
            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: 'userUniqueId',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
            },
            {
                $unwind: '$agency'
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
            replyStatusObj,
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
                    inquiryUniqueId: {$first: '$_id'},
                    realEstateUniqueId: {$first: '$userUniqueId'},
                    companyName: {$first: '$agency.companyName'},
                    ceoName: {$first: '$agency.ceoName'},
                    inquiryType: {$first: '$inquiryType'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    date: {$first: '$date'},
                    reply: {$first: '$reply'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    _id: 0,
                    inquiryUniqueId: 1,
                    realEstateUniqueId: 1,
                    companyName: 1,
                    ceoName: 1,
                    inquiryType: 1,
                    title: 1,
                    inquiry: 1,
                    date: 1,
                    'inquiryReply.responderUniqueId': '$reply.responderUniqueId',
                    'inquiryReply.message': '$reply.message',
                    property: {
                        $cond: [{$eq: ['$property', null]},
                            null,
                            {
                                'propertyUniqueId': '$property._id',
                                'title': '$property.title',
                                'address_1': '$property.address_1',
                                'address_2': '$property.address_2',
                                'floor': '$property.size.floor',
                                'totalFloor': '$property.size.totalFloor'
                            }
                        ]
                    }
                }
            },
            {
                $sort: {'inquiryUniqueId': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
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
                    inquiryList: docs
                }

                res.json(response)
            })
        })
    }
    ifAdminThenExecute(adminUniqueId, callback)
})


router.post('/fetch/realestate/saved/properties', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let memberUniqueId = req.body.memberUniqueId
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        let savedPropertyCollection = db.getDb().collection(constants.collection.SAVED_PROPERTY)

        savedPropertyCollection.aggregate([
            {$match: {'userUniqueId': new objectId(memberUniqueId)}},
            {
                $facet: {
                    info: [
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'userUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'agencyInfo'
                            }
                        },
                        {
                            $unwind: '$agencyInfo'
                        },
                        {
                            $group: {
                                _id: '$userUniqueId',
                                realEstateAgentUniqueId: {$first: '$agencyInfo.realEstateAgentUniqueId'},
                                companyName: {$first: '$agencyInfo.companyName'},
                                ceoName: {$first: '$agencyInfo.ceoName'},
                                email: {$first: '$agencyInfo.email'},
                                phoneNumber: {$first: '$agencyInfo.phoneNumber'},
                                address_1: {$first: '$agencyInfo.address_1'},
                                address_2: {$first: '$agencyInfo.address_2'},
                                licenseNumber: {$first: '$agencyInfo.licenseNumber'}
                            }
                        }

                    ],
                    savedProperties: [
                        {
                            $lookup: {
                                from: constants.collection.PROPERTY,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: 'userUniqueId',
                                as: 'property'
                            }
                        },
                        {
                            $unwind: '$property'
                        },
                        {
                            $group: {
                                _id: '$_id',
                                savedPropertyUniqueId: {$first: '$_id'},
                                propertyUniqueId: {$first: '$property._id'},
                                price: {$first: '$property.price'},
                                deposit: {$first: '$property.deposit'},
                                currDeposit: {$first: '$property.currDeposit'},
                                currRent: {$first: '$property.currRent'},
                                category: {$first: '$property.category'},
                                address_1: {$first: '$property.address_1'},
                                address_2: {$first: '$property.address_2'},
                                title: {$first: '$property.title'},
                                salesMethod: {$first: '$property.salesMethod'},
                                size: {$first: '$property.size'},
                                thumbnail: {$first: '$property.thumbnail'},
                            }
                        },
                        {
                            $sort: {'_id': -1}
                        }

                    ]

                }
            },
            {$unwind: '$info'},
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
    }
    ifAdminThenExecute(adminUniqueId, callback)
})


router.post('/fetch/inquiries/list', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let limit = req.body.limit
    let skip = req.body.skip
    let getRepliedOnly = req.body.getRepliedOnly
    let inquiryType = req.body.inquiryType
    let isRealEstateAgent = req.body.isRealEstateAgent

    let inquiryStatusObj = {}

    if (inquiryType === 'ALL') {
        inquiryStatusObj = {
            $match: {
                $or: [
                    {'inquiryType': {$eq: 'INQUIRY_MEMBER'}},
                    {'inquiryType': {$eq: 'INQUIRY_APPOINTMENT'}},
                    {'inquiryType': {$eq: 'INQUIRY_PROPERTY'}},
                    {'inquiryType': {$eq: 'INQUIRY_OTHER'}}
                ]
            }
        }
    } else {
        inquiryStatusObj = {$match: {'inquiryType': inquiryType}}
    }


    let replyStatusObj = {}

    if (getRepliedOnly) {
        replyStatusObj = {$match: {'reply': {$ne: null}}}
    } else if (getRepliedOnly === false) {
        replyStatusObj = {$match: {'reply': null}}
    } else {
        replyStatusObj = {$match: {$or: [{'reply': {$ne: null}}, {'reply': null}]}}
    }

    let inquiryCollection = ""

    let query = []

    if (isRealEstateAgent === false) {
        inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)
        query = [
            inquiryStatusObj,
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
            replyStatusObj,
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
                $match: {'user.isRealEstateAgent': isRealEstateAgent}
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
                    inquiryUniqueId: {$first: '$_id'},
                    date: {$first: '$date'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    inquiryType: {$first: '$inquiryType'},
                    inquiryReply: {$first: '$reply'},
                    inquirerUniqueId: {$first: '$user._id'},
                    userName: {$first: '$user.name'},
                    isRealEstateAgent: {$first: '$user.isRealEstateAgent'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    _id: 0,
                    inquiryUniqueId: 1,
                    date: 1,
                    title: 1,
                    inquiry: 1,
                    inquiryType: 1,
                    inquiryReply: {
                        $cond: [{$eq: ['$inquiryReply', null]}, {}, '$inquiryReply']
                    },
                    inquirerUniqueId: 1,
                    userName: 1,
                    isRealEstateAgent: 1,
                    property: {
                        $cond: [{$eq: ['$property', null]}, null, {
                            propertyUniqueId: '$property._id',
                            title: '$property.title',
                            address_1: '$property.address_1',
                            address_2: '$property.address_2'
                        }]
                    }
                }
            },
            {
                $sort: {'inquiryUniqueId': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }

        ]
    } else if (isRealEstateAgent) {
        inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)
        query = [
            inquiryStatusObj,
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
            replyStatusObj,
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
                $match: {'user.isRealEstateAgent': isRealEstateAgent}
            },
            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: 'userUniqueId',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
            },
            {
                $unwind: '$agency'
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
                    inquiryUniqueId: {$first: '$_id'},
                    date: {$first: '$date'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    inquiryType: {$first: '$inquiryType'},
                    inquiryReply: {$first: '$reply'},
                    inquirerUniqueId: {$first: '$user._id'},
                    userName: {$first: '$user.name'},
                    companyName: {$first: '$agency.companyName'},
                    isRealEstateAgent: {$first: '$user.isRealEstateAgent'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    _id: 0,
                    inquiryUniqueId: 1,
                    date: 1,
                    title: 1,
                    inquiry: 1,
                    inquiryType: 1,
                    inquiryReply: {
                        $cond: [{$eq: ['$inquiryReply', null]}, {}, '$inquiryReply']
                    },
                    inquirerUniqueId: 1,
                    userName: 1,
                    companyName: 1,
                    isRealEstateAgent: 1,
                    property: {
                        $cond: [{$eq: ['$property', null]}, null, {
                            propertyUniqueId: '$property._id',
                            title: '$property.title',
                            address_1: '$property.address_1',
                            address_2: '$property.address_2'
                        }]
                    }
                }
            },
            {
                $sort: {'inquiryUniqueId': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }

        ]
    } else {
        inquiryCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER)
        query = [
            inquiryStatusObj,
            {
                $lookup: {
                    from: 'INQUIRY_NON_MEMBER_ANSWER',
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
            replyStatusObj,
            {
                $lookup: {
                    from: 'PROPERTY',
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
                    inquiryUniqueId: {$first: '$_id'},
                    date: {$first: '$date'},
                    title: {$first: '$title'},
                    inquiry: {$first: '$inquiry'},
                    inquiryType: {$first: '$inquiryType'},
                    inquiryReply: {$first: '$reply'},
                    userName: {$first: '$name'},
                    userEmail: {$first: '$email'},
                    userPhoneNumber: {$first: '$phoneNumber'},
                    property: {$first: '$property'}
                }
            },
            {
                $project: {
                    _id: 0,
                    inquiryUniqueId: 1,
                    date: 1,
                    inquiry: 1,
                    inquiryType: 1,
                    inquiryReply: {
                        $cond: [{$eq: ['$inquiryReply', null]}, {}, '$inquiryReply']
                    },
                    userName: 1,
                    userEmail: 1,
                    userPhoneNumber: 1,
                    property: {
                        $cond: [{$eq: ['$property', null]}, null, {
                            propertyUniqueId: '$property._id',
                            title: '$property.title',
                            address_1: '$property.address_1',
                            address_2: '$property.address_2'
                        }]
                    }
                }
            },
            {
                $sort: {'inquiryUniqueId': -1}
            },
            {
                $skip: skip
            },
            {
                $limit: limit
            }
        ]
    }

    let callback = (isAdmin) => {
        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        inquiryCollection.aggregate([
            {
                $facet: {
                    inquiries: query
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()

                throw err
            }

            cursor.toArray()
                .then(docs => {
                    if (docs.length > 0) {
                        let response = docs[0]

                        res.json(response)
                    }
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })

    }

    ifAdminThenExecute(adminUniqueId, callback)
})

router.post('/fetch/inquiries/detail', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let inquiryUniqueId = req.body.inquiryUniqueId
    let memberType = req.body.memberType

    let query = []

    let inquiryCollection = ""

    if (memberType === "member") {
        inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)
        query = [
            {$match: {'isRealEstateAgent': false}},
            {$match: {'_id': new objectId(inquiryUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.USER,
                    localField: 'userUniqueId',
                    foreignField: '_id',
                    as: 'user'
                }
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
                $project: {
                    _id: 1,
                    inquiryUniqueId: '$_id',
                    userUniqueId: '$user._id',
                    userName: '$user.name',
                    inquiryType: 1,
                    title: 1,
                    inquiry: 1,
                    date: 1,
                    reply: '$reply',
                    property: {
                        'propertyUniqueId': '$property._id',
                        'title': '$property.title',
                        'address_1': '$property.address_1',
                        'address_2': '$property.address_2',
                    }
                }
            },
            {
                $unwind: '$userUniqueId'
            },
            {
                $unwind: '$userName'
            }
        ]

    } else if (memberType === "realEstate") {
        inquiryCollection = db.getDb().collection(constants.collection.INQUIRY)
        query = [
            {$match: {'_id': new objectId(inquiryUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.REAL_ESTATE_AGENT_INFO,
                    localField: 'userUniqueId',
                    foreignField: 'realEstateAgentUniqueId',
                    as: 'agency'
                }
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
                $project: {
                    _id: 1,
                    inquiryUniqueId: '$_id',
                    realEstateAgentUniqueId: '$agency.realEstateAgentUniqueId',
                    companyName: '$agency.companyName',
                    ceoName: '$agency.ceoName',
                    inquiryType: 1,
                    title: 1,
                    inquiry: 1,
                    date: 1,
                    reply: '$reply',
                    property: {
                        'propertyUniqueId': '$property._id',
                        'title': '$property.title',
                        'address_1': '$property.address_1',
                        'address_2': '$property.address_2',
                    }
                }
            },
            {
                $unwind: '$companyName'
            },
            {
                $unwind: '$ceoName'
            },
            {
                $unwind: '$realEstateAgentUniqueId'
            }
        ]

    } else {
        inquiryCollection = db.getDb().collection(constants.collection.INQUIRY_NON_MEMBER)
        query = [
            {$match: {'_id': new objectId(inquiryUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.INQUIRY_NON_MEMBER_ANSWER,
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
                $project: {
                    _id: 1,
                    inquiryUniqueId: '$_id',
                    userName: '$name',
                    userEmail: '$email',
                    phoneNumber: '$phoneNumber',
                    inquiryType: 1,
                    title: 1,
                    inquiry: 1,
                    date: 1,
                    reply: '$reply',
                    property: {
                        'propertyUniqueId': '$property._id',
                        'title': '$property.title',
                        'address_1': '$property.address_1',
                        'address_2': '$property.address_2',
                    }
                }
            }
        ]

    }


    let callback = (isAdmin) => {

        if (!isAdmin) {
            res.json({error: {code: 'AD001', message: '접근 권한이 없습니다.'}})

            return
        }

        inquiryCollection.aggregate([
            {
                $facet: {
                    inquiry: query
                }
            },
            {
                $unwind: '$inquiry'
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()

                throw err
            }

            cursor.toArray()
                .then(docs => {
                    if (docs.length > 0) {
                        let response = docs[0]

                        res.json(response)
                    }
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })

    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/search/realestate', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let Keyword = req.body.keyword
    let keywords = (Keyword !== null && Keyword !== undefined) ? Keyword.split(/[\s,"]+/) : null

    let callback = (isAdmin) => {

        let inArray = []

        keywords.forEach(word => {
            let regex = new RegExp([word].join(''), 'i')
            inArray.push(regex)
        })

        let realEstateAgentCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

        realEstateAgentCollection.aggregate([
            {$match: {'companyName': {$in: inArray}}},
            {
                $project: {
                    _id: 1,
                    realEstateAgentUniqueId: 1,
                    licenseNumber: 1,
                    companyName: 1,
                    ceoName: 1,
                    phoneNumber: 1
                }
            }
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    if (docs.length > 0) {
                        let result = docs

                        res.json(result)
                    } else {
                        let result = {
                            message: '일치하는 부동산이 없습니다'
                        }
                        res.json(result)
                    }
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})


router.post('/fetch/prop/detail/vrtour', (req, res) => {
    let adminUinqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.aggregate([
            {$match: {_id: new objectId(propertyUniqueId)}},
            {
                $facet: {
                    propertyInfo: [
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'realEstateAgent'
                            }
                        },
                        {$unwind: '$realEstateAgent'}
                    ],
                    vrTourRequest: [
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'vrTourRequest'
                            }
                        },
                        {
                            $unwind: '$vrTourRequest'
                        },
                        {
                            $lookup: {
                                from: constants.collection.USER,
                                localField: 'vrTourRequest.userUniqueId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        {
                            $unwind: '$user'
                        },
                        {
                            $group: {
                                _id: '$vrTourRequest._id',
                                vrTourUniqueId: {$first: '$vrTourRequest._id'},
                                vrTourRequestDate: {$first: '$vrTourRequest.date'},
                                name: {$first: '$user.name'},
                                gender: {$first: '$user.gender'},
                                phoneNumber: {$first: '$user.phoneNumber'},
                                email: {$first: '$user.email'},
                                address_1: {$first: '$user.address_1'},
                                address_2: {$first: '$user.address_2'},
                                isConfirmed: {$first: '$vrTourRequest.isConfirmed'},
                                isEnabled: {$first: '$vrTourRequest.isEnabled'}
                            }
                        },
                        {$sort: {'vrTourRequestDate': -1}},
                        {$skip: skip},
                        {$limit: limit}
                    ]
                }
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

                    let result = ""

                    if (docs.length > 0) {
                        result = docs[0]

                    } else {
                        result = {
                            message: '예약이 존재하지 않습니다.'
                        }

                    }
                    res.json(result)
                })

                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })

    }

    ifAdminThenExecute(adminUinqueId, callback)

})

router.post('/fetch/prop/detail/revrtour', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.aggregate([
            {$match: {_id: new objectId(propertyUniqueId)}},
            {
                $facet: {
                    propertyInfo: [
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'realEstateAgent'
                            }
                        },
                        {$unwind: '$realEstateAgent'}
                    ],
                    vrTourRequest: [
                        {
                            $lookup: {
                                from: constants.collection.VR_TOUR_RE_AGENT,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'vrTourRequest'
                            }
                        },
                        {
                            $unwind: '$vrTourRequest'
                        },
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'vrTourRequest.userUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'agency'
                            }
                        },
                        {
                            $unwind: '$agency'
                        },
                        {
                            $group: {
                                _id: '$vrTourRequest._id',
                                vrTourUniqueId: {$first: '$vrTourRequest._id'},
                                vrTourRequestDate: {$first: '$vrTourRequest.date'},
                                realEstateAgentUniqueId: {$first: '$agency.realEstateAgentUniqueId'},
                                companyName: {$first: '$agency.companyName'},
                                ceoName: {$first: '$agency.ceoName'},
                                phoneNumber: {$first: '$agency.phoneNumber'},
                                email: {$first: '$agency.email'},
                                address_1: {$first: '$agency.address_1'},
                                address_2: {$first: '$agency.address_2'},
                                isConfirmed: {$first: '$vrTourRequest.isConfirmed'},
                                isEnabled: {$first: '$vrTourRequest.isEnabled'}
                            }
                        },
                        {$sort: {'vrTourRequestDate': -1}},
                        {$skip: skip},
                        {$limit: limit}
                    ]
                }
            },
            {$unwind: '$propertyInfo'}
        ], (err, cursor) => {
            if (err) {
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    let result = {}

                    if (docs.length > 0) {
                        result = docs[0]

                    } else {
                        result = {
                            message: "예약이 존재하지 않습니다."
                        }
                    }

                    res.json(result)
                })
                .catch(e2 => {
                    res.status(500).send()
                    throw e2
                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)

})

router.post('/fetch/prop/detail/inquiry', (req, res) => {
    let adminUniqueId = req.body.userUniqueId
    let propertyUniqueId = req.body.propertyUniqueId
    let skip = req.body.skip
    let limit = req.body.limit

    let callback = (isAdmin) => {
        let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

        propertyCollection.aggregate([
            {$match: {_id: new objectId(propertyUniqueId)}},
            {
                $facet: {
                    propertyInfo: [
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'realEstateAgentUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
                                as: 'realEstateAgent'
                            }
                        },
                        {
                            $unwind: '$realEstateAgent'
                        }
                    ],
                    inquiryList: [
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY,
                                localField: '_id',
                                foreignField: 'propertyUniqueId',
                                as: 'inquiry'
                            }
                        },
                        {
                            $unwind: '$inquiry'
                        },
                        {
                            $lookup: {
                                from: constants.collection.INQUIRY_ANSWER,
                                localField: 'inquiry._id',
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
                                from: constants.collection.USER,
                                localField: 'inquiry.userUniqueId',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },
                        {
                            $unwind: '$user'
                        },
                        {
                            $lookup: {
                                from: constants.collection.REAL_ESTATE_AGENT_INFO,
                                localField: 'inquiry.userUniqueId',
                                foreignField: 'realEstateAgentUniqueId',
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
                            $project: {
                                inquiry: 1,
                                userName: {$cond: [{$eq: ['$user.isRealEstateAgent', false]}, '$user.name', null]},
                                ceoName: {$cond: [{$eq: ['$user.isRealEstateAgent', true]}, '$realEstateAgent.ceoName', null]},
                                gender: '$user.gender',
                                isRealEstateAgent: '$user.isRealEstateAgent',
                                companyName: '$realEstateAgent.companyName',
                                phoneNumber: '$user.phoneNumber',
                                address_1: '$user.address_1',
                                address_2: '$user.address_2',
                                reply: {$ifNull: ['$reply', {}]}
                            }
                        },
                        {
                            $group: {
                                _id: '$inquiry._id',
                                inquiryUniqueId: {$first: '$inquiry._id'},
                                date: {$first: '$inquiry.date'},
                                inquiryType: {$first: '$inquiry.inquiryType'},
                                title: {$first: '$inquiry.title'},
                                inquiry: {$first: '$inquiry.inquiry'},
                                userName: {$first: '$userName'},
                                ceoName: {$first: '$ceoName'},
                                gender: {$first: '$gender'},
                                isRealEstateAgent: {$first: '$isRealEstateAgent'},
                                companyName: {$first: '$companyName'},
                                phoneNumber: {$first: '$phoneNumber'},
                                address_1: {$first: '$address_1'},
                                address_2: {$first: '$address_2'},
                                inquiryReply: {$first: '$reply'}
                            }
                        },
                        {$sort: {'date': -1}}
                    ]
                }
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
                    let result = {}
                    if (docs.length > 0) {
                        result = docs[0]

                    } else {
                        result = {
                            message: "문의내역이 존재하지 않습니다."
                        }

                    }
                    res.json(result)
                })

                .catch(e2 => {
                    res.status(500).send()

                    throw e2

                })
        })
    }

    ifAdminThenExecute(adminUniqueId, callback)
})

module.exports = router
