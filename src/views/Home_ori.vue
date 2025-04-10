<script setup>
    import { ref, onMounted, onActivated, watch } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
        
    const router = useRouter()
    const gst = GeneralStore()

    let kind = ref('my'), listChan = ref([])
    let mounting = true

    /////////////////////////////패널 리사이징 : 다른 vue에서 필요시 localStorage만 바꾸면 됨
    let chanSideWidth = ref(localStorage.wiseband_lastsel_chansidewidth ?? '300px')
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')
    const resizeEle = { mainSide: null, resizer: null, leftSide: null, rightSide: null }
    const resizeObj = { mainSideWidth: 0, posX: 0, leftWidth: 0 }

    function downHandler(e) {
        gst.resize.downHandler(e, resizeEle, resizeObj, moveHandler, upHandler)
    }

    function moveHandler(e) {
        const dx = gst.resize.moveHandler(e, resizeEle, resizeObj)
        chanSideWidth.value = `${resizeObj.leftWidth + dx + resizeObj.mainSideWidth}px`
        chanMainWidth.value = `calc(100% - ${chanSideWidth.value})`
    }

    function upHandler() {
        gst.resize.upHandler(resizeEle, moveHandler, upHandler)
        localStorage.wiseband_lastsel_chansidewidth = chanSideWidth.value
    }
    //////////////////////////////////////////////////////////////////////////////////////

    onMounted(async () => {
        try {
            setBasicInfo()
            const lastSelKind = localStorage.wiseband_lastsel_kind
            if (lastSelKind) kind.value = lastSelKind
            await getList()
            gst.resize.getEle(resizeEle, 'main_side', 'dragMe', 'chan_side', 'chan_main') //패널 리사이징
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            loopListChan(localStorage.wiseband_lastsel_grid, localStorage.wiseband_lastsel_chanid)
        }
    })

    watch(kind, async () => {
        localStorage.wiseband_lastsel_kind = kind.value
        await getList() 
    })

    watch([() => gst.selChanId, () => gst.selGrId], () => { //onMounted보다 더 먼저 수행되는 경우임 (디버거로 확인)
        displayChanAsSelected(gst.selChanId, gst.selGrId) //채널트리간 Back()시 사용자가 선택한 것으로 표시해야 함
    }) //HomeBody.vue의 $$44 참조

    // watch(() => gst.selSideMenuTimeTag, () => { //router index.js에서만 전달받음 (Main.vue에서 홈 등 사이드메뉴 클릭시 캐시 가져오기)
    //     console.log(gst.selSideMenuTimeTag + " == gst.selSideMenuTimeTag########watch in home.vue")
    //     loopListChan(gst.selGrId, gst.selChanId)
    // }) ##87 지우지 말 것 : selSideMenuTimeTag 대신 onActivated() 사용해 해결 - keepalive인 경우임

    function setBasicInfo() {
        document.title = "WiSEBand 홈"
        gst.selSideMenu = "mnuHome" //HomeBody.vue에 Blank 방지
    }

    function loopListChan(grid, chanid, refresh) { //getList()에서 호출하는 것은 onMounted()이므로 캐싱 아님. onActivated()에서 부르는 것은 캐싱임
        try {
            listChan.value.forEach((item, index) => {
                if (item.GR_ID == grid) {
                    item.exploded = true
                    if (item.CHANID == chanid) {
                        chanClick(item, index, refresh)
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
            loopListChan(localStorage.wiseband_lastsel_grid, localStorage.wiseband_lastsel_chanid, true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function procChanRowImg(item) { //svg는 이미지 컬러링이 가능하나 핸들링이 쉽지 않아 png로 별도 이미지 교체로 처리
        if (item.DEPTH == "1") {
            item.nodeImg = item.exploded ? hush.cons.color_light + "expanded.png" : hush.cons.color_light + "collapsed.png"
            item.notioffImg = ""
            item.bookmarkImg = ""
            item.otherImg = ""
        } else {
            if (item.CHANID == null) {
                item.nodeImg = hush.cons.color_light + "channel.png"
                item.notioffImg = ""
                item.bookmarkImg = ""
                item.otherImg = ""
                item.CHANNM = "없음"
            } else {
                item.nodeImg = (item.STATE == "A") ? "channel.png" : "lock.png"
                item.notioffImg = (item.NOTI == "X") ? "notioff.png" : ""
                item.bookmarkImg = (item.BOOKMARK == "Y") ? "bookmark.png" : ""
                item.otherImg = (item.OTHER == "other") ? "other.png" : ""
                const color = item.sel ? hush.cons.color_dark : hush.cons.color_light
                item.nodeImg = color + item.nodeImg
                if (item.notioffImg) item.notioffImg = color + item.notioffImg
                if (item.bookmarkImg) item.bookmarkImg = color + item.bookmarkImg
                if (item.otherImg) item.otherImg = color + item.otherImg
            }
        }
    }

    async function chanClick(row, idx, refresh) {
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
                localStorage.wiseband_lastsel_chanid = row.CHANID
                await goHomeBody(row, refresh)
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

    async function goHomeBody(row, refresh) {
        let obj = { name : 'home_body', params : { grid: row.GR_ID, chanid: row.CHANID }}
        if (refresh) Object.assign(obj, { query : { ver: Math.random() }})
        const ele = document.getElementById("chan_center_body")
        if (!ele || ele.innerHTML == "") { //HomeBody.vue에 있는 chan_nm이 없다는 것은 빈페이지로 열려 있다는 것이므로 히스토리에서 지워야 back()할 때 빈공간 안나타남
            await router.replace(obj) //HomeBody.vue가 들어설 자리가 blank로 남아 있는데 실행시는 안보이는데 Back()에서는 보임. 이걸 해결하기 위해 replace 처리함
        } else {
            await router.push(obj)
        }
    }

    async function mouseRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        const img = row.nodeImg.replace(hush.cons.color_light, hush.cons.color_dark)        
        const nm = !row.CHANID ? row.GR_NM : row.CHANNM
        gst.ctx.data.header = "<img src='/src/assets/images/" + img + "' class='coImg18' style='margin-right:5px'>" + "<span>" + nm + "</span>"
        if (!row.CHANID) {            
            gst.ctx.menu = [
                { nm: "채널 생성" },
                { nm: "환경 설정" }
            ]
        } else {
            gst.ctx.menu = [
                { nm: "채널 새로고침", func: function(item, idx) {
                    goHomeBody(row, true)
                }},
                { nm: "채널정보 보기", func: function(item, idx) {

                }},
                { nm: "즐겨찾기" },
                { nm: "사용자 초대" },
                { nm: "복사", img: hush.cons.color_dark + "other.png", child: [
                    { nm: "채널 복사", func: function(item, idx) { 
                        
                    }},
                    { nm: "링크 복사" }
                ]},                
                { nm: "채널 나가기", color: "red" }
            ]            
        }
        gst.ctx.show(e)
    }

    function mouseEnter(row) {
        if (row.sel) return
        row.hover = true
    }

    function mouseLeave(row) {
        if (row.sel) return
        row.hover = false
    }

    function procExpCol(type) { //모두필치기,모두접기
        const exploded = (type == "E") ? true : false
        for (let i = 0; i < listChan.value.length; i++) {
            listChan.value[i].exploded = exploded
            procChanRowImg(listChan.value[i])
        }
    }
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
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'collapseall.png')" title="모두접기기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('E')">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'expandall.png')" title="모두펼치기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="newMsg">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'compose.png')" title="새메시지">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable"> <!-- gst.ctx.on=true처리후에는 @contextmenu.prevent 추가해도
            @mousedown.right.stop.prevent로 브라우저 컨텍스트메뉴가 100% 방지가 안되서 index.html <body>에서 막는 것으로 해결 -->
            <div v-for="(row, idx) in listChan" :id="row.DEPTH == '1' ? row.GR_ID : row.CHANID"
                @click="chanClick(row, idx)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div v-show="row.DEPTH == '1' || (row.DEPTH == '2' && row.exploded)" :class="['node', row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']">
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
    </div>
    <div class="resizer" id="dragMe" @mousedown="(e) => downHandler(e)"></div>
    <div class="chan_main" id="chan_main" :style="{ width: chanMainWidth }">
        <!-- App.vue와 Main.vue에서는 :key를 안쓰고 Home.vue, Later.vue 등에서만 :key를 사용 (HomeBody.vue에서 설명) / keep-alive로 router 감싸는 것은 사용금지(Deprecated) -->
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
