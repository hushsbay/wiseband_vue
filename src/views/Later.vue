<script setup>
    import { ref, onMounted, onActivated, nextTick } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
        
    const router = useRouter()
    const gst = GeneralStore()

    const LIGHT = "whitesmoke_", DARK = "violet_"

    //목록의 순서때문에 Object나 Map을 이용하기 어려워 v-for에서는 주로 Array를 이용해 업뎃을 하는데 크기가 클수록 msigid를 찾는데 시간이 더 걸리는 구조임
    //{ "327846325832467" : 0(항목인덱스) .. } 식으로는 (항목 삭제도 없고 push만 있어야 가능한데 splice도 있으니 index 변함) 어려움
    //1) 마우스오버 및 클릭시 색상 변경 등은 { "327846325832467": { hover: true, sel: false }.. } 으로 가능하므로 최대한 object로 처리하도록 노력
    //2) 나머지는 육안으로 화면에 보이는 것만 업데이트 등을 고려했으나 
    //사실, EndlessScroll해봤자 10000개를 넘으면 많은 것일테니 루프 도는데 크게 부담갖지 말고 처리하기로 함
    
    let scrollArea = ref(null)
    let mounting = true, savLastMsgMstCdt = gst.cons.cdtAtLast //가장 최근 일시
    let prevScrollY, prevScrollHeight

    //패널 리사이징 : 다른 vue에서 필요시 나머지 유지하되 localStorage이름만 바꾸면 됨
    let chanSideWidth = ref(localStorage.wiseband_lastsel_latersidewidth ?? '300px')
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
        localStorage.wiseband_lastsel_latersidewidth = chanSideWidth.value
    }
    //////////////////////////////////////////////////////////////////////////////////////

    onMounted(async () => {
        try {
            setBasicInfo()
            await getList(localStorage.wiseband_lastsel_later, true)            
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
            if (gst.objSaved[gst.kindLater]) scrollArea.value.scrollTop = gst.objSaved[gst.kindLater].scrollY
        }
    })

    function setBasicInfo() {
        document.title = "WiSEBand 나중에"
        gst.selSideMenu = "mnuLater" //HomeBody.vue에 Blank 방지
    }

    function saveCurScrollY(posY) {
        if (!gst.objSaved[gst.kindLater]) gst.objSaved[gst.kindLater] = {}
        gst.objSaved[gst.kindLater].scrollY = posY
    }

    const onScrollEnd = async (e) => { //scrollend 이벤트이므로 debounce가 필요없음 //import { debounce } from 'lodash'
        const sTop = scrollArea.value.scrollTop 
        const which = (prevScrollY && sTop <= prevScrollY) ? "up" : "down" //e로 찾아도 있을 것임
        prevScrollY = sTop
        saveCurScrollY(prevScrollY)
        if (which == "up" && sTop < 200) { //스크롤이 위 방향으로 특정 위치(이하)로 오게 되면 실행
            prevScrollHeight = scrollArea.value.scrollHeight
            await getList(gst.kindLater)
        }
    }

    async function getList(kindStr, refresh) {
        try {
            if (refresh || gst.kindLater != kindStr) {
                gst.kindLater = kindStr ? kindStr : "later"
                localStorage.wiseband_lastsel_later = gst.kindLater
                gst.listLater = []
                savLastMsgMstCdt = gst.cons.cdtAtLast
            }
            const lastMsgMstCdt = savLastMsgMstCdt
            const res = await axios.post("/menu/qryLater", { kind: gst.kindLater, lastMsgMstCdt: lastMsgMstCdt })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]                
                if (row.PICTURE == null) {
                    row.url = null
                } else {
                    row.url = hush.util.getImageBlobUrl(row.PICTURE.data)
                }
                gst.listLater.splice(0, 0, row) //jQuery prepend와 동일 (메시지리스트 맨 위에 삽입)
                if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
            }
            await nextTick()
            if (lastMsgMstCdt == gst.cons.cdtAtLast) { //맨 처음엔 최신인 맨 아래로 스크롤 이동
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (lastMsgMstCdt) { //1) 이후에 스크롤 위로 올려서 이전 데이터를 가지고 오면 높이가 커지면서
                if (rs.list.length > 0) { //직전에 육안으로 보고 있던 이전 행이 안보이게 되는데 그걸 해결하기 위해
                    //prevScrollY(이전 위치) + 새로 더해진 scrollHeight을 더해서 scrollArea의 scrollTop으로 주면 됨
                    scrollArea.value.scrollTop = (scrollArea.value.scrollHeight - prevScrollHeight) + prevScrollY
                } //2) 이게 만일 최신일자순으로 위에서부터 뿌리면 스크롤 아래로 내릴 때 데이터 가져오는 거라면 계산할 필요도 없이 육안으로 그냥 보이게 하면 될 것임
                //일단 슬랙의 오른쪽 메인의 메시지 목록이 위로 올라가면서 EndlessScroll를 하므로 여기도 동일한 UX(1)로 해 본 것임
            }
            gst.later.getCount() //진행중인 (나중에) 카운팅
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    async function laterClick(row, idx, refresh) { //채널트리와 다르게 여기선 최초 로드시에도 이전 선택한 행을 기억하지 않고
        try { //오른쪽 공간을 공백으로 두기로 함 (필요하면 localStorage 등을 사용하면 되나 나중에/고정 조회 화면까지 그럴 필요는 없어 보임)
            gst.listLater.map((item) => {
               item.sel = false
               item.hover = false
            })
            row.sel = true
            await goHomeBody(row, refresh)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function goHomeBody(row, refresh) { //댓글 클릭시는 댓글 MSGID로 호출됨
        let obj = { name : 'later_body', params : { grid: row.GR_ID, chanid: row.CHANID, msgid: row.MSGID }}
        if (refresh) Object.assign(obj, { query : { ver: Math.random() }})
        const ele = document.getElementById("chan_center_body")
        if (!ele || ele.innerHTML == "") { //HomeBody.vue에 있는 chan_center_body이 없다는 것은 빈페이지로 열려 있다는 것이므로 
            await router.replace(obj) //히스토리에서 지워야 back()할 때 빈공간 안나타남
        } else {
            await router.push(obj)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "채널 새로고침", func: function(item, idx) {
                goHomeBody(row, true)
            }},
            { nm: "홈에서 열기", func: function(item, idx) {
                
            }},
            { nm: "새창에서 열기", func: function(item, idx) {

            }},
            { nm: "보관", disable: (gst.kindLater == "stored") ? true : false, func: function(item, idx) {

            }},
            { nm: "완료", disable: (gst.kindLater == "finished") ? true : false, func: function(item, idx) {

            }},
            { nm: "진행", disable: (gst.kindLater == "later") ? true : false, func: function(item, idx) {

            }},
            { nm: "'나중에'에서 제거", func: function(item, idx) {

            }},
        ]            
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
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">나중에</div>
            <div class="chan_side_top_right">
                <div style="padding:3px;margin-left:10px;color:whitesmoke" @click="getList('later', true)"
                    :style="{ borderBottom: (gst.kindLater == 'later') ? '3px solid white' : '3px solid rgb(90, 46, 93)' }">
                    진행중<span style="margin-left:3px">{{ gst.cntLater }}</span>
                </div>
                <div style="padding:3px;margin-left:10px;color:whitesmoke" @click="getList('stored', true)"
                    :style="{ borderBottom: (gst.kindLater == 'stored') ? '3px solid white' : '3px solid rgb(90, 46, 93)' }">
                    보관됨<span style="margin-left:3px"></span>
                </div>
                <div style="padding:3px;margin-left:10px;color:whitesmoke" @click="getList('finished', true)"
                    :style="{ borderBottom: (gst.kindLater == 'finished') ? '3px solid white' : '3px solid rgb(90, 46, 93)' }" >
                    완료됨<span style="margin-left:3px"></span>
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" ref="scrollArea" @scrollend="onScrollEnd">
            <div v-for="(row, idx) in gst.listLater" :key="row.MSGID" :id="row.MSGID" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']"
                style="padding:10px;display:flex;flex-direction:column;border-bottom:1px solid dimgray;cursor:pointer"                 
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
                <div class="coDotDot"> <!-- 원래 coDotDot으로만 해결되어야 하는데 데이터가 있으면 넓이가 예) 1px 늘어나 육안으로 흔들림 -->
                    <div style="width:100px;color:white">{{ row.BODYTEXT }}</div> <!-- 이 행은 임시 조치임. 결국 슬랙의 2행 ellipsis를 못해냈는데 나중에 해결해야 함 -->
                </div>
            </div>
        </div>
    </div>
    <div class="resizer" id="dragMe" @mousedown="(e) => downHandler(e)"></div>
    <div class="chan_main" id="chan_main" :style="{ width: chanMainWidth }">
        <!-- App.vue와 Main.vue에서는 :key를 안쓰고 Home.vue, Later.vue 등에서만 :key를 사용하는 이유는 HomeBody.vue에서 설명 -->
        <!-- keep-alive로 router 감싸는 것은 사용금지(Deprecated) -->
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
        display:flex;flex-direction:column;background:var(--second-color);border-top-left-radius:10px;border-bottom-left-radius:10px
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
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto
    }
    .node {
        width:100%;height:45px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--text-white-color);cursor:pointer
    }
    .nodeHover, .nodeSel { background:var(--second-hover-color) }
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
    .chan_main {
        height:100%;display:flex; /* width:100%;는 resizing처리됨 */
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px
    }
</style>
