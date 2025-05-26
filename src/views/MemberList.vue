<script setup>










    //지우기










    import { ref, onMounted, nextTick, useTemplateRef, onActivated, onUnmounted } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import ContextMenu from "/src/components/ContextMenu.vue"
    import OrgTree from "/src/components/OrgTree.vue"
            
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    const emits = defineEmits(["ev-click", "ev-to-panel"]) //1) ev-click : OrgTree -> UserList 2) ev-to-panel : UserList -> GroupPanel
    //defineExpose({ procFromParent }) //부모(예:GroupPanel) => UserList의 procFromParent()를 호출하기 위함 : procFromParent는 바로 아래 OrgTree(자식)의 procFromParent()를 호출하기도 함

    //async function procFromParent(kind) {
    //    if (kind == "newGroup") {
    //        alert(kind)
    //    }
    //}
    
    function evToPanel(grid) { //말 그대로 패널에게 호출하는 것임
        emits("ev-to-panel", grid)
    }

    const orgRef = ref(null) //UserList(부모)가 OrgTree(자식)의 procFromParent()를 호출하기 위함

    const g_userid = gst.auth.getCookie("userid")
    let mounting = true
    
    const scrollArea = ref(null), userRow = ref({}) //userRow는 element를 동적으로 할당
    let onGoingGetList = false
        
    let sideMenu = "mnuGroup", grId
    let grnm = ref(''), masternm = ref(''), chkAll = ref(false), singleMode = ref('C')
    let userlist = ref([])

    let rowIssync = ref(''), rowUserid = ref(''), rowUsernm = ref(''), rowKind = ref('')
    let rowOrg = ref(''), rowJob = ref(''), rowEmail = ref(''), rowTelno = ref(''), rowRmks = ref('')

    onMounted(async () => {
        try {
            setBasicInfo()
            if (grId == "new") {
                //gst.util.setSnack("먼저 그룹명을 입력후 그룹명저장을 누르시기 바랍니다.", true)
            } else {
                await getList()                    
            }
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

    // function saveCurScrollY(posY) {
    //     if (!grId) return
    //     const key = grId
    //     if (!gst.objSaved[key]) gst.objSaved[key] = {}
    //     gst.objSaved[key].scrollY = posY
    // }

    // function chanCtxMenu(e) {
    //     gst.ctx.data.header = ""
    //     gst.ctx.menu = [
    //         { nm: "새창에서 열기", func: function(item, idx) {

    //         }},
    //         { nm: "정보 보기", func: function(item, idx) {
                
    //         }},
    //         { nm: "링크 복사", func: function(item, idx) {
                
    //         }},
    //         { nm: "설정", func: function(item, idx) {
                
    //         }},
    //         { nm: "알림 변경", func: function(item, idx) {
                
    //         }},
    //         { nm: "즐겨찾기", func: function(item, idx) {
                
    //         }},
    //         { nm: "나가기", color: 'red', func: function(item, idx) {
                
    //         }}
    //     ]
    //     gst.ctx.show(e)
    // }

    async function getList(addedParam) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            let param = { grid: grId }
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const kind = param.kind
            const res = await axios.post("/user/qryGroupWithUserList", param)
            const rs = gst.util.chkAxiosCode(res.data) 
            if (!rs) {
                onGoingGetList = false                
                return
            }
            userlist.value = []
            grnm.value = rs.list[0].GR_NM
            masternm.value = rs.list[0].MASTERNM
            document.title = grnm.value + " [그룹]"
            const grdtl = rs.list[0].userlist
            const len = grdtl.length
            for (let i = 0; i < len; i++) {
                const row = grdtl[i]
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                userlist.value.push(row)
            }
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    // async function getMsg(addedParam, verbose) {
    //     try {
    //         let param = { chanid: chanId } //기본 param
    //         if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
    //         const res = await axios.post("/chanmsg/qryMsg", param)
    //         const rs = gst.util.chkAxiosCode(res.data)
    //         if (!rs) {
    //             if (verbose) gst.util.setToast(rs.msg)
    //             return null
    //         }
    //         return rs.data
    //     } catch (ex) {
    //         gst.util.showEx(ex, true)
    //     }
    // }

    // function refreshWithGetMsg(rs, msgid) {
    //     let item = msglist.value.find(function(row) { return row.MSGID == msgid })
    //     if (item) { //필요한 경우 추가하기로 함. 그러나 결국엔 한번에 붓는 것도 필요해 질 것임
    //         item.BODY = rs.msgmst.BODY
    //         item.UDT = rs.msgmst.UDT
    //         item.reply = rs.reply
    //         item.replyinfo = rs.replyinfo
    //         item.act_later = rs.act_later
    //         item.act_fixed = rs.act_fixed
    //         //item.background = rs.act_later ? hush.cons.color_act_later : ""
    //     }
    // }

    // async function qryAction(addedParam) {
    //     try {
    //         let param = { chanid: chanId } //기본 param
    //         if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
    //         const res = await axios.post("/chanmsg/qryAction", param)
    //         const rs = gst.util.chkAxiosCode(res.data)
    //         if (!rs) return null
    //         return rs.data
    //     } catch (ex) {
    //         gst.util.showEx(ex, true)
    //     }
    // }

    // async function qryActionForUser(addedParam) {
    //     try {
    //         let param = { chanid: chanId } //기본 param
    //         if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
    //         const res = await axios.post("/chanmsg/qryActionForUser", param)
    //         const rs = gst.util.chkAxiosCode(res.data)
    //         if (!rs) return null
    //         return rs.data
    //     } catch (ex) {
    //         gst.util.showEx(ex, true)
    //     }
    // }

    // function memProfile(e, row) {
    //     gst.ctx.data.header = row.AUTHORNM
    //     gst.ctx.menu = [
    //         { nm: "메시지 보내기", func: function(item, idx) {
                
    //         }},
    //         { nm: "VIP로 설정", func: function(item, idx) {
                
    //         }},
    //         { nm: "퇴장 시키기", color: 'red', func: function(item, idx) {
                
    //         }}
    //     ]
    //     gst.ctx.show(e)
    // }

    // function rowRight(e, row, index) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
    //     let textRead, oldKind, newKind
    //     const msgdtlRow = row.msgdtl.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
    //     if (msgdtlRow) {
    //         oldKind = msgdtlRow.KIND
    //         if (msgdtlRow.KIND == "read") {
    //             textRead = "다시읽지않음으로 처리"
    //             newKind = "unread"
    //         } else {
    //             textRead = "읽음으로 처리"
    //             newKind = "read"
    //         }
    //     } else {
    //         oldKind = "notyet"
    //         textRead = "읽음으로 처리"
    //         newKind = "read"
    //     }
    //     gst.ctx.data.header = ""
    //     gst.ctx.menu = [
    //         { nm: "반응 추가", img: "dimgray_emoti.png", func: function(item, idx) {
    //             alert(JSON.stringify(row))
    //         }},
    //         { nm: "스레드(댓글)", img: "dimgray_thread.png", func: function(item, idx) {
                
    //         }},
    //         { nm: "메시지 전달", img: "dimgray_forward.png", func: function(item, idx) {
                
    //         }},
    //         { nm: textRead, func: function(item, idx) {
    //             updateWithNewKind(row.MSGID, oldKind, newKind)
    //         }},
    //         { nm: "리마인더 받기", child: [
    //             { nm: "1시간 후", func: function(item, idx) { 
    //                 alert(item.nm+"@@@@"+idx)
    //             }},
    //             { nm: "내일", func: function(item, idx) { 
                    
    //             }},
    //             { nm: "다음 주", func: function(item, idx) { 
                    
    //             }},
    //             { nm: "사용자 지정", func: function(item, idx) { 
                    
    //             }}                
    //         ]},
    //         { nm: "새 댓글시 알림 받기", func: function(item, idx) {
                
    //         }},
    //         { nm: "채널에 고정", func: function(item, idx) {
                
    //         }},
    //         { nm: "링크로 복사", func: function(item, idx) {
                
    //         }},
    //         { nm: "메시지 편집", func: function(item, idx) {
    //             editMsgId.value = row.MSGID
    //             prevEditData = document.getElementById(editorId).innerHTML
    //             if (prevEditData.trim() != "") {
    //                 //gst.util.setToast("에디터에 이미 편집중인 데이터가 있습니다.")
    //                 //return
    //             }
    //             msgbody.value = row.BODY
    //         }},
    //         { nm: "메시지 삭제", color: "red", func: async function(item, idx) {
    //             try {
    //                 //if (!window.confirm("삭제후엔 복구가 불가능합니다. 진행할까요?")) return
    //                 const res = await axios.post("/chanmsg/delMsg", { 
    //                     msgid: row.MSGID, chanid: chanId
    //                 })
    //                 const rs = gst.util.chkAxiosCode(res.data)
    //                 if (!rs) return
    //                 msglist.value.splice(index, 1) //해당 메시지 배열 항목 삭제해야 함 (일단 삭제하는 사용자 화면 기준만 해당)
    //                 if (hasProp()) { 
    //                     evClick({ type: "refreshFromReply", msgid: props.data.msgid })
    //                 } else {
    //                     if (msglistRef.value) msglistRef.value.procFromParent("deleteMsg", { msgid: row.MSGID })
    //                 }
    //                 if (appType == "later" || appType == "fixed") { //수정자 기준 : 패널 열려 있을 때
    //                     gst[appType].procFromBody("work", { msgid: row.MSGID, work: "delete" })
    //                 }
    //             } catch (ex) { 
    //                 gst.util.showEx(ex, true)
    //             }
    //         }}
    //     ]
    //     gst.ctx.show(e)
    // }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    // const onScrolling = () => { 
    //     // if (!scrollArea.value) return //오류 만났을 때
    //     // prevScrollY = scrollArea.value.scrollTop //자식에서도 prevScrollY는 필요함
    //     // prevScrollHeight = scrollArea.value.scrollHeight
    //     // readMsgToBeSeen()
    //     // saveCurScrollY(prevScrollY)
    // }

    // async function refreshMsgDtlWithQryAction(msgid) {
    //     let rs = await qryAction({ msgid: msgid }) //1개가 아닌 모든 kind 목록을 가져옴
    //     if (rs == null) return //rs = [{ KIND, CNT, NM }..] //NM은 이상병, 정일영 등으로 복수
    //     const item = msglist.value.find(function(row) { return row.MSGID == msgid })
    //     if (item) item.msgdtl = rs //해당 msgid 찾아 msgdtl을 통째로 업데이트함
    // }

    // async function updateWithNewKind(msgid, oldKind, newKind) {
    //     try {            
    //         const rq = { chanid: chanId, msgid: msgid, oldKind: oldKind, newKind: newKind }
    //         const res = await axios.post("/chanmsg/updateWithNewKind", rq)
    //         let rs = gst.util.chkAxiosCode(res.data)
    //         if (!rs) return
    //         await refreshMsgDtlWithQryAction(msgid)
    //         if (hasProp()) { //스레드에서 내가 안읽은 갯수를 Parent에도 전달해서 새로고침해야 함
    //             evClick({ type: "refreshFromReply", msgid: props.data.msgid }) //props.data.msgid는 자식의 부모 아이디
    //             const rs = await getMsg({ msgid: props.data.msgid })
    //             if (rs == null) return
    //             refreshWithGetMsg(rs, props.data.msgid)
    //         } else { 
    //             //굳이 실행하지 않아도 될 듯
    //         }
    //         if (oldKind == "read" || oldKind == "unread") {
    //             if (listMsgSel.value == "notyet" || listMsgSel.value == "unread") { //notyet은 실제로는 사용자가 이미 읽은 상태이므로 read로 변경되어 있을 것임
    //                 const idx = msglist.value.findIndex((item) => item.MSGID == msgid)
    //                 if (idx > -1) msglist.value.splice(idx, 1)
    //             }
    //             return //패널 업데이트 필요없음 (notyet은 변동없음)
    //         }
    //         if (appType == "home") { //if (route.fullPath.includes("/home_body/")) {
    //             gst.home.procFromBody("updateUnreadCnt", rq)
    //         } else if (appType == "dm") { //} else if (route.fullPath.includes("/dm_body/")) {
    //             gst.dm.procFromBody("updateUnreadCnt", rq)
    //         }
    //     } catch (ex) { 
    //         gst.util.showEx(ex, true)
    //     }
    // }

    // async function updateAllWithNewKind(oldKind, newKind) {
    //     try {            
    //         const rq = { chanid: chanId, oldKind: oldKind, newKind: newKind }
    //         const res = await axios.post("/chanmsg/updateAllWithNewKind", rq)
    //         let rs = gst.util.chkAxiosCode(res.data)
    //         if (!rs) return            
    //         if (appType == "home") {
    //             gst.home.procFromBody("updateUnreadCnt", rq)
    //         } else if (appType == "dm") { 
    //             gst.dm.procFromBody("updateUnreadCnt", rq)
    //         }
    //         listMsg('notyet')
    //     } catch (ex) { 
    //         gst.util.showEx(ex, true)
    //     }
    // }

    async function applyToBody(arr, mode) {
        if (grId == "new" || singleMode.value != "C") {
            gst.util.setSnack("조직도/내그룹에서 선택추가시는 그룹이 먼저 저장되고 행선택이 없어야 합니다.")
            return
        }
        for (let i = 0; i < arr.length; i++) {
            const row = arr[i]
            const rq = { crud: "C", GR_ID: grId }
            if (mode == "tree") { //수동입력이 아닌 조직도에서 넘기는 것임 (SYNC=Y)
                rq.USERID = row.USERID
                rq.USERNM = row.USERNM
                rq.SYNC = "Y"
                rq.KIND = "member"
            } else { //mygroup (인사연동+수동입력 혼재)
                if (row.SYNC == "Y") { //수동입력이 아닌 조직도에서 넘긴 것을 내그룹으로 저장한 것임
                    rq.USERID = row.USERID
                    rq.USERNM = row.USERNM
                    rq.SYNC = "Y"
                    rq.KIND = "member"
                } else {
                    rq.USERID = row.USERID
                    rq.USERNM = row.USERNM
                    rq.SYNC = ""
                    rq.KIND = "guest"
                    rq.ORG = row.ORG
                    rq.JOB = row.JOB
                    rq.EMAIL = row.EMAIL
                    rq.TELNO = row.TELNO
                }
            }
            const res = await axios.post("/user/saveMember", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) break
        }        
        await getList()
        await nextTick()
        for (let i = 0; i < arr.length; i++) {
            const row = arr[i]
            const userid = row.USER_ID ? row.USER_ID : row.USERID
            const idx = gst.util.getKeyIndex(userRow, userid)
            userlist.value[idx].chk = true
        }
        if (arr.length == 1) {
            const userid = arr[0].USER_ID ? arr[0].USER_ID : arr[0].USERID
            gst.util.scrollIntoView(userRow, userid)
        }
        orgRef.value.procFromParent("refresh")
    }

    function changeChk(row, idx) {
        chkEditRow()
    }

    function rowClick(e, row, idx) {
        if (e.target.nodeName == "INPUT") return //e.currentTarget.nodeName은 DIV로 나옴
        userlist.value.forEach(item => { item.chk = false })
        row.chk = true
        chkEditRow()
    }

    function chkEditRow() {
        const arr = userlist.value.filter(item => item.chk)
        if (arr.length == 1) {
            singleMode.value = 'E' //편집모드
            rowIssync.value = arr[0].SYNC
            rowUserid.value = arr[0].USERID
            rowUsernm.value = arr[0].USERNM
            rowOrg.value = arr[0].ORG
            rowJob.value = arr[0].JOB
            rowRmks.value = arr[0].RMKS
            rowKind.value = arr[0].KIND
            rowEmail.value = arr[0].EMAIL
            rowTelno.value = arr[0].TELNO
        } else {
            singleMode.value = (arr.length == 0) ? 'C' : ''
            rowIssync.value = ''
            rowUserid.value = ''
            rowUsernm.value = ''
            rowOrg.value = ''
            rowJob.value = ''
            rowRmks.value = ''
            rowKind.value = ''
            rowEmail.value = ''
            rowTelno.value = ''
        }
    }

    function changeChkAll() {
        const bool = chkAll.value
        userlist.value.forEach(item => { item.chk = bool })
        chkEditRow()
    }

    function newMember() {
        userlist.value.forEach(item => { item.chk = false })
        chkEditRow()
    }

    async function saveMember() {
        try {
            const arr = userlist.value.filter(item => item.chk)
            if (arr.length > 1) {
                gst.util.setSnack("한 행 이상 선택되었습니다.")
                return
            }
            if (arr.length == 0) { //신규멤버 (여기서는 W입력만 해당됨)
                const rq = { 
                    crud: "C", GR_ID: grId, USERNM: rowUsernm.value, SYNC: "", KIND: rowKind.value,
                    ORG: rowOrg.value, JOB: rowJob.value, EMAIL: rowEmail.value, TELNO: rowTelno.value, RMKS: rowRmks.value
                }
                const res = await axios.post("/user/saveMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return //서버 호출 저장 진행후 아래 처리 (가나다순으로 찾아서 해당 위치에 넣고 스크롤링 + 패널에도 반영)
                await getList()
                await nextTick()
                const idx = gst.util.getKeyIndex(userRow, rowEmail.value)
                if (idx > -1) userlist.value[idx].chk = true
                gst.util.scrollIntoView(userRow, rowEmail.value)
            } else {
                const row = arr[0] //row.USERID is one of key
                const rq = { crud: "U", GR_ID: grId, USERID: row.USERID }
                if (row.SYNC != "Y") {                
                    rq.USERNM = rowUsernm.value
                    rq.ORG = rowOrg.value
                    rq.JOB = rowJob.value
                    rq.EMAIL = rowJob.value
                    rq.TELNO = rowTelno.value
                }
                rq.KIND = rowKind.value
                rq.RMKS = rowRmks.value                
                const res = await axios.post("/user/saveMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return //서버 호출 저장 진행후 아래 처리 + 패널에도 반영
                const idxSel = userlist.value.findIndex(item => item.chk && item.USERID == row.USERID)
                if (row.SYNC != "Y") {
                    userlist.value[idxSel].USERNM = rowUsernm.value
                    userlist.value[idxSel].ORG = rowOrg.value
                    userlist.value[idxSel].JOB = rowJob.value
                    userlist.value[idxSel].TELNO = rowTelno.value            
                }
                userlist.value[idxSel].KIND = rowKind.value
                userlist.value[idxSel].RMKS = rowRmks.value                
            }
            orgRef.value.procFromParent("refresh")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteMember() {
        try {
            const arr = userlist.value.filter(item => item.chk)
            const len = arr.length
            if (len == 0) {
                gst.util.setSnack("선택한 행이 없습니다.")
                return
            }
            for (let i = 0; i < len; i++) {
                const rq = { GR_ID: grId, USERID: arr[i].USERID }
                const res = await axios.post("/user/deleteMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) break
            }
            newMember()
            await getList()
            orgRef.value.procFromParent("refresh")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function saveGroupMaster() {
        try {
            const rq = { GR_ID: grId, GR_NM: grnm.value } //grId=new일 경우는 신규그룹 생성
            const res = await axios.post("/user/saveGroupMaster", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (grId == "new") {
                grId = rs.data.grid
                await getList()
            }
            localStorage.wiseband_lastsel_grid = grId
            evToPanel(grId)
            orgRef.value.procFromParent("refresh")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteGroup() {
        try {
            const rq = { GR_ID: grId }
            const res = await axios.post("/user/deleteGroup", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            evToPanel()
            orgRef.value.procFromParent("refresh")
            await router.replace({ name : 'group_body', params : { grid: "new" }})
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }
</script>

<template>
<div class="chan_main">
    <div class="chan_center" style="width:calc(100% - 620px);padding-right:10px;">
        <div class="chan_center_header" id="chan_center_header">
            <div class="chan_center_header_left">
                 <img class="coImg18" :src="gst.html.getImageUrl('violet_people2.png')" style="margin-right:5px">
                <div style="display:flex;align-items:center">                    
                    <div class="coDotDot">{{ grnm }}</div>
                </div>
            </div>
            <div class="chan_center_header_right">

            </div>
        </div>
        <div style="width:100%;height:40px;padding-bottom:5px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid lightgray">
            <div style="width:70%;height:100%;display:flex;align-items:center">
                <input type="checkbox" v-model="chkAll" @change="changeChkAll()" style="margin-right:12px" />
                <span style="margin-right:10px;color:dimgray">그룹명 : </span><input type="text" v-model="grnm" style="width:300px"/>
                <span style="margin:0 10px;color:dimgray">생성자 : </span><span>{{ masternm }}</span>
            </div>
            <div style="width:30%;height:100%;padding-right:10px;display:flex;align-items:center;justify-content:flex-end">
                <div class="coImgBtn" @click="saveGroupMaster()">
                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                    <span style="margin:0 5px;color:dimgray">그룹명저장</span>
                </div>
                <div class="coImgBtn" @click="deleteGroup" style="margin-left:5px">
                    <img :src="gst.html.getImageUrl('dimgray_reset.png')" style="width:24px;height:24px">
                    <span style="margin:0 5px;color:dimgray">그룹삭제</span>
                </div>
            </div>
        </div>
        <div class="chan_center_body" id="chan_center_body" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in userlist" :key="row.USERID" :ref="(ele) => { userRow[row.USERID] = ele }" :keyIndex="idx" class="msg_body procMenu"  
                @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="(e) => rowClick(e, row, idx)">
                <div style="width:20px;padding-right:10px;display:flex;justify-content:center;align-items:center">
                    <input type="checkbox" v-model="row.chk" @change="changeChk(row, idx)" />
                </div>
                <div style="width:20px;padding-right:10px;display:flex;justify-content:center;align-items:center">
                    <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                </div>
                <div style="width:calc(100% - 60px);display:flex;flex-direction:column">
                    <div style="width:100%;height:24px;display:flex;align-items:center;justify-content:space-between">
                        <div style="display:flex;align-items:center">
                            <span style="margin-right:10px;font-weight:bold;color:darkblue">{{ row.USERNM }}</span>
                            <span>{{ row.JOB }}</span>
                        </div>
                        <div style="width:45px;margin-right:5px;display:flex;justify-content:flex-end;align-items:center">
                            <span v-if="row.KIND=='guest' || row.KIND=='admin'" :title="row.KIND" style="margin-left:5px;padding:2px;font-size:10px;background:steelblue;color:white;border-radius:5px">
                                {{ row.KIND.substring(0, 1).toUpperCase() }}
                            </span>
                            <span v-if="row.SYNC != 'Y'" title="수동입력" style="margin-left:5px;padding:2px;font-size:10px;background:darkred;color:white;border-radius:5px">M</span>
                        </div>
                    </div>
                    <div style="width:100%;height:24px;display:flex;align-items:center;justify-content:space-between">
                        <div style="width:calc(100% - 150px);display:flex;align-items:center">
                            <div class="coDotDot" style="width:100%">{{ row.ORG }}</div>
                        </div>
                        <div style="width:150px;display:flex;justify-content:flex-end">{{ row.EMAIL }}</div>                           
                    </div>
                    <div style="width:100%;height:24px;display:flex;align-items:center;justify-content:space-between">
                        <div style="width:calc(100% - 150px);display:flex;align-items:center">
                            <div class="coDotDot" style="width:100%;color:dimgray">{{ row.RMKS }}</div>
                        </div>
                        <div style="width:150px;display:flex;justify-content:flex-end">{{ row.TELNO }}</div>
                    </div>
                </div>
            </div>
        </div>
        <div class="chan_center_footer">
            <div style="padding-top:10px;display:flex;align-items:center;cursor:pointer">
                <div v-if="singleMode!=''" class="coImgBtn" @click="newMember()" style="margin-right:6px">
                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                    <span style="margin:0 5px;color:dimgray">신규멤버</span>
                </div>
                <div v-if="singleMode!=''" class="coImgBtn" @click="saveMember()" style="margin-right:6px">
                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                    <span style="margin:0 5px;color:dimgray">멤버저장</span>
                </div>
                <div class="coImgBtn" @click="deleteMember()" style="margin-right:6px">
                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                    <span style="margin:0 5px;color:dimgray">멤버삭제</span>
                </div>
                <span style="color:darkblue">조직도에 없는 멤버만 신규멤버 버튼으로 추가합니다.</span>
            </div>
            <div style="display:flex;align-items:center;cursor:pointer">
                <table>
                    <tbody>
                        <tr>
                            <td style="width:50px;border:none"></td>
                            <td style="width:calc(100% - 250px);border:none"></td>
                            <td style="width:50px;border:none"></td>
                            <td style="width:150px;border:none"></td>
                        </tr>
                        <tr>
                            <td class="tdLabel">이름</td>
                            <td class="tdValue">
                                <input type="text" style="width:150px" v-model="rowUsernm" :disabled="rowIssync == 'Y'"/>
                                <span style="margin-left:10px;color:dimgray">직책/업무</span>
                                <input type="text" style="width:200px;margin-left:10px" v-model="rowJob" :disabled="rowIssync == 'Y'"/>
                            </td>
                            <td class="tdValue" colspan="2">
                                <input type="radio" id="member" value="member" v-model="rowKind"><label for="member">Member</label>
                                <input type="radio" id="admin" value="admin" v-model="rowKind"><label for="admin">Admin</label>
                                <input type="radio" id="guest" value="guest" v-model="rowKind"><label for="guest">Guest</label>
                            </td>
                        </tr>
                        <tr>
                            <td class="tdLabel">소속</td>
                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowOrg" :disabled="rowIssync == 'Y'"/></td>
                            <td class="tdLabel">이메일</td>                        
                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowEmail" :disabled="rowIssync == 'Y' || singleMode != 'C'"/></td>
                        </tr>
                        <tr>
                            <td class="tdLabel">비고</td>
                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowRmks"/></td>
                            <td class="tdLabel">전화</td>                        
                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowTelno" :disabled="rowIssync == 'Y'"/></td>   
                        </tr>
                    </tbody>
                </table>
            </div>  
        </div>
    </div>
    <div class="chan_right" style="width:600px">
        <org-tree mode="tree" ref="orgRef" @ev-click="applyToBody"></org-tree>
    </div>  
</div>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>
    input[type="checkbox"] { min-width:16px;min-height:16px }  
    .chan_main { /* 원래는 각 패널에 있다가 msglist 라우팅(새창에서열기) 때문에 여기로 이동 - 댓글 관련 */
        width:100%;height:100%;display:flex;
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
    .chan_center {
        height:100%;padding: 0 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:45px;display:flex;justify-content:space-between;align-items:center;;overflow:hidden
    }
    .chan_center_header_left {
        width:70%;height:100%;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .list_msg_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .list_msg_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .chan_center_body {
        width:100%;height:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        width:calc(100% - 8px);display:flex;align-items:center;cursor:pointer;border-bottom:1px solid lightgray
    }
    .chan_center_footer {
        width:100%;margin:auto 0 10px 0;
        display:flex;flex-direction:column;
        border-top:2px solid lightgray;border-radius:5px;
    }
    .chan_right {
        height:100%;border-left:1px solid lightgray; /* 여기에 다시 MsgList.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
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
    .tdLabel { color:dimgray;border:none }
    .tdInput { width:calc(100% - 10px) }
    .tdValue { border:none }
</style>
