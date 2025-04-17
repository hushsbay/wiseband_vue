<script setup>
    import { ref, onMounted, onActivated, watch } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
        
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    //1. Home 패널 상태 정의는 아래와 같음
    //   1) Depth는 1,2 단계만 존재 : 1단계는 사내 그룹 (슬랙의 워크스페이스) 2단계는 채널
    //   2) 트리노드는 펼치기/접기 상태 기억해 브라우저를 닫고 열어도 직전 상태를 유지 (예: 새로고침)
    //   3) 스크롤 위치도 2)와 마찬가지로 기억 => localStorage와 scrollIntoView() 이용해서 현재 클릭한 채널노드를 화면에 보이도록 함
    //2. Home에서는 HomeBody의 라우팅과 Sync를 맞춰야 하는 것이 핵심과제임 
    //   예를 들어, 뒤로 가면 라우팅이 HomeBody의 채널 심지어는 메시지아이디도 포함되어 있는데 여기에 맞춰 Home도 트리노드, 스크롤 등이 맞춰져야 함
    //   그런데, 문제는 사이드메뉴 '홈'을 누르면 Home이 먼저 호출되고 HomeBody가 나중 호출되는데 뒤로 가기 누르면 HomeBody가 먼저 호출되는 경우가 많음
    //   HomeBody가 먼저 호출되면 채널이 정해지므로 Home에게 어느 채널로 가라고 전달되는데 Home이 먼저 호출되면 
    //3. 상태를 가져오는 경우는 아래와 같음 : localStorage는 save후 1)3)에서 recall함
    //   1) 페이지 처음 열린 경우 및 새로 고침 : onMounted
    //   2) 뒤로가기시 HomeBody가 A채널에서 B채널로 가는 경우 : 기존 B채널의 데이터가 캐싱되므로 그때 HomeBody의 스크롤/선택상태를 가져옴
    //   3) 사이드메뉴에서 직접 홈을 누를 경우는 HomeBody가 아닌 Home이 라우팅되므로 그 홈에서 마지막 열었던 채널을 클릭해주면 됨

    let scrollArea = ref(null), chanRow = ref({}) //chanRow는 element를 동적으로 할당받아 ref에 사용하려고 하는 것임
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
            if (lastSelKind) gst.kindHome = lastSelKind
            await getList() //여기서만 호출
            //recallScrollY()
            chanClickOnLoop()
            gst.resize.getEle(resizeEle, 'main_side', 'dragMe', 'chan_side', 'chan_main') //패널 리사이징
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else {
            setBasicInfo()
            if (route.path == "/main/home") { //사이드메뉴 '홈'을 누르면 Home이 먼저 호출되고 HomeBody가 나중 호출됨
                //recallScrollY()
                chanClickOnLoop()
            } else { //여기가 HomeBody가 라우팅되는 루틴인데 뒤로가기 누르면 열려 있었던 이전 채널이 표시됨
                //스크롤 recall은 여기가 아닌 아래 watch에서 수행
            }
        }
    })

    watch([() => gst.selChanHome], () => { //HomeBody -> GeneralStore -> 여기 watch로 전달
        //Home에서 클릭한 채널노드의 상태를 기억하는데 뒤로가기하면 HomeBody의 라우팅에서 처리하는 것이 효율적임
        //scrollArea.value.scrollTop = gst.scrollyHome   
        chanRow.value[gst.selChanHome].scrollIntoView({ behavior: "smooth", block: "nearest" })
        chanClick(null, null, gst.selChanHome)
    })

    watch(() => gst.kindHome, async () => {
        localStorage.wiseband_lastsel_kind = gst.kindHome
        await getList() 
        chanClickOnLoop()
    })

    // watch([() => gst.selChanId, () => gst.selGrId], () => { //onMounted보다 더 먼저 수행되는 경우임 (디버거로 확인)
    //     displayChanAsSelected(gst.selChanId, gst.selGrId) //채널트리간 Back()시 사용자가 선택한 것으로 표시해야 함
    // }) //HomeBody.vue의 $$44 참조

    // watch(() => gst.selSideMenuTimeTag, () => { //router index.js에서만 전달받음 (Main.vue에서 홈 등 사이드메뉴 클릭시 캐시 가져오기)
    //     console.log(gst.selSideMenuTimeTag + " == gst.selSideMenuTimeTag########watch in home.vue")
    //     loopListChan(gst.selGrId, gst.selChanId)
    // }) ##87 지우지 말 것 : selSideMenuTimeTag 대신 onActivated() 사용해 해결 - keepalive인 경우임

    function setBasicInfo() {
        document.title = "WiSEBand 홈"
        gst.selSideMenu = "mnuHome" //HomeBody.vue에 Blank 방지
    }

    // function recallScrollY() {
    //     if (localStorage.wiseband_home_scroll) {
    //         setTimeout(function() { 
    //             scrollArea.value.scrollTop = parseInt(localStorage.wiseband_home_scroll) 
    //         }, 1) //비동기로 하지 않으면 값이 0으로 설정됨 (어느 부분에서 0으로 되는지 파악 필요)
    //     }
    // }

    const onScrollEnd = () => { //saveScrollY
        //localStorage.wiseband_home_scroll = scrollArea.value.scrollTop
    }

    function chanClickOnLoop() {
        const arr = (!localStorage.wiseband_exploded_grid) ? [] : localStorage.wiseband_exploded_grid.split(",")
        gst.listHome.forEach((item, index) => { //depth1,2 모두 GR_ID 가지고 있음
            if (arr) { //onMounted때만 해당
                if (arr.indexOf(item.GR_ID) == -1) {
                    item.exploded = false
                } else {
                    item.exploded = true
                }
                procChanRowImg(item)
            }
            if (item.CHANID == localStorage.wiseband_lastsel_chanid) {
                chanRow.value[item.CHANID].scrollIntoView({ behavior: "smooth", block: "nearest" })
                chanClick(item, index)
            }
        })
    }

    async function getList() {
        try {  
            const res = await axios.post("/menu/qryChan", { kind : gst.kindHome }) //my,other,all
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.listHome = rs.list
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

    async function chanClick(row, idx, chanid) { //depth 1,2를 미리 filter해서 하지 말기
        try { //chanid 파라미터는 depth2에만 해당
            if (!chanid && row.DEPTH == "1") { //접기 or 펼치기
                row.exploded = (row.exploded) ? false : true
                procChanRowImg(row)
                for (let i = idx + 1; i < gst.listHome.length; i++) {
                    if (gst.listHome[i].DEPTH == "1") break
                    gst.listHome[i].exploded = row.exploded
                }                
                const arr = [] //브라우저 재실행해도 접기/펼치기 상태 기억해서 그대로 표시하기
                gst.listHome.forEach((item) => {
                    if (item.DEPTH == "1" && item.exploded) arr.push(item.GR_ID)
                })
                localStorage.wiseband_exploded_grid = arr.length == 0 ? "" : arr.join(',')                
            } else {
                gst.listHome.forEach((item) => {
                    if (item.DEPTH == "2") {
                        item.sel = false
                        item.hover = false
                        procChanRowImg(item)
                    }
                })
                if (chanid) { //Back()경우, HomeBody에 열린 채널의 원래 스크롤값을 watch에서 가져온 후 여기로 와서 채널노드의 색상 선택
                    const row1 = gst.listHome.find((item) => item.CHANID == chanid)
                    if (row1) {
                        row1.sel = true
                        procChanRowImg(row1)
                        localStorage.wiseband_lastsel_chanid = chanid
                    }
                } else {
                    row.sel = true
                    procChanRowImg(row)
                    localStorage.wiseband_lastsel_chanid = row.CHANID
                    //if (!gst.objHome[row.CHANID]) gst.objHome[row.CHANID] = {}
                    //setTimeout(function() { gst.objHome[row.CHANID].scrollY = scrollArea.value.scrollTop }, 500)
                    //debugger
                    await goHomeBody(row)
                }
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function goHomeBody(row, refresh) {
        let obj = { name : 'home_body', params : { chanid: row.CHANID }} //grid: row.GR_ID, 
        if (refresh) Object.assign(obj, { query : { ver: Math.random() }})
        const ele = document.getElementById("chan_center_header") //chan_center_body
        if (!ele || ele.innerHTML == "") { //HomeBody.vue에 있는 chan_center_header이 없다는 것은 빈페이지로 열려 있다는 것이므로 히스토리에서 지워야 back()할 때 빈공간 안나타남
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
        for (let i = 0; i < gst.listHome.length; i++) {
            gst.listHome[i].exploded = exploded
            procChanRowImg(gst.listHome[i])
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="gst.kindHome" style="background:var(--second-color);color:var(--text-white-color);border:none">
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
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scrollend="onScrollEnd">
            <!-- gst.ctx.on=true처리후에는 @contextmenu.prevent 추가해도 @mousedown.right.stop.prevent로 브라우저 컨텍스트메뉴가 100% 방지가 안되서 index.html <body>에서 막는 것으로 해결 -->
            <div v-for="(row, idx) in gst.listHome" :id="row.DEPTH == '1' ? row.GR_ID : row.CHANID"
                :ref="(ele) => { chanRow[row.DEPTH == '1' ? row.GR_ID : row.CHANID] = ele }"
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
    .node { /* min-height:36px */
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
