module.exports.verificationEmailHtml = (email) => {
                                return `<!DOCTYPE html>
                                    <html lang="ko">
                                    <head>
                                        <meta charset="UTF-8">
                                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        <link rel="stylesheet" type="text/css" href="https://cdn.rawgit.com/moonspam/NanumSquare/master/nanumsquare.css">
                                        <title>평행공간-메일 인증하기</title>
                                        <style>
                                            * {
                                                margin:0;
                                                padding: 0;
                                                font-family: 'NanumSquare', sans-serif !important;
                                            }
                                            section {
                                                position: relative;
                                                padding: 80px;
                                                width: 600px;
                                                height: 600px;
                                                box-sizing: border-box;
                                                background: #F6F6F6;
                                                border-radius: 50px;
                                            }
                                    
                                            /* logo */
                                            h1 {
                                                width: 150px;
                                                margin-top: 10px;
                                            }
                                            img {
                                                width: 100%;
                                            }
                                    
                                            /* description */
                                            h2 {
                                                font-size: 24px;
                                                margin: 40px 0 30px 0;
                                            }
                                    
                                            .desc {
                                                font-size: 17px;
                                                line-height: 26px;
                                            }
                                    
                                            .desc span {
                                                color: #00274a;
                                                font-weight: 900;
                                            }
                                    
                                            button {
                                                margin: 40px 0 20px 0;
                                                width: 440px;
                                                height: 60px;
                                                background: #00274a;
                                                color: #FFF;
                                                border: none;
                                                border-radius: 20px;
                                                cursor: pointer;
                                                font-size: 16px;
                                                font-weight: 900;
                                            }
                                            button:focus {
                                                outline: none;
                                            }
                                    
                                            div {
                                                width: 440px;
                                                padding: 20px 0 0 0;
                                                border-top: 1px solid #00274a;
                                            }
                                    
                                            div p {
                                                font-size: 14px;
                                                line-height: 20px;
                                                color: #999;
                                            }
                                        </style>
                                    </head>
                                    <body>
                                        <section>
                                            <h1>
                                                <img src="https://pspace.ai/images/210105_pspace_logo_B.png" alt="logo">
                                            </h1>
                                            <h2>이메일 주소 인증 안내입니다.</h2>
                                            <p class="desc">
                                                안녕하세요. 평행공간입니다.<br />
                                                저희의 서비스를 이용해주셔서 진심으로 감사드립니다.<br>
                                                <span>아래 '메일 인증하기'를 클릭하여 이메일 인증을 완료해주세요.</span><br>
                                                감사합니다.
                                            </p>
                                            <a href="https://pspace.ai/api/user/verify/email?address=${email}" ><p style="font-size:160%;">메일 인증하기</p></a>
                                            
                                    
                                        </section>
                                    </body>
                                    </html>`
                                }

