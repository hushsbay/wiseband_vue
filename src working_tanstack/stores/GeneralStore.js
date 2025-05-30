import { ref, inject } from "vue"
import { useRouter, useRoute } from 'vue-router'
import { defineStore } from "pinia" //ref 대신에 storeToRefs 사용해야 v-model, 구조분해할당 등에서 문제없음 (this 해결 어려우므로 꼭 필요시 사용)
import axios from 'axios'

import hush from '/src/stores/Common.js'

const GeneralStore = defineStore('General', () => {

    const router = useRouter()
    const route = useRoute()
    const $cookie = inject('$cookies')

    let objSaved = ref({}) //현재는 HomeBody에서만 사용중. 각 메뉴, 사이드메뉴+채널별 (Back하기 전에 저장한) 스크롤 위치 등이 있음

    let selSideMenu = ref("")
    const snackBar = ref({ msg : '', where : '', toastSec : 0 }) //ref 대신 storeToRefs로 감싸지 말 것 (this 해결안됨)
    const toast = ref({ msg : '', close : false, toastSec : 0 }) //ref 대신 storeToRefs로 감싸지 말 것 (this 해결안됨)

    /* Vue에서의 컴포넌트간 통신은 여러가지 기법이 있는데 콤포넌트간 통신이 필요한 경우는 아래와 같음 
       Later.vue 패널을 예로 설명. 여기서는 자식과 손주(스레드댓글)가 동일한 HomeBody임을 유의!!
       1) Later -> HomeBody : 부모 -> 자식 (라우팅)
       2) Later -> HomeBody(스레드댓글) : 부모 -> 손자 (라우팅도 컴포넌트호출도 아닌 중간에 자식이 전달받아서 전달해야 함)
       3) HomeBody -> Later : 자식 -> 부모
       4) HomeBody(스레드댓글) -> Later : 손자 -> 부모
       5) HomeBody -> HomeBody(스레드댓글) : 자식 -> 손자 (둘의 입장에서는 부모 -> 자식. 라우팅)
       6) HomeBody(스레드댓글) -> HomeBody : 손자 -> 자식 (둘의 입장에서는 자식 -> 부모)
       이 프로젝트에서는 HomeBody.vue가 스레드댓글에서도 다시 사용되므로 생각없이 되는대로 통신하는 것은 향후 코딩(유지보수)에 어려움을 줄 수가 있음
       따라서, 아래와 같이 규칙을 정해서 적용하려고 함 (사실, 모든 걸 스토어에 두고 관리하거나 props/emits로 처리해도 될 것이나 향후 복잡하게 얽힐 것임)
       1),2) 처럼 부모가 자식에게 전달하고자 할 때 (특히, 1)은 라우팅이므로 props 사용안하고 2)도 5)를 생각해서 혼란줄이기 위해 props 쓰지 말기)
         - HomeBody에 defineExpose({ procFromPanel })처럼 정의하고, Later에서 homebodyRef.value.procFromPanel(row)와 같이 호출함
         - 이 때 Later에서는 const homebodyRef = ref(null)로 선언하고 <component :is="Component" :key="$route.fullPath" ref="homebodyRef" />에서처럼 homebodyRef를 추가함
         - 부모가 손주에게는 이 방식(2)으로 바로 전달되지 않고 부모가 다시 자식에게 동일한 방식으로 전달해야 함 : HomeBody->HomeBody스레드댓글의 경우 아래 5) 참조
       3),4) 처럼 자식이나 손주가 부모에게 전달하려 할 때 
         - 자식이나 손주에서 const emits = defineEmits(["ev-click"])처럼 사용하면 되겠으나 이미 HomeBody(스레드댓글)->HomeBody의 경우에서 사용하고 있으므로
         - Later로 전달할 때도 그리 사용하면 향후엔 너무 혼란스러운 상황이 발생할 것임
         - 그래서, 이 프로젝트에서는 이 경우에 한해 스토어에서 변수 및 함수를 공유하는 것으로 함
         - 다만, 특정 vue끼리만 공유하기 위해 GeneralStore와는 별도로 만들어 사용하려 했으나 배열 루프 돌리는데 엄청 느린 현상이 발생해
           해결할 시간을 투여하지 않고 일단 여기 GeneralStore에서 ref 변수와 객체(예: const later =)를 두어 처리함 (**77)
       5) 처럼 (HomeBody간의 통신에 한해서) 부모가 자식에게 전달하고자 할 때 : omeBody->HomeBody스레드댓글
         - props와 defineExpose 사용하기
       6) 처럼 (HomeBody간의 통신에 한해서) 자식이 부모에게 전달하고자 할 때 : HomeBody(스레드댓글)->HomeBody
         - emits 사용하기
    */

    /////////////////////////////////////////////////아래 const later = 참조 (**77)
    let listLater = ref([]), cntLater = ref(''), kindLater = ref('later')
    ///////////////////////////////////////////////////////////////////////
    let listDm = ref([]), kindDm = ref('all')
    ///////////////////////////////////////////////////////////////////////
    let listHome = ref([]), kindHome = ref('my'), selChanHome = ref('') //, objHome = ref({}), scrollyHome = ref(0)
    ///////////////////////////////////////////////////////////////////////
    
    const auth = {

        setCookie : function(nm, val, persist) { //모든 쿠키는 main.js 설정에 따르고 여기서는 persist/session 쿠키여부만 결정함. persist는 모두 1년을 만기로 설정
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
            auth.setCookie("userid", rs.USER_ID, persist)
            auth.setCookie("usernm", rs.USER_NM)
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
        
        on : false, //Main.vue에서 <div class="coMain" @click=>처리하지 않으면 다른 곳을 클릭했을 때 right click한 ctx가 닫히면서 클릭한 이벤트가 바로 먹히지 않음        

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
            return new URL('/src/assets/images/' + strFile, import.meta.url).href //예) import.meta.url => http://localhost:5173/src/views/current.vue?t=1730165570470
        }

    }

    const dm = { //아래 const later 설명 참조

        procFromBody : async function(type, obj) { //HomeBody.vue에서 호출해 Dm.vue 패널 화면 업데이트하는 것임
            if (type == "update") {
                const idx = listDm.value.findIndex((item) => item.CHANID == obj.chanid)
                if (idx == -1) return
                const row = listDm.value[idx]
                row.BODYTEXT = obj.bodytext
                if (idx == 0) return //아래는 해당 배열항목이 맨 위가 아닐 때 맨 위로 올리는 것임
                listDm.value.splice(idx, 1)
                listDm.value.unshift(row)
            } else if (type == "updateUnreadCnt") { //사용자가 읽고 나서 갯수 새로 고침
                const row = listDm.value.find((item) => item.CHANID == obj.chanid)
                if (!row) return
                const res = await axios.post("/menu/qryKindCnt", { chanid: obj.chanid, kind: "notyet" })
                const rs = util.chkAxiosCode(res.data)
                if (!rs) return
                row.mynotyetCnt = rs.data.mynotyetCnt
            }
        }

    }

    const home = { //아래 const later 설명 참조

        procFromBody : async function(type, obj) { //HomeBody.vue에서 호출해 Home.vue 패널 화면 업데이트하는 것임
            if (type == "recall") {
                //if (objHome.value[obj.chanid]) {
                    selChanHome.value = obj.chanid
                    //scrollyHome.value = objHome.value[obj.chanid].scrollY
                //}
            } else if (type == "updateUnreadCnt") { //사용자가 읽고 나서 갯수 새로 고침
                const row = listHome.value.find((item) => item.CHANID == obj.chanid)
                if (!row) return
                const res = await axios.post("/menu/qryKindCnt", { chanid: obj.chanid, kind: "notyet" })
                const rs = util.chkAxiosCode(res.data)
                if (!rs) return
                row.mynotyetCnt = rs.data.mynotyetCnt
            }
        }

    }

    const later = { //Later.vue와 관련된 화면 업데이트는 아래와 같이 4가지임
        //1) Later -> HomeBody 2) Later -> HomeBody (Thread가 열린 경우) 3) HomeBody -> Later 4) HomeBody (Thread가 열린 경우) -> Later
        //이 중, 아래 procFromBody, getCount는 3),4) 경우 사용함. 1),2)는 맨 위 설명 참조

        procFromBody : async function(type, obj) { //HomeBody.vue에서 데이터 처리하고 Later.vue 패널 화면 업데이트하는 것임
            if (type == "update") { //HomeBody.vue의 saveMsg() 참조 : rq
                const row = listLater.value.find((item) => item.MSGID == obj.msgid)
                if (row) row.BODYTEXT = obj.bodytext
            } else if (type == "work") { //HomeBody.vue의 changeAction() 참조 : { msgid: msgid, work: work }
                if (obj.work == "delete") { 
                    const idx = listLater.value.findIndex((item) => item.MSGID == obj.msgid)
                    if (idx > -1) listLater.value.splice(idx, 1)
                } else { //create (화면에 없는 걸 보이게 하는 것임)
                    if (kindLater.value == "later") { //'나중에' 패널에서 진행중(later)탭이 아니면 추가된 행 화면업뎃할 일 없음
                        const res = await axios.post("/menu/qryLater", { msgid: obj.msgid })
                        const rs = util.chkAxiosCode(res.data)
                        if (!rs || rs.list.length == 0) return
                        const row = rs.list[0]
                        if (row.PICTURE == null) {
                            row.url = null
                        } else {
                            row.url = hush.util.getImageBlobUrl(row.PICTURE.data)
                        }
                        let added = false
                        const len = listLater.value.length
                        for (let i = 0; i < len; i++) { //listLater는 최근일시가 맨 위에 있음
                            if (obj.msgid > listLater.value[i].MSGID) {
                                listLater.value.splice(i, 0, row)
                                added = true
                                break
                            }
                        }
                        if (!added) listLater.value.push(row)
                    }
                }
                later.getCount() //화면에 갯수 업데이트
            } else if (type == "set_color") { //새창에서 열기시 패널에 색상 표시
                listLater.value.map((item) => {
                    item.sel = false
                    item.hover = false
                })
                const row = listLater.value.find((item) => item.MSGID == obj.msgid)
                if (row) row.sel = true
            }
        },

        getCount : async function(kindStr) { //현재는 kindStr없이 사용 (later만 해당)
            try {
                const kind = kindStr ?? "later"
                const res = await axios.post("/menu/qryLaterCount", { kind: kind })
                const rs = util.chkAxiosCode(res.data)
                if (!rs) return
                cntLater.value = rs.list[0].CNT
            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        }

    }

    const resize = {

        getEle : function(resizeEle, main_side, dragMe, chan_side, chan_main) {
            resizeEle.mainSide = document.getElementById(main_side) //Main.vue 참조
            resizeEle.resizer = document.getElementById(dragMe) //vue.js npm 사용해봐도 만족스럽지 못해 자체 구현 소스 참조해 vue 소스로 응용
            resizeEle.leftSide = document.getElementById(chan_side) //resizer.previousElementSibling
            resizeEle.rightSide = document.getElementById(chan_main) //resizer.nextElementSibling
        },
    
        downHandler : function(e, resizeEle, resizeObj, moveHandler, upHandler) {
            resizeObj.posX = e.clientX//마우스 위치 X값
            resizeObj.leftWidth = resizeEle.leftSide.getBoundingClientRect().width
            resizeObj.mainSideWidth = resizeEle.mainSide.getBoundingClientRect().width
            document.addEventListener('mousemove', moveHandler)
            document.addEventListener('mouseup', upHandler)
        },
    
        moveHandler : function(e, resizeEle, resizeObj) {
            const dx = e.clientX - resizeObj.posX //마우스가 움직이면 기존 초기 마우스 위치에서 현재 위치값과의 차이를 계산
            document.body.style.cursor = 'col-resize' //크기 조절중 마우스 커서 변경 (resizer에 적용하면 위치가 변경되면서 커서가 해제되기 때문에 body에 적용)
            resizeEle.leftSide.style.userSelect = 'none' //이동중 양쪽 영역(왼쪽, 오른쪽)에서 마우스 이벤트와 텍스트 선택을 방지하기 위해 추가 (4행)
            resizeEle.leftSide.style.pointerEvents = 'none'        
            resizeEle.rightSide.style.userSelect = 'none'
            resizeEle.rightSide.style.pointerEvents = 'none'
            return dx        
            //resizeRef.chanSideWidth.value = `${resizeObj.leftWidth + dx + resizeObj.mainSideWidth}px` //아래 % 대신에 바로 px 적용
            //resizeRef.chanMainWidth.value = `calc(100% - ${resizeRef.chanSideWidth.value})`
            //초기 width 값과 마우스 드래그 거리를 더한 뒤 상위요소(container) 너비 이용해 퍼센티지 구해 left의 width로 적용
            //const newLeftWidth = ((leftWidth + dx) * 100) / resizer.parentNode.getBoundingClientRect().width
            //leftSide.style.width = `${newLeftWidth}%`
        },
    
        upHandler : function(resizeEle, moveHandler, upHandler) { //모든 커서 관련 사항은 마우스 이동이 끝나면 제거됨
            resizeEle.resizer.style.removeProperty('cursor')
            document.body.style.removeProperty('cursor')
            resizeEle.leftSide.style.removeProperty('user-select')
            resizeEle.leftSide.style.removeProperty('pointer-events')
            resizeEle.rightSide.style.removeProperty('user-select')
            resizeEle.rightSide.style.removeProperty('pointer-events')
            document.removeEventListener('mousemove', moveHandler)
            document.removeEventListener('mouseup', upHandler)
            //localStorage.wiseband_lastsel_chansidewidth = resizeRef.chanSideWidth.value
        }

    }
    
    const util = {

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
            setTimeout(function() { util.setToast("") }, 1) //setting은 main.js axios에 있음
            if (data.code != hush.cons.OK) {
                if (notShowMsgIfNoData && data.code == hush.cons.NOT_FOUND) {
                    //데이터 없을 경우에 메시지없이 넘어가야 할 때가 있음
                } else if (!route.fullPath.startsWith("/login") && data.code.startsWith(hush.cons.auth_err_prefix)) {
                    router.replace({ name : 'login' }) //alert(data.msg + "[" + data.code + "]") //예) 인증이 필요합니다.
                } else {
                    util.setSnack("[" + data.code + "] " + data.msg, true)
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
            util.setToast("")
            util.setSnack(msg, sec)
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
        //isDoc, paging, scrollPosRecall, docId, isRead, isEdit, isNew, listIndex, //예전에 파일럿으로 개발시 썼던 것이고 여기, WiSEBand에서는 사용하지 않는 변수들임
        objSaved, selSideMenu, 
        snackBar, toast, auth, ctx, html, resize, util,
        later, listLater, cntLater, kindLater,
        home, listHome, kindHome, selChanHome, //, objHome, scrollyHome
        dm, listDm, kindDm
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
