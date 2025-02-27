//vue, react, jquery 등이 아닌 일반 native javascript 함수들만 모아서 관리하여 향후 다른 플랫폼, 라이브러리로 바뀌어도 재사용 가능하도록 함

const hush = {

    util : {
        isvoid : function(obj) { //대신 a ?? b로 사용하기 (a가 null도 아니고 undefined도 아니면 a 반환. a가 0이거나 false라도 a를 반환)
            if (typeof obj == "undefined" || obj == null || obj == "undefined") return true
            return false
        },
        getDateTimeStamp : (str) => { //str = 2012-08-02 14:12:04 (일자형식 체크해야 하나 일단 표준대로 들어온다는 전체하에 사용하기로 함)
            if (str.length != 19) return null
            const d = str.match(/\d+/g) //extract date parts
            return new Date(d[0], d[1] - 1, d[2], d[3], d[4], d[5])
        },
        getDayFromDateStr : function(str) { //str = 2012-08-02 (일자형식 체크해야 하나 일단 표준대로 들어온다는 전체하에 사용하기로 함)
            if (str.length != 10) return null
            const obj = { "1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토", "7": "일" }
            const dt = hush.util.getDateTimeStamp(str.substring(0, 10) + " 00:00:00")
            return obj[dt.getDay().toString()]
        },
        getDateTimeDiff(prev, cur) { //yyyy-mm-dd hh:MM:dd
            const dtPrev = hush.util.getDateTimeStamp(prev)
            const dtCur = hush.util.getDateTimeStamp(cur)
            return parseInt((dtCur - dtPrev) / 1000) //return seconds / 60 : 분으로 리턴
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
        }
    }

}

export default hush