let winston = require('winston');
let DailyRotateFile = require('winston-daily-rotate-file');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(

        winston.format.json()
    ) ,

    transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        }),
        new winston.transports.File({ filename: 'log/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'log/combined.log' }),
        new DailyRotateFile({
            filename: 'log/application-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m'

        })
    ],
    exitOnError: false,
    exceptionHandlers: [
        new DailyRotateFile({
            filename: 'log/exception-%DATE%.log',
            datePattern: 'YYYY-MM-DD-HH',
            zippedArchive: true,
            maxSize: '20m'

        }),
        new winston.transports.Console({
            level: 'error',
            handleExceptions: true,
            json: false,
            colorize: true
        }),
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// logger.configure({
//     level: 'verbose',
//     transports: [
//         new DailyRotateFile({
//             filename: 'log/application-%DATE%.log',
//             datePattern: 'YYYY-MM-DD-HH',
//             zippedArchive: true,
//             maxSize: '20m'
//
//         })
//     ]
// });

logger.stream = {
    write: function(message, encoding) {
        // use the 'info' log level so the output will be picked up by both transports (file and console)
        logger.info(message);
    },
};


module.exports = logger;