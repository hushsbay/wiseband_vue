<script setup>
    import { ref, onMounted, onActivated, onUnmounted, nextTick } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import MemberList from '/src/components/MemberList.vue'
    import MemberPiclist from "/src/components/MemberPiclist.vue"
    import Resizer from "/src/components/Resizer.vue"
        
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    let observerBottom = ref(null), observerBottomTarget = ref(null)
    let afterScrolled = ref(false)

    const msglistRef = ref(null), notyetChk = ref(false), searchWord = ref('')
    let scrollArea = ref(null), chanRow = ref({}) //chanRow는 element를 동적으로 할당
    let memberlistRef = ref(null), listDm = ref([]), kindDm = ref('all')
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
            gst.util.chkOnMountedTwice(route, 'DmPanel')
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
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 바로 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/dm") { //사이드메뉴에서 클릭한 경우
                dmClickOnLoop(true)
            } else {
                //MsgList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
            }
        }
        observerBottomScroll()
    })

    onUnmounted(() => {
        if (observerBottom && observerBottom.value) observerBottom.value.disconnect()
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
            kindDm.value = localStorage.wiseband_lastsel_dm
            const search = searchWord.value.trim()
            if (refresh) {
                listDm.value = []
                savLastMsgMstCdt = hush.cons.cdtAtLast
            }
            const lastMsgMstCdt = savLastMsgMstCdt
            const res = await axios.post("/menu/qryDm", { kind: kindDm.value, search: search, lastMsgMstCdt: lastMsgMstCdt })
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
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
                procChanRowImg(row)
                listDm.value.push(row)
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

    function dmClickOnLoop(clickNode, chanid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 true. chanid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        const chanidToChk = chanid ? chanid : localStorage.wiseband_lastsel_dmchanid
        if (!chanidToChk) return
        let foundIdx = -1
        listDm.value.forEach((item, index) => {
            if (item.CHANID == chanidToChk) {
                gst.util.scrollIntoView(chanRow, chanidToChk) //chanRow.value[chanidToChk].scrollIntoView({ behavior: "smooth", block: "nearest" })
                dmClick(item, index, clickNode, chanid)
                foundIdx = index
            }
        })
        if (foundIdx == -1 && clickNode && listDm.value.length > 0) { //무한스크롤이므로 다음 페이지 선택된 것은 못가져와서 처음 노드를 기본으로 선택하는 것임
            const row = listDm.value[0]
            dmClick(row, 0, clickNode, row.CHAIND)
        }
    }
    
    async function dmClick(row, idx, clickNode, chanid) {
        try {
            listDm.value.forEach((item) => {
               item.sel = false
               item.hover = false
            })
            if (chanid) { //Back() 경우
                const row1 = listDm.value.find((item) => item.CHANID == chanid)
                if (row1) {
                    row1.sel = true
                    localStorage.wiseband_lastsel_dmchanid = chanid
                }
            } else {
                row.sel = true
                localStorage.wiseband_lastsel_dmchanid = row.CHANID
                if (clickNode) gst.util.goMsgList('dm_body', { chanid: row.CHANID })
            }
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
            const idx = listDm.value.findIndex((item) => item.CHANID == row.CHANID)
            if (idx > -1) {
                if (kind == "noti") {
                    listDm.value[idx].NOTI = job
                } else if (kind == "bookmark") {
                    listDm.value[idx].BOOKMARK = job
                }
                procChanRowImg(listDm.value[idx])
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
            { nm: "새창에서 열기", deli: true, func: async function(item, idx) {
                let url = gst.util.getUrlForOneMsgNotYet(row.CHANID)
                window.open(url)
            }},
            { nm: "정보 보기", func: function(item, idx) {
                memberlistRef.value.open("dm", row.CHANID)
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

    async function handleEvFromBody(param) { //MsgList.vue에서 실행
        if (param.kind == "selectRow") {
            dmClickOnLoop(false, param.chanid) //뒤로가기는 clickNode = false
        } else if (param.kind == "update") {
            const idx = listDm.value.findIndex((item) => item.CHANID == param.chanid)
            if (idx == -1) return
            const row = listDm.value[idx]
            row.BODYTEXT = param.bodytext
            if (idx == 0) return //아래는 해당 배열항목이 맨 위가 아닐 때 맨 위로 올리는 것임
            listDm.value.splice(idx, 1)
            listDm.value.unshift(row)
        } else if (param.kind == "updateNotyetCnt") { //사용자가 읽고 나서 갯수 새로 고침
            const row = listHome.value.find((item) => item.CHANID == param.chanid)
            if (!row) return
            const res = await axios.post("/menu/qryKindCnt", { chanid: param.chanid, kind: "notyet" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            row.mynotyetCnt = rs.data.kindCnt
        }
    }

    function handleEvFromMemberList(chanid) { //MemberList에서 실행
        getList(true) //qryDm으로 하나의 행만 업데이트하기 (신규일 때는 맨 위에 추가하기)
    }

    function newDm() {
        memberlistRef.value.open("dm", "new")
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
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'compose.png')" title="새DM" @click="newDm()">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in listDm" :key="row.CHANID" :id="row.CHANID" :ref="(ele) => { chanRow[row.CHANID] = ele }"
                class="node" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']"
                @click="dmClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
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
                <div class="nodeMiddle">
                    <div style="display:flex;align-items:center">
                        <member-piclist :row="row"></member-piclist>
                        <div style="color:whitesmoke;font-weight:bold;margin-left:8px">{{ row.memnm.join(", ") }}{{ row.memcnt > hush.cons.picCnt ? '..' : '' }}</div>    
                    </div>
                </div>
                <div style="width:100%">
                    <div class="coDotDot" style="color:white;font-weight:bold">{{ row.BODYTEXT }}</div> 
                </div>
            </div>
            <div v-if="listDm.length == 0" style="width:100%;height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 DM 데이터가 없습니다.<br><br>
                    패널 우측상단 '새DM' 버튼으로<br>
                    DM방을 만들어 사용하시기 바랍니다.
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" style="width:100%;height:200px;display:flex;justify-content:center;align-items:center"></div>
        </div>
    </div>
    <resizer nm="dm" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listDm.length > 0" id="chan_body" :style="{ width: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive>                
                <component :is="Component" :key="$route.fullPath" ref="msglistRef" @ev-to-panel="handleEvFromBody" />
            </keep-alive>
        </router-view>
    </div>
    <div v-else id="chan_body" :style="{ width: chanMainWidth }" style="display:flex;justify-content:center;align-items:center">
        <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
    </div>
    <member-list ref="memberlistRef" @ev-from-member="handleEvFromMemberList"></member-list>
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
    .node { padding:10px;display:flex;flex-direction:column;font-size:15px;border-bottom:var(--border-lg);cursor:pointer }
    .nodeHover, .nodeSel { background:var(--second-hover-color) }
    .nodeMiddle {
        width:100%;height:45px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--second-select-color);cursor:pointer
    }
</style>
