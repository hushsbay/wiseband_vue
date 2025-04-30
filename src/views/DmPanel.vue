<script setup>
    import { ref, onMounted, onActivated, onUnmounted, nextTick } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import MemberPiclist from "/src/components/MemberPiclist.vue"
    import Resizer from "/src/components/Resizer.vue"
        
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    let observerBottom = ref(null), observerBottomTarget = ref(null)
    let afterScrolled = ref(false)

    const msglistRef = ref(null), notyetChk = ref(false), searchWord = ref('')
    let scrollArea = ref(null), chanRow = ref({}) //chanRow는 element를 동적으로 할당
    let mounting = true, savLastMsgMstCdt = hush.cons.cdtAtLast //가장 최근 일시
    let onGoingGetList = false

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_dmsidewidth ?? '300px') //localStorage 이름 유의
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')

    function handleFromResizer(chanSideVal, chanMainVal) {
        chanSideWidth.value = chanSideVal
        chanMainWidth.value = chanMainVal
    }
    //////////////////////////////////////////////////////////////////////////////////////

    const observerBottomScroll = () => {
        observerBottom.value = new IntersectionObserver(async (entry) => {
            if (entry[0].isIntersecting) {
                await getList()
            } else {
                return
            }
        })
        observerBottom.value.observe(observerBottomTarget.value)
    }

    onMounted(async () => {
        try {
            setBasicInfo()
            notyetChk.value = (localStorage.wiseband_lastsel_dm == "notyet") ? true : false
            await getList(true)            
            observerBottomScroll()
            dmClickOnLoop(true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/dm") {
                dmClickOnLoop()
            } else {
                //MsgList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
            }
        }
        observerBottomScroll()
    })

    onUnmounted(() => {
        observerBottom.value.disconnect()
    })

    function setBasicInfo() {
        document.title = "WiSEBand DM"
        gst.selSideMenu = "mnuDm" //MsgList.vue에 Blank 방지
    }

    const onScrolling = () => {
        if (!afterScrolled.value) afterScrolled.value = true
    }

    function procChangedQuery() {
        localStorage.wiseband_lastsel_dm = (notyetChk.value) ? "notyet" : "all"
        getList(true)
    }

    function procClearSearch() {
        if (searchWord.value == "") getList(true)
    }

    function procSearchQuery() {
        getList(true)
    }
    
    async function getList(refresh) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            gst.kindDm = localStorage.wiseband_lastsel_dm
            const search = searchWord.value.trim()
            if (refresh) {
                gst.listDm = []
                savLastMsgMstCdt = hush.cons.cdtAtLast
            }
            const lastMsgMstCdt = savLastMsgMstCdt
            const res = await axios.post("/menu/qryDm", { kind: gst.kindDm, search: search, lastMsgMstCdt: lastMsgMstCdt })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) {
                onGoingGetList = false
                return                
            }
            if (rs.list.length == 0) {
                onGoingGetList = false
                afterScrolled.value = false
                return
            }
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]
                for (let i = 0; i < row.picture.length; i++) {
                    if (row.picture[i] == null) {
                        row.url[i] = null
                    } else {
                        row.url[i] = hush.util.getImageBlobUrl(row.picture[i].data)
                    }
                }                
                //row.notioffImg = (row.NOTI == "X") ? hush.cons.color_light + "notioff.png" : ""
                //row.bookmarkImg = (row.BOOKMARK == "Y") ? hush.cons.color_light + "bookmark.png" : ""
                procChanRowImg(row)
                gst.listDm.push(row)
                if (row.LASTMSGDT < savLastMsgMstCdt) savLastMsgMstCdt = row.LASTMSGDT //CDT가 아님을 유의
            }
            await nextTick()
            if (lastMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                scrollArea.value.scrollTo({ top: 0 }) //scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (lastMsgMstCdt) { //이후에 스크롤 아래로 올려서 이전 데이터를 가지고 오면 높이가 커지는데 
                //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
            }
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function procChanRowImg(row) {
        row.notioffImg = (row.NOTI == "X") ? hush.cons.color_light + "notioff.png" : ""
        row.bookmarkImg = (row.BOOKMARK == "Y") ? hush.cons.color_light + "bookmark.png" : ""
    }

    function dmClickOnLoop(refresh) {
        const chanid = localStorage.wiseband_lastsel_dmchanid
        if (!chanid) return
        gst.listDm.forEach((item, index) => {
            if (item.CHANID == chanid) {
                chanRow.value[chanid].scrollIntoView({ behavior: "smooth", block: "nearest" })
                dmClick(item, index, refresh)
            }
        })
    }
    
    async function dmClick(row, idx, refresh) {
        try {
            gst.listDm.map((item) => {
               item.sel = false
               item.hover = false
            })
            row.sel = true
            localStorage.wiseband_lastsel_dmchanid = row.CHANID
            gst.util.goMsgList('dm_body', { chanid: row.CHANID }, refresh)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function toggleChanOption(kind, job, row) {
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            const rq = { chanid: row.CHANID, kind: kind, job: job } //kind는 현재 상태, job은 바꿀 상태
            const res = await axios.post("/chanmsg/toggleChanOption", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            const idx = gst.listDm.findIndex((item) => item.CHANID == row.CHANID)
            if (idx > -1) {
                if (kind == "noti") {
                    gst.listDm[idx].NOTI = job
                } else if (kind == "bookmark") {
                    gst.listDm[idx].BOOKMARK = job
                }
                procChanRowImg(gst.listDm[idx])
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {        
        const notiStr = "알림 " + (row.NOTI == "X" ? "해제" : "설정")
        const bookmarkStr = "즐겨찾기 " + (row.BOOKMARK == "Y" ? "해제" : "설정")
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "메시지목록 새로고침", func: function(item, idx) {
                gst.util.goMsgList('dm_body', { chanid: row.CHANID }, true)
            }},
            { nm: "새창에서 열기", deli: true, func: function(item, idx) {
                //let url = "/main/dm/dm_body/" + row.CHANID + "/" + row.MSGID + "?newwin=" + Math.random()
                //위와 같이 dm_body로 새창을 열면 router index.js를 보면 from/to url이 여러번 발생하는데 심지어 ?newwin으로 query가 ?ver로 변경되어 최종 전달되어 문제가 복잡함
                //따라서, 아래와 같이 DmPanel까지만 라우팅하면 거기서 이미 로컬스토리지로 가지고 있는 chanid를 클릭해서 여는 효과를 내는 것으로 일단 대체함
                if (row.CHANID != localStorage.wiseband_lastsel_dmchanid) {
                    gst.util.setToast("선택된 DM방에서 우클릭해 주시기 바랍니다.")
                    return
                }
                let url = "/main/dm"
                window.open(url)
            }}, //nm: "홈에서 열기" : 슬랙은 자식에게 '나중에'가 처리된 경우 해당 부모 메시지에 자식들이 딸린 UI(withreply)여서 필요할 수 있으나 여긴 부모/자식 모두 동일한 UI이므로 굳이 필요없음
            { nm: "정보 보기", func: function(item, idx) {

            }},
            { nm: notiStr, func: function(item, idx) {
                const job = (row.NOTI == "X") ? "" : "X"
                toggleChanOption("noti", job, row)
            }},
            { nm: bookmarkStr, func: function(item, idx) {
                const job = (row.BOOKMARK == "Y") ? "" : "Y"
                toggleChanOption("bookmark", job, row)
            }},
            { nm: "초대" },
            { nm: "나가기", color: "red" }
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

    function handleEvFromBody() { //MsgList.vue에서 실행 (to later, dm..)
        dmClickOnLoop()
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">DM</div>
            <div class="chan_side_top_right">
                <div style="padding:5px;display:flex;align-items:center;border-radius:8px;" @click="newMsg">
                    <input type="search" v-model="searchWord" @keyup.enter="procSearchQuery" @input="procClearSearch" style="width:80px;margin-right:8px" placeholder="멤버" />
                    <input type="checkbox" id="checkbox" v-model="notyetChk" @change="procChangedQuery" /><label for="checkbox" style="margin-right:12px;color:whitesmoke">안읽음</label>
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'compose.png')" title="새메시지">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in gst.listDm" :key="row.CHANID" :id="row.CHANID" :ref="(ele) => { chanRow[row.CHANID] = ele }"
                :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']" style="padding:10px;display:flex;flex-direction:column;border-bottom:1px solid dimgray;cursor:pointer"                 
                @click="dmClick(row, idx)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;color:lightgray">
                        <span>{{ row.memcnt }}명</span>
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        <span style="margin-right:5px;color:darkgray">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span>
                        <img v-if="row.notioffImg" class="coImg14" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off" style="margin-right:5px">
                        <img v-if="row.bookmarkImg" class="coImg14" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크" style="margin-right:5px">
                        {{ hush.util.displayDt(row.LASTMSGDT, false) }}
                    </div>
                </div>
                <div class="node">
                    <div style="display:flex;align-items:center">
                        <member-piclist :row="row"></member-piclist>
                        <div style="color:whitesmoke;font-weight:bold;margin-left:8px">{{ row.memnm.join(", ") }}{{ row.memcnt > hush.cons.picCnt ? '..' : '' }}</div>    
                    </div>
                </div>
                <div class="coDotDot"> <!-- 원래 coDotDot으로만 해결되어야 하는데 데이터가 있으면 넓이가 예) 1px 늘어나 육안으로 흔들림 -->
                    <div style="width:100px;color:white">{{ row.BODYTEXT }}</div> <!-- 이 행은 임시 조치임. 결국 슬랙의 2행 ellipsis를 못해냈는데 나중에 해결해야 함 -->
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" style="width:100%;height:200px;display:flex;justify-content:center;align-items:center"></div>
        </div>
    </div>
    <resizer nm="dm" @ev-from-resizer="handleFromResizer"></resizer>
    <div class="chan_main" id="chan_main" :style="{ width: chanMainWidth }">
        <!-- App.vue와 Main.vue에서는 :key를 안쓰고 HomePanel.vue, LaterPanel.vue 등에서만 :key를 사용 (MsgList.vue에서 설명) / keep-alive로 router 감싸는 것은 사용금지(Deprecated) -->
        <router-view v-slot="{ Component }">
            <keep-alive>                
                <component :is="Component" :key="$route.fullPath" ref="msglistRef" @ev-to-panel="handleEvFromBody"/>
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
        width:10%;height:100%;padding-left:10px;display:flex;align-items:center;font-size:18px;font-weight:bold;color:white
    }
    .chan_side_top_right {
        width:90%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
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
    .chan_main {
        height:100%;display:flex; /* width:100%;는 resizing처리됨 */
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px
    }
</style>
