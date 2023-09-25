let express = require('express');
let router = express.Router();
let objectId = require('mongodb').ObjectID;
let NginxConfFile = require('nginx-conf').NginxConfFile
let shortid = require('shortid')
let db = require('../config/database')
let shell = require('shelljs')
let constants = require('../util/constants')
const {exec} = require('child_process')

router.post('/generate/new/iv/instance', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let newInstances = req.body.newInstances
    let indoorViewerCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)



    let checkIfInUse = (i) => {


        if(i >= newInstances.length){

            let instances = []
            newInstances.forEach( (newInstance, k) => {
                let iv = {
                    instanceName: newInstance.name,
                    port: newInstance.port,
                    isUp: false,
                    status: 'LOADING',
                    linkedProperty: { title: newInstance.linkedProperty.title, propertyUniqueId: new objectId(newInstance.linkedProperty.propertyUniqueId) }
                }

                let propertyUniqueId = newInstance.linkedProperty.propertyUniqueId
                let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)
                let permanentKey = shortid.generate()
                propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: {vrTourPath: newInstance.name, vrTourPort: newInstance.port, permanentKey: permanentKey}})
                    .then(result => {
                        let property = result.value

                        let redisCli = db.getRedisClient()
                        redisCli.set(`${permanentKey}.userUniqueId`, property.realEstateAgentUniqueId.toString())
                        redisCli.set(`${permanentKey}.path`, newInstance.name)
                        redisCli.set(`${permanentKey}.port`, newInstance.port)
                    })

                instances.push(iv)

            })

            indoorViewerCollection.insertMany(instances)
                .then(result => {
                    res.json({error: null , message: null})
                    addNewInstances()
                })


            return

        }

        let newInstance = newInstances[i]



        indoorViewerCollection.findOne({instanceName: newInstance.name})
            .then(instance => {
                return new Promise((resolve, reject) => {
                    if(instance){
                        console.log('name in use')
                        res.json({error: '00' , message: `인스턴스 ${instance.instanceName}은(는) 이미 사용중 입니다.`})
                        reject(new Error('name in use'))
                    }else{
                        resolve()
                        return indoorViewerCollection.findOne({port: newInstance.port})

                    }
                })

            })

            .then(instance => {
                return new Promise((resolve, reject) => {
                    if(instance){
                        console.log('port in use')
                        res.json({error: '00' , message: `포트번호 ${instance.port}은(는) 이미 사용중 입니다.`})
                        reject(new Error('port in use'))
                    }else{
                        return resolve()
                    }

                })
            })

            .then(_ => {

                checkIfInUse(i + 1)

            })
            .catch(err => {
                throw err;
            })
    }

    checkIfInUse(0)



    let addNewInstances = () => {
        newInstances.forEach(async instance => {

            await generateNewIVInstance(instance.name, instance.port)

        })

        newInstances.forEach(async instance => {
            await writeToNginxConfFile(instance.name, instance.port)
        })
        let nginxExec = `echo "${process.env.SUDO_PWD}" | sudo -S systemctl restart nginx`

        exec(nginxExec, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
        })



    }




})

let generateNewIVInstance = (instanceName, port) => {
    shell.cd(process.env.NAVVIS_IV_INSTANCE_PATH)
    shell.mkdir(instanceName)

    let envShExec = `sh ${process.env.DOCKER_SCRIPT_PATH}/env.sh ${instanceName} ${port} > ${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}/.env`

    shell.exec(envShExec)

    shell.cp(`${process.env.DOCKER_SCRIPT_PATH}/docker-compose.yml`, `${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}/docker-compose.yml`)

    shell.chmod(755, `${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}/.env`)
    shell.chmod(755, `${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}/docker-compose.yml`)

    shell.cd(`${instanceName}`)
    shell.mkdir('-p', `storage/${instanceName}`)

    shell.cd(`${process.env.IV_DATASETS_WEB_PATH}`)
    shell.mkdir('-p', `${instanceName}/datasets_web`)

    shell.cd(`${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}/storage/${instanceName}`)
    shell.ln('-s', `${process.env.IV_DATASETS_WEB_PATH}/${instanceName}/datasets_web`, 'data')

    shell.cd(`${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}`)
    const {stdout, stderr, code} = shell.exec('docker-compose up -d', {silent:true})




    let indoorViewerCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)
    indoorViewerCollection.findOneAndUpdate({instanceName: instanceName, port: port}, {$set: {isUp: true, status:'UP'}})
        .then(_ => {

        })




}

router.post('/fetch/instance/list', (req, res) => {
    let userUniqueId = req.body.userUniqueId
    let skip = req.body.skip
    let limit = req.body.limit



    let indoorViewerCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)

    indoorViewerCollection.aggregate([
        {
            $facet: {
                count: [{$count: 'totalCount'}],
                instanceList: [
                    {
                        $lookup: {
                            from: constants.collection.PROPERTY,
                            localField: 'linkedProperty.propertyUniqueId',
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
                        $project:{
                            ivUniqueId: '$_id',
                            instanceName: '$instanceName',
                            port: '$port',
                            'property.propertyUniqueId': '$property._id',
                            'property.title': '$property.title',
                            status: '$status'
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
                    }
                ]
            }
        },
        {
            $unwind: '$count'
        }
    ], (err, cursor) => {
        if(err){
            throw err
        }

        cursor.toArray()
            .then(docs => {

                let response = {
                    instanceList: [],
                    totalCount: 0
                }

                if(docs.length > 0){
                    let result = docs[0]

                    response.instanceList = result.instanceList
                    response.totalCount = result.count.totalCount

                }

                res.json(response)
            })
    })
})

router.post('/pull/status', (req , res) => {
    let ivUniqueId = req.body.ivUniqueId
    let instanceName = req.body.instanceName
    let port = req.body.port
    let ivCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)

    ivCollection.findOne({instanceName: instanceName, port: port})
        .then(instance => {
            if(instance){
                res.json({status: instance.status})
            }else{
                res.json({status: constants.INDOOR_VIEWER_STATUS.DOWN})
            }
        })
        .catch(err => {
            console.error(err)
            throw err
        })


})

let writeToNginxConfFile = (instanceName, port) => {

    let filename = process.env.NGINX_CONF_FILE_PATH

    NginxConfFile.create(filename, (err, conf) => {
        if (err || !conf) {
            console.log(err);
            throw err;

        }


        conf.nginx.server[0]._add('location', `/${instanceName}` )

        let locationIndex = conf.nginx.server[0].location.length - 1

        conf.nginx.server[0].location[locationIndex]._add('sub_filter', '"<title>NavVis IndoorViewer</title>" "<title>평행공간</title>"')
        conf.nginx.server[0].location[locationIndex]._add('sub_filter', '"favicon.ico" "https://pspace.ai/images/favicon.png"')
        conf.nginx.server[0].location[locationIndex]._add('sub_filter_once', 'off')
        conf.nginx.server[0].location[locationIndex]._add('proxy_set_header', '"Host" "$http_host"')
        conf.nginx.server[0].location[locationIndex]._add('proxy_set_header', '"X-Real-IP" "$remote_addr"')
        conf.nginx.server[0].location[locationIndex]._add('proxy_set_header', '"X-Forwarded-For" "$proxy_add_x_forwarded_for"')
        conf.nginx.server[0].location[locationIndex]._add('proxy_set_header', '"X-Forwarded-Proto" "$scheme"')
        conf.nginx.server[0].location[locationIndex]._add('proxy_set_header', '"X-NginX-Proxy" "true"')
        conf.nginx.server[0].location[locationIndex]._add('proxy_set_header', '"Accept-Encoding" ""' )
        conf.nginx.server[0].location[locationIndex]._add('proxy_pass', `http://127.0.0.1:${port}`)
        conf.nginx.server[0].location[locationIndex]._add('proxy_redirect', 'off')


        conf.on('flushed', () => {
            //process.exit()
        })

        conf.flush()

    })

}

router.post('/start/iv', (req, res) => {
    let instanceName = req.body.instanceName
    let ivUniqueId = req.body.ivUniqueId
    shell.cd(`${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}`)
    const {stdout, stderr, code} = shell.exec('docker-compose up -d')
    const {stdout1, stderr1, code1} = shell.exec('whoami')

    console.log('who am i', stdout1)

    if(code !== 0){
        console.error(stderr)
        res.json({error: '00', message: stderr})
    }else{
        let ivCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)
        ivCollection.findOneAndUpdate({_id: new objectId(ivUniqueId)}, {$set: {isUp: true, status: constants.INDOOR_VIEWER_STATUS.UP}})

        res.json({error: null, message: null})
    }

})

router.post('/stop/iv', (req, res) => {
    let instanceName = req.body.instanceName
    let ivUniqueId = req.body.ivUniqueId
    shell.cd(`${process.env.NAVVIS_IV_INSTANCE_PATH}/${instanceName}`)
    const {stdout, stderr, code} = shell.exec('docker-compose down')

    if(code !== 0){
        console.error(stderr)
        res.json({error: '00', message: stderr})
    }else{
        let ivCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)
        ivCollection.findOneAndUpdate({_id: new objectId(ivUniqueId)}, {$set: {isUp: false, status: constants.INDOOR_VIEWER_STATUS.DOWN}})

        res.json({error: null, message: null})
    }

})

router.post('/modify/linked/property', (req, res) => {
    let ivUniqueId = req.body.ivUniqueId
    let newPropertyUniqueId = req.body.newPropertyUniqueId

    let ivCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)
    let propertyCollection = db.getDb().collection(constants.collection.PROPERTY)

    ivCollection.aggregate([
        {
            $lookup: {
                from: constants.collection.PROPERTY,
                localField: 'linkedProperty.propertyUniqueId',
                foreignField: '_id',
                as: 'property'
            }
        },
        {
            $unwind: '$property'
        },
        {
            $match: {'property._id': new objectId(newPropertyUniqueId)}
        }
    ], (err, cursor) => {
        if(err){
            throw err
        }

        cursor.toArray()
            .then(docs => {
                if(docs.length > 0){
                    let iv = docs[0]
                    res.json({error: {message: `${iv.property.title}은(는) 이미 다른 인스턴스와 연결되어 있습니다.`}, isModified: false, newProperty: null})
                }else{
                    propertyCollection.findOne({_id: new objectId(newPropertyUniqueId)})
                        .then(property => {
                            if(property){
                                editIV(property.realEstateAgentUniqueId)
                            }
                        })

                }
            })
    })

    let editIV = (newPropRealEstateAgentUniqueId) => {
        ivCollection.aggregate([
            {$match: {_id: new objectId(ivUniqueId)}},
            {
                $lookup: {
                    from: constants.collection.PROPERTY,
                    localField: 'linkedProperty.propertyUniqueId',
                    foreignField: '_id',
                    as: 'property'
                }
            },
            {
                $unwind: {
                    path: '$property',
                    preserveNullAndEmptyArrays: true
                }
            }
        ], (err, cursor) => {
            if(err){
                res.status(500).send()
                throw err
            }

            cursor.toArray()
                .then(docs => {
                    if(docs.length > 0){
                        let property = docs[0].property
                        let iv = docs[0]

                        let permanentKey
                        let vrTourPath
                        let vrTourPort
                        let redisCli = db.getRedisClient()
                        if(property && property.permanentKey){
                            redisCli.del(`${property.permanentKey}.userUniqueId`)
                            redisCli.del(`${property.permanentKey}.path`)
                            redisCli.del(`${property.permanentKey}.port`)
                        }
                        permanentKey = shortid.generate()
                        vrTourPath = iv.instanceName
                        vrTourPort = iv.port

                        redisCli.set(`${permanentKey}.userUniqueId`, newPropRealEstateAgentUniqueId.toString())
                        redisCli.set(`${permanentKey}.path`, vrTourPath)
                        redisCli.set(`${permanentKey}.port`, vrTourPort)

                        let editProperty = () => {
                            return new Promise((resolve, reject) => {
                                if(property){
                                    propertyCollection.findOneAndUpdate({_id: property._id}, {$set: {permanentKey: null, vrTourPath: null, vrTourPort: null}})
                                }

                                return resolve()
                            })


                        }

                        editProperty()
                            .then(_ => {
                                return propertyCollection.findOneAndUpdate({_id: new objectId(newPropertyUniqueId)}, {$set: {permanentKey: permanentKey, vrTourPath: vrTourPath, vrTourPort: vrTourPort}})

                            })
                            .then(_ => {
                                return propertyCollection.findOne({_id: new objectId(newPropertyUniqueId)})
                            })
                            .then(newProp => {
                                ivCollection.findOneAndUpdate({_id: new objectId(ivUniqueId)}, {$set : {'linkedProperty.title': newProp.title, 'linkedProperty.propertyUniqueId': new objectId(newPropertyUniqueId)}})
                                return newProp
                            })
                            .then( newProp => {

                                res.json({error: {message: null}, isModified: true, newProperty: {title: newProp.title, propertyUniqueId: newProp._id}})
                            })
                            .catch(e2 => {
                                throw e2
                            })
                    }
                })
        })
    }



})

router.post('/unlink/property', (req, res) => {
    let ivUniqueId = req.body.ivUniqueId
    let propertyUniqueId = req.body.propertyUniqueId

    let ivCollection = db.getDb().collection(constants.collection.INDOOR_VIEWER)
    let propertyCollection =db.getDb().collection(constants.collection.PROPERTY)

    ivCollection.findOneAndUpdate({_id: new objectId(ivUniqueId)}, {$set: {'linkedProperty.title': null, 'linkedProperty.propertyUniqueId': null}})

    propertyCollection.findOne({_id: new objectId(propertyUniqueId)})
        .then(property => {
            if(property){
                if(property.permanentKey){
                    let redisCli = db.getRedisClient()

                    redisCli.del(`${property.permanentKey}.userUniqueId`)
                    redisCli.del(`${property.permanentKey}.path`)
                    return redisCli.del(`${property.permanentKey}.port`)


                }else{
                    return ''
                }

            }else{
                return ''
            }
        })
        .then(_ => {
            return propertyCollection.findOneAndUpdate({_id: new objectId(propertyUniqueId)}, {$set: {permanentKey: null, vrTourPath: null, vrTourPort: null}})
        })
        .then(_ => {
            res.json({isUnlinked: true})
        })
        .catch(err => {
            res.status(500).send()
            throw err
        })




})

module.exports = router