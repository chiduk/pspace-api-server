let express = require('express');
let path = require('path');
let objectId = require('mongodb').ObjectID;
let cookieParser = require('cookie-parser');
let morgan = require('morgan');
require('dotenv').config()
let cors = require('cors')
let cluster = require('cluster');
let dateformat = require('dateformat')
let numCPUs = require('os').cpus().length;
let database = require('./config/database')
let logger = require('./config/logger')
let constants = require('./util/constants')
let httpProxy = require('./config/httpProxy')
let csvtojson = require('csvtojson')
let alimtalk = require('./util/alimtalk')
let bcrypt = require('bcrypt')





let usersRouter = require('./routes/users');
let mypageRouter = require('./routes/mypage')
let repageRouter = require('./routes/realEstateAgentPage')
let nonmemberRouter = require('./routes/nonmember')
let adminpageRouter = require('./routes/adminPage')
let mainpageRouter = require('./routes/mainPage')
let vrTourRouter = require('./routes/vrTour')
let smsRouter = require('./routes/sms')
let ivRouter = require('./routes/ivRouter')
let payRouter = require('./routes/pay')
let agreementRouter = require('./routes/agreement')
let navvisIVRouter = require('./routes/navvisIV')
let app = express();

app.use(cors())
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/api/user', usersRouter);
app.use('/api/mypage', mypageRouter)
app.use('/api/repage', repageRouter)
app.use('/api/nonmember', nonmemberRouter)
app.use('/api/adm/', adminpageRouter)
app.use('/api/main/', mainpageRouter)
app.use('/vt/', vrTourRouter)
app.use('/vm/', ivRouter)
app.use('/api/sms', smsRouter)
app.use('/api/pay', payRouter)
app.use('/api/agreement', agreementRouter)
app.use('/api/navvis', navvisIVRouter)


let mongoConnect = () => {
    database.connect((err) => {

        if(err){
            throw err
        }

        app.listen(process.env.PORT)
        logger.log('info', 'MONGODB_CONNECTED');
        logger.log('info', 'Server started on', {date:  dateformat(new Date)});
        logger.log('info', 'Port', {port: process.env.PORT});

    })


    database.createRedisClient()


}

//mongoConnect();

httpProxy.createProxyServer()

if(cluster.isMaster){
    for(let i = 0; i < numCPUs; i++){
        cluster.fork();
    }
}else{
    mongoConnect();
}



module.exports = app;

