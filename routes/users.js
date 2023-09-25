let db = require('../config/database')
let httpProxy = require('../config/httpProxy')
let express = require('express');
let router = express.Router();
let bcrypt = require('bcrypt')
let saltRounds = 10
let mailer = require('../util/mailer')
let axios = require('axios').default
let constants = require('../util/constants')
let verificationEmail = require('../util/emailVerification')
let tokenGenerator = require('../util/accessToken')
let alimtalk = require('../util/alimtalk')

router.get('/verify/email', (req, res) => {
    let email = req.query.address

    let emailVerificationCollection = db.getDb().collection('EMAIL_VERIFICATION')
    emailVerificationCollection.update({email: email}, {$set: {isVerified: true}})

    let userCollection = db.getDb().collection(constants.collection.USER)
    userCollection.findOneAndUpdate({email: email}, {$set: {isConfirmed: true}})
        .then(() => {
            res.send('<div><p style="font-size:160%;">인증되었습니다. 로그인 해주세요</p> <a href="https://pspace.ai/signIn" ><p style="font-size:160%;">로그인하러 가기</p></a></div>')
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })


})


router.post('/signup/regularUser', async (req, res) => {
    let params = req.body
    params.isRealEstateAgent = false
    params.isAdmin = false
    params.isSignedOut = false
    // params.isConfirmed = false
    params.isEnabled = null

    checkEmail(params.email)
        .then(() => {
            return checkPhoneNumber({phoneNumber: params.phoneNumber, name: params.name, birthDate: params.birthDate})
        })
        .then(() => {
            addUser(params, res)
        })
        .catch(err => {
            if(err === 'EXIST'){
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'J001', message: '이미 가입된 이메일입니다.'}
                }

                res.json(obj)
            }else if(err === 'EXIST_PHONE_NUMBER') {
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'J001', message: '이미 가입된 핸드폰번호입니다.'}
                }

                res.json(obj)
            }

            throw err
        })


})

router.post('/signup/realEstateAgent', (req, res) => {
    let params = req.body
    params.isRealEstateAgent = true
    params.isAdmin = false
    params.isSignedOut = false
    //params.isConfirmed = false
    params.isEnabled = null

    checkEmail(params.email)
        .then(() => {
            return checkRELicenseNumber(params.licenseNumber)


        })
        .then(() => {
            addUser(params, res)
        })
        .catch(err => {

            if(err === 'EXIST_PHONE_NUMBER') {
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'J001', message: '이미 가입된 핸드폰번호입니다.'}
                }

                res.json(obj)
            }else if (err === 'EXIST_RE_LIC_NO') {
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'J001', message: '이미 가입된 중개소 등록번호입니다.'}
                }

                res.json(obj)
            }else if(err === 'SIGNED_OUT'){
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'J002', message: '이미 탈퇴한 회원입니다. 같은 이메일을 사용할 수 없습니다.'}
                }

                res.json(obj)

            }else{
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'S500', message: '서버에러'}
                }

                res.json(obj)
                throw err
            }
        })

})

checkPhoneNumber = (info) => {
    return new Promise((resolve, reject) => {
        let userCollection = db.getDb().collection(constants.collection.USER)

        userCollection.findOne({phoneNumber: info.phoneNumber, name: info.name, birthDate: info.birthDate})
            .then(user => {
                if(user){
                    if(user){
                        return reject('EXIST_PHONE_NUMBER')
                    }else{
                        resolve()
                    }
                }else{
                    resolve()
                }
            })
            .catch(err => {
                return reject(err)
            })

    })

}

checkRELicenseNumber = (licenseNumber) => {
    return new Promise((resolve, reject) => {
        let joinedLicNumber = licenseNumber.split('-').join('')

        let reInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)

        reInfoCollection.findOne({licenseNumberForSearching: joinedLicNumber})
            .then(agency => {
                if(agency){
                    return reject('EXIST_RE_LIC_NO')
                }else{
                    resolve()
                }
            })
            .catch(err => {
                return reject(err)

            })
    })
}

checkEmail = (email) => {
    return new Promise((resolve, reject) => {
        db.getDb().collection('USER').findOne({email:email.trim()})
            .then(user => {
                if(user !== null){
                    if(user.isSignedOut){
                        reject('SIGNED_OUT')
                    }else {
                        reject('EXIST')
                    }
                }else{
                    resolve()
                }
            })
            .catch(err => {

                throw err
            })
    })

}

addUser = (params, res) => {

    if(params.name.length === 0 ){
        if(params.isRealEstateAgent){
            let obj = {
                isVerificationEmailSent: false,
                error: {code: 'S500', message: '본인인증에서 뭔가 잘못됐습니다. 다시 본인인증을 해주세요.'}
            }

            res.json(obj)

        }else{
            if(params.birthDate.length === 0 || params.gender.length === 0 ){
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 'S500', message: '본인인증에서 뭔가 잘못됐습니다. 다시 본인인증을 해주세요.'}
                }

                res.json(obj)

            }
        }

        return
    }

    let userCollection = db.getDb().collection('USER')

    let plainTextPassword = params.password
    bcrypt.genSalt(saltRounds, (err, salt) => {
        if (err) {

            let obj = {
                isVerificationEmailSent: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(obj)

            throw err
        }

        bcrypt.hash(plainTextPassword, salt, (e2, hash) => {
            if (e2) {
                let obj = {
                    isVerificationEmailSent: false,
                    error: {code: 500, message: '서버에러'}
                }

                res.json(obj)

                throw e2
            }

            params.password = hash
            params.joinedDate = new Date()

                    if(params.gender === '1' || params.gender === '3' || params.gender === '5'){
                        params.gender = '1'
                    }else if(params.gender === '2' || params.gender === '4' || params.gender === '6'){
                        params.gender = '2'
                    }else if(params.gender === null){
                        params.gender = null
                    }

            params.email = params.email.trim()

            userCollection.insertOne(params)
                .then(async insertResult => {

                    if(params.isRealEstateAgent === true){
                        let licenceNumberForSearching = params.licenseNumber.split('-').join('')
                        let realEstateAgentUniqueId = insertResult.insertedId
                        let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
                        let realEstateInfo = {
                            licenceNumberForSearching: licenceNumberForSearching,
                            licenseNumber: params.licenseNumber,
                            companyName: params.companyName,
                            ceoName: params.name,
                            email: params.email,
                            phoneNumber: params.phoneNumber,
                            address_1: params.address_1,
                            address_2: params.address_2,
                            realEstateAgentUniqueId: realEstateAgentUniqueId
                        }
                        realEstateInfoCollection.insertOne(realEstateInfo)
                            .then(_ => {
                                let date = new Date()
                                let month = date.getMonth() + 1
                                let day = date.getDate()
                                let hour = date.getHours()
                                let min = date.getMinutes()
                                let dayOfWeek = date.getDay()

                                let info = {
                                    name: params.name,
                                    company: params.companyName,
                                    phoneNumber: params.phoneNumber,
                                    dateTime: `${month}월 ${day}일 ${hour}시 ${min}분 ${constants.day[dayOfWeek]}`
                                }

                                alimtalk.sendAlimTalkNewREJoined(info)
                            })
                    }

                    res.json({error: null})

                    // let emailVerificationCollection = db.getDb().collection(constants.collection.EMAIL_VERIFICATION)
                    //
                    // emailVerificationCollection.updateOne({email: params.email}, {
                    //     $set: {
                    //         email: params.email,
                    //         isVerified: false
                    //     }
                    // }, {upsert: true})
                    //     .then(() => {
                    //
                    //         mailer.sendEmail({receiver:params.email, title: '평행공간 회원가입 이메일 인증이 필요합니다.', html: verificationEmail.verificationEmailHtml(params.email)})
                    //             .then(() => {
                    //                 let obj = {
                    //                     isVerificationEmailSent: true,
                    //                     error: null
                    //                 }
                    //
                    //                 res.json(obj)
                    //             })
                    //             .catch(err => {
                    //
                    //                 let obj = {
                    //                     isVerificationEmailSent: false,
                    //                     error: {code: 201, message: '인증 이메일 보내기 실패'}
                    //                 }
                    //
                    //                 res.json(obj)
                    //
                    //                 throw err
                    //             })
                    //
                    //     })


                })
                .catch(err => {

                    let obj = {
                        error: {code: 500, message: '서버에러'}
                    }

                    res.json(obj)

                    throw err
                })


        })
    })
}

router.post('/signup/send/verificationEmail', (req, res) => {
    let email = req.body.email


    let emailVerificationCollection = db.getDb().collection('EMAIL_VERIFICATION')

    emailVerificationCollection.updateOne({email: email}, {$set: {email: email, isVerified: false}}, {upsert: true})
        .then(async () => {

            mailer.sendEmail({receiver:email, title: '평행공간 회원가입 이메일 인증이 필요합니다.', html: verificationEmail.verificationEmailHtml(email)})
                .then(() => {
                    let obj = {
                        isVerificationEmailSent: true,
                        error: null
                    }

                    res.json(obj)
                })
                .catch(err => {
                    let obj = {
                        isVerificationEmailSent: false,
                        error: {code: 201, message: '인증 이메일 보내기 실패'}
                    }

                    res.json(obj)

                    throw err
                })


        })


})

router.post('/request/email/verification/code', (req, res) => {
    let name = req.body.name
    let email = req.body.email

    let emailVerificationCollection = db.getDb().collection('EMAIL_VERIFICATION')
    let userCollection = db.getDb().collection('USER')

    let code = getRandomIntInclusive(1000, 7999)

    userCollection.findOne({email: email})
        .then(user => {
            if(user !== null){
                emailVerificationCollection.updateOne({email: email}, {$set:{code: code.toString(), isVerified: false}}, {upsert: true})
                    .then(result => {

                        mailer.sendEmail({receiver: email, title: '이메일 인증번호', html: `<div style="font-size:160%;">이메일 인증 번호 입니다:</div> <div style="font-size:160%; color: #008CBA;">${code}</div>`})
                            .then(()=> {
                                let obj = {
                                    isCodeSent: true,
                                    error: null
                                }

                                res.json(obj)

                            })
                            .catch( err => {
                                let obj = {
                                    isCodeSent: false,
                                    error: {code: 'S500', message: '서버에러'}
                                }
                            })

                    })
                    .catch(err => {

                        let obj = {
                            isCodeSent: false,
                            error: {code: 'S500', message: '서버에러'}
                        }

                        res.json(obj)

                        throw err
                    })
            } else {
                let obj = {
                    isCodeSent: false,

                    error: {code: 'L002', message: '가입하지 않은 회원입니다.'}
                }

                res.json(obj)
            }
        })
        .catch(err => {
            let obj = {
                isCodeSent: false,
                error: {code: 'S500', message: '서버에러'}
            }

            res.json(obj)

            throw err
        })



})



function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //최댓값도 포함, 최솟값도 포함
}

router.post('/verify/email/code', (req, res) => {
    let name = req.body.name
    let email = req.body.email
    let code = req.body.code

    let emailVerificationCollection = db.getDb().collection(constants.collection.EMAIL_VERIFICATION)
    let userCollection = db.getDb().collection(constants.collection.USER)
    emailVerificationCollection.aggregate([
        {$match: {email: email}},
        {
            $lookup: {
                from: 'USER',
                localField: 'email',
                foreignField: 'email',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        }
    ], (err, cursor) => {
        if(err){

            throw err
        }

        cursor.toArray((e2, docs) => {
            if(e2){

                throw e2
            }

            if(docs.length > 0) {
                let data = docs[0]

                if(data.code !== undefined){
                    if(data.code === code  && data.user.name === name){
                       let obj = {
                           isVerified: true,
                           error: null
                       }

                       userCollection.findOneAndUpdate({_id: data.user._id}, {$set: {isConfirmed: true}})

                       res.json(obj)
                    }else{
                        let obj = {
                            isVerified: false,
                            error: {
                                code: 'V001',
                                message: '입력하신 정보가 일치하지 않습니다'
                            }
                        }

                        res.json(obj)
                    }
                }
            }
        })


    })
})


router.post('/email/isAvailable', (req, res) => {
    let email = req.body.email

    let userCollection = db.getDb().collection('USER')

    userCollection.findOne({email: email})
        .then(user => {

            let obj = {
                isAvailable: true,
                error: null
            }

            obj.isAvailable = user === null;

            res.json(obj)
        })
        .catch(err => {
            let obj = {
                code: 500,
                message: '서버에러'
            }

            res.json(obj)

            throw err
        })
})


router.post('/login', (req, res) => {

    let email = req.body.email
    let password = req.body.password



    let userCollection = db.getDb().collection('USER')
    userCollection.findOne({email: email})
        .then(user => {
            if (user !== null) {

                if(user.isSignedOut){
                    let result = {
                        userUniqueId: null,
                        name: null,
                        isRealEstateAgent: null,
                        isAdmin: null,
                        isSignedOut: true,
                        error: {code: 'L003', message: '이미 탈퇴한 회원입니다. 재가입 해주세요.'}
                    }

                    res.json(result)
                    return
                }

                // if(!user.isConfirmed){
                //     let result = {
                //         userUniqueId: null,
                //         name: null,
                //         isRealEstateAgent: null,
                //         isAdmin: null,
                //         isSignedOut: true,
                //         error: {code: 'L003', message: '이메일 주소 인증을 해주세요.'}
                //     }
                //
                //     res.json(result)
                //     return
                // }

                let hash = user.password

                bcrypt.compare(password, hash)
                    .then(result => {

                        if (result) {
                            let obj = {
                                userUniqueId: user._id,
                                name: user.name,
                                isRealEstateAgent: user.isRealEstateAgent,
                                isAdmin: (user.isAdmin === undefined) ? false : user.isAdmin,
                                companyName: null,
                                error: null
                            }

                            if(user.isRealEstateAgent){
                                let realEstateInfoCollection = db.getDb().collection(constants.collection.REAL_ESTATE_AGENT_INFO)
                                realEstateInfoCollection.findOne({realEstateAgentUniqueId: user._id})
                                    .then(agency => {
                                        if(agency){
                                            obj.companyName = agency.companyName
                                            res.json(obj)
                                        }
                                    })
                                    .catch(err => {
                                        res.status(500).send()
                                        throw err
                                    })


                            }else{
                                res.json(obj)
                            }


                        } else {
                            let result = {
                                userUniqueId: null,
                                name: null,
                                isRealEstateAgent: null,
                                isAdmin: null,
                                error: {code: 'L001', message: '이메일주소와 비밀번호가 일치하지 않습니다.'}
                            }

                            res.json(result)
                        }
                    })
                    .catch(err => {
                        let result = {
                            userUniqueId: null,
                            name: null,
                            isRealEstateAgent: null,
                            isAdmin: null,
                            error: {code: 'S500', message: '서버에러'}
                        }

                        res.json(result)
                        throw err;
                    })
            } else {
                let result = {
                    userUniqueId: null,
                    name: null,
                    isRealEstateAgent: null,
                    isAdmin: null,
                    error: {code: 'L002', message: '가입하지 않은 회원입니다.'}
                }

                res.json(result)
            }
        })

});


router.post('/find/myemail', (req, res) => {
    let name = req.body.name
    let phoneNumber = req.body.phoneNumber
    let birthDate = req.body.birthDate

    let userCollection = db.getDb().collection('USER')
    userCollection.findOne({name: name, phoneNumber: phoneNumber, birthDate: birthDate})
        .then(user => {
            if (user !== null) {
                let obj = {
                    email: user.email,
                    error: null
                }

                res.json(obj)
            } else {
                let obj = {
                    email: null,
                    error: { code: 'V002', message: '회원을 찾을 수 없습니다.'}
                }

                res.json(obj)
            }
        })
        .catch(err => {

            throw err
        })
})

router.post('/reset/password', (req, res) => {
    let name = req.body.name
    let email = req.body.email
    let newPassword = req.body.newPassword

    let userCollection = db.getDb().collection('USER')

    bcrypt.genSalt(saltRounds, (err, salt) => {
        if(err){

            throw err
        }

        bcrypt.hash(newPassword, salt, (e2, hash) => {
            if(e2){
                throw e2
            }

            userCollection.findOneAndUpdate({name: name, email: email}, {$set: {password: hash}})
                .then(updateResult => {

                    if(updateResult !== null){
                        let obj = {
                            isReset: true,
                            error: null
                        }

                        res.json(obj)

                    }else{
                        let obj = {
                            isReset: false,
                            error: {code: 'S500', message: '비밀번호 재설정 실패하였습니다. 다시 시도해주세요.'}
                        }

                        res.json(obj)
                    }
                })
                .catch(err => {
                    let obj = {
                        isReset: false,
                        error: {code: 'S500', message: '서버에러'}
                    }

                    res.json(obj)
                    throw err
                })

        })
    })


})

router.post('/id/certifications', (req, res) => {
    let imp_uid = req.body.imp_uid

    axios.post( 'https://api.iamport.kr/users/getToken', {imp_key: process.env.IMP_KEY, imp_secret: process.env.IMP_PWD})
        .then(response => {

            let access_token = response.data.response.access_token

            axios.get(`https://api.iamport.kr/certifications/${imp_uid}`,{headers: { "Authorization": access_token }})
                .then(result => {

                    let info = result.data.response
                    let name = info.name
                    let gender = info.gender
                    let birthDate = info.birthday.split('-').join('');

                    if( ( name && name.length > 0) && ( gender && gender.length > 0) && ( birthDate && birthDate.length > 0)) {
                        let obj = {
                            isVerified: true,
                            name: name,
                            gender: (gender === 'male') ? '1' : '2',
                            birthDate: birthDate,
                            error: null
                        }

                        res.json(obj)

                    }else {
                        let obj = {
                            isVerified: false,
                            name: null,
                            gender: null,
                            birthDate: null,
                            error: {message: '본인인증시 에러가 발생되었습니다. 다시 시도해주세요.'}
                        }

                        res.json(obj)
                    }


                })
                .catch(err => {
                    throw err
                })

        })
        .catch(err => {
            throw err
        })
})

router.post('/fetch/interested/firstarea', (req, res) => {

    let firstAreaCollection = db.getDb().collection(constants.collection.FIRST_AREA)

    firstAreaCollection.find().toArray()
        .then(areas => {

            let result = []
            areas.forEach(area => {
                result.push(area.area)
            })
            res.json(result)
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })
})

router.post('/fetch/interested/secondarea', (req, res) => {
    let firstArea = req.body.firstArea

    let secondAreaCollection = db.getDb().collection(constants.collection.SECOND_AREA)

    secondAreaCollection.find({firstArea: firstArea}).toArray()
        .then(secondAreas => {
            let result = []

            secondAreas.forEach(area => {
                result.push(area.secondArea)
            })

            res.json(result)
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })

})

router.post('/fetch/interested/thirdarea', (req, res) => {
    let secondArea = req.body.secondArea

    let thirdAreaCollection = db.getDb().collection(constants.collection.THIRD_AREA)

    thirdAreaCollection.find({secondArea: secondArea}).toArray()
        .then(thirdAreas => {
            let result = []

            thirdAreas.forEach(area => {
                result.push(area.thirdArea)
            })
            res.json(result)
        })
        .catch(err => {
            res.status(500).send()

            throw err
        })
})

router.get('/get/js', (req, res) => {
    console.log(req.query)

    let userUniqueId = req.query.userUniqueId
    let key = req.query.key
    let subpath = req.query.subpath
    let search = req.query.search

    console.log(userUniqueId, key, subpath, search)

    let userUniqueIdKey = `${key}.userUniqueId`
    let linkKey = `${key}.path`
    let portKey = `${key}.port`

    db.getRedisClient().get(userUniqueIdKey, (e1, userId) => {
        if(e1){

            throw e1
        }

        if(!userId) {
            console.log(userId)
            res.json({isValid: false})
            return
        }

        if(userUniqueId === userId){
            db.getRedisClient().get(linkKey, (e2, path) => {
                if(e2){
                    throw e2
                }

                if(path){

                    db.getRedisClient().get(portKey, (e3, port) => {
                        if(e3){
                            throw e3
                        }

                        if(port){
                            httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {
                                //proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br')
                            })

                            let target = `http://localhost:${port}/${path}/${subpath}${search}`



                            console.log('vt js target ----->', target)

                            httpProxy.getProxy().web(req, res, {

                                ignorePath: true,
                                target:target}, (err) => {
                                if(err){
                                    console.log(err)
                                }
                            })
                        }
                    })

                }else{
                    res.json({isValid: false})
                }
            })
        }else{
            res.json({isValid: false})
        }

    })
})

router.get('/check/vrtour/link', (req, res) => {
    console.log(req.query)

    let userUniqueId = req.query.userUniqueId
    let key = req.query.key
    let subpath = req.query.subpath
    let search = req.query.search

    console.log(userUniqueId, key)

    let userUniqueIdKey = `${key}.userUniqueId`
    let linkKey = `${key}.path`
    let portKey = `${key}.port`

    db.getRedisClient().get(userUniqueIdKey, (e1, userId) => {
        if(e1){

            throw e1
        }

        if(!userId) {
            console.log(userId)
            res.json({isValid: false})
            return
        }

        if(userUniqueId === userId){
            db.getRedisClient().get(linkKey, (e2, path) => {
                if(e2){
                    throw e2
                }


                if(path){

                    db.getRedisClient().get(portKey, (e3, port) => {
                        if(e3){
                            throw e3
                        }

                        if(port){
                            // httpProxy.getProxy().on('proxyReq', (proxyReq, request, response, options) => {
                            //     //proxyReq.setHeader('Accept-Encoding', 'gzip, deflate, br')
                            // })

                            //let target = `http://localhost:${process.env.PORT}/vt/${key}/`

                            let target = `/vt/${key}/`
                            //res.redirect(target)

                            console.log('vt target ----->', target)
                            res.send('OK')
                            // res.json({isValid: true})

                            // httpProxy.getProxy().web(req, res, {
                            //
                            //     ignorePath: true,
                            //     target:target}, (err) => {
                            //     if(err){
                            //         console.log(err)
                            //     }
                            // })
                        }
                    })

                }else{
                    res.json({isValid: false})
                }
            })
        }else{
            res.json({isValid: false})
        }

    })

})


router.post('/request/token', (req, res) => {
    let userUniqueId = req.body.userUniqueId

    let accessToken = tokenGenerator.generate(userUniqueId)

    res.json({token: accessToken})
})

module.exports = router;
