<script setup>
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

    const emits = defineEmits(["ev-to-panel"]) //1) ev-click : OrgTree -> UserList 2) ev-to-panel : UserList -> GroupPanel
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
            //gst.home.procFromBody("recall", { grid: grId })
        }
    })

    function setBasicInfo() {        
        //sideMenu = gst.selSideMenu
        //if (!sideMenu) sideMenu = "mnuGroup"
        if (route.params.grid) grId = route.params.grid
    }

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

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    async function applyToBody(arr, mode) {
        if (grId == "new" || singleMode.value != "C") {
            gst.util.setSnack("먼저 그룹이 저장되어야 하고 행선택도 없어야 합니다.")
            return
        }
        const brr = [] //추가시 중복된 멤버 빼고 추가 성공한 멤버 배열
        for (let i = 0; i < arr.length; i++) {
            const row = arr[i]
            const rq = { crud: "C", GR_ID: grId, USERID: row.USERID, USERNM: row.USERNM, KIND: "member" }
            if (mode == "tree") { //수동입력이 아닌 조직도에서 넘기는 것임 (SYNC=Y)
                rq.SYNC = "Y"
            } else { //mygroup (인사연동+수동입력 혼재)
                if (row.SYNC == "Y") { //수동입력이 아닌 조직도에서 넘긴 것을 내그룹으로 저장한 것임
                    rq.SYNC = "Y"
                } else {
                    rq.SYNC = ""
                    rq.ORG = row.ORG
                    rq.JOB = row.JOB
                    rq.EMAIL = row.EMAIL
                    rq.TELNO = row.TELNO
                    rq.RMKS = row.RMKS
                }
            }
            const res = await axios.post("/user/saveMember", rq)
            const rs = gst.util.chkAxiosCode(res.data, true) //true : 중복 체크 등 오류 표시 넘어감
            if (rs) brr.push(row) //if (!rs) return //loop내 오류메시지 표시하려면 break가 아닌 return을 사용해야 하나 오류 표시하지 않고 추가 성공한 항목만 담아서 표시함
        }
        await getList()
        await nextTick()
        for (let i = 0; i < brr.length; i++) {
            const row = brr[i]
            const idx = gst.util.getKeyIndex(userRow, row.USERID)
            if (idx > -1) userlist.value[idx].chk = true
        }
        if (brr.length == 1) {
            gst.util.scrollIntoView(userRow, brr[0].USERID)
        }
        orgRef.value.procFromParent("refresh")
        if (arr.length != brr.length) gst.util.setSnack("선택 : " + arr.length + " / 추가 : " + brr.length)
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
            if (!confirm("선택한 행(" + arr.length + "건)을 삭제할까요?")) return
            for (let i = 0; i < len; i++) {
                const rq = { GR_ID: grId, USERID: arr[i].USERID }
                const res = await axios.post("/user/deleteMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
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
            if (!confirm("[" + grnm.value + "]그룹에 대해 전체 삭제를 진행합니다. 계속할까요?")) return
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
            <div v-for="(row, idx) in userlist" :key="row.USERID" :ref="(ele) => { userRow[row.USERID] = ele }" :keyidx="idx" class="msg_body procMenu"  
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
        <org-tree mode="mygroup" ref="orgRef" @ev-click="applyToBody"></org-tree>
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
