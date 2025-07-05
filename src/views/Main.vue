<script setup>
    import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupSidemenu from "/src/components/PopupSidemenu.vue"
    import MediaSearch from "/src/components/MediaSearch.vue"

    const gst = GeneralStore()
    const router = useRouter()
    const route = useRoute()

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

    //리얼타임 반영
    let panelRef = ref(null)
    let timerShort = true, timeoutShort, timeoutLong
    const TIMERSEC_SHORT = 1000, TIMERSEC_LONG = 1000
    let logdt = ref(''), cntChanActivted = ref(0), cntNotChanActivted = ref(0), logdtColor = ref('yellow') //화면 표시용

    let bc //BroadcastChannel

    function test() {
        bc.postMessage({ aaa:"aaa", bbb:"bbb" })
    }

    async function chkDataLogEach() {
        try {
            //console.log(sessionStorage.realtimeJobDone+"#####00")
            if (sessionStorage.realtimeJobDone != 'Y') return //gst.util.setSnack 참조
            sessionStorage.realtimeJobDone = ''            
            //console.log(sessionStorage.logdt+"@@@@@"+sessionStorage.realtimeJobDone)
            logdt.value = sessionStorage.logdt //화면 표시용
            logdtColor.value = logdtColor.value == 'yellow' ? 'lightgreen' : 'yellow' //화면 표시용
            cntChanActivted.value = 0
            cntNotChanActivted.value = 0
            const res = await axios.post("/chanmsg/qryDataLogEach", { logdt : sessionStorage.logdt })
            const rs = gst.util.chkAxiosCode(res.data, true)
            if (!rs) {
                sessionStorage.realtimeJobDone = 'Y'
                return
            }
            if (rs.list.length > 0 && panelRef.value) { //로드시 가끔 패널에 panelRef가 늦게 잡히는 경우가 있는데 이 경우는 한번 더 돌아야 함
                debugger
                let arrForChanActivted = (!gst.chanIdActivted)? [] : rs.list.filter(x => x.CHANID == gst.chanIdActivted) //MsgList로 전달하는 것임
                let arrForNotChanActivted = rs.list.filter(x => x.CHANID != gst.chanIdActivted) //각 패널에 전달하는데 패널마다 채널 단위 또는 메시지 단위로 다르게 전달해야 함
                cntChanActivted.value = arrForChanActivted.length //화면 표시용
                cntNotChanActivted.value = arrForNotChanActivted.length //화면 표시용
                if (arrForNotChanActivted.length > 0) { //MsgList에 열려 있지 않은 채널데이터들에 대한 리얼타임 반영
                    const len = arrForNotChanActivted.length
                    for (let i = 0; i < len; i++) {
                        const row = arrForNotChanActivted[i]
                        if (gst.selSideMenu == "mnuHome") { //채널 단위로 읽음처리 관련만 전달하면 됨
                            await panelRef.value.procMainToPanel('updateNotyetCnt', row)
                        } else if (gst.selSideMenu == "mnuDm") { //채널 단위로 
                            if (row.CUD == 'T') { //notyet->read가 많음 (아닌 경우도 있으나 그냥 무시) 
                                await panelRef.value.procMainToPanel('updateNotyetCnt', row)
                            } else {
                                await panelRef.value.procMainToPanel('refreshRow', row)
                            }
                        }
                    }
                }
                if (arrForChanActivted.length > 0) {
                    console.log(rs.data.logdt+"@@@@@22"+arrForChanActivted[0].MSGID+"---"+arrForChanActivted[0].CDT)
                    await panelRef.value.procMainToMsglist("realtime", { list: arrForChanActivted, logdt: rs.data.logdt })
                } else { //바로 위 루틴에서 logdt를 sessionStorage.logdt으로부터 가져오는데 이게 그 위 if (arrForNotChanActivted > 0) 조건도 같이 체크해서
                    //마지막으로 끝나는 싯점에 맞춰 sessionStorage.logdt = obj.logdt으로 처리해야 다음에 읽어올 logdt가 흐트러지지 않음
                    sessionStorage.logdt = rs.data.logdt
                    sessionStorage.realtimeJobDone = 'Y'
                }
            } else {
                sessionStorage.realtimeJobDone = 'Y'
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function procTimerShort() {
        //요점 : 페이지가 보이면 최단시간 타이머 안보이면 타이머 갭을 늘리기 : 하나의 window 객체에 Main.vue의 timer가 돌아가는 것은 오직 1개만 가능하도록 함
        //vue-observe-visibility npm 굳이 사용하지 않고도 pageShown으로 처리 가능
        //sessionStorage.pageShown은 document.hidden(index.html) 참조. hot deploy시 타이머가 더 생기는지 체크 필요 (아래 .bind(this) 적용 테스트 더 해보기)
        if (timerShort) await chkDataLogEach()
        timerShort = (sessionStorage.pageShown == 'Y') ? true : false
        //timeoutShort = setTimeout(function() { procTimerShort() }.bind(this), TIMERSEC_SHORT)
        timeoutShort = setTimeout(function() { procTimerShort() }, TIMERSEC_SHORT)
    }

    async function procTimerLong() {
        //사실, document.hidden시 굳이 timer가 돌아갈 이유는 없으나, 다시 shown시 처리해야 할 데이터를 분산한다는 의미로 timer 갭을 좀 길게 해 살려 두는 정도임
        if (!timerShort) await chkDataLogEach()
        //timeoutLong = setTimeout(function() { procTimerLong() }.bind(this), TIMERSEC_LONG)             
        timeoutLong = setTimeout(function() { procTimerLong() }, TIMERSEC_LONG)
    }

    function getBroadcast(data) {
        console.log(JSON.stringify(data))
    }
    
    onMounted(async () => {
        try {
            bc = new BroadcastChannel("wbRealtime")
            bc.onmessage = (e) => { getBroadcast(e.data) }
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            sessionStorage.realtimeJobDone = 'Y' 
            //if (!sessionStorage.logdt) { //9999-99-99로 잘못들어간 적이 있는데 변경할 밥업이 없음
                sessionStorage.logdt = rs.data.dbdt //앱 로드후 최초로 /menu/qry 호출한 시각으로 그 직전까지 들어온 메시지는 별도로 안읽은 메시지로 가져오기로 함
            //}
            listAll.value = rs.list
            listSel.value = rs.list.filter(x => x.USERID != null)
            listUnSel.value = rs.list.filter(x => x.USERID == null)
            window.addEventListener('resize', () => { decideSeeMore() })
            await nextTick() //아니면 decideSeeMore()에서 .cntTarget가 읽히지 않아 문제 발생
            decideSeeMore()
            // let idx = -1    
            // let lastSelMenu = localStorage.wiseband_lastsel_menu
            // if (lastSelMenu) {
            //     idx = listSel.value.findIndex((item) => { return item.ID == lastSelMenu })
            // } else {
            //     lastSelMenu = "mnuHome"
            // }
            // const idxReal = (idx == -1) ? 0 : idx
            // const row = listSel.value[idxReal]
            // sideClick(lastSelMenu, row, true)
            sideClickOnLoop(null, true)
            procTimerShort() 
            procTimerLong()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onUnmounted(async () => {
        if (bc) bc.close()
    })

    function sideClickOnLoop(selMenu, onMounted) {
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
    }

    watch(() => gst.selSideMenu, () => { //Home.vue의 gst.selSideMenu = "mnuHome" 참조
        //debugger
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
        //setTimeout(function() {
            prevX = e.pageX
            prevY = e.pageY
            const menuDiv = e.target //console.log(e.pageY + "====mouseenter===" + prevX + "===" + menuDiv.offsetTop)
            if (menuDiv.id == "mnuSeeMore") {
                listPopupMenu.value = [...listUnSel.value, ...listNotSeen.value] //위 ## 주석 참조
            } else {
                return //더보기 말고 팝업표시하는 것은 육안으로는 화면이 더 복잡해져서 오히려 불편함을 느낌 (주관적) : 향후 필요시 return 빼고 팝업 메뉴 추가하면 됨 (일단은 더보기에 대해서만 팝업 지원)
                const found = listAll.value.find((item) => item.ID == menuDiv.id)
                if (!found || found.POPUP != "Y") {
                    popupMenuOn.value = false //혹시 떠 있을 팝업 제거
                    return
                }
                listPopupMenu.value = [] //임시. 여기서부터는 실시간으로 axios로 가져와도 무방할 것임 (한번 가져오면 그 다음부터는 캐싱..등 고려)
            }
            popupMenuOn.value = true
            const docHeight = document.documentElement.offsetHeight
            if (menuDiv.offsetTop + POPUPHEIGHT > docHeight) {
                popupMenuPos.value.top = null
                popupMenuPos.value.bottom = (docHeight - menuDiv.offsetTop - 100) + "px"
            } else { //100은 사이드메뉴아이템 높이인데 이 화면의 로직에서는 대략 산정해도 무리없음
                popupMenuPos.value.top = (menuDiv.offsetTop - 100) + "px"
                popupMenuPos.value.bottom = null
            }
            popupData.value.id = menuDiv.id
        //}, 500)
    }

    function mouseLeave(e) {
        const angle = hush.util.getAngle(prevX, prevY, e.pageX, e.pageY)
        if (angle >= -60 && angle <= 60) { //if (e.pageX > prevX) {
            //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
        } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
            popupMenuOn.value = false
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
        ["mnuHome"] : async (row, onMounted) => { await goRoute({ path: '/main/home' }, onMounted) },        
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

    async function logout() {
        if (!confirm("로그아웃합니다. 계속 진행할까요?")) return
        gst.auth.logout()
        await goRoute({ name: 'login' }, true)
    }

    function handleEvFromPanel(kind, menu) { //예) kind: "forwardToSide", menu: "home" => Home.vue의 onMounted() => MsgList.vue
        //현재 미사용. 지우지 말 것 (향후 사용가능성) : MsgList okChanDmPopup() 참조
        const menuStr = "mnu" + menu.substring(0, 1).toUpperCase() + menu.substring(1)
        const ka = keepAliveRef.value._.__v_cache
        ka.delete(menu) //const appType = route.fullPath.split("/")[2] //arr[2] = home,dm 등..
        sideClickOnLoop(menuStr) //여기까지 잘됨. 여기서 추가로 MsgList의 캐시지우기까지 처리해야 완벽함 (그 부분만 아직 미구현) 
    }
</script>

<template>
    <div class="coMain" @click="gst.ctx.hide">
        <div class="header" id="header"><!-- MsgList에서 id 사용-->
            <div style="display:flex;align-items:center;color:white">
                <span>
                    <span>[logdt:</span><span style="margin-left:3px;font-weight:bold" :style="{ color: logdtColor }">{{ logdt.substring(11, 19) }}</span><span>{{ logdt.substring(19) }}]</span>
                    <span style="margin-left:5px">[활성:</span><span style="font-weight:bold" :style="{ color: logdtColor }">{{ cntChanActivted }}</span><span>]</span>
                    <span style="margin-left:5px">[비활성:</span><span style="font-weight:bold" :style="{ color: logdtColor }" >{{ cntNotChanActivted }}</span><span>]</span>
                </span>
            </div>
            <div style="display:flex;justify-content:center;align-items:center">
                <input type="search" v-model="searchText" @keyup.enter="openMsgSearch()" class="search" placeholder="통합검색키워드"/>
                <div class="btn_basic" @click="openMsgSearch()"><img :src="gst.html.getImageUrl('search.png')" style="width:16;height:16px" ></div>
                <div class="btn_basic" @click="openMsgSearch()"><span>통합검색으로이동</span></div>
            </div>
            <div style="display:flex;justify-content:flex-end;align-items:center;cursor:pointer">
                <span style="margin-right:10px;color:whitesmoke">{{ gst.auth.getCookie("usernm") }}</span>
                <span style="color:whitesmoke;font-weight:bold" @click="logout">Logout</span>
            </div>
        </div>
        <div class="body">
            <div class="side" id="main_side"> <!--main_side는 Home.vue에서 resizing에서 사용-->
                <div class="sideTop" style="margin-top:8px">
                    <div style="margin-bottom:16px;display:flex;justify-content:center;align-items:center">
                        <img class="coImg32" src="/src/assets/images/color_slacklogo.png" @click="test"/>
                    </div>
                    <div id="sideTop" class="sideTop">
                        <div v-for="(row, idx) in listSel" @click="sideClick(row.ID, row)" :id="row.ID + 'Target'" class="menu cntTarget">
                            <div :id="row.ID" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img :class="['coMenuImg', row.sel ? 'coMenuImgSel' : '']" :src="gst.html.getImageUrl(row.IMG)">
                            </div>
                            <div class="coMenuText">{{ row.NM }}</div>
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
                    <div class="menu" style="margin:0"><img class="menu32" :src="gst.html.getImageUrl('plus.png')"></div>
                    <div class="menu" style="margin:0 0 8px 0"><img class="menu32" :src="gst.html.getImageUrl('user.png')"></div>
                </div>
            </div>
            <div class="main">
                <div class="content"><!-- <component :is="Component" :key="$route.fullPath" />로 구현시 MsgList의 $route.fullPath이므로 unique하지 않아 onMounted가 수회 발생 or 무한루프(예:홈 메뉴)-->
                    <!-- <router-view v-slot="{ Component }">
                        <keep-alive ref="keepAliveRef">
                            <component :is="Component" :key="$route.fullPath.split('/')[2]" @ev-to-side="handleEvFromPanel" fromPopupChanDm="" />
                        </keep-alive>
                    </router-view> -->
                    <router-view v-slot="{ Component }">
                        <keep-alive ref="keepAliveRef">
                            <component :is="Component" :key="$route.fullPath.split('/')[2]" ref="panelRef" />
                        </keep-alive>
                    </router-view>
                </div>
                <div class="footer">
                    <div class="coDotDot">
                        {{ gst.bottomMsg }}
                    </div>
                </div>
            </div>
        </div>
    </div>
    <popup-sidemenu :popupOn="popupMenuOn" :popupPos="popupMenuPos" :list="listPopupMenu" :popupData="popupData" @ev-click="sideClick" @ev-leave="popupMenuOn=false"></popup-sidemenu> 
    <media-search ref="mediaPopupRef"></media-search>
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
        width:55px;min-height:55px;margin:8px 0; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:white;cursor:pointer; 
    }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
