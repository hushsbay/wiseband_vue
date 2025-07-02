//vue, react, jquery 등이 아닌 일반 native javascript 함수들만 모아서 관리하여 향후 다른 플랫폼, 라이브러리로 바뀌어도 재사용 가능하도록 함

const hush = {

    cons : {
        OK : '0',
        NOT_OK : '-1',
        NOT_FOUND : '-100',
        // BLANK_DATA : '-101',
        // JWT_NONE : '-801',
        // JWT_MISMATCH : '-802',
        // JWT_EXPIRED : '-803',
        // JWT_ETC : '-809',
        // PWD_MISMATCH : '-811',
        auth_err_prefix : "-8",
        deli : "$~$",
        cdtAtFirst : "1111-11-11",
        cdtAtLast : "9999-99-99",
        scrollToBottomMaxCount : 3, //100개 정도로 시작해보기
        color_light : "whitesmoke_",
        color_dark : "violet_",
        color_athome : "#e6f2e6", //--hover-color in main.css //"lightsteelblue", //color_act_later : "lightsteelblue",
        uploadLimitSize : 10 * 1024 * 1024, //10MB
        uploadMaxCount : 10,
        toastSec : 2,
        toastMsg : "처리중..",
        moreData : "조회중..",
        startOfData : "처음 데이터입니다.",
        endOfData : "마지막 데이터입니다.",
        picCnt : 4, //picCnt명까지만 사진 등 보여주기 (4명까지만 가능. 서버도 동일 설정)
        //done : "처리 완료",
        //doneWithCnt : "처리 완료 : ",
        //askDel : "삭제하시겠습니까?",
    },

    util : {
        isvoid : function(obj) { //대신 a ?? b로 사용하기 (a가 null도 아니고 undefined도 아니면 a 반환. a가 0이거나 false라도 a를 반환)
            if (typeof obj == "undefined" || obj == null || obj == "undefined") return true
            return false
        },
        isObject : function(value) {
            return typeof value === 'object' && value !== null && !Array.isArray(value)
        },
        getRnd : function(min, max) {
            const minInt = (!min && min != 0) ? 100000 : min
            const maxInt = (!max && max != 0) ? 999999 : max
            return Math.floor(Math.random() * (maxInt - minInt)) + minInt //return min(inclusive) ~ max(exclusive) Integer only 
        },
        getDateTimeStamp : (str) => { //str = 2012-08-02 14:12:04 (일자형식 체크해야 하나 일단 표준대로 들어온다는 전체하에 사용하기로 함)
            if (str.length != 19) return null
            const d = str.match(/\d+/g) //extract date parts
            return new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5])
        },
        getDayFromDateStr : function(str) { //str = 2012-08-02 (일자형식 체크해야 하나 일단 표준대로 들어온다는 전체하에 사용하기로 함)
            if (str.length != 10) return null
            const obj = { "0": "일", "1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토" }
            const dt = hush.util.getDateTimeStamp(str.substring(0, 10) + " 00:00:00")
            return obj[dt.getDay().toString()]
        },
        getDateTimeDiff(prev, cur) { //yyyy-mm-dd hh:MM:dd
            const dtPrev = hush.util.getDateTimeStamp(prev)
            const dtCur = hush.util.getDateTimeStamp(cur)
            return parseInt((dtCur - dtPrev) / 1000) //return seconds / 60 : 분으로 리턴
        },
        displayDt(dtStr, tm) {
            if (dtStr.length < 19) return null
            const arr = dtStr.split(" ")
            if (tm == true) { //일자없이 시각만 표시
                return arr[1].substring(0, 5)
            } else if (tm == false) {
                const hday = hush.util.getDayFromDateStr(arr[0])
                return arr[0] + " (" + hday + ")"
            } else {
                const hday = hush.util.getDayFromDateStr(arr[0])
                return arr[0] + " (" + hday + ") " + arr[1].substring(0, 5)
            }
        },
        formatBytes : function (bytes) {
            let units = ["B", "KB", "MB", "GB", "TB"], i
            for (i = 0; bytes >= 1024 && i < 4; i++) bytes /= 1024
            return bytes.toFixed(2) + units[i]
        },
        getRect : (tagStr) => {
            const tag = document.querySelector(tagStr)
            if (!tag) return null 
            const rect = tag.getBoundingClientRect()
            return rect
        },
        getAngle : (x1, y1, x2, y2) => {
            var rad = Math.atan2(y2 - y1, x2 - x1)
            return (rad * 180) / Math.PI
        },
        getImageBlobUrl : (bufferData) => {
            const uInt8Array = new Uint8Array(bufferData)
            const blob = new Blob([uInt8Array], { type: "image/png" })
            return URL.createObjectURL(blob)
        },
        isInViewport : (ele) => { //사실 vieport가 아니라 웹에디터 빼고 상단 빼고 등등해서 진짜 육안으로 보여야 하므로 왠만하면 사용하지 말기
            const rect = ele.getBoundingClientRect()
            return (rect.top >= 0 && rect.left >= 0 && 
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            )
        }
    }

}

export default hush