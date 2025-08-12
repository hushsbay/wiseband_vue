import { ref, inject } from "vue"
import { useRouter, useRoute } from 'vue-router'
import { defineStore } from "pinia" //ref 대신에 storeToRefs 사용해야 v-model, 구조분해할당 등에서 문제없음 (this 해결 어려우므로 꼭 필요시 사용)
import axios from 'axios'
//import VueCookies from "vue-cookies"
import hush from '/src/stores/Common.js'
import { sock } from "/src/stores/Socket.js"

const GeneralStore = defineStore('General', () => {

    const router = useRouter()
    const route = useRoute()
    const $cookie = inject('$cookies')

    let objSaved = ref({}) //현재는 MsgList에서만 사용중. 각 메뉴, 사이드메뉴+채널별 (Back하기 전에 저장한) 스크롤 위치 등이 있음
    let selSideMenu = ref(""), chanIdActivted = ref(''), objByChanId = ref({})

    const snackBar = ref({ msg : '', where : '', toastSec : 0 }) //ref 대신 storeToRefs로 감싸지 말 것 (this 해결안됨)
    const toast = ref({ msg : '', close : false, toastSec : 0 }) //ref 대신 storeToRefs로 감싸지 말 것 (this 해결안됨)
    const bottomMsg = ref(''),  bottomMsgList = ref([]), routeFrom = ref(''), routeTo = ref(''), routedToSamePanelFromMsgList = ref(false)

    let timerShort = ref(-1) //-1은 Long Timer를 운영하는 것이고 0부터 n까지(3초정도)는 Short Timer를 운영하는 것임 (Main.vue)
    const sockToSend = ref([])

    const auth = {

        setCookie : function(nm, val, persist) { //모든 쿠키는 main.js 설정에 따르고 여기서는 persist/session 쿠키 여부만 결정. persist는 모두 1년을 만기로 설정
            const dur = (persist == true) ? "365d" : 0
            $cookie.set(nm, val, dur)
        },

        getCookie : function(nm) { //vue-cookies의 get 메소드는 nm이 없으면 "undefined"를 반환하는데 그 경우도 null로 처리해서 밖에서는 if (!userid) 방식으로 체크 가능하도록 함
            const cookie = $cookie.get(nm)
            if (hush.util.isvoid(cookie)) return null
            return cookie
        },

        delCookie : function(nm) {
            $cookie.remove(nm)
        },

        setCookieForUser : function(rs, persist) { //persist=true일 경우 아이디 저장
            auth.setCookie("token", rs.token)
            auth.setCookie("userid", rs.USERID, persist)
            auth.setCookie("usernm", rs.USERNM)
            auth.setCookie("orgcd", rs.ORG_CD)
            auth.setCookie("orgnm", rs.ORG_NM)
            auth.setCookie("toporgcd", rs.TOP_ORG_CD)
            auth.setCookie("toporgnm", rs.TOP_ORG_NM)
        },

        logout : function() {
            auth.delCookie("token")
            auth.delCookie("usernm")
            auth.delCookie("orgcd")
            auth.delCookie("orgnm")
            auth.delCookie("toporgcd")
            auth.delCookie("toporgnm")
        }

    }

    const ctx = { 
        
        on : false, //Main.vue에서 <div class="coMain" @click=>처리하지 않으면, 다른 곳을 클릭했을 때 right click한 ctx가 닫히면서 클릭한 이벤트가 바로 먹히지 않음        

        data : {
            posX : 0,
            posY : 0,
            type : null, //클릭 Target에서 LB(Left Bottom), LT(Left Top), RB(Right Bottom), RT(Right Top)
            parentX : 0,
            parentY : 0,
            parentWidth : 0,
            header : '' //v-html로 받기
        },

        menu : [],    
        
        show : async function(e) {
            this.on = false //child 메뉴 없애지 않으면 child 떠 있는채로 right click 먹히게 됨
            this.data.posX = e.clientX
            this.data.posY = e.clientY
            this.on = true
        },

        hide : function(e) { //maintainContextMenu : Main.vue에서 @click시 click해도 메뉴가 안닫히도록 해야 눈에 보일 것임
            if (e.srcElement.className.includes("maintainContextMenu")) return //우클릭이 아닌 click에서 처리시 바로 닫히면 안되게 함
            this.on = false
        },

        proc : function(row, idx) {
            if (typeof row.func != "function") return
            row.func(row, idx)
        }

    }

    const html = {

        getImageUrl : function(strFile) { //<template>의 <img>에서 사용
            //import.meta.url => http://localhost:5173/src/stores/GeneralStore.js?t=1752741856628
            //return new URL('/src/assets/images/' + strFile, import.meta.url).href
            return new URL('../assets/images/' + strFile, import.meta.url).href //배포된 운영서버에서는 public/assets/images로 표시
        }

    }

    const realtime = {

        setObjToChan : function(chanid, key, val) {
            if (!objByChanId.value[chanid]) objByChanId.value[chanid] = {}
            objByChanId.value[chanid][key] = val
        },

        procNoti : async function(row) { //알림바는 tag(=채널단위)로 groupby되어 show
            if (!hush.noti.rooms[row.CHANID]) {
                const res = await axios.post("/chanmsg/qryMsg", { chanid: row.CHANID, msgid: row.MSGID })
                const rs = util.chkAxiosCode(res.data, true)
                if (rs) hush.noti.rooms[row.CHANID] = rs.data
            }
            const room = hush.noti.rooms[row.CHANID] //오로지 CHANNM 가져오려고 서버 호출하는 것임
            const title = '[' + (room ? room.chanmst.CHANNM : hush.cons.appName) + ']'
            const author = '작성자 : ' + row.USERNM + '\n'
            const body = author + row.BODYTEXT //나중에 사용자 옵션에 따라 작성자와 본문을 보여줄지 말지 구현
            const objNoti = new window.Notification(title, {
                body : body, dir : "auto", lang : "EN", tag : row.CHANID, icon : html.getImageUrl('color_slacklogo.png'), requireInteraction : true 
            })           
            objNoti.chanid = row.CHANID
            objNoti.subkind = row.SUBKIND
            //objNoti.msgid = row.REPLYTO ? row.REPLYTO : row.MSGID //부모 메시지
            //objNoti.isNewWin = route.fullPath.includes('/body/msglist') ? true : false
            hush.noti.winForNoti[objNoti.chanid] = window
            objNoti.onclick = function () {
                //if (!hush.noti.winForNoti.closed) {
                const win = hush.noti.winForNoti[objNoti.chanid]
                if (win && !win.closed) {
                    sessionStorage.chanidFromNoti = objNoti.chanid
                    sessionStorage.subkindFromNoti = objNoti.subkind //WS or GS
                    win.focus() //hush.noti.winForNoti.focus()
                    // if (objNoti.isNewWin) { //새창에서 알림을 받았으니 클릭하면 바로 그 창으로 열어 줘야 함
                    //     ///const url = util.getUrlForBodyListNewWin(objNoti.chanid, objNoti.msgid); window.open(url, '_blank')
                    //     hush.noti.winForNoti.focus() //바로 위와 같이 처리하면 기존 창이 열려 있더라도 새창이 열리게 되므로 focus()만 주면 됨
                    // } else { //기본적으로는 메인창에 아래와 같이 focus()를 주면 Main.vue의 focus()에서 인지해서 router.push()하도록 함
                    //     //여기서 사용자가 알림 클릭시마다 선택할 수 있으면 좋은데 html5 notification bar에서 이벤트를 나누기 못찾음
                    //     //sessionStorage.msgidFromNoti = objNoti.msgid //사실, msgid까지 특정해서 열지 않아 막음 (슬랙도 제공하지 않고 있음)
                    //     sessionStorage.chanidFromNoti = objNoti.chanid
                    //     sessionStorage.subkindFromNoti = objNoti.subkind
                    //     hush.noti.winForNoti.focus()
                    // }
                    setTimeout(function() { objNoti.close() }, 500)
                } else {
                    alert("closed") //여기로 오는 경우는 없음 (해당 탭을 닫아도 다시 shown. 브라우저 닫아도 여기로 안옴)
                }
            }
            //if (!hush.noti.winForNoti) hush.noti.winForNoti = window
            realtime.setObjToChan(row.CHANID, "noti", objNoti) //나중에 창이 열리게 되면 사용자가 클릭안해도 알림바가 닫히게 하려는 용도임
        },
        
        closeNoti : function(chanid) {
            if (!objByChanId.value[chanid]) return
            if (objByChanId.value[chanid].noti) objByChanId.value[chanid].noti.close()
        },

        //아래부터는 만들어 놓은 socket.js 관련임
        set : function() { //리얼타임 반영 시작 (약 3초동안 - Main.vue 참조)
            timerShort.value = 0
        },

        emit : function(kind, data) { //room 멤버가 아닌 다른 사용자 또는 다른 소켓 1개에만 직접 전송하는 것은 서버 로직 참조
            sock.socket.emit(kind, data) //보낼 때는 서버의 본인 소켓으로만 보내고 서버에서 kind가 myself/room/all에 따라 그 대상으로 전송함
            realtime.set()
        },

        // onSock : function(kind, beforeCallback, afterCallback) {
        //     sock.socket.off(kind).on(kind, async (data) => {
        //         if (beforeCallback) await beforeCallback(data) //reserved
        //         realtime.set()
        //         if (afterCallback) await afterCallback(data) //reserved
        //     })
        // }

    }

    const util = {

        chkOnMountedTwice : function(route, str) { //MsgList가 1초 이내 2번 mounted되는데 이 루틴으로 한번만 막으려 했으나 노드자동클릭 안되는 현상 발생해 모두 막아야 함
            // if (sessionStorage.mountedFullpath == route.fullPath) {
            //     console.log(str + " - route.fullPath가 동일한데 onMounted() 재호출되어 막음 - 개발 Hot Deploy일 수도 있음 (운영에서 체크) - " + route.fullPath)
            //     return false
            // }
            // sessionStorage.mountedFullpath = route.fullPath
            // setTimeout(function() { sessionStorage.mountedFullpath = '' }, 1000)
            return true //현재 미사용이라 위에 막고 return true만 처리
        }, 

        setSnack : function(ex, toastSec, fromConfig) {
            let strMsg, strStack
            if (toastSec == true) { //토스트없이 계속 display
                snackBar.value.toastSec = 0
            } else if (Number.isInteger(toastSec)) {
                snackBar.value.toastSec = toastSec
            } else { //기본 3초 토스트
                snackBar.value.toastSec = hush.cons.toastSec
            }
            if (typeof ex == "string") {
                strMsg = ex
            } else if (typeof ex == "object" && ex.stack) {
                strMsg = ex.message
                strStack = ex.stack
                console.log(ex.stack)
            } else {
                strMsg = "gst.util.setSnack - typeof error"
            }
            if (!strMsg) {
                snackBar.value.msg = ""
            } else {
                let arrStack, line
                if (fromConfig) { //main.js의 app.config.errorHandler()에서만 true로 호출되도록 한 것임 (이 경우 ex.stack의 1번째 행이 직전 호출 함수임)
                    arrStack = ex.stack.split("\n")
                    line = 1
                } else {
                    const strStack = new Error().stack
                    arrStack = strStack.split("\n")
                    line = arrStack.length - 1 //ex.stack의 마지막 행이 직전 호출 함수임
                }
                const arr = strMsg.split("\n") //strMsg 예) [-811] user>login : 비번이 다릅니다.\nuid[oldclock]<br>at goLoginNext (http://localhost:5173/src/views/Login.vue?t=1749296700208:64:27)
                if (arr.length > 1) {
                    const brr = arr[0].split(" : ")
                    if (brr.length > 1) {
                        brr[1] = "<span style='font-weight:bold'>" + brr[1] + "</span>"
                        arr[0] = brr.join(" : ")
                        strMsg = arr.join("\n")
                    }
                }
                snackBar.value.msg = strMsg.replace(/\n/g, "<br>")
                snackBar.value.where = arrStack[line]
            }
        },

        setToast : function(ex, toastSec, close) {
            let strMsg
            if (toastSec == true) { //토스트없이 계속 display  
                toast.value.toastSec = 0 //this.toast.toastSec = 0
            } else if (Number.isInteger(toastSec)) {
                toast.value.toastSec = toastSec //this.toast.toastSec = toastSec
            } else {//기본 3초 토스트            
                toast.value.toastSec = hush.cons.toastSec //this.toast.toastSec = hush.cons.toastSec
            }
            if (typeof ex == "string") {
                strMsg = ex
            } else if (typeof ex == "object" && ex.stack) {
                strMsg = ex.message
            } else {
                strMsg = "gst.util.setToast - typeof error"
            }
            if (!strMsg) {
                toast.value.msg = "" //this.toast.msg = ""
            } else {
                toast.value.msg = strMsg //this.toast.msg = strMsg
                toast.value.close = close //this.toast.close = close
            }
        },

        chkAxiosCode : function(data, notShowMsgIfNoData) { //data는 axios의 rs.data
            setTimeout(function() { 
                util.setToast("")
                //bottomMsg.value = ""
            }, 500) //setting은 main.js axios에 있음
            if (data == "") {
                util.setSnack('서버 Response data가 없습니다.', true)
                return null
            }
            if (data.code != hush.cons.OK) {
                if (notShowMsgIfNoData && data.code == hush.cons.NOT_FOUND) {
                    //데이터 없을 경우에 메시지 없이 넘어가야 할 때가 있음
                } else {
                    const sec = data.code.startsWith(hush.cons.auth_err_prefix) ? 3 : true
                    util.setSnack("[" + data.code + "] " + data.msg, sec)
                    if (data.code.startsWith(hush.cons.auth_err_prefix) && !route.fullPath.startsWith("/login")) {
                        router.replace({ name : 'login' }) //예) jwt token expired 또는 AuthGuard>canActivate 참조 (예: 브라우저 없이 알림바만 있을 때 클릭시)
                    }
                }
                return null
            } //axios call은 res.data 아래 code,msg,data,list로 nest로부터 받음
            return data //res.data를 리턴 받는 것임
        },
    
        showEx : function(ex, sec) {
            let msg                
            if (typeof ex == "string") {
                msg = ex
            } else if (typeof ex == "object" && ex.stack) {
                // const arr = ex.stack.split("\n")
                // arr.splice(0, 1) //첫번째 아이템 제거
                // const strAt = arr.join("\n")
                // console.log(ex.stack)
                // _msg = _title + ex.message + "<br><br>" + strAt
                console.log(ex.stack)
                msg = ex.message //stack을 사용자에게 보여주기엔 너무 시각적으로 부담이 됨
            } else {
                msg = ex.toString()
            }
            if (msg.includes('Network Error')) {
                msg = "서버에 접속되지 않고 있습니다. "
                if (route.fullPath.includes('/login')) {                    
                    msg += "잠시후 다시 시도해 주시기 바랍니다."
                } else {
                    msg += "서버 재접속시 자동 복구됩니다."
                }
            }
            util.setToast("")
            util.setSnack(msg, sec)
        },

        getKeyIndex : function(refRow, key) {
            const ele = refRow.value[key]
            if (!ele) return -1
            const idx = parseInt(ele.getAttribute("keyidx")) //해당 루프에서 keyIndex로 해도 keyindex로 렌더링되어 편의상 keyidx로 변경함
            if (hush.util.isvoid(idx)) return -1 //if (!idx) return -1 //idx가 0일 경우도 있으므로 유의해서 코딩
            return idx
        },

        deleteCacheFromKeepAlive : function(keepAliveRef, urlStr) {
            if (!keepAliveRef.value) return
            const ka = keepAliveRef.value._.__v_cache
            if (!ka) return
            const pathCached = ka.get(urlStr)
            if (pathCached) ka.delete(urlStr)
        },

        scrollIntoView : function(rowRef, rowValue, opt) {
            let optReal = opt ? opt : { behavior: "smooth", block: "nearest" }
            if (rowRef.value && rowRef.value[rowValue]) rowRef.value[rowValue].scrollIntoView(optReal)
        },

        qryOneMsgNotYet : async function(chanid) {
            const res = await axios.post("/chanmsg/qryOneMsgNotYet", { chanid : chanid })
            const rs = util.chkAxiosCode(res.data)
            if (!rs) return null //return (rs.list.length == 0) ? null : rs.data.MSGID
            return (rs.list.length == 0) ? "0" : rs.list[0].MSGID //라우팅 마지막에 "0"인 경우 고려해 return을 목적에 맞게 처리
        },

        getUrlForOneMsgNotYet : async function(chanid) { //아래 goMsgList가 아닌 window.open(새창열기)에 사용됨
            let strMsgid = await util.qryOneMsgNotYet(chanid)
            return "/body/msglist/" + chanid + "/" + strMsgid
        },

        getChanImg : function(typ, state) {
            if (typ == "WS") {
                return (state == "P") ? "violet_lock.png" : "violet_channel.png"
            } else {
                return "violet_dm.png"
            }
        },

        handleMsgSub : function(row) {
            for (let item of row.msgimg) {
                if (!item.BUFFER) continue //잘못 insert된 것임
                item.url = hush.util.getImageBlobUrl(item.BUFFER.data)
                item.hover = false
                item.cdt = item.CDT
            }
            for (let item of row.msgfile) {
                item.hover = false
                item.name = item.BODY
                item.size = item.FILESIZE
                item.cdt = item.CDT
            }
            for (let item of row.msglink) {
                item.hover = false                        
                item.cdt = item.CDT
                const arr = item.BODY.split(hush.cons.deli)
                if (arr.length == 1) {
                    item.text = item.BODY
                    item.url = item.BODY
                } else {
                    item.text = arr[0]
                    item.url = arr[1]
                }
            }
        },

        setRouteFromTo : function(to, from) {
            routeFrom.value = from
            routeTo.value = to
            const arr = from.path.split("/") //예) /main/dm/dm_body/20250428084532918913033115/0
            const brr = to.path.split("/")   //예) /main/dm/dm_body/30250428084532334324533119/0
            if (arr.length >= 4 && brr.length >= 4 && arr[3] == brr[3]) { //사이드 메뉴 같은 경우
                routedToSamePanelFromMsgList.value = true //사용자가 방내 범위내에서 노드를 클릭하거나 뒤로가기를 눌렀는데 사이드 메뉴가 안바뀌고 해당 패널내에서 라우팅하는 경우
            } else { //사이드 메뉴 같은 경우 : 사용자가 다른 사이드 메뉴를 클릭하거나 뒤로가기를 눌렀는데 사이드 메뉴가 바뀐 경우
                routedToSamePanelFromMsgList.value = false
            }
            console.log("## routeFrom: " + from.path + " : " + JSON.stringify(from.params) + " : " + JSON.stringify(from.query))
            console.log("## routeTo: " + to.path + " : " + JSON.stringify(to.params) + " : " + JSON.stringify(to.query))
        },

        goMsgList : async function(nm, params, refresh) {
            try {
                let msgid = params.msgid
                if (!msgid) params.msgid = await util.qryOneMsgNotYet(params.chanid)
                let obj = { name : nm, params : params}
                const ele = document.getElementById("chan_center_header") //chan_center_body
                if (refresh || !ele || ele.innerHTML == "") { //MsgList.vue에 있는 chan_center_header이 없다는 것은 빈페이지로 열려 있다는 것이므로 히스토리에서 지워야 back()할 때 빈공간 안나타남
                    await router.replace(obj) //히스토리에서 지워야 back()할 때 빈공간 안나타남
                } else {
                    await router.push(obj)
                }
            } catch (ex) {
                util.showEx(ex, true)
            }
        },

        goBodyList : async function(nm, params) {
            try {
                let obj = { name : nm, params : params}
                const ele = document.getElementById("chan_center_header") //chan_center_body
                if (!ele || ele.innerHTML == "") { //MsgList.vue에 있는 chan_center_header이 없다는 것은 빈페이지로 열려 있다는 것이므로 히스토리에서 지워야 back()할 때 빈공간 안나타남
                    await router.replace(obj) //히스토리에서 지워야 back()할 때 빈공간 안나타남
                } else {
                    await router.push(obj)
                }
            } catch (ex) {
                util.showEx(ex, true)
            }
        },

        getUrlForBodyListNewWin : function(chanid, msgid, appType) { //새창열기시 사이드메뉴,패널도 모두 보여주려면 홈에서는 가능한데 DM등에서는 무한스크롤후 가져온 메시지는 패널에 해당 데이터를 가져오기 난해함
            //const url = location.protocol + "//" + location.host + "/body/msglist/" + chanid + "/" + msgid + "?appType=" + appType
            let url = "/body/msglist/" + chanid + "/" + msgid
            if (appType) url += "?appType=" + appType
            return url
        },

        downloadBlob : function(kind, msgid, chanid, cdt, name) {
            const query = "?msgid=" + msgid + "&chanid=" + chanid + "&kind=" + kind + "&cdt=" + cdt //+ "&name=" + row.name
            axios.get("/chanmsg/readBlob" + query, { 
                responseType: "blob"
            }).then(async (res) => { //비즈니스로직 실패시 오류처리에 대한 부분 구현이 현재 어려움 (procDownloadFailure in common.ts 참조)
                //https://stackoverflow.com/questions/55218597/is-it-good-to-access-dom-in-vue-js
                //index.html의 <body><div id="app">와 main.js의 app.mount('#app')를 보면 알 수 있듯이 vue realm은 app이 루트엘레먼트가 되서
                //아래 document.body.appendChild(link)는 app의 밖이므로 문제없어 보임. 다만, 처리후 삭제하는 코딩은 callback/promise가 필요해 보이는데
                //더 간편하게 처리하려면 차라리 시작할 때 기존 정해진 아이디를 지우는 게 나아 보이긴 함
                if (name == "copyImage") {
                    const blob = new Blob([res.data], { type: 'image/png' })
                    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
                    util.setToast("이미지 복사 완료")
                } else {
                    const tagId = "btn_download"
                    const elem = document.getElementById(tagId)
                    if (elem) elem.remove()
                    const url = window.URL.createObjectURL(new Blob([res.data]))
                    const link = document.createElement('a')
                    link.id = tagId
                    link.href = url
                    link.setAttribute('download', name)
                    document.body.appendChild(link)
                    link.click()
                    util.setToast("파일 다운로드 완료")
                }
            }).catch(exception => {
                util.setToast("")
                util.setSnack("파일 다운로드 실패\n" + exception.toString(), true)
            })
        },

        getTypeForMsgDtl : function(strKind) { //서버,클라언트 모두 동일
            switch (strKind) { //break 안쓰고 바로 return
                case 'later':
                case 'stored':
                case 'finished':
                case 'fixed':
                    return 'user'
                case 'done':
                case 'checked':
                case 'watching':
                    return 'react'
                case 'notyet':
                case 'read':
                case 'unread':
                    return 'read'
                case 'msg':
                    return 'msg'
                default:
                    return 'error'         
            }
        }

        //아래 함수는 main.js의 axios.defaults.baseURL로 해결했으므로 더 이상 사용하지 않아도 됨 (포트 3000으로의 호출시 쿠키 전송안되는것은 Cors Issue - nest/axios)
        //dev : "http://localhost:3000", ops : "https://hushsbay.com:446"
        //function getRequestUrl(addr) { //vue와 next 조합으로 개발시 locahost port는 2개가 되는데 아래처럼 어쩔 수 없이 절대주소로 axios를 호출해아 함
        //     //예) location.href=http://localhost:5173/login, location.protocol=http:, location.host=localhost:5173, location.hostname=localhost
        //     //예) localhost의 vue port = 5173, nest port = 3000 (운영서버는 하나의 port로 운영 가능)
        //     if (addr.startsWith("http")) {
        //         return addr
        //     } else if (location.hostname == "localhost") {
        //         return cons.dev + addr
        //     } else {
        //         return cons.ops + addr
        //     }
        //}

        // codeQry : async function (strKind) { //예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임
        //     const res = await axios.post("/code/qry", { kind: strKind })
        //     const rs = util.chkAxiosCode(res.data)
        //     return rs
        // },

        // getCodeNm : function(arr, id) { //Z_CODE_TBL 관련 전용 //예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임
        //     const found = arr.find((item) => item.ID == id)
        //     return (found) ? found.NM : null
        // },

    }
    
    return { 
        objSaved, selSideMenu, chanIdActivted, objByChanId, timerShort, sockToSend, 
        snackBar, toast, bottomMsg, bottomMsgList, routeFrom, routeTo, routedToSamePanelFromMsgList,
        auth, ctx, html, realtime, util
        //isDoc, paging, scrollPosRecall, docId, isRead, isEdit, isNew, listIndex, //예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임
    }

    ////////////////////////////////////////////////////////////////////////////////예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임
    // const paging = ref({ //서버에 전송되어야 할 파라미터(pageRq)는 curPage/rowPerPage 2개임
    //     curPage : 1, rowPerPage : 20, pagePerNav : 5, totalRow : 0, totalPage : 0, curPageArr : [], savedPage : 0
    // }) //위 savedPage와 아래 scrollPosRecall 2개는 (목록과 디테일이 분리된 .vue일 경우) 목록에서 디테일 열고 작업후 닫고 나서 기존 페이지 찾아 기존 위치로 스크롤링하기 위한 용도임
    // const scrollPosRecall = { x : -1, y : -1 }
    // let listIndex = ref(-1), isDoc = ref(false), docId = ref(null), isRead = ref(false), isEdit = ref(false), isNew = ref(false)
    ////////////////////////////////////////////////////////////////////////////////

    // const doc = { //예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임 (혹시 필요할 수 있을 거 같아서 그냥 두었음 - noSql등에서 사용 가능할 수도..)

    //     open : function(strDocId, idx) {
    //         docId.value = strDocId
    //         isDoc.value = true
    //         isRead.value = true
    //         isEdit.value = false
    //         isNew.value = false
    //         listIndex.value = idx
    //     },

    //     edit : function(strDocId, idx) {
    //         docId.value = strDocId
    //         isDoc.value = true
    //         isRead.value = false
    //         isEdit.value = true
    //         isNew.value = false
    //         if (!hush.util.isvoid(idx)) listIndex.value = idx //목록에서도 openDoc하지 않고 바로 편집가능하게 editDoc()하는 가능성도 열어둬야 함
    //     },

    //     new : function() {
    //         docId.value = null
    //         isDoc.value = true
    //         isRead.value = false
    //         isEdit.value = false
    //         isNew.value = true
    //         listIndex.value = -1
    //     },

    //     onOpen : function(btn) {
    //         if (btn && btn.value) {
    //             if (btn.value.btn_edit) btn.value.btn_edit.hide = false
    //             if (btn.value.btn_save) btn.value.btn_save.hide = true
    //             if (btn.value.btn_delete) btn.value.btn_delete.hide = false
    //         }
    //     },

    //     onEdit : function(btn) {
    //         if (btn && btn.value) {
    //             if (btn.value.btn_edit) btn.value.btn_edit.hide = true
    //             if (btn.value.btn_save) btn.value.btn_save.hide = false
    //             if (btn.value.btn_delete) btn.value.btn_delete.hide = true
    //         }
    //     },

    //     onNew : function(btn) {
    //         if (btn && btn.value) {
    //             if (btn.value.btn_edit) btn.value.btn_edit.hide = true
    //             if (btn.value.btn_save) btn.value.btn_save.hide = false
    //             if (btn.value.btn_delete) btn.value.btn_delete.hide = true
    //         }
    //     },

    //     close : function() {
    //         docId.value = null
    //         isDoc.value = false
    //         isRead.value = false
    //         isEdit.value = false
    //         isNew.value = false
    //         listIndex.value = -1
    //     },

    //     closeIfOpened : function() { //목록과 문서가 한몸일 때 문서인 경우 closeDoc()하면 문서는 초기화하고 hide하는 것으로 종료 (history.back 없음)
    //         if (isDoc.value) {
    //             doc.close()
    //             return true
    //         }
    //         return false
    //     }

    // }

    // const list = { //일단 막음. 예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임 (혹시 페이징네비가 필요할 수 있을 거 같아서 그냥 두었음)

    //     saveCurPage : function() {
    //         const _paging = paging.value
    //         _paging.savedPage = _paging.curPage
    //     },
        
    //     setCurPage : function(toWhere) {
    //         const _paging = paging.value
    //         if (toWhere == 'first') {
    //             if (_paging.curPage <= 1) return "첫 페이지입니다."
    //             _paging.curPage = 1
    //         } else if (toWhere == 'prev') {
    //             if (_paging.curPage <= 1) return "첫 페이지입니다."
    //             _paging.curPage = (_paging.curPage <= 1) ? 1 : parseInt(_paging.curPage) - 1
    //         } else if (toWhere == 'next') {
    //             if (_paging.curPage >= _paging.totalPage) return "마지막 페이지입니다."
    //             _paging.curPage = (_paging.curPage >= _paging.totalPage) ? _paging.totalPage : parseInt(_paging.curPage) + 1
    //         } else if (toWhere == 'last') {
    //             if (_paging.curPage >= _paging.totalPage) return "마지막 페이지입니다."
    //             _paging.curPage = _paging.totalPage
    //         } else if (toWhere == 'prevSet') { //일반적인 UI에서는 잘 사용하지 않으나 사용자 요청이 있을 경우 쓰기로 함
    //             if (_paging.curPageArr[0] <= 1) return "첫 페이지셋입니다."
    //             _paging.curPage = (_paging.curPageArr[0] <= 1) ? _paging.curPageArr[0] : _paging.curPageArr[0] - parseInt(_paging.pagePerNav)
    //         } else if (toWhere == 'nextSet') { //일반적인 UI에서는 잘 사용하지 않으나 사용자 요청이 있을 경우 쓰기로 함
    //             if (_paging.curPageArr[0] + parseInt(_paging.pagePerNav) > _paging.totalPage) return "마지막 페이지셋입니다."
    //             _paging.curPage = (_paging.curPageArr[0] + parseInt(_paging.pagePerNav) > _paging.totalPage) ? _paging.curPageArr[0] : _paging.curPageArr[0] + parseInt(_paging.pagePerNav)
    //         } else {
    //             _paging.curPage = toWhere
    //         }
    //         return ""
    //     }, 
        
    //     setPageNav : function(totalRow) { //서버로부터 totalRow를 응답받아서 페이지 네비게이션을 만들어냄
    //         const _paging = paging.value
    //         _paging.totalRow = totalRow
    //         _paging.totalPage = (typeof totalRow == "undefined" || totalRow == 0) ? 0 : Math.ceil(totalRow / _paging.rowPerPage)    
    //         const pageStart = parseInt(_paging.pagePerNav) * (Math.ceil(parseInt(_paging.curPage) / parseInt(_paging.pagePerNav)) - 1) + 1
    //         const pageEnd = pageStart + parseInt(_paging.pagePerNav) - 1
    //         _paging.curPageArr = []
    //         for (let i = pageStart; i <= pageEnd; i++) {
    //             if (i > _paging.totalPage) break
    //             _paging.curPageArr.push(i)
    //         }
    //     }, 
        
    //     getListWithPager : async function(_toWhere, _rq, _promise, _scrollArea, msgCallback) {
    //         const _paging = paging.value
    //         if (_toWhere) {
    //             const msg = list.setCurPage(_toWhere)
    //             if (msg) {
    //                 if (typeof msgCallback == "function") msgCallback(msg)
    //                 return
    //             } 
    //         } else {
    //             if (_paging.savedPage) { //recalling page
    //                 _paging.curPage = _paging.savedPage
    //                 _paging.savedPage = 0
    //             } else {
    //                 list.setCurPage(1)
    //             }
    //         }
    //         const req = _rq
    //         req.pageRq = { curPage : _paging.curPage, rowPerPage : _paging.rowPerPage }
    //         _promise(req).then((totalRow) => {
    //             list.setPageNav(totalRow)
    //             setTimeout(function() {
    //                 if (_scrollArea) {
    //                     const scrollPos = _scrollArea.value
    //                     scrollPos.scrollLeft = scrollPosRecall.x
    //                     scrollPos.scrollTop = scrollPosRecall.y
    //                 } else {

    //                 }
    //             }, 10) 
    //         }).catch((err) => {
    //             alert("getListWithPager: " + err)
    //         })
    //     }

    // }    

})

export default GeneralStore
