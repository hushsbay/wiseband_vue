<script setup>
    import { ref, onMounted, nextTick, useTemplateRef, onActivated, onUnmounted } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import OrgTree from "/src/components/OrgTree.vue"
            
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    //ev-click    : OrgTree -> UserList
    //ev-to-panel : UserList -> GroupPanel
    const emits = defineEmits(["ev-click", "ev-to-panel"])

    //1) GroupPanel -> UserList 2) UserList -> OrgTree의 경우는 없으므로 여기에 해당하는 defineExpose({ procFromParent }) 등은 MsgList.vue와는 달리 모두 제거함

    function evToPanel() { //말 그대로 패널에게 호출하는 것임
        emits("ev-to-panel")
    }

    const g_userid = gst.auth.getCookie("userid")
    let mounting = true
    
    const scrollArea = ref(null), groupRow = ref({}) //groupRow는 element를 동적으로 할당
    let onGoingGetList = false
        
    let sideMenu = "mnuGroup", grId
    let grnm = ref(''), masternm = ref('')
    let userlist = ref([])

    onMounted(async () => {
        try {
            setBasicInfo()
            await getList()                    
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else {
            setBasicInfo()
            const key = grId
            if (gst.objSaved[key]) scrollArea.value.scrollTop = gst.objSaved[key].scrollY
            gst.home.procFromBody("recall", { grid: grId })
        }
    })

    function setBasicInfo() {        
        //sideMenu = gst.selSideMenu
        //if (!sideMenu) sideMenu = "mnuGroup"
        if (route.params.grid) grId = route.params.grid
    }

    function saveCurScrollY(posY) {
        if (!grId) return
        const key = grId
        if (!gst.objSaved[key]) gst.objSaved[key] = {}
        gst.objSaved[key].scrollY = posY
    }

    function chanCtxMenu(e) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {

            }},
            { nm: "정보 보기", func: function(item, idx) {
                
            }},
            { nm: "링크 복사", func: function(item, idx) {
                
            }},
            { nm: "설정", func: function(item, idx) {
                
            }},
            { nm: "알림 변경", func: function(item, idx) {
                
            }},
            { nm: "즐겨찾기", func: function(item, idx) {
                
            }},
            { nm: "나가기", color: 'red', func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
    }

    async function getList(addedParam) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            let param = { grid: grId }
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const kind = param.kind
            const res = await axios.post("/user/qryGroupDetail", param)
            const rs = gst.util.chkAxiosCode(res.data) 
            //debugger
            if (!rs) {
                onGoingGetList = false                
                return
            }
            grnm.value = rs.data.grmst.GR_NM
            masternm.value = rs.data.grmst.MASTERNM
            document.title = grnm.value + " [그룹]"
            const grdtl = rs.data.grdtl
            const len = grdtl.length
            for (let i = 0; i < len; i++) {
                const row = grdtl[i]                
                //if (row.PICTURE == null) {
                //    row.url = null
                //} else {
                //    row.url = hush.util.getImageBlobUrl(row.PICTURE.data)
                //}
                userlist.value.push(row)
            }
            await nextTick()
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    async function getMsg(addedParam, verbose) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryMsg", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) {
                if (verbose) gst.util.setToast(rs.msg)
                return null
            }
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function refreshWithGetMsg(rs, msgid) {
        let item = msglist.value.find(function(row) { return row.MSGID == msgid })
        if (item) { //필요한 경우 추가하기로 함. 그러나 결국엔 한번에 붓는 것도 필요해 질 것임
            item.BODY = rs.msgmst.BODY
            item.UDT = rs.msgmst.UDT
            item.reply = rs.reply
            item.replyinfo = rs.replyinfo
            item.act_later = rs.act_later
            item.act_fixed = rs.act_fixed
            //item.background = rs.act_later ? hush.cons.color_act_later : ""
        }
    }

    async function qryAction(addedParam) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryAction", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return null
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function qryActionForUser(addedParam) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryActionForUser", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return null
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function memProfile(e, row) {
        gst.ctx.data.header = row.AUTHORNM
        gst.ctx.menu = [
            { nm: "메시지 보내기", func: function(item, idx) {
                
            }},
            { nm: "VIP로 설정", func: function(item, idx) {
                
            }},
            { nm: "퇴장 시키기", color: 'red', func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
    }

    function rowRight(e, row, index) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        let textRead, oldKind, newKind
        const msgdtlRow = row.msgdtl.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
        if (msgdtlRow) {
            oldKind = msgdtlRow.KIND
            if (msgdtlRow.KIND == "read") {
                textRead = "다시읽지않음으로 처리"
                newKind = "unread"
            } else {
                textRead = "읽음으로 처리"
                newKind = "read"
            }
        } else {
            oldKind = "notyet"
            textRead = "읽음으로 처리"
            newKind = "read"
        }
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "반응 추가", img: "dimgray_emoti.png", func: function(item, idx) {
                alert(JSON.stringify(row))
            }},
            { nm: "스레드(댓글)", img: "dimgray_thread.png", func: function(item, idx) {
                
            }},
            { nm: "메시지 전달", img: "dimgray_forward.png", func: function(item, idx) {
                
            }},
            { nm: textRead, func: function(item, idx) {
                updateWithNewKind(row.MSGID, oldKind, newKind)
            }},
            { nm: "리마인더 받기", child: [
                { nm: "1시간 후", func: function(item, idx) { 
                    alert(item.nm+"@@@@"+idx)
                }},
                { nm: "내일", func: function(item, idx) { 
                    
                }},
                { nm: "다음 주", func: function(item, idx) { 
                    
                }},
                { nm: "사용자 지정", func: function(item, idx) { 
                    
                }}                
            ]},
            { nm: "새 댓글시 알림 받기", func: function(item, idx) {
                
            }},
            { nm: "채널에 고정", func: function(item, idx) {
                
            }},
            { nm: "링크로 복사", func: function(item, idx) {
                
            }},
            { nm: "메시지 편집", func: function(item, idx) {
                editMsgId.value = row.MSGID
                prevEditData = document.getElementById(editorId).innerHTML
                if (prevEditData.trim() != "") {
                    //gst.util.setToast("에디터에 이미 편집중인 데이터가 있습니다.")
                    //return
                }
                msgbody.value = row.BODY
            }},
            { nm: "메시지 삭제", color: "red", func: async function(item, idx) {
                try {
                    //if (!window.confirm("삭제후엔 복구가 불가능합니다. 진행할까요?")) return
                    const res = await axios.post("/chanmsg/delMsg", { 
                        msgid: row.MSGID, chanid: chanId
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    msglist.value.splice(index, 1) //해당 메시지 배열 항목 삭제해야 함 (일단 삭제하는 사용자 화면 기준만 해당)
                    if (hasProp()) { 
                        evClick({ type: "refreshFromReply", msgid: props.data.msgid })
                    } else {
                        if (msglistRef.value) msglistRef.value.procFromParent("deleteMsg", { msgid: row.MSGID })
                    }
                    if (appType == "later" || appType == "fixed") { //수정자 기준 : 패널 열려 있을 때
                        gst[appType].procFromBody("work", { msgid: row.MSGID, work: "delete" })
                    }
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    const onScrolling = () => { 
        // if (!scrollArea.value) return //오류 만났을 때
        // prevScrollY = scrollArea.value.scrollTop //자식에서도 prevScrollY는 필요함
        // prevScrollHeight = scrollArea.value.scrollHeight
        // readMsgToBeSeen()
        // saveCurScrollY(prevScrollY)
    }

    async function refreshMsgDtlWithQryAction(msgid) {
        let rs = await qryAction({ msgid: msgid }) //1개가 아닌 모든 kind 목록을 가져옴
        if (rs == null) return //rs = [{ KIND, CNT, NM }..] //NM은 이상병, 정일영 등으로 복수
        const item = msglist.value.find(function(row) { return row.MSGID == msgid })
        if (item) item.msgdtl = rs //해당 msgid 찾아 msgdtl을 통째로 업데이트함
    }

    async function updateWithNewKind(msgid, oldKind, newKind) {
        try {            
            const rq = { chanid: chanId, msgid: msgid, oldKind: oldKind, newKind: newKind }
            const res = await axios.post("/chanmsg/updateWithNewKind", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            await refreshMsgDtlWithQryAction(msgid)
            if (hasProp()) { //스레드에서 내가 안읽은 갯수를 Parent에도 전달해서 새로고침해야 함
                evClick({ type: "refreshFromReply", msgid: props.data.msgid }) //props.data.msgid는 자식의 부모 아이디
                const rs = await getMsg({ msgid: props.data.msgid })
                if (rs == null) return
                refreshWithGetMsg(rs, props.data.msgid)
            } else { 
                //굳이 실행하지 않아도 될 듯
            }
            if (oldKind == "read" || oldKind == "unread") {
                if (listMsgSel.value == "notyet" || listMsgSel.value == "unread") { //notyet은 실제로는 사용자가 이미 읽은 상태이므로 read로 변경되어 있을 것임
                    const idx = msglist.value.findIndex((item) => item.MSGID == msgid)
                    if (idx > -1) msglist.value.splice(idx, 1)
                }
                return //패널 업데이트 필요없음 (notyet은 변동없음)
            }
            if (appType == "home") { //if (route.fullPath.includes("/home_body/")) {
                gst.home.procFromBody("updateUnreadCnt", rq)
            } else if (appType == "dm") { //} else if (route.fullPath.includes("/dm_body/")) {
                gst.dm.procFromBody("updateUnreadCnt", rq)
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function updateAllWithNewKind(oldKind, newKind) {
        try {            
            const rq = { chanid: chanId, oldKind: oldKind, newKind: newKind }
            const res = await axios.post("/chanmsg/updateAllWithNewKind", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return            
            if (appType == "home") {
                gst.home.procFromBody("updateUnreadCnt", rq)
            } else if (appType == "dm") { 
                gst.dm.procFromBody("updateUnreadCnt", rq)
            }
            listMsg('notyet')
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function applyToBody(arr) {
        alert(JSON.stringify(arr))
    }
</script>

<template>
<div class="chan_main">
    <div class="chan_center" style="width:calc(100% - 620px)">
        <div class="chan_center_header" id="chan_center_header">
            <div class="chan_center_header_left">
                <!-- <img class="coImg18" :src="gst.html.getImageUrl(chanImg)" style="margin-right:5px" @click="adminJob"> -->
                <div style="display:flex;align-items:center">                    
                    <div class="coDotDot">{{ grnm }}</div>
                </div>
            </div>
            <div class="chan_center_header_right">

            </div>
        </div>
        <div class="chan_center_nav" id="chan_center_nav">
            <span style="margin-right:10px">그룹명</span><input type="text" v-model="grnm" style="width:300px"/>
            <span style="margin:0 10px">생성자</span><span>{{ masternm }}</span>
            그룹신규 그룹저장 그룹삭제
        </div> 
        <div class="chan_center_body" id="chan_center_body" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in userlist" :id="row.USERID" :ref="(ele) => { groupRow[row.USERID] = ele }" class="msg_body procMenu"  
                @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                <table>
                    <tr>
                        <td rowspan="4" style="width:20px"><input type="checkbox" id="checkbox" /></td>
                        <td class="tdLabel">이름</td>
                        <td>{{ row.USERNM }}</td>
                        <td style="width:150px">임직원/멤버</td>
                    </tr>
                    <tr>
                        <td class="tdLabel">소속</td>
                        <td>회사 부서</td>
                        <td style="width:150px">메일</td>
                    </tr>
                    <tr>
                        <td class="tdLabel">비고</td>
                        <td>{{ row.TYP }}</td>
                        <td style="width:150px">전화</td>
                    </tr>
                </table>
            </div>
        </div>
        <div class="chan_center_footer">
            <div style="display:flex;align-items:center;cursor:pointer">
                행신규 행저장 행삭제 hide/show
            </div>
            <div style="display:flex;align-items:center;cursor:pointer">
                <table>
                    <tr>
                        <td rowspan="4" style="width:20px"></td>
                        <td class="tdLabel">이름</td>
                        <td>name</td>
                        <td style="width:150px">임직원/멤버</td>
                    </tr>
                    <tr>
                        <td class="tdLabel">소속</td>
                        <td>회사 부서</td>
                        <td style="width:150px">메일</td>
                    </tr>
                    <tr>
                        <td class="tdLabel">비고</td>
                        <td>라라라</td>
                        <td style="width:150px">전화</td>
                    </tr>
                </table>
            </div>  
        </div>
    </div>
    <div class="chan_right" style="width:600px">
        <org-tree mode="tree" @ev-click="applyToBody"></org-tree>
    </div>  
</div>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>  
    .chan_main { /* 원래는 각 패널에 있다가 msglist 라우팅(새창에서열기) 때문에 여기로 이동 - 댓글 관련 */
        width:100%;height:100%;display:flex;
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
    .chan_center {
        height:100%;padding: 0 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;justify-content:space-between;border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_header_left {
        width:70%;height:100%;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .chan_center_nav {
        width:100%;min-height:60px;display:flex;align-items:center;
        border-bottom:1px solid dimgray;overflow:hidden
    }
    .list_msg_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .list_msg_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        display:flex;align-items:center;cursor:pointer
    }
    .chan_center_footer {
        width:100%;height:200px;margin:auto 0 10px 0;
        display:flex;flex-direction:column;
        border:1px solid lightgray;border-radius:5px;
    }
    .chan_right {
        height:100%;border-left:1px solid var(--second-color); /* 여기에 다시 MsgList.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
    }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:whitesmoke;font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .replyAct { display:flex;align-items:center;cursor:pointer }
    .replyAct:hover { background:#e6e7eb;border-radius:12px }
    .replyAct:active { background:var(--active-color) }
    .procMenu { padding:3px 3px 0px 3px }
    .procMenu:hover { background:whitesmoke }
    .procAct { padding:4px;margin-right:10px;border-radius:5px;background:white;cursor:pointer }
    .procAct:hover { background:lightgray }
    .procAct:active { background:var(--active-color) }
    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .editorMenu:active { background:var(--active-color) }
    .saveMenu { display:flex;align-items:center;padding:5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px }
    .saveMenu:hover { opacity:0.5 }
    .saveMenu:active { background:darkblue;opacity:1.0 }
    .btn { padding:3px 6px;display:flex;align-items:center;color:dimgray;border:1px solid dimgray;border-radius:5px;cursor:pointer }
    .btn:hover { background:lightgray}
    .btn:active { background:var(--active-color)}
    table { width:100%;border-collapse:collapse }
    td { padding:3px;border:1px solid lightgray }
    .tdLabel { width:50px;text-align:center;color:dimgray }
</style>
