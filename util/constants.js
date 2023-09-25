let randomNumberGenerator = require('./randomNumberGenerator')


module.exports = property = {
        category: [
            {
                type: 'APARTMENT',
                value: '아파트'
            },
            {
                type: 'OFFICETEL',
                value: '오피스텔'
            },
            {
                type: 'VILLA',
                value: '빌라'
            },
            {
                type: 'HOUSE',
                value: '주택'
            },
            {
                type: 'ONE_ROOM',
                value: '원룸'
            },
            {
                type: 'TWO_ROOM',
                value: '투룸'
            },
            {
                type: 'MALL',
                value: '상가'
            },
            {
                type: 'OFFICE',
                value: '업무'
            },
            {
                type: 'FACTORY',
                value: '공장'
            },
            {
                type: 'LAND',
                value: '토지'
            },
            {
                type: 'FARCEL',
                value: '분양'
            }
        ],
        salesMethod: [
            {
                type: 'FOR_SALE',
                value: '매매'
            },
            {
                type: 'KEY_DEPOSIT_RENT',
                value: '전세'
            },
            {
                type: 'MONTHLY_RENT',
                value: '월세'
            },
            {
                type: 'SHORT_TERM_RENT',
                value: '단기임대'
            }
        ],
        mortgage: [
            {
                type: 'NONE',
                value: '없음'
            },
            {
                type: 'BELOW_30',
                value: '30% 미만'
            }
        ],
        facingDirection: [
            {
                type: 'E',
                value: '동'
            },
            {
                type: 'W',
                value: '서'
            },
            {
                type: 'S',
                value: '남'
            },
            {
                type: 'N',
                value: '북'
            },
            {
                type: 'SE',
                value: '남동'
            },
            {
                type: 'SW',
                value: '남서'
            },
            {
                type: 'NE',
                value: '북동'
            },
            {
                type: 'NW',
                value: '북서'
            }
        ],
        principalUser: [
            {
                type: 'DETACHED_HOUSE',
                value: '단독주택'
            },
            {
                type: 'MULTI_UNIT_HOUSE',
                value: '다가구주택'
            },
            {
                type: 'MULTI_FAMILY_HOUSE',
                value: '공동주택'
            },
            {
                type: 'CLASS_ONE',
                value: '1종 근린생활시설'
            },
            {
                type: 'CLASS_TWO',
                value: '2종 근린생활시설'
            },
            {
                type: 'CULTURAL_AND_ASSEMBLY_FACILITY',
                value: '문화 및 집회시설'
            },
            {
                type: 'RELIGIOUS_FACILITY',
                value: '종교시설'
            },
            {
                type: 'SALES_FACILITY',
                value: '판매시설'
            },
            {
                type: 'TRANSPORTATION_FACILITY',
                value: '운수시설'
            },
            {
                type: 'MEDICAL_FACILITY',
                value: '의료시설'
            },
            {
                type: 'EDUCATION_AND_RESEARCH_FACILITY',
                value: '교육연구시설'
            },
            {
                type: 'ELDERLY_FACILITY',
                value: '노유자시설'
            },
            {
                type: 'TRAINING_FACILITY',
                value: '수련시설'
            },
            {
                type: 'EXERCISE_FACILITY',
                value: '운동시설'
            },
            {
                type: 'BUSINESS_FACILITY',
                value: '업무시설'
            },
            {
                type: 'ACCOMMODATION_FACILITY',
                value: '숙박시설'
            },
            {
                type: 'ENTERTAINMENT_FACILITY',
                value: '위락시설'
            },
            {
                type: 'FACTORY_FACILITY',
                value: '공장'
            },
            {
                type: 'WAREHOUSE_FACILITY',
                value: '창고시설'
            },
            {
                type: 'DANGEROUS_GOODS_STORAGE_AND_DISPOSAL_FACILITY',
                value: '위험물 저장 및 처리 시설'
            },
            {
                type: 'AUTOMOTIVE_RELATED_FACILITY',
                value: '자동차 관련 시설'
            },
            {
                type: 'ANIMAL_AND_PLANT_FACILITY',
                value: '동물 및 식물 관련 시설'
            },
            {
                type: 'RESOURCE_CIRCULATION_RELATED_FACILITY',
                value: '자원순환 관련 시설'
            },
            {
                type: 'CORRECTIONAL_AND_MILITARY_FACILITY',
                value: '교정 및 군사 시설'
            },
            {
                type: 'BROADCASTING_AND_COMMUNICATION_FACILITY',
                value: '방송통신시설'
            },
            {
                type: 'POWER_GENERATION_FACILITY',
                value: '발전시설'
            },
            {
                type: 'GRAVEYARD_RELATED_FACILITY',
                value: '묘지 관련 시설'
            },
            {
                type: 'TOURIST_RESTING_FACILITY',
                value: '관광 휴게시설'
            },
            {
                type: 'FUNERAL',
                value: '장례식장'
            },
            {
                type: 'CAMPSITE_FACILITY',
                value: '야영장시설'
            }
        ],
        codeHeatNm: [
            {
              type: 'DISTRICT_HEATING',
              value: '지역난방'
            },
            {
                type: 'CENTRAL_HEATING',
                value: '중앙난방'
            },
            {
                type: 'INDIVIDUAL_HEATING',
                value: '개별난방'
            }
        ],
        maintenanceFee: '',
        note:'',
        title: '',
        address_1: '',
        address_2: '',

        size: {
            location: [
                {
                    type: 'LOW',
                    value: '저'
                },
                {
                    type: 'MIDDLE',
                    value: '중'
                },
                {
                    type: 'HIGH',
                    value: '고'
                }
            ],
            floor:'',
            groundFloor: '',
            basement: '',
            totalFloor: '',
            actualSize:'',
            totalSize:'',
            floorAreaRatio: '',
            buildingCoverage: '',
            siteArea: '',
            totalFloorArea: ''

        },
    
        moveinDate: '',

}
    

let constants = {
    property: {
        category: [
            {
                type: 'APARTMENT',
                value: '아파트'
            },
            {
                type: 'OFFICETEL',
                value: '오피스텔'
            },
            {
                type: 'VILLA',
                value: '빌라'
            },
            {
                type: 'HOUSE',
                value: '주택'
            },
            {
                type: 'ONE_ROOM',
                value: '원룸'
            },
            {
                type: 'TWO_ROOM',
                value: '투룸'
            },
            {
                type: 'MALL',
                value: '상가'
            },
            {
                type: 'OFFICE',
                value: '업무'
            },
            {
                type: 'FACTORY',
                value: '공장'
            },
            {
                type: 'LAND',
                value: '토지'
            },
            {
                type: 'FARCEL',
                value: '분양'
            }
        ],
        salesMethod: [
            {
                type: 'FOR_SALE',
                value: '매매'
            },
            {
                type: 'KEY_DEPOSIT_RENT',
                value: '전세'
            },
            {
                type: 'MONTHLY_RENT',
                value: '월세'
            },
            {
                type: 'SHORT_TERM_RENT',
                value: '단기임대'
            }
        ],
        mortgage: [
            {
                type: 'NONE',
                value: '없음'
            },
            {
                type: 'BELOW_30',
                value: '30% 미만'
            }
        ],
        principalUser: [
            {
                type: 'DETACHED_HOUSE',
                value: '단독주택'
            },
            {
                type: 'MULTI_UNIT_HOUSE',
                value: '다가구주택'
            },
            {
                type: 'MULTI_FAMILY_HOUSE',
                value: '공동주택'
            },
            {
                type: 'CLASS_ONE',
                value: '1종 근린생활시설'
            },
            {
                type: 'CLASS_TWO',
                value: '2종 근린생활시설'
            },
            {
                type: 'CULTURAL_AND_ASSEMBLY_FACILITY',
                value: '문화 및 집회시설'
            },
            {
                type: 'RELIGIOUS_FACILITY',
                value: '종교시설'
            },
            {
                type: 'SALES_FACILITY',
                value: '판매시설'
            },
            {
                type: 'TRANSPORTATION_FACILITY',
                value: '운수시설'
            },
            {
                type: 'MEDICAL_FACILITY',
                value: '의료시설'
            },
            {
                type: 'EDUCATION_AND_RESEARCH_FACILITY',
                value: '교육연구시설'
            },
            {
                type: 'ELDERLY_FACILITY',
                value: '노유자시설'
            },
            {
                type: 'TRAINING_FACILITY',
                value: '수련시설'
            },
            {
                type: 'EXERCISE_FACILITY',
                value: '운동시설'
            },
            {
                type: 'BUSINESS_FACILITY',
                value: '업무시설'
            },
            {
                type: 'ACCOMMODATION_FACILITY',
                value: '숙박시설'
            },
            {
                type: 'ENTERTAINMENT_FACILITY',
                value: '위락시설'
            },
            {
                type: 'FACTORY_FACILITY',
                value: '공장'
            },
            {
                type: 'WAREHOUSE_FACILITY',
                value: '창고시설'
            },
            {
                type: 'DANGEROUS_GOODS_STORAGE_AND_DISPOSAL_FACILITY',
                value: '위험물 저장 및 처리 시설'
            },
            {
                type: 'AUTOMOTIVE_RELATED_FACILITY',
                value: '자동차 관련 시설'
            },
            {
                type: 'ANIMAL_AND_PLANT_FACILITY',
                value: '동물 및 식물 관련 시설'
            },
            {
                type: 'RESOURCE_CIRCULATION_RELATED_FACILITY',
                value: '자원순환 관련 시설'
            },
            {
                type: 'CORRECTIONAL_AND_MILITARY_FACILITY',
                value: '교정 및 군사 시설'
            },
            {
                type: 'BROADCASTING_AND_COMMUNICATION_FACILITY',
                value: '방송통신시설'
            },
            {
                type: 'POWER_GENERATION_FACILITY',
                value: '발전시설'
            },
            {
                type: 'GRAVEYARD_RELATED_FACILITY',
                value: '묘지 관련 시설'
            },
            {
                type: 'TOURIST_RESTING_FACILITY',
                value: '관광 휴게시설'
            },
            {
                type: 'FUNERAL',
                value: '장례식장'
            },
            {
                type: 'CAMPSITE_FACILITY',
                value: '야영장시설'
            }
        ],
        codeHeatNm: [
            {
                type: 'DISTRICT_HEATING',
                value: '지역난방'
            },
            {
                type: 'CENTRAL_HEATING',
                value: '중앙난방'
            },
            {
                type: 'INDIVIDUAL_HEATING',
                value: '개별난방'
            }
        ],
        status: {
            type:{
                ALL: 'ALL',
                SELLING: 'SELLING',
                COMPLETED: 'COMPLETED',
                WITHDRAWN: 'WITHDRAWN',
                OTHER: 'OTHER'
            }
        },
        facingDirection: [
            {
                type: 'E',
                value: '동'
            },
            {
                type: 'W',
                value: '서'
            },
            {
                type: 'S',
                value: '남'
            },
            {
                type: 'N',
                value: '북'
            },
            {
                type: 'SE',
                value: '남동'
            },
            {
                type: 'SW',
                value: '남서'
            },
            {
                type: 'NE',
                value: '북동'
            },
            {
                type: 'NW',
                value: '북서'
            }
        ],



        getRandomCategory: () => {
            let index = randomNumberGenerator.getRandomeIntInclusive(0,5)
            return property.category[index]
        },

        getRandomSalesMethod: () => {
            let index = randomNumberGenerator.getRandomeIntInclusive(0 ,3)
            return property.salesMethod[index]
        },

        getRandomMortgage: () => {
            let index = randomNumberGenerator.getRandomeIntInclusive(0, 1)
            return property.mortgage[index]
        },

        getRandomNumberOfRooms: () => {
            return randomNumberGenerator.getRandomeIntInclusive(1,4)
        },

        getRandomNumberOfBathrooms: () => {
            return randomNumberGenerator.getRandomeIntInclusive(1,4)
        },

        getRandomFacingDirection: () => {
            let index = randomNumberGenerator.getRandomeIntInclusive(0,7)
            return property.facingDirection[index]
        },

        getRandomLocation: () => {
            let index = randomNumberGenerator.getRandomeIntInclusive(0, 2)
            return property.size.location[index]
        }
    },

    salesStatus: {
        ALL : {
            type: 'ALL',
            value: '전체'
        },
        SELLING: {
            type: 'SELLING',
            value: '거래중'
        },
        COMPLETED: {
            type: 'COMPLETED',
            value: '계약완료'
        },
        WITHDRAWN: {
            type: 'WITHDRAWN',
            value: '중개의사철회'
        },
        OTHER: {
            type: 'OTHER',
            value: '기타'

        },
        CLOSED: {
            type: 'CLOSED',
            value: '거래종료'
        }

    },

    category: {
        APARTMENT: '아파트',
        OFFICETEL: '오피스텔',
        VILLA: '빌라',
        HOUSE: '주택',
        ONE_ROOM: '원룸',
        TWO_ROOM: '투룸',
        MALL: '상가',
        OFFICE: '업무',
        FACTORY: '공장',
        GROUND: '토지',
        PARCEL: '분양'
    },

    salesMethod: {
        FOR_SALE: '매매',
        KEY_DEPOSIT_RENT: '전세',
        MONTHLY_RENT: '월세',
        SHORT_TERM_RENT: '단기임대'
    },

    mortgage: {
        NONE: '없음',
        BELOW_30: '30% 미만'
    },

    facingDirection: {
        E: '동',
        W: '서',
        S: '남',
        N: '북',
        SE: '남동',
        SW: '남서',
        NE: '북동',
        NW: '북서'
    },

    principalUser: {
        DETACHED_HOUSE: '단독주택',
        MULTI_UNIT_HOUSE: '다가구주택',
        MULTI_FAMILY_HOUSE: '공동주택',
        CLASS_ONE: '1종 근린생활시설',
        CLASS_TWO: '2종 근린생활시설',
        CULTURAL_AND_ASSEMBLY_FACILITY: '문화 및 집회시설',
        RELIGIOUS_FACILITY: '종교시설',
        SALES_FACILITY: '판매시설',
        TRANSPORTATION_FACILITY: '운수시설',
        MEDICAL_FACILITY: '의료시설',
        EDUCATION_AND_RESEARCH_FACILITY: '교육연구시설',
        ELDERLY_FACILITY: '노유자시설',
        TRAINING_FACILITY: '수련시설',
        EXERCISE_FACILITY: '운동시설',
        BUSINESS_FACILITY: '업무시설',
        ACCOMMODATION_FACILITY: '숙박시설',
        ENTERTAINMENT_FACILITY: '위락시설',
        FACTORY_FACILITY: '공장',
        WAREHOUSE_FACILITY: '창고시설',
        DANGEROUS_GOODS_STORAGE_AND_DISPOSAL_FACILITY: '위험물 저장 및 처리 시설',
        AUTOMOTIVE_RELATED_FACILITY: '자동차 관련 시설',
        ANIMAL_AND_PLANT_FACILITY: '동물 및 식물 관련 시설',
        RESOURCE_CIRCULATION_RELATED_FACILITY: '자원순환 관련 시설',
        CORRECTIONAL_AND_MILITARY_FACILITY: '교정 및 군사 시설',
        BROADCASTING_AND_COMMUNICATION_FACILITY: '방송통신시설',
        POWER_GENERATION_FACILITY: '발전시설',
        GRAVEYARD_RELATED_FACILITY: '묘지 관련 시설',
        TOURIST_RESTING_FACILITY: '관광 휴게시설',
        FUNERAL: '장례식장',
        CAMPSITE_FACILITY: '야영장시설'
    },

    codeHeatNm: {
        DISTRICT_HEATING: '지역난방',
        CENTRAL_HEATING: '중앙난방',
        INDIVIDUAL_HEATING: '개별난방'
    },

    fuel: {
        LATENIGHT_ELECTRICITY: '심야전기',
        CITY_GAS: '도시가스',
        OIL_BOILER: '기름보일러',
        LPG: 'LPG가스',
        BRIQUET: '연탄',
        CHP: '열병합'
    },

    codeHallNm: {
        CASCADING: '계단식',
        CORRIDOR: '복도식',
        MIXED: '혼합식'
    },

    officetelUse: {
        FOR_RESIDENTIAL: '주거용',
        FOR_BUSINESS: '업무용',
        FOR_COMBINED_USE: '겸용'
    },

    height: {
        LOW: '저',
        MIDDLE: '중',
        HIGH: '고'
    },

    collection: {
        USER: 'USER',
        PROPERTY: 'PROPERTY',
        EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
        INTERESTED_PROPERTY: 'INTERESTED_PROPERTY', //매물등록 알림 리스트 요청
        VR_TOUR: 'VR_TOUR_REG_USER',
        VR_TOUR_RE_AGENT: 'VR_TOUR_RE_AGENT',
        VISIT_APPOINTMENT: 'VISIT_APPOINTMENT',
        SAVED_PROPERTY: 'SAVED_PROPERTY',
        VISIT_SCHEDULE: 'VISIT_SCHEDULE',
        INQUIRY: 'INQUIRY',
        INQUIRY_ANSWER: 'INQUIRY_ANSWER',
        INQUIRY_NON_MEMBER: 'INQUIRY_NON_MEMBER',
        INQUIRY_NON_MEMBER_ANSWER: 'INQUIRY_NON_MEMBER_ANSWER',
        WEBSITE_VISITOR: 'WEBSITE_VISITOR',
        VISIT_UNAVAILABLE_DATE: 'VISIT_UNAVAILABLE_DATE',
        ALERT_ADMIN: 'ALERT_ADMIN',
        REAL_ESTATE_AGENT_INFO: 'REAL_ESTATE_AGENT_INFO',
        KAPT: 'KAPT',
        IMAGE: 'IMAGE',
        VR_DELETE_REQUEST: 'VR_DELETE_REQUEST',
        FIRST_AREA: 'INTERESTED_FIRST_AREA',
        SECOND_AREA: 'INTERESTED_SECOND_AREA',
        THIRD_AREA: 'INTERESTED_THIRD_AREA',
        VR_PORT: 'VR_PORT',
        BUILDING_REGISTRY_PYOJEBU: 'BUILDING_REGISTRY_PYOJEBU',
        BUILDING_REGISTRY_TOTALPYOJEBU: 'BUILDING_REGISTRY_TOTALPYOJEBU',
        ACTUAL_SALES_OF_APARTMENTS: 'ACTUAL_SALES_OF_APARTMENTS',
        SCAN_AGREEMENT: '3D_SCAN_AGREEMENT',
        PAYMENT: 'PAYMENT',
        INDOOR_VIEWER: 'INDOOR_VIEWER',
        BJDONG: 'BJDONG'
    },

    inquiry_category: [
        {type: 'INQUIRY_APPOINTMENT', value: '예약문의'},
        {type: 'INQUIRY_PROPERTY', value: '매물문의'},
        {type: 'INQUIRY_MEMBER', value: '회원문의'},
        {type: 'INQUIRY_OTHER', value: '기타문의'}
    ],

    MAX_VISIT: 5,

    PROPERTY_RESERVATION_LIST_ORDER_BY : {
        RECENT_RESERVATION: 'RECENT_RESERVATION',
        RECENT_ADDED: 'RECENT_ADDED',
        MOST_RESERVED: 'MOST_RESERVED'
    },

    ALERT_ADMIN: {
        ALERT_RE_SIGN_UP_APPROVAL: 'ALERT_RE_SIGN_UP_APPROVAL',
        ALERT_VISIT_APPOINTMENT: 'ALERT_VISIT_APPOINTMENT'
    },

    PROPERTY_LIST_ORDER_BY: {
        MOST_POPULAR: 'MOST_POPULAR',
        RECENT_ADDED: 'RECENT_ADDED',
        TITLE: 'TITLE',
        PRICE: 'PRICE',
        VIEW_COUNT: 'VIEW_COUNT',
        VR_TOUR_COUNT: 'VR_TOUR_COUNT',
        MOVE_IN_DATE: 'MOVE_IN_DATE'
    },


}

module.exports = constants


module.exports.SALES_METHOD = {
    FOR_SALE: {
        type: 'FOR_SALE',
        value: '매매'
    },
    KEY_DEPOSIT_RENT: {
        type: 'KEY_DEPOSIT_RENT',
        value: '전세'
    },
    MONTHLY_RENT: {
        type: 'MONTHLY_RENT',
        value: '월세'
    },
    SHORT_TERM_RENT: {
        type: 'SHORT_TERM_RENT',
        value: '단기임대'
    }
}

module.exports.MORTGAGE = {
    NONE:{
        type: 'NONE',
        value: '없음'
    },
    BELOW_30: {
        type: 'BELOW_30',
        value: '30% 미만'
    }
}

module.exports.CATEGROY = {
    APARTMENT:{
        type: 'APARTMENT',
        value: '아파트'
    },
    OFFICETEL:{
        type: 'OFFICETEL',
        value: '오피스텔'
    },
    VILLA: {
        type: 'VILLA',
        value: '빌라'
    },
    HOUSE: {
        type: 'HOUSE',
        value: '주택'
    },
    ONE_ROOM: {
        type: 'ONE_ROOM',
        value: '원룸'
    },
    TWO_ROOM: {
        type: 'TWO_ROOM',
        value: '투룸'
    },
    MALL:{
        type: 'MALL',
        value: '상가'
    },
    OFFICE:{
        type: 'OFFICE',
        value: '업무'
    },
    FACTORY: {
        type: 'FACTORY',
        value: '공장'
    },
    LAND: {
        type: 'LAND',
        value: '토지'
    },
    FARCEL: {
        type: 'FARCEL',
        value: '분양'
    }
}

module.exports.FACING_DIRECTION = {
    E:{
        type: 'E',
        value: '동'
    },
    W:{
        type: 'W',
        value: '서'
    },
    S:{
        type: 'S',
        value: '남'
    },
    N:{
        type: 'N',
        value: '북'
    },
    SE:{
        type: 'SE',
        value: '남동'
    },
    SW:{
        type: 'SW',
        value: '남서'
    },
    NE:{
        type: 'NE',
        value: '북동'
    },
    NW:{
        type: 'NW',
        value: '북서'
    }
}

module.exports.SIZE_LOCATION = {
    HIGH:{
        type: 'HIGH',
        value: '고'
    },
    MIDDLE: {
        type: 'MIDDLE',
        value: '중'
    },
    LOW: {
        type: 'LOW',
        value: '저'
    }
}

module.exports.MOVE_IN_DATE = {
    DATE : {
        type : 'DATE',
        value : '날짜'
    },
    ALWAYS : {
        type : 'ALWAYS',
        value : '상시가능'
    },
    CONFERENCE : {
        type : 'CONFERENCE',
        value : '협의가능'
    }
}

module.exports.VR_TOUR_LINK_TTL = 86400

module.exports.INDOOR_VIEWER_STATUS = {
    UP: 'UP',
    LOADING: 'LOADING',
    DOWN: 'DOWN'
}

module.exports.day = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

module.exports.PSPACE_LAT = 37.492702
module.exports.PSPACE_LONG= 127.028535

module.exports.DANAL_PAYMENT_METHOD = {
    CARD: 'card',
    TRANS: 'trans',
    VBANK: 'vbank',
    PHONE: 'phone'
}

module.exports.BANK_CODE = [
    { name: 'KB국민은행', code: '4' },
    { name: 'SC제일은행', code: '23' },
    { name: '경남은행', code: '39' },
    { name: '광주은행', code: '34' },
    { name: '기업은행', code: '3' },
    { name: '농협', code: '11' },
    { name: '대구은행', code: '31' },
    { name: '부산은행', code: '32' },
    { name: '산업은행', code: '2' },
    { name: '새마을금고', code: '45' },
    { name: '수협', code: '7' },
    { name: '신한은행', code: '88' },
    { name: '신협', code: '48' },
    { name: '외환은행', code: '5' },
    { name: '우리은행', code: '20' },
    { name: '우체국', code: '71' },
    { name: '전북은행', code: '37' },
    { name: '카카오뱅크', code: '90' },
    { name: '케이뱅크', code: '89' },
    { name: '하나은행(서울은행)', code: '81' },
    { name: '한국씨티은행(한미은행)', code: '27' }
]

module.exports.DANAL_PAYMENT_STATUS = {
    PAID : 'paid',
    CANCELLED : 'cancelled',
    READY : 'ready'
}