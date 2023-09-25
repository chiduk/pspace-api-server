
module.exports.generateAgreementDoc = (info) => {
    return `<html>
            <body>
                <script>
                   setTimeout(function (){
                        let options = '<option>연도</option>'
                        for(let i = 1900; i < 2021; i++){
                            options = options + '<option value=' + i + '>' + i + '</option>'
                        }
                        document.getElementById('birthDateYearSelect').innerHTML = options
                        
                        let date = new Date()
                     
                        let year = date.getFullYear()
                        let month = date.getMonth() + 1
                        let day = date.getDate()
                        document.getElementById('today').innerHTML = year + '년 ' + month + '월 ' + day + '일'
                   
                    }, 100)
                </script>
                <script>
                    function requestSign() {
                        document.getElementById('ownerInfoForm').submit()
                    }
                </script>
                <script>
                    setTimeout(function () {
                        console.log(document.getElementById('keyInputId').value)
                        let key = document.getElementById('keyInputId').value
                        let filename = document.getElementById('filenameInputId').value
    
                        let http = new XMLHttpRequest()
                        let url = '/api/agreement/isSigned'
                        let params = 'key=' + key
                        http.open('post', url, true)
                        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                        http.send(params)
                        http.onreadystatechange = function () {
                            if(http.readyState === 4 && http.status === 200){
                                console.log(http)
                                
                                let isSigned = JSON.parse(http.response).isSigned
                                
                                console.log(isSigned)
                                
                                if(isSigned){
                                    document.getElementById('ownerInfoForm').style.display = 'none'
                                    document.getElementById('requestSignButtonId').style.display = 'none'
                                    document.getElementById('signedId').style.display = 'block'
                                  
                                    
                                    let ownerName = document.getElementById('ownerNameId').textContent
                                    document.getElementById('signedId').innerHTML = '서명완료: ' + ownerName
                                }else{
                                    document.getElementById('ownerInfoForm').style.display = 'block'
                                    document.getElementById('requestSignButtonId').style.display = 'block'
                                    document.getElementById('signedId').style.display = 'none'
                                    
                                }
                            }
                        }
                    }, 100)
                    
                </script>
                <script>
                    function saveDoc () {
                        let http = new XMLHttpRequest()      
                        let key = document.getElementById('keyInputId').value
                        let url = '/api/agreement/save'
                        let params = 'key=' + key
                        http.open('post', url, true)
                        http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                        http.send(params)
                        http.onreadystatechange = function () {
                            if(http.readyState === 4 && http.status === 200){
                                console.log(http) 
                            }
                        }
                    }
                </script>
                
                <div style="width:60%; margin:0 auto; padding:80px 0 60px 0; line-height:1.8em;">
                    <div>
                        <ul style="list-style:none; padding:0;">
                            <li>갑: ${info.ownerName}</li>
                            <li>을: (주)평행공간</li>
                            <li>병: ${info.reAgencyCompanyName}</li>
                        </ul>
                    </div>
                    <br/>
                    <div>목적물의 주소: ${info.address}</div>
                    <br/>
                    <div>갑은 아래와 같이 ㈜평행공간이 부동산 물건에 대한 공간내부 매핑 및 후가공, 사용하는 것에 동의합니다.</div>
                    <br/>
                    <div style='text-align:center'>-  아       래  -</div>
                    <br/>
                    <div>
                        1. 갑은 갑이 소유 또는 사용하는 부동산 공간을 을이 내부를 촬영 및 매핑하도록 편의를 제공하고 이를 www.pspace.ai에서 일부에게 개시하는 것에 동의한다.
                    </div>
                    <br/>
                    <div>
                        2. 을의 파노라마 이미지와 3D데이터값 생성의 보수용역에 대하여 ${info.reAgencyCompanyName}이(가) 금액 ₩30,000원을(를) 지급한다. (vat별도)
                    </div>
                    <br/>
                    <div>
                        3. 제작된 파노라마 이미지와 3D데이터값의 권리는 을에게 있다
                    </div>
                    <br/>
                    <div>
                        4. 갑은 언제든지 을에게 www.pspcae.ai에 개시된 내부매핑데이터의 삭제를 요청할 수 있고 을은 이에 즉시 따라야 한다.
                    </div>
                    <br/>
                    <div>
                        5. (제3자 정보제공동의) 갑은 부동산중개거래에 있어서 필요한 목적의 범위 내에서 촬영 제작된 파노라마 이미지와 3D데이터값을 병에게 제공함에 동의한다.
                    </div>
                    <br/>
                    <p id="today" style='text-align: center'></p>
                    <br/>
                    <form action="/api/agreement/sign/agreement" method="post" id="ownerInfoForm" style="float:right;">
                        <div>
                            <input id="keyInputId" hidden name="key" value=${info.key} />
                            <input id="filenameInputId" hidden name="filename" value=${info.filename} />
                        </div>
                        <div style="height:40px;">
                            <label>이름 :</label>
                            <input readonly id="ownerNameInputID" name="ownerName" value=${info.ownerName} style="width:150px; border:none; border-bottom:1px solid lightgray; line-height:1.8em;"/>
                        </div>
                        <div style="height:40px;">
                            <label>핸드폰번호 :</label>
                            <input id="cellPhoneNumberInputID" name="ownerPhoneNumber" style="width:150px; border:none; border-bottom:1px solid lightgray; line-height:1.8em;"/>
                        </div>
                        <div style="display:inline-flex; height:40px; clear:both;">
                            <label>생년월일 :</label>
                            <div style="margin:0 0 0 4px;">
                                <select id="birthDateYearSelect" name="birthYear" form="ownerInfoForm" style="border:none; border-bottom:1px solid lightgray; padding:4px;"></select>
                                <select id="birthDateMonthSelect" name="birthMonth" form="ownerInfoForm" style="border:none; border-bottom:1px solid lightgray; padding:4px;">
                                    <option>월</option>
                                    <option value="01">1</option>
                                    <option value="02">2</option>
                                    <option value="03">3</option>
                                    <option value="04">4</option>
                                    <option value="05">5</option>
                                    <option value="06">6</option>
                                    <option value="07">7</option>
                                    <option value="08">8</option>
                                    <option value="09">9</option>
                                    <option value="11">11</option>
                                    <option value="12">12</option>
                                </select>
    
                                <select id="birthDateDateSelect" name="birthDate" form="ownerInfoForm" style="border:none; border-bottom:1px solid lightgray; padding:4px;">
                                    <option>일</option>
                                    <option value="01">1</option>
                                    <option value="02">2</option>
                                    <option value="03">3</option>
                                    <option value="04">4</option>
                                    <option value="05">5</option>
                                    <option value="06">6</option>
                                    <option value="07">7</option>
                                    <option value="08">8</option>
                                    <option value="09">9</option>
                                    <option value="11">11</option>
                                    <option value="12">12</option>
                                    <option value="13">13</option>
                                    <option value="14">14</option>
                                    <option value="15">15</option>
                                    <option value="16">16</option>
                                    <option value="17">17</option>
                                    <option value="18">18</option>
                                    <option value="19">19</option>
                                    <option value="20">20</option>
                                    <option value="21">21</option>
                                    <option value="22">22</option>
                                    <option value="23">23</option>
                                    <option value="24">24</option>
                                    <option value="25">25</option>
                                    <option value="26">26</option>
                                    <option value="27">27</option>
                                    <option value="28">28</option>
                                    <option value="29">29</option>
                                    <option value="30">30</option>
                                    <option value="31">31</option>
                                </select>
                            </div> 
                    </form>
                </div>
                <div style="width:100%; height:180px;"></div>
                <button id="requestSignButtonId" onclick="requestSign()" style="clear:both; display:block; width:200px; height:50px; border:none; border-radius:20px; margin:0 auto; cursor:pointer; transition:all 0.3s ease;" onmouseover="this.style.background='rgba(0, 39, 74, 1)'; this.style.color='#ffffff';" onmouseout="this.style.background=''; this.style.color=''; ">서명하기</button>
                <div>
                    <p id="signedId"></p>
                    
                </div>
                <div>
                    <p style="display: none" id="ownerNameId">${info.ownerName}</p>
                </div>
            </div>
        </body>
    </html>`
}