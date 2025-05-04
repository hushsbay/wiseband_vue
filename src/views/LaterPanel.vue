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
    let scrollArea = ref(null), msgRow = ref({}) //msgRow는 element를 동적으로 할당
    let mounting = true, savLastMsgMstCdt = hush.cons.cdtAtLast //가장 최근 일시
    let onGoingGetList = false

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
            setBasicInfo()
            gst.kindLater = localStorage.wiseband_lastsel_later ? localStorage.wiseband_lastsel_later : "later"
            await getList(true)            
            observerBottomScroll()
            laterClickOnLoop(true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/later") {
                laterClickOnLoop()
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
        document.title = "WiSEBand 나중에"
        gst.selSideMenu = "mnuLater" //MsgList.vue에 Blank 방지
    }

    const onScrolling = () => {
        if (!afterScrolled.value) afterScrolled.value = true
    }

    function procQuery(kind) {
        gst.kindLater = kind
        localStorage.wiseband_lastsel_later = gst.kindLater
        getList(true)
    }

    async function getList(refresh) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            if (refresh) {
                gst.listLater = []
                savLastMsgMstCdt = hush.cons.cdtAtLast
            }
            const lastMsgMstCdt = savLastMsgMstCdt
            const res = await axios.post("/menu/qryLater", { kind: gst.kindLater, lastMsgMstCdt: lastMsgMstCdt })
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
                if (row.PICTURE == null) {
                    row.url = null
                } else {
                    row.url = hush.util.getImageBlobUrl(row.PICTURE.data)
                }
                gst.listLater.push(row)
                if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
            }
            await nextTick()
            if (lastMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                scrollArea.value.scrollTo({ top: 0 }) //scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (lastMsgMstCdt) { //이후에 스크롤 아래로 올려서 이전 데이터를 가지고 오면 높이가 커지는데 
                //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
            }
            gst.later.getCount() //진행중인 (나중에) 카운팅
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function laterClickOnLoop(refresh) {
        const msgid = localStorage.wiseband_lastsel_latermsgid
        if (!msgid) return
        gst.listLater.forEach((item, index) => {
            if (item.MSGID == msgid) {
                msgRow.value[msgid].scrollIntoView({ behavior: "smooth", block: "nearest" })
                laterClick(item, index, refresh)
            }
        })
    }
    
    async function laterClick(row, idx, refresh) {
        try {            
            gst.listLater.map((item) => {
               item.sel = false
               item.hover = false
            })
            row.sel = true
            localStorage.wiseband_lastsel_latermsgid = row.MSGID
            gst.util.goMsgList('later_body', { chanid: row.CHANID, msgid: row.MSGID }, refresh)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function changeAction(kind, row) {
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            const msgid = row.MSGID
            const rq = { chanid: row.CHANID, msgid: msgid, kind: gst.kindLater, job: kind } //kind는 현재 상태, job은 바꿀 상태
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return //아래에서는 뭐가 되었던 현재 보이는 Later 패널 탭에서는 제거해야 함 //const work = rs.data.work은 여기서는 무시하고 무조건 delete
            const idx = gst.listLater.findIndex((item) => item.MSGID == msgid)
            if (idx > -1) gst.listLater.splice(idx, 1)
            gst.later.getCount() //화면에 갯수 업데이트
            if (kind != "delete") return //delete인 경우만 아래에서 MsgList 업데이트
            const msgidParent = (row.REPLYTO) ? row.REPLYTO : msgid //자식에게 처리되어 있는 경우는 부모 색상도 원위치 필요함
            msglistRef.value.procFromParent("later", { msgid: msgid, msgidParent: msgidParent, work: "delete" })
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "메시지목록 새로고침", func: function(item, idx) {
                gst.util.goMsgList('later_body', { chanid: row.CHANID, msgid: row.MSGID }, true)
            }},
            { nm: "새창에서 열기", func: function(item, idx) {
                let url = "/body/msglist/" + row.CHANID + "/" + row.MSGID
                window.open(url)
            }}, //nm: "홈에서 열기" : 슬랙은 자식에게 '나중에'가 처리된 경우 해당 부모 메시지에 자식들이 딸린 UI(withreply)여서 필요할 수 있으나 여긴 부모/자식 모두 동일한 UI이므로 굳이 필요없음
            { nm: "보관", disable: (gst.kindLater == "stored") ? true : false, func: async function(item, idx) {
                changeAction('stored', row)
            }},
            { nm: "완료", disable: (gst.kindLater == "finished") ? true : false, func: function(item, idx) {
                changeAction('finished', row)
            }},
            { nm: "진행", disable: (gst.kindLater == "later") ? true : false, func: function(item, idx) {
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

    function handleEvFromBody() { //MsgList.vue에서 실행
        laterClickOnLoop()
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">나중에</div>
            <div class="chan_side_top_right">
                <div class="procMenu" :class="(gst.kindLater == 'later') ? 'procMenuSel' : ''" @click="procQuery('later')">
                    진행중<span style="margin-left:3px">{{ gst.cntLater }}</span>
                </div>
                <div class="procMenu" :class="(gst.kindLater == 'stored') ? 'procMenuSel' : ''" @click="procQuery('stored')">
                    보관됨
                </div>
                <div class="procMenu" :class="(gst.kindLater == 'finished') ? 'procMenuSel' : ''" @click="procQuery('finished')">
                    완료됨
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in gst.listLater" :key="row.MSGID" :id="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }"
                :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']" style="padding:10px;display:flex;flex-direction:column;border-bottom:1px solid dimgray;cursor:pointer"                 
                @click="laterClick(row, idx)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
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
                <div class="node">
                    <div style="display:flex;align-items:center">
                        <member-piceach :picUrl="row.url" sizeName="wh32"></member-piceach>
                        <div style="color:white;font-weight:bold;margin-left:5px">{{ row.AUTHORNM }}</div>    
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        {{ hush.util.displayDt(row.CDT, false) }}
                    </div>
                </div>
                <div class="coDotDot"> <!-- 원래 coDotDot으로만 해결되어야 하는데 데이터가 있으면 넓이가 예) 1px 늘어나 육안으로 흔들림 -->
                    <div style="width:100px;color:white;font-weight:bold">{{ row.BODYTEXT }}</div> <!-- 이 행은 임시 조치임. 결국 슬랙의 2행 ellipsis를 못해냈는데 나중에 해결해야 함 -->
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" style="width:100%;height:200px;display:flex;justify-content:center;align-items:center"></div>
        </div>
    </div>
    <resizer nm="later" @ev-from-resizer="handleFromResizer"></resizer>
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
    .procMenu { padding:3px;margin-left:10px;color:lightgray;font-weight:bold;border-bottom:3px solid rgb(90, 46, 93) }
    .procMenu:hover { color:white;font-weight:bold }
    .procMenuSel { color:white;border-bottom:3px solid white }
</style>
