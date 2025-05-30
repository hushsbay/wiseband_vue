<script setup>
    import { ref, onMounted, onActivated, onUnmounted, nextTick } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import Resizer from "/src/components/Resizer.vue"
        
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    let observerBottom = ref(null), observerBottomTarget = ref(null)
    let afterScrolled = ref(false)

    const msglistRef = ref(null)    
    let scrollArea = ref(null), listFixed = ref([]), cntFixed = ref(0), msgRow = ref({}) //msgRow는 element를 동적으로 할당
    let mounting = true, savLastMsgMstCdt = hush.cons.cdtAtLast //가장 최근 일시
    let onGoingGetList = false

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_fixedsidewidth ?? '300px') //localStorage 이름 유의
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
            gst.util.chkOnMountedTwice(route, 'FixedPanel')
            setBasicInfo()
            await getList(true)            
            observerBottomScroll()
            fixedClickOnLoop(true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/fixed") {
                fixedClickOnLoop(true)
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
        document.title = "WiSEBand 나중에"
        gst.selSideMenu = "mnuFixed" //MsgList.vue에 Blank 방지
    }

    const onScrolling = () => {
        if (!afterScrolled.value) afterScrolled.value = true
    }

    function procQuery() {
        //gst.kindLater = kind
        //localStorage.wiseband_lastsel_later = gst.kindLater
        getList(true)
    }

    async function getList(refresh) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            if (refresh) {
                listFixed.value = []
                savLastMsgMstCdt = hush.cons.cdtAtLast
            }
            const lastMsgMstCdt = savLastMsgMstCdt
            const res = await axios.post("/menu/qryPanel", { kind: "fixed", lastMsgMstCdt: lastMsgMstCdt }) //kind: gst.kindLater, 
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
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                listFixed.value.push(row)
                if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
            }
            await nextTick()
            if (lastMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                scrollArea.value.scrollTo({ top: 0 }) //scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (lastMsgMstCdt) { //이후에 스크롤 아래로 올려서 이전 데이터를 가지고 오면 높이가 커지는데 
                //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
            }
            getCount()
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function fixedClickOnLoop(clickNode, msgid) {
        //const msgid = localStorage.wiseband_lastsel_fixedmsgid
        const msgidToChk = msgid ? msgid : localStorage.wiseband_lastsel_fixedmsgid
        if (!msgidToChk) return
        let foundIdx = -1
        listFixed.value.forEach((item, index) => {
            if (item.MSGID == msgidToChk) {
                gst.util.scrollIntoView(msgRow, msgidToChk) //msgRow.value[msgid].scrollIntoView({ behavior: "smooth", block: "nearest" })
                fixedClick(item, index, clickNode, msgid)
                foundIdx = index
            }
        })
        if (foundIdx == -1 && clickNode && listFixed.value.length > 0) { //무한스크롤이므로 다음 페이지 선택된 것은 못가져와서 처음 노드를 기본으로 선택하는 것임
            const row = listFixed.value[0]
            fixedClick(row, 0, clickNode, row.MSGID)
        }
    }
    
    async function fixedClick(row, idx, clickNode, msgid) {
        try {            
            listFixed.value.forEach((item) => {
               item.sel = false
               item.hover = false
            })
            if (msgid) { //Back() 경우
                const row1 = listFixed.value.find((item) => item.MSGID == msgid)
                if (row1) {
                    row1.sel = true
                    localStorage.wiseband_lastsel_fixedmsgid = msgid
                }
            } else {
                row.sel = true
                localStorage.wiseband_lastsel_fixedmsgid = row.MSGID
                if (clickNode) gst.util.goMsgList('fixed_body', { chanid: row.CHANID, msgid: row.MSGID })
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function changeAction(kind, row) { //delete만 존재
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            const msgid = row.MSGID
            const rq = { chanid: row.CHANID, msgid: msgid, kind: kind }
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return //아래에서는 뭐가 되었던 현재 보이는 Fixed 패널 탭에서는 제거해야 함
            const idx = listFixed.value.findIndex((item) => item.MSGID == msgid)
            if (idx > -1) listFixed.value.splice(idx, 1)
            getCount() //화면에 갯수 업데이트
            if (kind != "delete") return //delete인 경우만 아래에서 MsgList 업데이트
            const msgidParent = (row.REPLYTO) ? row.REPLYTO : msgid //자식에게 처리되어 있는 경우는 부모 색상도 원위치 필요함
            msglistRef.value.procFromParent("fixed", { msgid: msgid, msgidParent: msgidParent, work: "delete" })
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "메시지목록 새로고침", func: function(item, idx) {
                gst.util.goMsgList('fixed_body', { chanid: row.CHANID, msgid: row.MSGID }, true)
            }},
            { nm: "새창에서 열기", func: function(item, idx) {
                let url = "/body/msglist/" + row.CHANID + "/" + row.MSGID
                window.open(url)
            }}, //nm: "홈에서 열기" : 슬랙은 자식에게 처리된 경우 해당 부모 메시지에 자식들이 딸린 UI(withreply)여서 필요할 수 있으나 여긴 부모/자식 모두 동일한 UI이므로 굳이 필요없음
            { nm: "제거", color: "red", func: function(item, idx) {
                changeAction('delete', row)                
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

    async function handleEvFromBody(param) { //MsgList.vue에서 실행
        if (param.kind == "selectRow") {
            fixedClickOnLoop(false, param.msgid) //뒤로가기는 clickNode = false
        } else if (param.kind == "update") {
            const row = listFixed.value.find((item) => item.MSGID == param.msgid)
            if (row) row.BODYTEXT = param.bodytext
        } else if (param.kind == "create" || param.kind == "delete") { //MsgList.vue의 changeAction() 참조 : { msgid: msgid, kind: work }
            if (param.kind == "delete") { 
                const idx = listFixed.value.findIndex((item) => item.MSGID == param.msgid)
                if (idx > -1) listFixed.value.splice(idx, 1)
            } else { //create (화면에 없는 걸 보이게 하는 것임)
                const res = await axios.post("/menu/qryPanel", { msgid: param.msgid })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs || rs.list.length == 0) return
                const row = rs.list[0]
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                let added = false
                const len = listFixed.value.length
                for (let i = 0; i < len; i++) { //최근일시가 맨 위에 있음
                    if (param.msgid > listFixed.value[i].MSGID) {
                        listFixed.value.splice(i, 0, row)
                        added = true
                        break
                    }
                }
                if (!added) listFixed.value.push(row)
            }
            getCount()
        }
    }

    async function getCount() { //화면에 갯수 업데이트
        try {
            const res = await axios.post("/menu/qryPanelCount", { kind: "fixed" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            cntFixed.value = rs.list[0].CNT
        } catch (ex) {
            util.showEx(ex, true)
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">고정</div>
            <div class="chan_side_top_right"><span style="color:white;font-size:15px;font-weight:bold">{{ cntFixed }}</span></div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in listFixed" :key="row.MSGID" :id="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }"
                class="node" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']" 
                @click="fixedClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;color:lightgray">
                        <div v-if="row.TYP=='GS'" style="display:flex;align-items:center">
                            {{ row.memnm.join(", ") }}{{ row.memcnt > hush.cons.picCnt ? '..' : '' }}
                        </div>
                        <div v-else style="display:flex;align-items:center">
                            <img class="coImg14" :src="gst.html.getImageUrl(hush.cons.color_light + ((row.STATE == 'A') ? 'channel.png' : 'lock.png'))">
                            <span style="margin-left:3px">{{ row.CHANNM }}</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        {{ row.REPLYTO ? '댓글' : '' }}
                    </div>
                </div>
                <div class="nodeMiddle">
                    <div style="display:flex;align-items:center">
                        <member-piceach :picUrl="row.url" sizeName="wh32"></member-piceach>
                        <div style="color:white;font-weight:bold;margin-left:5px">{{ row.AUTHORNM }}</div>    
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray;margin-right:3px">
                        {{ hush.util.displayDt(row.CDT, false) }}
                    </div>
                </div>
                <div style="width:100%">
                    <div class="coDotDot" style="color:white;font-weight:bold">{{ row.BODYTEXT }}</div> 
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget"></div>
        </div>
    </div>
    <resizer nm="fixed" @ev-from-resizer="handleFromResizer"></resizer>
    <div id="chan_body" :style="{ width: chanMainWidth }">
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
        width:100%;height:50px;display:flex;justify-content:space-between;border-bottom:var(--border-lg);cursor:pointer
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
    .node { padding:10px;display:flex;flex-direction:column;font-size:15px;border-bottom:var(--border-lg);cursor:pointer }
    .nodeHover, .nodeSel { background:var(--second-hover-color) }
    .nodeMiddle {
        width:100%;height:45px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--second-select-color);cursor:pointer
    }
    .procMenu { padding:3px;margin-left:10px;color:lightgray;font-weight:bold;border-bottom:3px solid rgb(90, 46, 93) }
    .procMenu:hover { color:white;font-weight:bold }
    .procMenuSel { color:white;border-bottom:3px solid white }
</style>
