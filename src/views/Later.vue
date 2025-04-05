<script setup>
    import { ref, onMounted, onActivated, nextTick } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    
    const gst = GeneralStore()
    const router = useRouter()

    const LIGHT = "whitesmoke_", DARK = "violet_"

    let kind = ref('later'), listLater = ref([]), cntLater = ref(-1)
    let mounting = true
    const scrollArea = ref(null)
    let savLastMsgMstCdt = gst.cons.cdtAtLast //가장 최근 일시
    let prevScrollY, prevScrollHeight

    //아래는 resizing 관련
    let chanSideWidth = ref(localStorage.wiseband_lastsel_chansidewidth ?? '300px')
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')
    let mainSide, resizer, leftSide, rightSide, mainSideWidth, posX = 0, leftWidth = 0

    onMounted(async () => { //Main.vue와는 달리 라우팅된 상태에서 Back()을 누르면 여기가 실행됨
        try {
            setBasicInfo()
            await getList(localStorage.wiseband_lastsel_later)
            //mainSide = document.getElementById('main_side') //Main.vue 참조
            //resizer = document.getElementById('dragMe') //vue.js npm 사용해봐도 만족스럽지 못해 자체 구현 소스 참조해 vue 소스로 응용
            //leftSide = document.getElementById('chan_side') //resizer.previousElementSibling
            //rightSide = document.getElementById('chan_main') //resizer.nextElementSibling
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => { //초기 마운트 또는 캐시상태에서 다시 삽입될 때마다 호출 : onMounted -> onActivated 순으로 호출됨
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()시에는 실행되지 않도록 함 (onActivated()시에는 onMounted()내 실행이 안되도록 함)
            setBasicInfo()
            if (gst.objSaved[kind.value]) {
                scrollArea.value.scrollTop = gst.objSaved[kind.value].scrollY
            }
        }
    })

    function setBasicInfo() {
        document.title = "WiSEBand 나중에" //다른 곳에서 title이 업데이트 될 것임
        gst.selSideMenu = "mnuLater" //이 행이 없으면 DM 라우팅후 Back()후 홈을 누르면 이 값이 mnuDm이므로 HomeBody.vue에 Balnk가 표시됨
    }

    function saveCurScrollY(posY) {
        if (!gst.objSaved[kind.value]) gst.objSaved[kind.value] = {}
        gst.objSaved[kind.value].scrollY = posY
    }

    const onScrollEnd = async (e) => { //scrollend 이벤트이므로 debounce가 필요없음 //import { debounce } from 'lodash'
        const sTop = scrollArea.value.scrollTop 
        const which = (prevScrollY && sTop <= prevScrollY) ? "up" : "down" //e로 찾아도 있을 것임
        prevScrollY = sTop
        saveCurScrollY(prevScrollY)
        if (which == "up" && sTop < 200) { //스크롤이 위 방향으로 특정 위치(이하)로 오게 되면 실행
            prevScrollHeight = scrollArea.value.scrollHeight
            await getList(kind.value)
        }
    }

    async function getList(kindStr) {
        try {
            if (kind.value != kindStr) {
                kind.value = kindStr ? kindStr : "later"
                localStorage.wiseband_lastsel_later = kind.value
                listLater.value = []
                savLastMsgMstCdt = gst.cons.cdtAtLast
            }
            const lastMsgMstCdt = savLastMsgMstCdt
            const res = await axios.post("/menu/qryLater", { kind: kind.value, lastMsgMstCdt: lastMsgMstCdt })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]                
                if (row.PICTURE == null) {
                    row.url = null
                } else {
                    row.url = hush.util.getImageBlobUrl(row.PICTURE.data)
                }
                listLater.value.splice(0, 0, row) //jQuery의 prepend와 동일 (메시지리스트 맨 위에 삽입)
                if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
            }
            await nextTick()
            if (lastMsgMstCdt == gst.cons.cdtAtLast) {
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (lastMsgMstCdt) {
                if (rs.list.length > 0) {
                    scrollArea.value.scrollTop = (scrollArea.value.scrollHeight - prevScrollHeight) + prevScrollY
                } else {
                    //스크롤 위치는 그대로임 //scrollArea.value.scrollTop = prevScrollY
                }
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    async function laterClick(row, idx, refresh) {
        try {
            listLater.value.map((item) => {
                item.sel = false
                item.hover = false
            })
            row.sel = true
            //localStorage.wiseband_lastsel_grid = row.GR_ID
            //localStorage.wiseband_lastsel_chanid = row.CHANID
            await goHomeBody(row, refresh)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function goHomeBody(row, refresh) {
        let obj = { name : 'home_body_later', params : { grid: row.GR_ID, chanid: row.CHANID, msgid: row.MSGID }}
        if (refresh) Object.assign(obj, { query : { ver: Math.random() }})
        const ele = document.getElementById("chan_center_body")
        if (!ele || ele.innerHTML == "") { //HomeBody.vue에 있는 chan_nm이 없다는 것은 빈페이지로 열려 있다는 것이므로 히스토리에서 지워야 back()할 때 빈공간 안나타남
            await router.replace(obj) //HomeBody.vue가 들어설 자리가 blank로 남아 있는데 실행시는 안보이는데 Back()에서는 보임. 이걸 해결하기 위해 replace 처리함
        } else {
            await router.push(obj)
        }
    }

    async function mouseRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "홈에서 열기", func: function(item, idx) {
                
            }},
            { nm: "새창에서 열기", func: function(item, idx) {

            }},
            { nm: "보관", disable: (kind.value == "stored") ? true : false, func: function(item, idx) {

            }},
            { nm: "완료", disable: (kind.value == "finished") ? true : false, func: function(item, idx) {

            }},
            { nm: "진행", disable: (kind.value == "later") ? true : false, func: function(item, idx) {

            }},
            { nm: "'나중에'에서 제거", func: function(item, idx) {

            }},
        ]            
        gst.ctx.show(e)
    }

    function mouseEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        if (row.sel) return
        row.hover = true
    }

    function mouseLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        if (row.sel) return
        row.hover = false
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
            <div class="chan_side_top_left">나중에</div>
            <div class="chan_side_top_right">
                <div style="padding:3px;margin-left:10px;color:whitesmoke" @click="getList('later')"
                    :style="{ borderBottom: (kind == 'later') ? '3px solid white' : '3px solid rgb(90, 46, 93)' }">
                    진행중<span style="margin-left:3px">{{ cntLater }}</span>
                </div>
                <div style="padding:3px;margin-left:10px;color:whitesmoke" @click="getList('stored')"
                    :style="{ borderBottom: (kind == 'stored') ? '3px solid white' : '3px solid rgb(90, 46, 93)' }">
                    보관됨<span style="margin-left:3px"></span>
                </div>
                <div style="padding:3px;margin-left:10px;color:whitesmoke" @click="getList('finished')"
                    :style="{ borderBottom: (kind == 'finished') ? '3px solid white' : '3px solid rgb(90, 46, 93)' }" >
                    완료됨<span style="margin-left:3px"></span>
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" ref="scrollArea" @scrollend="onScrollEnd">
            <div v-for="(row, idx) in listLater" :id="row.MSGID" style="padding:10px;display:flex;flex-direction:column;border-bottom:1px solid dimgray;cursor:pointer" 
                :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']"
                @click="laterClick(row, idx)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;color:lightgray">
                        <img class="coImg14" :src="gst.html.getImageUrl(LIGHT + ((row.STATE == 'A') ? 'channel.png' : 'lock.png'))">
                        {{ row.CHANNM }} 
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        {{ row.REPLYTO ? '댓글' : '' }}
                    </div>
                </div>
                <div class="node">
                    <div style="display:flex;align-items:center">
                        <img v-if="row.url" :src="row.url" style='width:32px;height:32px;border-radius:16px'>
                        <img v-else :src="gst.html.getImageUrl('user.png')" style='width:32px;height:32px'>
                        <div style="color:whitesmoke;font-weight:bold;margin-left:5px">{{ row.AUTHORNM }}</div>    
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        {{ hush.util.displayDt(row.CDT, false) }}
                    </div>
                </div>
                <div class="coDotDot"> <!-- 원래 coDotDot으로만 해결되어야 하는데 데이터가 있으면 넓이가 예) 1px 늘어남 -->
                    <div style="width:100px;color:white">{{ row.BODYTEXT }}</div> <!-- 이 행은 임시 조치임. 결국 슬랙의 2행 ellipsis를 못해냈는데 나중에 해결해야 함 -->
                </div>
            </div>
        </div>
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
        width:100%;height:50px;display:flex;justify-content:space-between;border-bottom:1px solid lightgray;cursor:pointer
    }
    .chan_side_top_left {
        width:20%;height:100%;padding-left:10px;display:flex;align-items:center;font-size:18px;font-weight:bold;color:white
    }
    .chan_side_top_right {
        width:80%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
    }
    .chan_side_main {
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .node {
        width:100%;height:45px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--text-white-color);cursor:pointer;
    }
    .nodeRight { display:flex;align-items:center;justify-content:flex-end; }
    .coImg20:hover { background:var(--second-hover-color); }
    .coImg20:active { background:var(--active-color);border-radius:9px }
    .nodeHover, .nodeSel { background:var(--second-hover-color); }
    /* .nodeSel { background:var(--second-hover-color); } */
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px; /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
    .chan_main {
        height:100%;display:flex; /* width:100%;는 resizing처리됨 */
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
</style>
