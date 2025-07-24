<script setup>
    import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupSidemenu from "/src/components/PopupSidemenu.vue"
    import MediaSearch from "/src/components/MediaSearch.vue"
    import UserProfile from "/src/components/UserProfile.vue"
    import PopupCommon from "/src/components/PopupCommon.vue"

    const gst = GeneralStore()
    const router = useRouter()
    const route = useRoute()

    const g_userid = gst.auth.getCookie("userid")

    const POPUPHEIGHT = 300
    const popupMenuOn = ref(false) //바로 아래 popupMenuPos는 main_side내 팝업메뉴 (left는 고정. top만 결정하면 됨) 
    const popupMenuPos = ref({ top: '0px', bottom: '0px', height: POPUPHEIGHT + 'px' })
    const popupData = ref({ id: '', lines: false })
    const seeMore = ref(false)
    const listAll = ref([]), listSel = ref([]), listUnSel = ref([]) //listAll = listSel(사용자가 설정한 메뉴) + listUnSel(사용자가 설정하지 않은 메뉴)
    let listNotSeen = ref([]), listPopupMenu = ref([]) //listPopupMenu = listUnSel(사용자가 설정하지 않은 메뉴) + listNotSeen(화면에서 육안으로 안보이는 메뉴) = 더보기에서의 수식
    //## 더보기를 누르면 사용자가 설정하지 않은 메뉴와 화면에서 육안으로 보이지 않는 메뉴가 (화면 사이즈가 변함에 따라) 실시간으로 보여져야 함

    let prevX, prevY
    let keepAliveRef = ref(null)
    let mediaPopupRef = ref(null), searchText = ref('')
    let userProfileRef = ref(null), user = ref(null)
    let bottomMsgListPopupRef = ref(null)

    //리얼타임 반영
    let panelRef = ref(null)
    let timerShort = true, timeoutShort, timeoutLong
    const TIMERSEC_SHORT = 3000, TIMERSEC_LONG = 5000, TIMERSEC_WINNER = 10 //procLocalStorage()의 10초때문에 1초/3초로 정하고 10초보다 크게 가면 3초도 좀 더 크게 가도 됨
    //여기 sec은 데이터를 읽어오고 타이머가 처리하는 동안은 추가로 중복 실행안되게 함 (1초 간격이라도 1초가 넘을 수도 있음 - 따라서, 위너는 아래 10초정도로 충분한 시간을 줌)
    //이 TIMERSEC_SHORT, TIMERSEC_LONG은 여러탭에서는 결국 하나의 위너에서만 서버호출할텐데, 위너가 보이고 다른 이들이 안보이면 전달이 1초일테고 위너가 안보이면 3초일테니 그땐 좀 늦게 반영되게 됨
    //결국, 사용자들이 자기가 원해서 여러개의 탭을 띄운다면 (위너가 뒤로 가면 리얼타임 반영이 3초로 약간) 늦어질 수도 있다는 안내가 필요할 수도 있음
    let logdt = '', logdtDisp = ref(''), cntChanActivted = ref(0), cntNotChanActivted = ref(0), logdtColor = ref('yellow') //화면 표시용
    let notyetCntHome = ref(0), notyetCntDm = ref(0), winId, winnerId = ref(''), isWinner = false
    let realtimeJobDone, pageShown = 'Y'
    let bc1, fifo = [], fifoLen = ref(0) //fifoLen은 화면 표시용 (나중에 제거)
    let bc2, arrCurPageShown = []

    //sessionStorage와는 달리 localStorage는 persistent cookie와 유사하게 브라우저에서 사용자가 제거하지 않는 한 존재하며 도메인 단위로 공유
    //그래서, index.html에서 localStorage와 Broadcast Channel를 이용해 별도 탭이 몇개가 생성되어도 단 하나의 타이머만 돌아가게 했으나
    //2개의 조합으로도 불안하므로 브라우저 강제종료 등의 예외 대비해 procLocalStorage 타이머로 체크 추가
    //참고로, Main.vue가 들어가는 탭은 사용자가 다른 탭에서 url을 치거나 복사해야 가능 (새창에서 열기 메뉴는 main.vue가 없는 MsgList.vue만 존재하므로 무시)
    function procLocalStorage() {
        try {
            if (!winId) return
            let shouldSetNewWinId = false
            if (!localStorage.winId) {
                shouldSetNewWinId = true
            } else { //이미 다른 탭이 위너로 자리잡고 있다고 봐야 하나 (자기자신이나 다른 탭이) 비정상적인 브라우저 종료로 미처 delete 안되었을 경우도 고려
                if (localStorage.winId == winId) {
                    localStorage.winDt = hush.util.getCurDateTimeStr(true) //타이머에서 계속 업데이트
                } else { //내가 위너가 아니면 위너의 widDt 체크해서 업데이트안되고 있다고 파악되면 여기 winId로 그자리 바로 차지해서 위너되기 (디버깅은 넘어가도 alert는 다른 서버호출도 중지시키므로 문제가 됨)
                    const winDt = localStorage.winDt //localStorage.winId가 있으면 localStorage.winDt도 무조건 있다고 보기
                    const dtPrev = hush.util.getDateTimeStamp(winDt)
                    const sec = parseInt(((new Date()) - dtPrev) / 1000) //return seconds
                    if (sec > TIMERSEC_WINNER) shouldSetNewWinId = true //5초 지나면 위너가 업데이트 안하고 있는 것인데 (위너가 비정상 종료되어) 새로 위너에 도전하기
                }
            }
            if (shouldSetNewWinId) {
                localStorage.winId = winId
                localStorage.winDt = hush.util.getCurDateTimeStr(true) //타이머에서 계속 업데이트
            }
            if (localStorage.winId == winId) {
                isWinner = true
            } else {
                isWinner = false
            }
            if (winnerId.value != localStorage.winId) winnerId.value = localStorage.winId //화면 표시용
            setTimeout(function() { procLocalStorage() }, TIMERSEC_SHORT)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    /* 
       리얼타임 반영은 폴링으로 일단 처리되고 있고, 여러 개의 창에 Main.vue가 있는 것과 MagList.vue만 있는 것이 복수로 혼재되어 있는 구조인데
       이 경우, 동일한 채널이 각각 창에 2-3개 있을 경우는 그 중에 하나만 사용자 육안으로 보일 경우는 나머지도 pageShown으로 정의해야 알림이 안오게 됨 (알림이 오면 사용자 불편)
       이를 구현하기 위해 아래와 같이 방안을 마련함 (예를 들어, A,B,C,D 창이 있고 A,B,C가 같은 채널일 때)
       1. 먼저 A의 이벤트에서 pageShown 값이 변경되면 단순 변경됨이라고 방송(BroadCast)함 : pageShownChanged(파라미터 필요없음)로 B,C,D로 방송
       2. 받은 B,C,D는 현재 채널아이디와 pageShown 값을 A,B,C,D로 방송 : informCurPageShown(파라미터 = chanid and Y/N)
       3. 본인 값과 받은 값을 합해서 채널별로 그 중에 하나라도 pageShown 값이 Y이면 Y로 정해서 gst.objChanId(공유객체-채널별관리)에 정리,저장함
       4. 나중에 리얼타임 반영시 알림 여부 결정할 때 gst.objChanId의 pageShown 값이 Y이면 (여러개중 하나라도 Y이면) 알림을 표시하지 않기로 함
       ** bc1은 각탭의 Main.vue <=> Main.vue 통신이고 bc2는 각탭의 Main.vue <=> MsgList.vue 이므로 bc2를 사용해야 함
       ** 또한, 방송후 피드백(onmessage callback)을 PromiseAll로 구현해야 그 싯점에 정리가능한데 당장 쉽지 않아서 일단 타이머 0.5초이후 정리하기로 함 (그 안에 오는 알림이 표시안되면 좋은데 되는 불편 살짝..)
       ** pageShownChanged()가 들어갈 이벤트 : visibilityChange, focus, blur, onMounted, OnUnmounted, onActivated, onDeactivated
    */

    async function chkDataLogEach(rsObj) {
        try {
            if (realtimeJobDone != 'Y') return
            realtimeJobDone = ''
            logdtDisp.value = logdt //화면 표시용
            logdtColor.value = logdtColor.value == 'yellow' ? 'lightgreen' : 'yellow' //화면 표시용
            let arrForChanActivted = []
            let arrForNotChanActivted = []
            cntChanActivted.value = 0
            cntNotChanActivted.value = 0
            let rs
            if (rsObj) {
                rs = rsObj //바로 아래 else에서 bc1.postMessage() 한 것을 위너가 아닌 탭에서 받은 것임
            } else {
                const res = await axios.post("/chanmsg/qryDataLogEach", { logdt : logdt, noMsg: true })
                rs = gst.util.chkAxiosCode(res.data, true)
                if (!rs) {
                    realtimeJobDone = 'Y'
                    return
                }
                gst.util.setSnack("")
                bc1.postMessage({ code: 'polling', obj: rs })
                if (rs.list.length > 0) {
                    bc2.postMessage({ code: 'pollingToMsgList', obj: rs.list })
                }
            }
            let notyetCntHomeTmp = 0, notyetCntDmTmp = 0
            const listByMenu = rs.data.listByMenu //GS와 WS의 notyet count 배열임
            for (let i = 0; i < listByMenu.length; i++) {
                const row = listByMenu[i]
                if (row.TYP == "WS") { //홈
                    notyetCntHomeTmp = row.SUM
                } else { //GS (DM)
                    notyetCntDmTmp = row.SUM
                }
            }
            if (notyetCntHomeTmp != notyetCntHome.value) notyetCntHome.value = notyetCntHomeTmp
            if (notyetCntDmTmp != notyetCntDm.value) notyetCntDm.value = notyetCntDmTmp
            if (rs.list.length > 0 && panelRef.value) { //로드시 가끔 패널에 panelRef가 늦게 잡히는 경우가 있는데 이 경우는 한번 더 돌아야 함
                //활성/비활성배열 개념은 원래 메시지처리에 대한 개념에서 시작했는데 나중에 채널마스터/디테일처리인 'chan' TYP도 포함됨
                //'chan' TYP는 패널의 각 행에 대한 CUD처리를 위한 목적지인 Main(arrForNotChanActivted)에서도 해야 하고 
                //MsgList 상단의 채널명/멤버이미지를 위해서도 (새창으로도) 열려 있는 MsgList(arrForChanActivted)로도 보내져야 함
                if (gst.chanIdActivted) arrForChanActivted = rs.list.filter(x => {
                    return (x.CHANID == gst.chanIdActivted) //x.TYP == 'group'인 경우는 여기로 오지 않으므로 MsgList의 그룹명은 현재 업데이트 안됨
                }) //MsgList로 전달하는 것임
                arrForNotChanActivted = rs.list.filter(x => { 
                    return (x.CHANID != gst.chanIdActivted || x.TYP == 'chan' || x.TYP == 'group')
                }) //각 패널에 전달하는데 패널마다 채널 단위 또는 메시지 단위로 다르게 전달해야 함
                cntChanActivted.value = arrForChanActivted.length //화면 표시용
                cntNotChanActivted.value = arrForNotChanActivted.length //화면 표시용
                if (arrForNotChanActivted.length > 0) { //MsgList에 열려 있지 않은 채널데이터들에 대한 리얼타임 반영
                    let realShown
                    const objChanid = gst.objByChanId[gst.chanIdActivted]
                    if (!objChanid) {
                        realShown = pageShown
                    } else {
                        if (objChanid && objChanid.realShown == 'Y') {
                            realShown = 'Y'
                        } else { //해당 채널이 여러 창에 있을 때는 하나라도 보이면 보인다고 정의함
                            realShown = 'N'
                        }
                    }
                    const len = arrForNotChanActivted.length
                    for (let i = 0; i < len; i++) {                        
                        const row = arrForNotChanActivted[i]
                        if (gst.selSideMenu == "mnuHome") { //채널 단위로 읽음처리 관련만 전달하면 됨
                            if (row.TYP == 'chan' || row.TYP == 'group') {
                                await panelRef.value.procMainToPanel('procRows')
                            } else {
                                await panelRef.value.procMainToPanel('updateNotyetCnt', row)
                            }
                        } else if (gst.selSideMenu == "mnuDm") { //채널 단위로 
                            if (row.CUD == 'T') { //notyet->read가 많음 (아닌 경우도 있으나 그냥 무시) 
                                await panelRef.value.procMainToPanel('updateNotyetCnt', row)
                            } else if (row.TYP == 'chan') {
                                await panelRef.value.procMainToPanel('procRows')
                            } else if (row.TYP == 'group') {
                                //skip
                            } else {
                                await panelRef.value.procMainToPanel('refreshRow', row)
                            }
                        }
                        if (row.TYP == 'msg' && row.CUD == "C" && gst.chanIdActivted != '') {
                            if (realShown != 'Y' && row.USERID != g_userid) {
                                gst.realtime.procNoti(row)
                            }
                        }
                    }
                }
                if (arrForChanActivted.length > 0) {
                    if (panelRef.value && panelRef.value.procMainToMsglist) {
                        await panelRef.value.procMainToMsglist("realtime", { list: arrForChanActivted, logdt: rs.data.logdt }) //async/await 동작함 (동기화 가능)
                        //위 실행하여 MsgList.vue까지 가서 처리후 console.log 찍고 여기 아래 console.log 찍으면 순서바뀌지 않고 제대로 찍힘
                        //따라서, sessionStorage.logdt는 그냥 여기 변수로 logdt로 잡고 sessionStorage.realtimeJobDone은 제거해도 되나 일단 막아두기만 함
                    }
                }
                logdt = rs.data.logdt
            }
            realtimeJobDone = 'Y' //추가
        } catch (ex) {
            realtimeJobDone = "Y"
            gst.util.showEx(ex, true)
        }
    }

    async function procTimerShort() {
        //요점 : 페이지가 보이면 최단시간 타이머 안보이면 타이머 갭을 늘리기 : 하나의 window 객체에 Main.vue의 timer가 돌아가는 것은 오직 1개만 가능하도록 함
        //vue-observe-visibility npm 굳이 사용하지 않고도 pageShown으로 처리 가능
        //sessionStorage.pageShown은 document.hidden(index.html) 참조. hot deploy시 타이머가 더 생기는지 체크 필요 (아래 .bind(this) 적용 테스트 더 해보기)
        if (timerShort) {
            if (isWinner) { //위너일 때만 실행 (브라우저의 모든 탭에서는 타이머를 통한 서버호출은 단 한개만 존재하고 나머지는 bc로 받아서 처리)
                await chkDataLogEach()
            }
        }
        timerShort = (pageShown == 'Y') ? true : false
        timeoutShort = setTimeout(function() { procTimerShort() }, TIMERSEC_SHORT) //procTimerShort() }.bind(this)
    }

    async function procTimerLong() { //사실, document.hidden시 굳이 timer가 돌아갈 이유는 없으나, 다시 shown시 처리해야 할 데이터를 분산한다는 의미로 timer 갭을 좀 길게 해 살려 두는 정도임
        if (!timerShort) {
            if (isWinner) { //위너일 때만 실행 (브라우저의 모든 탭에서는 타이머를 통한 서버호출은 단 한개만 존재하고 나머지는 bc로 받아서 처리)
                await chkDataLogEach()
            }
        }        
        timeoutLong = setTimeout(function() { procTimerLong() }, TIMERSEC_LONG) //procTimerLong() }.bind(this)
    }

/*
    async function procTimerShort() {
        //요점 : 페이지가 보이면 최단시간 타이머 안보이면 타이머 갭을 늘리기 : 하나의 window 객체에 Main.vue의 timer가 돌아가는 것은 오직 1개만 가능하도록 함
        //vue-observe-visibility npm 굳이 사용하지 않고도 pageShown으로 처리 가능
        //sessionStorage.pageShown은 document.hidden(index.html) 참조. hot deploy시 타이머가 더 생기는지 체크 필요 (아래 .bind(this) 적용 테스트 더 해보기)
        if (timerShort) {
            if (isWinner) { //위너일 때만 실행 (브라우저의 모든 탭에서는 타이머를 통한 서버호출은 단 한개만 존재하고 나머지는 bc로 받아서 처리)
                await chkDataLogEach()
            }
        }
        timerShort = (pageShown == 'Y') ? true : false
        timeoutShort = setTimeout(function() { procTimerShort() }, TIMERSEC_SHORT) //procTimerShort() }.bind(this)
    }

    async function procTimerLong() { //사실, document.hidden시 굳이 timer가 돌아갈 이유는 없으나, 다시 shown시 처리해야 할 데이터를 분산한다는 의미로 timer 갭을 좀 길게 해 살려 두는 정도임
        if (!timerShort) {
            if (isWinner) { //위너일 때만 실행 (브라우저의 모든 탭에서는 타이머를 통한 서버호출은 단 한개만 존재하고 나머지는 bc로 받아서 처리)
                await chkDataLogEach()
            }
        }
        timeoutLong = setTimeout(function() { procTimerLong() }, TIMERSEC_LONG) //procTimerLong() }.bind(this)
    }*/

    async function procRsObj() { //넘어오는 양에 비해 여기서 (오류발생 등으로) 처리가 안되면 계속 쌓여갈 수 있으므로 그 경우 경고가 필요함
        try {
            if (fifo.length > 0) {
                const rsObj = fifo[0] //if (rsObj.list.length)
                await chkDataLogEach(rsObj)
                fifo.splice(0, 1)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        } finally {
            setTimeout(function() { procRsObj() }, 100)
        }
    }

    function pageShownChanged(ps) { //ps=pageShown
        if (gst.chanIdActivted) gst.realtime.setObjToChan(gst.chanIdActivted, "realShown", ps)
        bc2.postMessage({ code: 'pageShownChanged' })
    }

    function getBroadcast1(data) {
        if (data.code == 'polling') { //위너로부터 polling된 data를 받아 서버호출없이 탭내에서 리얼타임 처리하는 것임
            //chkDataLogEach(data.obj) //data.obj=rs <= bc.postMessage({ code: 'polling', obj: rs })
            //그런데, chkDataLogEach() 바로 호출시 (동기화가 되어 있지 않기 때문에) 그 뒤에 따라오는 다음 순번 객체에 침해당할 수 있으므로, 막고 별도 배열에 추가하고 처리후 제거하는 아래 루틴 필요
            fifo.push(data.obj)
            fifoLen.value = fifo.length
        }
    }

    function getBroadcast2(data) {
        if (data.code == 'pageShownChanged') {
            bc2.postMessage({ code: 'pageShownChanged1' })
            bc2.postMessage({ code: 'informCurPageShown', chanid: gst.chanIdActivted, pageShown: pageShown })
        }else if (data.code == 'pageShownChanged1') {
            bc2.postMessage({ code: 'informCurPageShown', chanid: gst.chanIdActivted, pageShown: pageShown })
        } else if (data.code == 'informCurPageShown') { //정작 자기 것은 안옴
            arrCurPageShown.push({ code: 'informCurPageShown', chanid: gst.chanIdActivted, pageShown: pageShown }) //본인 것 넣기 (듀얼모니터 테스트시엔 N일 수가 많을 것임을 유의)
            arrCurPageShown.push(data)
            setTimeout(function() { procObjByChanid() }, 500)
        }
    }

    function procObjByChanid() {
        try {
            const tmpArr = []
            const len = arrCurPageShown.length
            if (len > 0) {
                for (let i = 0; i < len; i++) {
                    const item = arrCurPageShown[i]
                    if (tmpArr.length == 0) {
                        tmpArr.push(item)
                    } else {
                        let modified = false
                        for (let j = 0; j < tmpArr.length; j++) {
                            if (tmpArr[j].chanid == item.chanid) {
                                if (tmpArr[j].pageShown == 'Y') { 
                                    //Y이면 원하는 답을 얻었으므로 더 이상 안 넣어도 됨
                                } else {
                                    if (item.pageShown == 'Y') {
                                        tmpArr[j] = item
                                    }
                                }
                                modified = true
                            }
                        }
                        if (!modified) tmpArr.push(item)
                    }
                } //여기까지 하면 tmpArr에 pageShwon 정보가 채널별로 Y에 중점을 두고 groupby되어 들어가므로 arrCurPageShown 아래에서 항목 제거하고 gst에 정리하면 됨
                arrCurPageShown.splice(0, len)
            }
            for (let i = 0; i < tmpArr.length; i++) {
                const item = tmpArr[i]
                gst.realtime.setObjToChan(gst.chanIdActivted, "realShown", item.pageShown)
            } //if (arrCurPageShown.length > 0) setTimeout(function() { procObjByChanid() }, 10)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    onMounted(async () => {
        try {   
            bc1 = new BroadcastChannel("wbRealtime1") //각탭의 Main.vue <=> Main.vue
            bc1.onmessage = (e) => { getBroadcast1(e.data) }
            bc2 = new BroadcastChannel("wbRealtime2") //각탭의 Main.vue <=> MsgList.vue
            bc2.onmessage = (e) => { getBroadcast2(e.data) }
            pageShownChanged(pageShown)
            const tag = document.querySelector("#winid") //변하지 않는 값
            winId = (tag) ? tag.innerText : '' //winId를 여기서 만들지 않고 index.html에서 받아오는 것은 index.html의 beforeunload event를 여기서 구현하기가 쉽지 않아서임
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            realtimeJobDone = 'Y'
            //if (!sessionStorage.logdt) { //9999-99-99로 잘못들어간 적이 있는데 변경할 방법이 없어 막음
            logdt = rs.data.dbdt //앱 로드후 최초로 /menu/qry 호출한 시각으로 그 직전까지 들어온 메시지는 별도로 안읽은 메시지로 가져오기로 함
            //}
            listAll.value = rs.list
            listSel.value = rs.list.filter(x => x.USERID != null)
            listUnSel.value = rs.list.filter(x => x.USERID == null)
            window.addEventListener('resize', () => { decideSeeMore() })
            const res1 = await axios.post("/user/getUserInfo")
            const rs1 = gst.util.chkAxiosCode(res1.data)
            if (!rs1) return
            user.value = rs1.data
            setImgUrl(user.value.PICTURE)
            await nextTick() //아니면 decideSeeMore()에서 .cntTarget가 읽히지 않아 문제 발생
            decideSeeMore()
            sideClickOnLoop(null, true)
            procLocalStorage() 
            procTimerShort() 
            procTimerLong()
            if (!route.fullPath.includes('/body/msglist') && !route.fullPath.includes('/notyet')) procRsObj() //아직안읽음에서는 리얼타임 반영하지 않음
            document.addEventListener("visibilitychange", () => { //alt+tab이나 태스트바 클릭시 안먹힘 https://fightingsean.tistory.com/52
                //https://stackoverflow.com/questions/28993157/visibilitychange-event-is-not-triggered-when-switching-program-window-with-altt
                if (document.hidden) {
                    pageShown = 'N' 
                } else {
                    pageShown = 'Y'         
                }
                pageShownChanged(pageShown)                
            }) //아래 2개는 듀얼 모니터로 테스트시에는 다른쪽에서 누르면 또 다른 한쪽은 항상 blur 상태이므로 관련 테스트가 제대로 안될 것임 (제대로 테스트하려면 2대를 놓고 해야 함)
            window.addEventListener('focus', async function() {
                pageShown = 'Y'
                pageShownChanged(pageShown)
                if (sessionStorage.chanidFromNoti) { //알림(noti)바를 클릭한 경우임 - GeneralStore.js의 procNoti() 참조
                    //await router.push({ name : "home_body", params : { chanid: sessionStorage.chanidFromNoti, msgid: sessionStorage.msgidFromNoti }}) //다른 채널이라도 메시지가 추가됨 (사용금지)
                    const nm = (sessionStorage.subkindFromNoti == "GS") ? "dm" : "home"
                    await goRoute({ name: nm }) //home or dm
                    sessionStorage.chanidFromNoti = ''
                    sessionStorage.subkindFromNoti = ''
                    //sessionStorage.msgidFromNoti = '' //사실, msgid까지 특정해서 열지 않아 막음 (슬랙도 제공하지 않고 있음)
                }
            })
            window.addEventListener('blur', function() {
                pageShown = 'N'
                pageShownChanged(pageShown)
            })
            window.focus() //focus()해야 blur()도 발생함
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onUnmounted(() => {
        pageShownChanged('N')
        clearTimeout(timeoutShort)
        clearTimeout(timeoutLong)
    })

    function sideClickOnLoop(selMenu, onMounted) {
        try {
            let idx = -1    
            let lastSelMenu = selMenu ? selMenu : localStorage.wiseband_lastsel_menu
            if (lastSelMenu) {
                idx = listSel.value.findIndex((item) => { return item.ID == lastSelMenu })
            } else {
                lastSelMenu = "mnuHome"
            }
            const idxReal = (idx == -1) ? 0 : idx
            const row = listSel.value[idxReal]
            sideClick(lastSelMenu, row, onMounted)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    watch(() => gst.selSideMenu, () => { //Home.vue의 gst.selSideMenu = "mnuHome" 참조
        console.log("Main gst.selSideMenu..... " + gst.selSideMenu)
        displayMenuAsSelected(gst.selSideMenu) //Home >> DM >> Back()시 Home을 사용자가 선택한 것으로 표시해야 함
    })

    function decideSeeMore() {
        try {
            listNotSeen.value = []
            const sideTop = document.querySelector('#sideTop')
            const sizeH = sideTop.offsetTop + sideTop.offsetHeight
            let targetAll = document.querySelectorAll('.cntTarget') //더보기 제외 console.log(targetAll.length)
            targetAll.forEach(menuDiv => {
                if ((menuDiv.offsetTop + menuDiv.offsetHeight) > sizeH) { //사이드바에서 육안으로 안보이면 listNotSeen에 추가
                    const found = listAll.value.find((item) => item.ID == menuDiv.id.replace("Target", ""))
                    if (found) listNotSeen.value.push(found) //console.log(menuDiv.id)
                }
            })        
            if (listUnSel.value.length > 0 || listNotSeen.value.length > 0) { //(사용자가 원래 선택하지 않은 메뉴 포함해) (화면이 작아진 후) 안 보이는 메뉴가 있으면 더보기 버튼 필요
                seeMore.value = true
            } else {
                seeMore.value = false
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function mouseEnter(e) {
        try {
            prevX = e.pageX
            prevY = e.pageY
            const menuDiv = e.target //console.log(e.pageY + "====mouseenter===" + prevX + "===" + menuDiv.offsetTop)
            if (menuDiv.id == "mnuSeeMore") {
                listPopupMenu.value = [...listUnSel.value, ...listNotSeen.value] //위 ## 주석 참조
            } else {
                return //더보기 말고 팝업표시하는 것은 육안으로는 화면이 더 복잡해져서 오히려 불편함을 느낌 (주관적) : 향후 필요시 return 빼고 아래 팝업 메뉴 추가하면 됨 (일단은 더보기에 대해서만 팝업 지원)
                const found = listAll.value.find((item) => item.ID == menuDiv.id)
                if (!found || found.POPUP != "Y") {
                    popupMenuOn.value = false //혹시 떠 있을 팝업 제거
                    return
                }
                listPopupMenu.value = [] //임시. 여기서부터는 실시간으로 axios로 가져와도 무방할 것임 (한번 가져오면 그 다음부터는 캐싱..등 고려)
            }
            popupMenuOn.value = true
            if (menuDiv.id == "mnuSeeMore") { //console.log(e.pageY + "===" + prevX + "===" + menuDiv.offsetTop)
                popupMenuPos.value.top = (e.pageY - POPUPHEIGHT + 50) + "px"
                popupMenuPos.value.bottom = null
            } else {
                // const docHeight = document.documentElement.offsetHeight
                // if (menuDiv.offsetTop + POPUPHEIGHT > docHeight) {
                //     popupMenuPos.value.top = null
                //     popupMenuPos.value.bottom = (docHeight - menuDiv.offsetTop - 100) + "px"
                // } else { //100은 사이드메뉴아이템 높이인데 이 화면의 로직에서는 대략 산정해도 무리없음
                //     popupMenuPos.value.top = (menuDiv.offsetTop - 100) + "px"
                //     popupMenuPos.value.bottom = null
                // }
            }
            popupData.value.id = menuDiv.id
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function mouseLeave(e) {
        try {
            const angle = hush.util.getAngle(prevX, prevY, e.pageX, e.pageY)
            if (angle >= -90 && angle <= 90) { //if (e.pageX > prevX) {
                //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
            } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX)
                popupMenuOn.value = false
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    //더보기 메뉴는 로컬에 저장하기 않는 전제임 (더보기 누르면 나오는 목록 클릭시 저장) : row까지 argument로 받는 것은 좀 과하다 싶지만 일단 개발 편의 고려해 처리하고자 함
    function sideClick(popupId, row, onMounted) {
        try {
            popupMenuOn.value = false
            const id = (popupId == "mnuSeeMore") ? row.ID : popupId //mnuSeeMore일 경우는 무조건 mnuHome
            for (let i = 0; i < listSel.value.length; i++) {
                if (listSel.value[i].sel) listSel.value[i].sel = false
            }
            row.sel = true
            if (!onMounted && id == gst.selSideMenu) return //사용자 최초 시작시엔 무조건 HomePanel 호출
            if (popupId != "mnuSeeMore") {
                console.log("Main 메뉴 클릭 gst.selSideMenu..... " + gst.selSideMenu)
                gst.selSideMenu = id                
                localStorage.wiseband_lastsel_menu = id
            }
            procMenu[id].call(null, row, onMounted)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function displayMenuAsSelected(popupId) {
        for (let i = 0; i < listSel.value.length; i++) {
            if (listSel.value[i].ID == popupId) {
                listSel.value[i].sel = true
            } else {
                listSel.value[i].sel = false
            }
        }
        localStorage.wiseband_lastsel_menu = popupId
    }

    async function goRoute(obj, onMounted) {
        //Object.assign(obj, { query : { ver : Math.random() }}) //obj에 merge : 사이드메뉴 클릭시 (예:Home.vue 호출) 캐시 제거하고 호출해야 MsgList.vue 안뜨는 상황 방지될 것임
        if (onMounted) { //사이드메뉴 클릭시 맨 처음 로드시 push로 라우팅하면 오른쪽 공백이 생기므로 replace 필요
            await router.replace(obj)
        } else {
            await router.push(obj)
        }
        popupMenuOn.value = false
    }

    const procMenu = {
        ["mnuHome"] : async (row, onMounted) => { await goRoute({ name: 'home' }, onMounted) }, //path: '/main/home'       
        ["mnuDm"] : async (row, onMounted) => { await goRoute({ name: 'dm' }, onMounted) },
        ["mnuActivity"] : async (row, onMounted) => { await goRoute({ name: 'activity' }, onMounted) },
        ["mnuLater"] : async (row, onMounted) => { await goRoute({ name: 'later' }, onMounted) },
        ["mnuFixed"] : async (row, onMounted) => { await goRoute({ name: 'fixed' }, onMounted) },
        ["mnuAuto"] : async (row, onMounted) => { 
            gst.util.setToast("미개발된 메뉴입니다.") //await goRoute({ name: 'auto' }, onMounted) 
        },
        ["mnuGroup"] : async (row, onMounted) => { await goRoute({ name: 'group' }, onMounted) }
    }

    function openMsgSearch() {
        mediaPopupRef.value.open("msg", '', '', '', searchText.value.trim())
    }

    function openUserProfile() {
        userProfileRef.value.open("msg", '', '', '', searchText.value.trim())
    }   
    
    function setImgUrl(pict) {
        user.value.url = (pict) ? hush.util.getImageBlobUrl(pict.data) : null
    }

    function handleEvFromUserProfile(userObj) {
        user.value = userObj
        if (panelRef.value && panelRef.value.procMainToMsglist) panelRef.value.procMainToMsglist("userprofile", userObj)
    }

    async function logout() {
        if (!confirm("로그아웃합니다. 계속 진행할까요?")) return
        gst.auth.logout()
        await goRoute({ name: 'login' }, true)
    }

    // function handleEvFromPanel(kind, menu) { //예) kind: "forwardToSide", menu: "home" => Home.vue의 onMounted() => MsgList.vue
    //     //현재 미사용. 지우지 말 것 (향후 사용가능성) : MsgList okChanDmPopup() 참조
    //     const menuStr = "mnu" + menu.substring(0, 1).toUpperCase() + menu.substring(1)
    //     const ka = keepAliveRef.value._.__v_cache
    //     ka.delete(menu) //const appType = route.fullPath.split("/")[2] //arr[2] = home,dm 등..
    //     sideClickOnLoop(menuStr) //여기까지 잘됨. 여기서 추가로 MsgList의 캐시지우기까지 처리해야 완벽함 (그 부분만 아직 미구현) 
    // }

    function showBottomMsgList() {
        bottomMsgListPopupRef.value.open()
    }
</script>

<template>
    <div class="coMain" @click="gst.ctx.hide">
        <div class="header" id="header"><!-- MsgList에서 id 사용-->
            <div style="display:flex;align-items:center;color:white">
                <span v-show="winnerId == winId">
                    <span>[</span><span style="font-weight:bold" :style="{ color: logdtColor }">{{ logdtDisp ? logdtDisp.substring(11, 19) : '' }}</span>
                    <span>{{ logdtDisp ? logdtDisp.substring(19) : '' }}]</span>
                    <span style="margin-left:5px">[A:</span><span style="font-weight:bold" :style="{ color: logdtColor }">{{ cntChanActivted }}</span><span>]</span>
                    <span style="margin-left:5px">[D:</span><span style="font-weight:bold" :style="{ color: logdtColor }" >{{ cntNotChanActivted }}</span><span>]</span>
                    <span style="margin-left:5px">{{ winnerId }}/{{ winId }}</span>
                </span>
                <span v-show="winnerId != winId">
                    <span>fifoLen : {{ fifoLen }}</span>
                </span>
            </div>
            <div style="display:flex;justify-content:center;align-items:center">
                <input type="search" v-model="searchText" @keyup.enter="openMsgSearch()" class="search" placeholder="통합검색키워드"/>
                <div class="btn_basic" @click="openMsgSearch()"><img :src="gst.html.getImageUrl('search.png')" style="width:16;height:16px" ></div>
                <div class="btn_basic" @click="openMsgSearch()"><span>통합검색으로이동</span></div>
            </div>
            <div style="display:flex;justify-content:flex-end;align-items:center;cursor:pointer">
                <!-- <span style="margin-right:10px;color:whitesmoke">{{ gst.auth.getCookie("usernm") }}</span> -->
                <span style="margin-right:10px;color:whitesmoke">{{ user ? user.USERNM : '' }}</span>
                <span style="color:whitesmoke;font-weight:bold" @click="logout">Logout</span>
            </div>
        </div>
        <div class="body">
            <div class="side" id="main_side"> <!--main_side는 Home.vue에서 resizing에서 사용-->
                <div class="sideTop" style="margin-top:8px">
                    <div style="margin-bottom:16px;display:flex;justify-content:center;align-items:center">
                        <img class="coImg32" src="/src/assets/images/color_slacklogo.png"/>
                    </div>
                    <div id="sideTop" class="sideTop">
                        <div v-for="(row, idx) in listSel" @click="sideClick(row.ID, row)" :id="row.ID + 'Target'" class="menu cntTarget">
                            <div :id="row.ID" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img :class="['coMenuImg', row.sel ? 'coMenuImgSel' : '']" :src="gst.html.getImageUrl(row.IMG)">
                            </div>
                            <div class="coMenuText">{{ row.NM }}</div>
                            <div v-show="row.ID=='mnuHome'&&notyetCntHome>0" class="myNotYet" style="position:absolute;top:-2px;left:34px">{{ notyetCntHome > 99 ? '99!' : notyetCntHome }}</div>
                            <div v-show="row.ID=='mnuDm'&&notyetCntDm>0" class="myNotYet" style="position:absolute;top:-2px;left:34px">{{ notyetCntDm > 99 ? '99!' : notyetCntDm }}</div>
                        </div>                      
                    </div>
                    <div v-show="seeMore" class="sideBottom"><!--sideTop안에 sideBottom에 들어 있으며 바로 아래는 sideTop과 sibling으로 sideBottom이 있음을 유의-->
                        <div class="menu"><!--더보기엔 cntTarget이 없음을 유의--> 
                            <div id="mnuSeeMore" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img class="coMenuImg" :src="gst.html.getImageUrl('white_option_horizontal.png')">
                            </div>
                            <div class="coMenuText">더보기</div>
                        </div>
                    </div>
                </div>
                <div class="sideBottom">
                    <div class="menu" style="margin:0 0 30px 0" @click="openUserProfile">
                        <!-- <img class="menu32" :src="gst.html.getImageUrl('user.png')" @click="openUserProfile"> -->
                        <img v-if="user && user.url" :src="user.url" class="coImg32" style="border-radius:16px">
                        <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg32">
                    </div>
                </div>
            </div>
            <div class="main">
                <div class="content"><!-- <component :is="Component" :key="$route.fullPath" />로 구현시 MsgList의 $route.fullPath이므로 unique하지 않음. @ev-to-side="handleEvFromPanel"-->
                    <router-view v-slot="{ Component }">
                        <keep-alive ref="keepAliveRef">
                            <component :is="Component" :key="$route.fullPath.split('/')[2]" ref="panelRef" />
                        </keep-alive>
                    </router-view>
                </div>
                <div class="footer" @click="showBottomMsgList()" style="color:lightgray;cursor:pointer">
                    <div class="coDotDot">
                        {{ gst.bottomMsg }}
                    </div>
                </div>
            </div>
        </div>
    </div>
    <popup-sidemenu :popupOn="popupMenuOn" :popupPos="popupMenuPos" :list="listPopupMenu" :popupData="popupData" @ev-click="sideClick" @ev-leave="popupMenuOn=false"></popup-sidemenu> 
    <media-search ref="mediaPopupRef"></media-search>
    <user-profile ref="userProfileRef" @evToMain="handleEvFromUserProfile"></user-profile>
    <popup-common ref="bottomMsgListPopupRef" style="display:flex;flex-direction:column">
         <div v-for="(row, idx) in gst.bottomMsgList" >
            <span style="margin:0px">{{ row }}</span>
        </div>
    </popup-common>
</template>

<style scoped>
    .body {
        width:100%;height:100%;display:flex;
        background:var(--primary-color);overflow:hidden; /* hidden이 있어야 sidebar의 아랫공간이 always seen 가능 */
    }
    input[type=search]:focus { outline:2px solid lightgreen }
    .header {
        width:calc(100% - 40px);min-height:45px;padding:0 20px;display:flex;justify-content:space-between;align-items:center;
        background:var(--primary-color);
    }
    .search { width:240px;padding-left:5px;background-color:var(--second-color);color:var(--second-select-color);border:none;border-radius:4px }
    .search::placeholder { color:var(--second-select-color) }
    .btn_basic { 
        height:28px;margin-left:10px;padding:0 8px;display:flex;justify-content:center;align-items:center;
        border:1px solid dimgray;border-radius:4px;background-color:var(--primary-color);color:var(--second-select-color);cursor:pointer 
    }
    .btn_basic:hover { background:var(--second-hover-color) }
    /* .btn_basic:active { background:var(--active-btn) } */
    .side {
        min-width:70px;height:100%;
        display:flex;flex-direction:column;align-items:center;justify-content:space-between;
        background:var(--primary-color);
    }
    .sideTop {
        display:flex;flex-direction:column;overflow:hidden;
    }
    .sideBottom { /* sidebar의 아랫공간이 always seen 가능하려면 body에 hidden이 필요함 */
        display:flex;flex-direction:column;justify-content:flex-end;
    }
    .main {
        width:calc(100% - 70px);height:100%;display:flex;flex-direction:column;
    }
    .content {
        width:calc(100% - 3px);height:100%;display:flex;margin-right:3px;margin-bottom:3px;
        overflow:hidden;
    }
    .footer {
        width:calc(100% - 24px);height:24px;margin:auto 0 0 0;padding:0 10px;
        display:flex;align-items:center;
        background:var(-primary-color);color:whitesmoke
    }
    .menu { 
        position:relative;width:55px;min-height:55px;margin:8px 0; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:white;cursor:pointer; 
    }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
    .myNotYet { 
        width:13px;height:13px;padding:1px 2px 2px 2px;
        display:flex;align-items:center;justify-content:center;border-radius:12px;background-color:var(--active-color);color:black;font-size:10px
    }
</style>
