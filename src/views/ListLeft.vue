<script setup>
    import { ref, onMounted, onActivated, watch } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    
    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    const LIGHT = "whitesmoke_", DARK = "violet_"

    let kind = ref('my'), listChan = ref([])
    let mounting = true
    //아래는 resizing 관련
    let chanSideWidth = ref(localStorage.wiseband_lastsel_chansidewidth ?? '300px')
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')
    let mainSide, resizer, leftSide, rightSide, mainSideWidth, posX = 0, leftWidth = 0

    onMounted(async () => { //Main.vue와는 달리 라우팅된 상태에서 Back()을 누르면 여기가 실행됨
        try {
            //debugger
            setBasicInfo()
            // const lastSelKind = localStorage.wiseband_lastsel_kind
            // if (lastSelKind) kind.value = lastSelKind
            // await getList()
            // mainSide = document.getElementById('main_side') //Main.vue 참조
            // resizer = document.getElementById('dragMe') //vue.js npm 사용해봐도 만족스럽지 못해 자체 구현 소스 참조해 vue 소스로 응용
            // leftSide = document.getElementById('chan_side') //resizer.previousElementSibling
            // rightSide = document.getElementById('chan_main') //resizer.nextElementSibling
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => { //초기 마운트 또는 캐시상태에서 다시 삽입될 때마다 호출 : onMounted -> onActivated 순으로 호출됨
        if (mounting) {
            mounting = false
        } else {
            setBasicInfo()
            //loopListChan(localStorage.wiseband_lastsel_grid, localStorage.wiseband_lastsel_chanid)
        }
    })

    watch(kind, async () => {
        localStorage.wiseband_lastsel_kind = kind.value
        await getList() 
    })

    // watch([() => gst.selChanId, () => gst.selGrId], () => { //onMounted보다 더 먼저 수행되는 경우임 (디버거로 확인)
    //     displayChanAsSelected(gst.selChanId, gst.selGrId) //채널트리간 Back()시 사용자가 선택한 것으로 표시해야 함
    // })

    // watch(() => gst.selSideMenuTimeTag, () => { //router index.js에서만 전달받음 (Main.vue에서 홈 등 사이드메뉴 클릭시 캐시 가져오기)
    //     console.log(gst.selSideMenuTimeTag + " == gst.selSideMenuTimeTag########watch in home.vue") //console.log(route.fullPath+"@@@@@@@main.vue")
    //     loopListChan(gst.selGrId, gst.selChanId)
    // }) ##87 지우지 말 것 : selSideMenuTimeTag 대신 onActivated() 사용해 해결 - keepalive인 경우임

    function setBasicInfo() {
        document.title = "WiSEBand 나중에" //다른 곳에서 title이 업데이트 될 것임
        gst.selSideMenu = "mnuLater" //이 행이 없으면 DM 라우팅후 Back()후 홈을 누르면 이 값이 mnuDm이므로 HomeBody.vue에 Balnk가 표시됨
    }

    function loopListChan(grid, chanid) {
        try {
            listChan.value.forEach((item, index) => {
                if (item.GR_ID == grid) {
                    item.exploded = true
                    if (item.CHANID == chanid) {
                        chanClick(item, index)
                    } else {
                        procChanRowImg(item)
                    }
                } else {
                    item.exploded = false
                    procChanRowImg(item)
                }
            })
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function getList() {
        try {            
            const res = await axios.post("/menu/qryChan", { kind : kind.value }) //my,other,all
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            listChan.value = rs.list
            loopListChan(localStorage.wiseband_lastsel_grid, localStorage.wiseband_lastsel_chanid)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function procChanRowImg(item) { //svg는 이미지 컬러링이 가능하나 핸들링이 쉽지 않아 png로 별도 이미지 교체로 처리
        if (item.DEPTH == "1") {
            item.nodeImg = item.exploded ? LIGHT + "expanded.png" : LIGHT + "collapsed.png"
            item.notioffImg = ""
            item.bookmarkImg = ""
            item.otherImg = ""
        } else {
            if (item.CHANID == null) {
                item.nodeImg = LIGHT + "channel.png"
                item.notioffImg = ""
                item.bookmarkImg = ""
                item.otherImg = ""
                item.CHANNM = "없음"
            } else {
                item.nodeImg = (item.STATE == "A") ? "channel.png" : "lock.png"
                item.notioffImg = (item.NOTI == "X") ? "notioff.png" : ""
                item.bookmarkImg = (item.BOOKMARK == "Y") ? "bookmark.png" : ""
                item.otherImg = (item.OTHER == "other") ? "other.png" : ""
                const color = item.sel ? DARK : LIGHT
                item.nodeImg = color + item.nodeImg
                if (item.notioffImg) item.notioffImg = color + item.notioffImg
                if (item.bookmarkImg) item.bookmarkImg = color + item.bookmarkImg
                if (item.otherImg) item.otherImg = color + item.otherImg
            }
        }
    }

    function chanClick(row, idx) {
        try {
            if (row.DEPTH == "1") { //접기 or 펼치기
                if (row.exploded) {
                    row.exploded = false
                } else {
                    row.exploded = true
                }
                procChanRowImg(row)
                for (let i = idx + 1; i < listChan.value.length; i++) {
                    if (listChan.value[i].DEPTH == "1") break
                    listChan.value[i].exploded = row.exploded
                }
                if (row.exploded) localStorage.wiseband_lastsel_grid = row.GR_ID
            } else {
                for (let i = 0; i < listChan.value.length; i++) {
                    if (listChan.value[i].DEPTH == "2") {
                        listChan.value[i].sel = false
                        listChan.value[i].hover = false
                        procChanRowImg(listChan.value[i])
                    }
                }
                row.sel = true
                procChanRowImg(row)
                localStorage.wiseband_lastsel_grid = row.GR_ID
                localStorage.wiseband_lastsel_chanid = row.CHANID //console.log("router.push:" + row.CHANNM)
                const obj = { name : 'list_body', params : { grid: row.GR_ID, chanid: row.CHANID }} //path와 param는 같이 사용 X (name 이용)
                //debugger
                if (!sessionStorage.wiseband_list_at_first) { //Main.vue가 Home.vue를 라우팅할 때는 
                    router.replace(obj) //HomeBody.vue가 들어설 자리가 blank로 남아 있는데 실행시는 안보이는데 Back()에서는 보임. 이걸 해결하기 위해 replace 처리함
                } else {
                    router.push(obj)
                }
                sessionStorage.wiseband_list_at_first = true
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function displayChanAsSelected(chanid, grid) {
        try {
            for (let i = 0; i < listChan.value.length; i++) {
                const row = listChan.value[i]
                if (grid == row.GR_ID) {
                    row.exploded = true //dept1이든 2든 펼치기
                    if (row.DEPTH == "2") {
                        if (chanid == row.CHANID) {
                            row.sel = true
                            localStorage.wiseband_lastsel_grid = row.GR_ID
                            localStorage.wiseband_lastsel_chanid = row.CHANID
                        } else {
                            row.sel = false
                        }
                    } else {
                        localStorage.wiseband_lastsel_grid = row.GR_ID
                    }
                } else { //row.exploded = false //row.exploded는 사용자가 본 그대로 (접지 말고) 둬야 함
                    row.sel = false
                    row.hover = false
                }
                procChanRowImg(row)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        const img = row.nodeImg.replace(LIGHT, DARK)        
        const nm = !row.CHANID ? row.GR_NM : row.CHANNM
        gst.ctx.data.header = "<img src='/src/assets/images/" + img + "' class='coImg18' style='margin-right:5px'>" + "<span>" + nm + "</span>"
        if (!row.CHANID) {            
            gst.ctx.menu = [
                { nm: "채널 생성" },
                { nm: "환경 설정" }
            ]
        } else {
            gst.ctx.menu = [
                { nm: "채널정보 보기", func: function(item, idx) {
                    
                }},
                { nm: "즐겨찾기" },
                { nm: "사용자 초대" },
                { nm: "복사", img: DARK + "other.png", child: [
                    { nm: "채널 복사", func: function(item, idx) { 
                        
                    }},
                    { nm: "링크 복사" }
                ]},                
                { nm: "채널 나가기", color: "red" }
            ]            
        }
        gst.ctx.show(e)
    }

    function mouseEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        if (row.sel) return
        row.hover = true
        //procChanRowImg(row)
    }

    function mouseLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        if (row.sel) return
        row.hover = false
        //procChanRowImg(row)
    }

    function procExpCol(type) { //모두필치기,모두접기
        const exploded = (type == "E") ? true : false
        for (let i = 0; i < listChan.value.length; i++) {
            listChan.value[i].exploded = exploded
            procChanRowImg(listChan.value[i])
        }
    }

    function newMsg() {
        alert('newMsg')
    }

    //////////////////////////////////////마우스다운후 채널바 리사이징
    function mouseDownHandler(e) {
        posX = e.clientX//마우스 위치 X값
        leftWidth = leftSide.getBoundingClientRect().width
        mainSideWidth = mainSide.getBoundingClientRect().width
        document.addEventListener('mousemove', mouseMoveHandler)
        document.addEventListener('mouseup', mouseUpHandler)
    }

    async function mouseMoveHandler(e) {
        const dx = e.clientX - posX //마우스가 움직이면 기존 초기 마우스 위치에서 현재 위치값과의 차이를 계산
        document.body.style.cursor = 'col-resize' //크기 조절중 마우스 커서 변경 (resizer에 적용하면 위치가 변경되면서 커서가 해제되기 때문에 body에 적용)
        leftSide.style.userSelect = 'none' //이동중 양쪽 영역(왼쪽, 오른쪽)에서 마우스 이벤트와 텍스트 선택을 방지하기 위해 추가 (4행)
        leftSide.style.pointerEvents = 'none'        
        rightSide.style.userSelect = 'none'
        rightSide.style.pointerEvents = 'none'        
        chanSideWidth.value = `${leftWidth + dx + mainSideWidth}px` //아래 % 대신에 바로 px 적용
        chanMainWidth.value = `calc(100% - ${chanSideWidth.value})`
        //초기 width 값과 마우스 드래그 거리를 더한 뒤 상위요소(container) 너비 이용해 퍼센티지 구해 left의 width로 적용
        //const newLeftWidth = ((leftWidth + dx) * 100) / resizer.parentNode.getBoundingClientRect().width
        //leftSide.style.width = `${newLeftWidth}%`
    }

    function mouseUpHandler() { //모든 커서 관련 사항은 마우스 이동이 끝나면 제거됨
        resizer.style.removeProperty('cursor')
        document.body.style.removeProperty('cursor')
        leftSide.style.removeProperty('user-select')
        leftSide.style.removeProperty('pointer-events')
        rightSide.style.removeProperty('user-select')
        rightSide.style.removeProperty('pointer-events')
        document.removeEventListener('mousemove', mouseMoveHandler)
        document.removeEventListener('mouseup', mouseUpHandler)
        localStorage.wiseband_lastsel_chansidewidth = chanSideWidth.value
    }
    //////////////////////////////////////마우스다운후 채널바 리사이징
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="kind" style="background:var(--second-color);color:var(--text-white-color);border:none">
                    <option value="my">내 채널</option>
                    <option value="other">다른 채널</option>
                    <option value="all">모든 채널</option>
                </select>
            </div>
            <div class="chan_side_top_right">
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('C')">
                    <img class="coImg20" :src="gst.html.getImageUrl(LIGHT + 'collapseall.png')" title="모두접기기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('E')">
                    <img class="coImg20" :src="gst.html.getImageUrl(LIGHT + 'expandall.png')" title="모두펼치기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="newMsg">
                    <img class="coImg20" :src="gst.html.getImageUrl(LIGHT + 'compose.png')" title="새메시지">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable"> <!-- gst.ctx.on=true처리후에는 @contextmenu.prevent 추가해도
            @mousedown.right.stop.prevent로 브라우저 컨텍스트메뉴가 100% 방지가 안되서 index.html <body>에서 막는 것으로 해결 -->
            <div v-for="(row, idx) in listChan" :id="row.DEPTH == '1' ? row.GR_ID : row.CHANID"
                @click="chanClick(row, idx)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div v-show="row.DEPTH == '1' || (row.DEPTH == '2' && row.exploded)" :class="['node', row.hover ? 'nodeHover' : '', , row.sel ? 'nodeSel' : '']">
                    <div class="coDotDot" :title="row.DEPTH == '1' ? row.GR_NM : row.CHANNM">
                        <img class="coImg14" :src="gst.html.getImageUrl(row.nodeImg)">
                        {{ row.DEPTH == '1' ? row.GR_NM : row.CHANNM }}
                    </div>
                    <div class="nodeRight">
                        <img v-if="row.notioffImg" class="coImg14" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off">
                        <img v-if="row.bookmarkImg" class="coImg14" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크">
                        <img v-if="row.otherImg" class="coImg14" :src="gst.html.getImageUrl(row.otherImg)" title="다른 채널">
                    </div>
                </div>
            </div>
        </div>
        <div style="color:white">{{ $route.fullPath }}</div>
    </div>
    <div class="resizer" id="dragMe" @mousedown="(e) => mouseDownHandler(e)"></div>
    <div class="chan_main" id="chan_main" :style="{ width: chanMainWidth }">  <!-- .vue마다 :key 및 keep-alive가 달리 구현되어 있음 -->
        <!-- App.vue와 Main.vue에서는 :key를 안쓰고 여기 Home.vue에서만 :key를 사용하는 이유는 HomeBody.vue에서 설명 -->
        <!-- <router-view :key="$route.fullPath"></router-view> -->
        <!-- <keep-alive><router-view :key="$route.fullPath"></router-view></keep-alive> keep-alive로 router 감싸는 것은 사용금지(Deprecated) -->
        <router-view v-slot="{ Component }">
            <keep-alive>
                <component :is="Component" :key="$route.fullPath" />
            </keep-alive>
        </router-view>
    </div>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>    
    .chan_side {
        height:100%; /* width는 resizing처리됨 */
        display:flex;flex-direction:column;background:var(--second-color);border-top-left-radius:10px;border-bottom-left-radius:10px;
    }
    .chan_side_top {
        width:100%;height:50px;display:flex;justify-content:space-between;
    }
    .chan_side_top_left {
        width:50%;height:100%;padding-left:10px;display:flex;align-items:center;
    }
    .chan_side_top_right {
        width:50%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
    }
    .chan_side_main {
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .node {
        width:calc(100% - 30px);min-height:36px;padding:0 10px;margin:0 5px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--text-white-color);border-radius:5px;cursor:pointer;
    }
    .nodeRight { display:flex;align-items:center;justify-content:flex-end; }
    .coImg20:hover { background:var(--second-hover-color); }
    .coImg20:active { background:var(--active-color);border-radius:9px }
    .nodeHover { background:var(--second-hover-color); }
    .nodeSel { background:var(--second-select-color);color:var(--primary-color); }
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px; /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
    .chan_main {
        height:100%;display:flex; /* width:100%;는 resizing처리됨 */
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
</style>
