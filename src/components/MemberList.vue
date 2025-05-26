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

    const emits = defineEmits(["ev-click", "ev-to-panel"]) //1) ev-click : OrgTree -> memberlist 2) ev-to-panel : memberlist -> GroupPanel
    defineExpose({ open, close }) //부모(예:HomePanel,DmPanel) => MemberList의 open(), close() 호출
    
    function evToPanel() { //말 그대로 패널에게 호출하는 것임
        emits("ev-to-panel", chanId)
    }

    function open(strKind, strChanid, strChannm, strChanimg) {
        show.value = true
        appType = strKind //chan or dm
        chanId = strChanid
        chanNm.value = strChannm //chan만 있음
        chanImg.value = strChanimg //chan만 있음
        getList()
    }

    function close() {
        show.value = false
    }

    const orgRef = ref(null) //memberlist(부모)가 OrgTree(자식)의 procFromParent()를 호출하기 위함

    const g_userid = gst.auth.getCookie("userid")
    let mounting = true
    
    let kind = ref(''), show = ref(false), chanId = '', chanNm = ref(''), chanImg = ref(null)
    const scrollArea = ref(null), userRow = ref({}) //userRow는 element를 동적으로 할당
    let onGoingGetList = false
        
    let grId
    let grnm = ref(''), masternm = ref(''), chkAll = ref(false), singleMode = ref('C')
    let memberlist = ref([]), chanmemFullExceptMe = ref([]), appType

    let rowIssync = ref(''), rowUserid = ref(''), rowUsernm = ref(''), rowKind = ref('')
    let rowOrg = ref(''), rowJob = ref(''), rowEmail = ref(''), rowTelno = ref(''), rowRmks = ref('')
    
    async function getList() {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            let param = { chanid: chanId }
            const res = await axios.post("/chanmsg/qryChanDmWithMemberList", param)
            const rs = gst.util.chkAxiosCode(res.data) 
            if (!rs) {
                onGoingGetList = false                
                return
            }
            chanImg.value = gst.util.getChanImg(rs.data.chanmst.TYP, rs.data.chanmst.STATE)
            chanmemFullExceptMe.value = []
            memberlist.value = []
            grnm.value = rs.data.chanmst.GR_NM
            masternm.value = rs.data.chanmst.MASTERNM
            document.title = grnm.value + " [그룹]"
            const len = rs.data.chandtl.length
            for (let i = 0; i < len; i++) {
                const row = rs.data.chandtl[i]
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                if (row.USERID != g_userid) chanmemFullExceptMe.value.push(row.USERNM)
                memberlist.value.push(row)
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
            memberlist.value[idx].chk = true
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
        memberlist.value.forEach(item => { item.chk = false })
        row.chk = true
        chkEditRow()
    }

    function chkEditRow() {
        const arr = memberlist.value.filter(item => item.chk)
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
            rowState.value = arr[0].STATE
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
            rowState.value = ''
        }
    }

    function changeChkAll() {
        const bool = chkAll.value
        memberlist.value.forEach(item => { item.chk = bool })
        chkEditRow()
    }

    function newMember() {
        memberlist.value.forEach(item => { item.chk = false })
        chkEditRow()
    }

    async function saveMember() {
        try {
            const arr = memberlist.value.filter(item => item.chk)
            if (arr.length > 1) { //기본적으로는 이 경고가 나오지 않아야 함
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
                if (idx > -1) memberlist.value[idx].chk = true
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
                const idxSel = memberlist.value.findIndex(item => item.chk && item.USERID == row.USERID)
                if (row.SYNC != "Y") {
                    memberlist.value[idxSel].USERNM = rowUsernm.value
                    memberlist.value[idxSel].ORG = rowOrg.value
                    memberlist.value[idxSel].JOB = rowJob.value
                    memberlist.value[idxSel].TELNO = rowTelno.value            
                }
                memberlist.value[idxSel].KIND = rowKind.value
                memberlist.value[idxSel].RMKS = rowRmks.value                
            }
            orgRef.value.procFromParent("refresh")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteMember() {
        try {
            const arr = memberlist.value.filter(item => item.chk)
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

    async function saveChanMaster() {
        try {
            const rq = { CHANID: chanId, CHANNM: chanNm.value, STATE: state.value ? "P" : "" } //chanId=new일 경우는 신규 채널 생성
            const res = await axios.post("/chanmsg/saveChanMaster", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (chanId == "new") {
                chanId = rs.data.chanid
                await getList()
            }
            //localStorage.wiseband_lastsel_grid = grId
            //evToPanel()
            //orgRef.value.procFromParent("refresh")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteGroup() {
        try {
            const rq = { CHANID: chanId }
            const res = await axios.post("/user/deleteGroup", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            evToPanel()
            //orgRef.value.procFromParent("refresh")
            //await router.replace({ name : 'group_body', params : { grid: "new" }})
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div class="chan_main">
                    <div class="chan_center" style="width:calc(100% - 620px);padding-right:10px;">
                        <div class="chan_center_header" id="chan_center_header">
                            <div class="chan_center_header_left">
                                <img class="coImg18" :src="gst.html.getImageUrl(chanImg)" style="margin-right:5px">
                                <div style="display:flex;align-items:center">                    
                                    <div v-if="appType=='dm'" class="coDotDot">{{ chanmemFullExceptMe.join(", ") }}</div>
                                    <div v-else class="coDotDot">{{ chanNm }} {{ grnm ? "[" + grnm+ "]" : "" }}</div>
                                </div>
                            </div>
                            <div class="chan_center_header_right">

                            </div>
                        </div>
                        <div style="width:100%;height:40px;padding-bottom:5px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid lightgray">
                            <div style="width:70%;height:100%;display:flex;align-items:center">
                                <input type="checkbox" v-model="chkAll" @change="changeChkAll()" style="margin-right:12px" />
                                <span v-if="appType=='chan'" style="margin-right:10px;color:dimgray">채널명 : </span>
                                <input v-if="appType=='chan'" type="text" v-model="chanNm" style="width:300px"/>
                                <span style="margin:0 10px;color:dimgray">생성자 : </span><span>{{ masternm }}</span>
                                <input type="checkbox" id="checkbox" v-model="state" style="margin-left:20px"/><label for="checkbox">비공개</label>
                            </div>
                            <div style="width:30%;height:100%;padding-right:10px;display:flex;align-items:center;justify-content:flex-end">
                                <div v-if="appType=='chan'" class="coImgBtn" @click="saveChanMaster()">
                                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                                    <span style="margin:0 5px;color:dimgray">채널저장</span>
                                </div>
                                <div class="coImgBtn" @click="deleteGroup" style="margin-left:5px">
                                    <img :src="gst.html.getImageUrl('dimgray_reset.png')" style="width:24px;height:24px">
                                    <span style="margin:0 5px;color:dimgray">{{ (appType == "dm" ? "DM" : "채널") + "삭제" }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="chan_center_body" id="chan_center_body" ref="scrollArea" @scroll="onScrolling">
                            <div v-for="(row, idx) in memberlist" :key="row.USERID" :ref="(ele) => { userRow[row.USERID] = ele }" :keyIndex="idx" class="msg_body procMenu"  
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
                                            <span v-if="row.STATE=='C' || row.STATE=='W'" style="margin-left:5px;padding:2px;font-size:10px;background:darkred;color:white;border-radius:5px">{{ row.STATE }}</span>
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
                                <div v-if="singleMode!=''" class="coImgBtn" @click="saveMember()" style="margin-right:6px">
                                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                                    <span style="margin:0 5px;color:dimgray">멤버저장</span>
                                </div>
                                <div class="coImgBtn" @click="deleteMember()" style="margin-right:6px">
                                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                                    <span style="margin:0 5px;color:dimgray">멤버삭제</span>
                                </div>
                                <div class="coImgBtn" @click="invite()" style="margin-right:6px">
                                    <img :src="gst.html.getImageUrl('search.png')" style="width:24px;height:24px">
                                    <span style="margin:0 5px;color:dimgray">초대</span>
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;cursor:pointer">
                                <table>
                                    <tbody>
                                        <tr>
                                            <td style="width:50px;border:none"></td>
                                            <td style="width:calc(100% - 300px);border:none"></td>
                                            <td style="width:50px;border:none"></td>
                                            <td style="width:200px;border:none"></td>
                                        </tr>
                                        <tr>
                                            <td class="tdLabel">이름</td>
                                            <td class="tdValue">
                                                <input type="text" style="width:150px" v-model="rowUsernm" disabled="true"/>
                                                <span style="margin-left:10px;color:dimgray">직책/업무</span>
                                                <input type="text" style="width:200px;margin-left:10px" v-model="rowJob" disabled="true"/>
                                                <span style="margin-left:10px">{{  }}</span>
                                            </td>
                                            <td class="tdValue" colspan="2">
                                                <div style="display:flex;align-items:center">
                                                    <input type="radio" id="member" value="member" selected v-model="rowKind"><label for="member">Member</label>
                                                    <input type="radio" id="admin" value="admin" v-model="rowKind"><label for="admin">Admin</label>
                                                    <input type="radio" id="guest" value="guest" v-model="rowKind"><label for="guest">Guest</label>
                                                </div>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td class="tdLabel">소속</td>
                                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowOrg" disabled="true"/></td>
                                            <td class="tdLabel">이메일</td>                        
                                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowEmail" disabled="true"/></td>
                                        </tr>
                                        <tr>
                                            <td class="tdLabel">비고</td>
                                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowRmks" disabled="true"/></td>
                                            <td class="tdLabel">전화</td>                        
                                            <td class="tdValue"><input type="text" class="tdInput" v-model="rowTelno" disabled="true"/></td>   
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
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>
    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    .popup {
        position:fixed;width:90%;height:90%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;border-radius:10px
    }
    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }
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
    .tdValue { vertical-align:middle;border:none }
</style>
