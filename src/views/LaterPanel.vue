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

    let observerBottom = ref(null), observerBottomTarget = ref(null), afterScrolled = ref(false)

    let keepAliveRef = ref(null)
    const msglistRef = ref(null)    
    let scrollArea = ref(null), listLater = ref([]), cntLater = ref(''), kindLater = ref('later'), msgRow = ref({}) //msgRow는 element를 동적으로 할당
    let savPrevMsgMstCdt = hush.cons.cdtAtLast //가장 큰 일시(9999-99-99)로부터 시작해서 스크롤이 내려갈 때마다 점점 작은 일시가 저장됨
    let mounting = true, onGoingGetList = false

    defineExpose({ procMainToMsglist })

    async function procMainToMsglist(kind, obj) { //단순 전달
        //await msglistRef.value.procMainToMsglist(kind, obj)
    }

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_latersidewidth ?? '300px') //localStorage 이름 유의
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
            gst.util.chkOnMountedTwice(route, 'LaterPanel')
            setBasicInfo()
            kindLater.value = localStorage.wiseband_lastsel_later ? localStorage.wiseband_lastsel_later : "later"
            await getList(true)            
            laterClickOnLoop(true)
            observerBottomScroll()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 바로 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/later") { //사이드메뉴에서 클릭한 경우
                laterClickOnLoop(true)
            } else {
                //MsgList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
            }
            observerBottomScroll()
        }
    })

    onUnmounted(() => {
        if (observerBottom && observerBottom.value) observerBottom.value.disconnect()
    })

    function setBasicInfo() {
        document.title = "WiSEBand 나중에"
        gst.selSideMenu = "mnuLater" //MsgList.vue에 Blank 방지
    }

    const onScrolling = () => {
        if (afterScrolled.value == false) afterScrolled.value = true //false 조건에 유의 (아니면 마지막 hide 안됨)
    }

    function procQuery(kind) {
        kindLater.value = kind
        localStorage.wiseband_lastsel_later = kind
        getList(true)
    }

    async function getList(refresh) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            if (refresh) {
                listLater.value = []
                savPrevMsgMstCdt = hush.cons.cdtAtLast
            }
            const prevMsgMstCdt = savPrevMsgMstCdt
            const res = await axios.post("/menu/qryPanel", { kind: kindLater.value, prevMsgMstCdt: prevMsgMstCdt })
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            if (!rs || rs.list.length == 0) {
                onGoingGetList = false
                afterScrolled.value = null
                return
            }
            afterScrolled.value = false
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                listLater.value.push(row)
                if (row.CDT < savPrevMsgMstCdt) savPrevMsgMstCdt = row.CDT
            }
            await nextTick()
            if (prevMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                scrollArea.value.scrollTo({ top: 0 }) //{ top: scrollArea.value.scrollHeight }
            } else if (prevMsgMstCdt) {
                //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
            }
            getCount() //진행중인 (나중에) 카운팅
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function laterClickOnLoop(clickNode, msgid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 false. msgid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        const msgidToChk = msgid ? msgid : localStorage.wiseband_lastsel_latermsgid
        let foundIdx = -1
        listLater.value.forEach((item, index) => {
            if (item.MSGID == msgidToChk) {
                gst.util.scrollIntoView(msgRow, msgidToChk)
                laterClick(item, index, clickNode, msgid)
                foundIdx = index
            }
        })
        if (foundIdx == -1 && listLater.value.length > 0) { //무한스크롤이므로 다음 페이지에서 선택된 것은 못가져오는데 그 경우는 처음 노드를 기본으로 선택하도록 함
            const row = listLater.value[0]
            laterClick(row, 0, true)
        }
    }
    
    async function laterClick(row, idx, clickNode, msgid) {
        try {            
            listLater.value.forEach((item) => {
               item.sel = false
               item.hover = false
            })
            if (msgid) { //Back() 경우
                const row1 = listLater.value.find((item) => item.MSGID == msgid)
                if (row1) {
                    row1.sel = true
                    localStorage.wiseband_lastsel_latermsgid = msgid
                }
            } else {
                row.sel = true
                localStorage.wiseband_lastsel_latermsgid = row.MSGID
                if (clickNode) gst.util.goMsgList('later_body', { chanid: row.CHANID, msgid: row.MSGID })
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function changeAction(kind, row) {
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            const msgid = row.MSGID
            const rq = { chanid: row.CHANID, msgid: msgid, kind: kindLater.value, job: kind } //kind는 현재 상태, job은 바꿀 상태
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return //아래에서는 뭐가 되었던 현재 보이는 Later 패널 탭에서는 제거해야 함 //const work = rs.data.work은 여기서는 무시하고 무조건 delete
            const idx = listLater.value.findIndex((item) => item.MSGID == msgid)
            if (idx > -1) listLater.value.splice(idx, 1)
            getCount() //화면에 갯수 업데이트
            if (kind != "delete") return //delete인 경우만 아래에서 MsgList 업데이트
            const msgidParent = (row.REPLYTO) ? row.REPLYTO : msgid //자식에게 처리되어 있는 경우는 부모 색상도 원위치 필요함
            msglistRef.value.procFromParent("later", { msgid: msgid, msgidParent: msgidParent, work: "delete" })
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        const url = gst.util.openWinForBodyList(row.CHANID, row.MSGID, "later")
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {
                window.open(url)
            }},
            { nm: "메시지 링크 복사", deli: true, func: function(item, idx) {
                navigator.clipboard.writeText(url).then(() => {
                    gst.util.setToast("메시지 링크가 복사되었습니다.")
                }).catch(() => {
                    gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                })
            }},
            { nm: "보관", disable: (kindLater.value == "stored") ? true : false, func: async function(item, idx) {
                changeAction('stored', row)
            }},
            { nm: "완료", disable: (kindLater.value == "finished") ? true : false, func: function(item, idx) {
                changeAction('finished', row)
            }},
            { nm: "진행", disable: (kindLater.value == "later") ? true : false, deli: true, func: function(item, idx) {
                changeAction('later', row)
            }},
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

    async function refreshPanel() {
        await getList(true)            
        laterClickOnLoop(true)
    }

    async function handleEvFromBody(param) { //MsgList.vue에서 실행
        if (param.kind == "selectRow") {
            laterClickOnLoop(false, param.msgid) //뒤로가기는 clickNode = false
        } else if (param.kind == "update") {
            const row = listFixed.value.find((item) => item.MSGID == param.msgid)
            if (row) row.BODYTEXT = param.bodytext
        } else if (param.kind == "create" || param.kind == "delete") { //MsgList.vue의 changeAction() 참조 : { msgid: msgid, kind: work }
            if (param.kind == "delete") { 
                const idx = listLater.value.findIndex((item) => item.MSGID == param.msgid)
                if (idx > -1) listLater.value.splice(idx, 1)
            } else { //create (화면에 없는 걸 보이게 하는 것임)
                if (kindLater.value == "later") { //'나중에' 패널에서 진행중(later)탭이 아니면 추가된 행 화면업뎃할 일 없음
                    const res = await axios.post("/menu/qryPanel", { msgid: param.msgid })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs || rs.list.length == 0) return
                    const row = rs.list[0]
                    row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                    let added = false
                    const len = listLater.value.length
                    for (let i = 0; i < len; i++) { //최근일시가 맨 위에 있음
                        if (param.msgid > listLater.value[i].MSGID) {
                            listLater.value.splice(i, 0, row)
                            added = true
                            break
                        }
                    }
                    if (!added) listLater.value.push(row)
                }
            }
            getCount()
        }
    }

    async function getCount() { //화면에 갯수 업데이트
        try {
            const res = await axios.post("/menu/qryPanelCount", { kind: "later" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            cntLater.value = rs.list[0].CNT
        } catch (ex) {
            util.showEx(ex, true)
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                나중에
                
            </div>
            <div class="chan_side_top_right">
                <div @click="refreshPanel">
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_refresh.png')" title="새로고침" @click="refreshPanel">
                </div>
                <div class="procMenu" :class="(kindLater == 'later') ? 'procMenuSel' : ''" @click="procQuery('later')">
                    진행<span style="margin-left:3px">{{ cntLater }}</span>
                </div>
                <div class="procMenu" :class="(kindLater == 'stored') ? 'procMenuSel' : ''" @click="procQuery('stored')">
                    보관
                </div>
                <div class="procMenu" :class="(kindLater == 'finished') ? 'procMenuSel' : ''" @click="procQuery('finished')">
                    완료
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in listLater" :key="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }" :keyidx="idx"
                class="node" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']" 
                @click="laterClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
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
            <div v-if="listLater.length == 0" style="width:calc(100% - 20px);height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 '나중에' 데이터가 없습니다.<br><br>
                    채널이나 DM 메시지에서 '나중에' 처리를<br>
                    누르면 여기에 표시됩니다.
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget">{{ hush.cons.moreData }}</div>
        </div>
    </div>
    <resizer nm="later" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listLater.length > 0" id="chan_body" :style="{ width: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive ref="keepAliveRef">
                <component :is="Component" :key="$route.fullPath" ref="msglistRef" @ev-to-panel="handleEvFromBody"/>
            </keep-alive>
        </router-view>
    </div>
    <div v-else id="chan_body" :style="{ width: chanMainWidth }" style="display:flex;justify-content:center;align-items:center">
        <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
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
        width:100px;height:100%;padding-left:10px;display:flex;align-items:center;font-size:18px;font-weight:bold;color:white
    }
    .chan_side_top_right {
        width:calc(100% - 100px);height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
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
