let nodemailer = require('nodemailer')

let transporter = nodemailer.createTransport({
    host: 'smtp.worksmobile.com',
    port: 465,
    secure: true,
    auth: {
        user: '',
        pass: ''
    }
})

exports.sendEmail = ({sender = '평행공간 <support@pspace.ai>', receiver, title, html}) => {

    return new Promise( async (resolve, reject) => {

        let info = await transporter.sendMail({
            from: sender,
            to: receiver,
            subject: title,
            html: html
        })


        if (info.accepted.length > 0) {
            resolve(info)
        } else {
            reject(info)
        }
    })


}

