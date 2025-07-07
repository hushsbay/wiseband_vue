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

    defineExpose({ procMainToMsglist, procMainToPanel })

    async function procMainToMsglist(kind, obj) { //단순 전달
        if (msglistRef.value) {
            await msglistRef.value.procMainToMsglist(kind, obj)
        }        
    }

    async function procMainToPanel(kind, obj) {
        await handleEvFromBody({ kind: kind, chanid: obj.CHANID })
    }

    const props = defineProps({ fromPopupChanDm: String })
    const emits = defineEmits(["ev-click"]) //, "ev-to-side"])

    function listRowClick(row) {
        emits("ev-click", "dm", row.CHANID)
    }

    function evToSide(kind, menu) {
        //emits("ev-to-side", kind, menu) //kiind=forwardToSide/menu=home,later..
    }

    let keepAliveRef = ref(null)
    let observerBottom = ref(null), observerBottomTarget = ref(null), afterScrolled = ref(false)
    let notyetChk = ref(false), searchWord = ref('') //msglistRef = ref(null), 
    let scrollArea = ref(null), chanRow = ref({}) //chanRow는 element를 동적으로 할당
    let memberlistRef = ref(null), listDm = ref([]), kindDm = ref('all'), msglistRef = ref(null)
    let newRoomJustCreated = ref(false)
    let savPrevMsgMstCdt = hush.cons.cdtAtLast //가장 큰 일시(9999-99-99)로부터 시작해서 스크롤이 올라갈 때마다 점점 이전의 작은 일시가 저장됨
    let mounting = true, onGoingGetList = false

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
            if (!gst.util.chkOnMountedTwice(route, 'DmPanel')) return
            setBasicInfo()
            notyetChk.value = (localStorage.wiseband_lastsel_dm == "notyet") ? true : false
            await getList(true)
            if (props.fromPopupChanDm != "Y") { //fromPopupChanDm은 home과 dm만 해당
                dmClickOnLoop(true)
            } else {
                dmClickOnLoop(false)
            }
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
            if (route.path == "/main/dm") { //사이드메뉴에서 클릭한 경우
                if (props.fromPopupChanDm != "Y") { //fromPopupChanDm은 home과 dm만 해당
                    dmClickOnLoop(true)
                } else {
                    dmClickOnLoop(false)
                }
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
        if (props.fromPopupChanDm == "Y") {
            //MsgList > PopupChanDm > DmPanel에서는 팝업이므로 gst.selSideMenu가 변경되면 안됨
        } else {
            document.title = "WiSEBand DM"
            gst.selSideMenu = "mnuDm" //MsgList.vue에 Blank 방지
        }
    }

    const onScrolling = () => {
        if (afterScrolled.value == false) afterScrolled.value = true //false 조건에 유의 (아니면 마지막 hide 안됨)
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
                listDm.value = [] //여기서 이 배열을 초기화한 후 다시 담으면 노드가 다시 만들어지면서 특정행이 클릭되고 MsgList가 onMounted()됨을 유의
                savPrevMsgMstCdt = hush.cons.cdtAtLast
            }
            const prevMsgMstCdt = savPrevMsgMstCdt
            const res = await axios.post("/menu/qryDm", { kind: kindDm.value, search: search, prevMsgMstCdt: prevMsgMstCdt })
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            if (!rs || rs.list.length == 0) {
                onGoingGetList = false
                afterScrolled.value = null
                return
            }
            afterScrolled.value = false
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
                if (row.LASTMSGDT < savPrevMsgMstCdt) savPrevMsgMstCdt = row.LASTMSGDT //CDT가 아님을 유의
            }
            await nextTick()
            if (prevMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                scrollArea.value.scrollTo({ top: 0 }) //{ top: scrollArea.value.scrollHeight }
            } else if (prevMsgMstCdt) {
                //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
            }
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    async function getSingleDm(chanid) { //한행에 대해 새로고침
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            const res = await axios.post("/menu/qryDm", { chanid: chanid, prevMsgMstCdt: hush.cons.cdtAtLast })
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            if (!rs || rs.list.length == 0) {
                onGoingGetList = false
                return
            }
            const row = rs.list[0]
            for (let i = 0; i < row.picture.length; i++) {
                if (row.picture[i] == null) {
                    row.url[i] = null
                } else {
                    row.url[i] = hush.util.getImageBlobUrl(row.picture[i].data)
                }
            }                
            procChanRowImg(row)            
            onGoingGetList = false
            return row
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function procChanRowImg(row) {
        row.notioffImg = (row.NOTI == "X") ? hush.cons.color_light + "notioff.png" : ""
        row.bookmarkImg = (row.BOOKMARK == "Y") ? hush.cons.color_light + "bookmark.png" : ""
    }

    function dmClickOnLoop(clickNode, chanid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 false. chanid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        const chanidToChk = chanid ? chanid : localStorage.wiseband_lastsel_dmchanid
        let foundIdx = -1
        listDm.value.forEach((item, index) => {
            if (item.CHANID == chanidToChk) {
                gst.util.scrollIntoView(chanRow, chanidToChk)
                dmClick(item, index, clickNode, chanid)
                foundIdx = index
            }
        })
        if (foundIdx == -1 && listDm.value.length > 0) { //무한스크롤이므로 다음 페이지에서 선택된 것은 못가져오는데 그 경우는 처음 노드를 기본으로 선택하도록 함
            const row = listDm.value[0]
            dmClick(row, 0, true)
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
                if (props.fromPopupChanDm == "Y") {
                    listRowClick(row)
                } else {
                    if (clickNode) gst.util.goMsgList('dm_body', { chanid: row.CHANID })
                }
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
        gst.ctx.data.header = ""
        const notiStr = (row.NOTI == "X") ? "켜기" : "끄기"
        const bookmarkStr = (row.BOOKMARK == "Y") ? "해제" : "표시"
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: async function(item, idx) {
                let url = await gst.util.getUrlForOneMsgNotYet(row.CHANID)
                window.open(url + "?appType=dm")
            }},
            { nm: "DM 관리", deli: true, img: "color_slacklogo.png", func: function(item, idx) {
                memberlistRef.value.open("dm", null, row.CHANID)
            }},
            { nm: "알림 " + notiStr, func: function(item, idx) {
                const job = (row.NOTI == "X") ? "" : "X"
                toggleChanOption("noti", job, row)
            }},
            { nm: "북마크 " + bookmarkStr, deli:true, func: function(item, idx) {
                const job = (row.BOOKMARK == "Y") ? "" : "Y"
                toggleChanOption("bookmark", job, row)
            }}
            //'DM링크 복사' 메뉴는 '채널링크 복사' 메뉴가 비공개인 경우와 마찬가지로, 아직 쓰임새가 안보여 지원하지 않음
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

    async function newDm(manage) {
        if (manage) {
            memberlistRef.value.open("dm", null, "new")
        } else {
            listDm.value.forEach((item) => { //선택 해제
                item.sel = false
                item.hover = false
            })
            await router.push({ name: "dm_body_new" })
        }
    }

    async function refreshPanel() {
        await getList(true) //true시 listDm이 초기화되었다 다시 추가되므로 MsgList의 onMounted()가 실행됨을 유의
        dmClickOnLoop(true)
        newRoomJustCreated.value = false
    }

    async function handleEvFromBody(param) { //MsgList.vue에서 실행
        if (param.kind == "selectRow") {
            dmClickOnLoop(false, param.chanid) //뒤로가기는 clickNode = false
        // } else if (param.kind == "update") { //대신 아래 refreshRow 사용하기
        //     const idx = listDm.value.findIndex((item) => item.CHANID == param.chanid)
        //     if (idx == -1) return
        //     const row = listDm.value[idx]
        //     row.BODYTEXT = param.bodytext
        //     if (idx == 0) return //아래는 해당 배열항목이 맨 위가 아닐 때 맨 위로 올리는 것임
        //     listDm.value.splice(idx, 1)
        //     listDm.value.unshift(row)
        } else if (param.kind == "refreshRow") {
            await refreshRow(param.chanid, true)
        } else if (param.kind == "delete") {
            const idx = listDm.value.findIndex((item) => item.CHANID == param.chanid)
            if (idx == -1) return
            listDm.value.splice(idx, 1)
        } else if (param.kind == "updateNotyetCnt") { //사용자가 읽고 나서 갯수 새로 고침
            const row = listDm.value.find((item) => item.CHANID == param.chanid)
            if (!row) return
            const res = await axios.post("/menu/qryKindCnt", { chanid: param.chanid, kind: "notyet" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            row.mynotyetCnt = rs.data.kindCnt
        } else if (param.kind == "refreshPanel") { //방 나가기,삭제에서 사용
            await refreshPanel()
        /*} else if (param.kind == "forwardToSide") { //지우지 말 것 (향후 사용가능성) : MsgList okChanDmPopup() 참조            
            evToSide(param.kind, param.menu) 향후 사용시 모든 패널에 evToSide 검토 필요 */
        }
    }

    async function refreshRow(chanid, upToTop) {
        const row = await getSingleDm(chanid)
        const idx = listDm.value.findIndex((item) => item.CHANID == chanid)
        if (idx > -1) {
            if (idx != 0 && upToTop) { //행을 맨위로 올려서 업데이트
                let item = listDm.value[idx]
                listDm.value.splice(idx, 1)
                listDm.value.unshift(item)
                listDm.value[0] = row
                if (listDm.value[0].CHANID == localStorage.wiseband_lastsel_dmchanid) {
                    listDm.value[0].sel = true
                    scrollArea.value.scrollTo({ top: 0 })
                }
            } else {
                listDm.value[idx] = row
                if (listDm.value[0].CHANID == localStorage.wiseband_lastsel_dmchanid) {
                    listDm.value[idx].sel = true
                }
            }
        } else { //refreshPanel() 사용시 MsgList도 다시 Mounted되므로 사용자 액션으로 누르지 않는 한 사용하지 말기
            newRoomJustCreated.value = true
        }
    }

    async function handleEvFromMemberList(chanid, kind) { //MemberList에서 실행
        if (kind == "update") {
            refreshRow(chanid)
        } else if (kind == "delete") {
            const idx = listDm.value.findIndex((item) => item.CHANID == chanid)
            if (idx == -1) return
            listDm.value.splice(idx, 1)
            if (listDm.value.length > 0) {
               dmClick(listDm.value[0], 0, true)
            } else { //패널에 데이터가 없음
                gst.util.goMsgList('dm_body', { chanid: chanid, msgid: "nodata" })
            }
            //MsgList의 마스터/디테일 새로고침을 아래 if (kind == "forwardToBody") 말고 여기서 처리해도 되나 
            //home에서 호출안되는 부분도 있어 일관되게 별도로 빼기로 함
        } else if (kind == "create") {
            const row = await getSingleDm(chanid)
            listDm.value.unshift(row)
            setTimeout(function() { //await nextTick()으로 처리가 안되어, MsgList에서 역으로 뭔가 처리하는 것이 있는지 봐도 없음. 일단 임시방편으로 1초후 처리
                dmClick(listDm.value[0], 0, true) //이 때 새 라우팅이므로 MsgList의 onMounted()가 당연히 발생함
            }, 1000)
        } else if (kind == "forwardToBody") {
            msglistRef.value.procFromParent(kind)
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: props.fromPopupChanDm ? '100%' : chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">DM</div>
            <div class="chan_side_top_right">
                <div style="padding:5px;display:flex;align-items:center;border-radius:8px;">
                    <input type="search" v-model="searchWord" @keyup.enter="procSearchQuery" @input="procClearSearch" style="width:100px;margin-right:8px" placeholder="멤버" />
                    <input type="checkbox" id="checkbox" v-model="notyetChk" @change="procChangedQuery" /><label for="checkbox" style="margin-right:12px;color:whitesmoke">안읽음</label>
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_refresh.png')" title="새로고침" style="margin-right:0px" @click="refreshPanel">
                    <!-- <img v-if="!props.fromPopupChanDm" class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'compose.png')" title="DM방 만들기" @click="newDm()"> -->
                </div>
            </div>
        </div>
        <div v-if="newRoomJustCreated" @click="refreshPanel" style="padding:0 5px 10px 0;display:flex;align-items:center;justify-content:flex-end;color:yellow;border-bottom:1px solid lightgray;cursor:pointer">
            <span style="margin-right:10px;font-weight:bold">새 DM방 생성됨</span>
        </div>
        <div v-else style="padding:0 5px 10px 0;display:flex;align-items:center;justify-content:flex-end;color:whitesmoke;border-bottom:1px solid lightgray;cursor:pointer">
            <span style="margin-right:10px" @click="newDm()">신규</span>
            <span style="margin-right:10px">|</span>
            <span style="margin-right:10px" @click="newDm(true)">신규(관리)</span>
        </div>        
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in listDm" :key="row.CHANID" :id="row.CHANID" :ref="(ele) => { chanRow[row.CHANID] = ele }" :keyidx="idx"
                class="node" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']"
                @click="dmClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;color:lightgray">
                        <span>{{ row.memcnt }}명</span>
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        <!-- <span style="margin-right:5px;color:darkgray">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span> -->
                        <span :class="row.mynotyetCnt == 0 ? '' : 'coMyNotYet'">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span>
                        <img v-if="row.notioffImg" class="coImg14" style="margin-left:5px" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off">
                        <img v-if="row.bookmarkImg" class="coImg14" style="margin-left:5px" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크">
                        <span style="margin-left:5px">{{ hush.util.displayDt(row.LASTMSGDT, false) }}</span>
                    </div>
                </div>
                <div class="nodeMiddle">
                    <div style="display:flex;align-items:center">
                        <member-piclist :row="row"></member-piclist>
                        <div style="color:whitesmoke;font-weight:bold;margin-left:8px">
                            {{ row.memcnt > 1 ? row.memnm.join(", ") : "나에게" }}
                            {{ row.memcnt > hush.cons.picCnt ? '..' : '' }}
                        </div>    
                    </div>
                </div>
                <div style="width:100%">
                    <div class="coDotDot" style="color:white">{{ row.BODYTEXT }}</div> 
                </div>
            </div>
            <div v-if="listDm.length == 0" style="width:calc(100% - 20px);height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 DM 데이터가 없습니다.<br><br>
                    패널 우측상단 '새DM' 버튼으로<br>
                    DM방을 만들어 사용하시기 바랍니다.
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget">{{ hush.cons.moreData }}</div>
        </div>
    </div>
    <resizer nm="dm" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listDm.length > 0" id="chan_body" :style="{ width: chanMainWidth }"> <!--<component ref="msglistRef" -->
        <router-view v-slot="{ Component }">
            <keep-alive ref="keepAliveRef">
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
        width:100%;height:40px;display:flex;justify-content:space-between;border-bottom:0px solid lightgray;cursor:pointer
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
