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

    const emits = defineEmits(["ev-from-member"]) //memberlist -> HomePanel or DmPanel
    defineExpose({ open, close }) //부모(예:HomePanel,DmPanel) => MemberList의 open(), close() 호출
    
    function evToPanel() { //말 그대로 패널에게 호출하는 것임
        emits("ev-from-member", chanId)
    }

    function open(strKind, strChanid, strChannm, strChanimg) {
        show.value = true
        appType = strKind //chan or dm
        chanId = strChanid //채널아이디 또는 new
        memberlist.value = []
        chanNm.value = ""
        if (appType == "chan") {
            if (chanId == "new") {
                grId = strChannm //그룹 아이디
                state.value = false
            } else {
                chanNm.value = strChannm //chan만 있음
                chanImg.value = strChanimg //chan만 있음
                getList()
            }
        } else {
            if (chanId == "new") {
                state.value = true
            } else {
                getList()
            }
        }
    }

    function close() {
        show.value = false
    }

    const orgRef = ref(null) //memberlist(부모)가 OrgTree(자식)의 procFromParent()를 호출하기 위함

    const g_userid = gst.auth.getCookie("userid")
    let mounting = true
    
    let kind = ref(''), show = ref(false), chanId = '', chanNm = ref(''), chanImg = ref(null), state = ref(false)
    const scrollArea = ref(null), memberRow = ref({}) //memberRow는 element를 동적으로 할당
    let onGoingGetList = false
        
    let grId
    let grnm = ref(''), masternm = ref(''), chkAll = ref(false), singleMode = ref('C')
    let memberlist = ref([]), chanmemFullExceptMe = ref([]), appType

    let rowIssync = ref(''), rowUserid = ref(''), rowUsernm = ref(''), rowKind = ref('')
    let rowOrg = ref(''), rowJob = ref(''), rowEmail = ref(''), rowTelno = ref(''), rowRmks = ref(''), rowState = ref('')
    
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
            state.value = (rs.data.chanmst.STATE == "P") ? true : false
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
        if (appType == "chan" && (chanId == "new" || singleMode.value != "C")) {
            gst.util.setSnack("먼저 채널이 저장되어야 하고 행선택도 없어야 합니다.")
            return
        } else if (appType == "dm" && chanId == "new") {
            const ret = await saveChanMaster()
            if (!ret) return //DM은 마스터에 저장할 내용이 없으므로 사용자가 행을 먼저 추가하더라도 백엔드에서 마스터를 먼저 저장해야 함
        }
        const brr = [] //추가시 중복된 멤버 빼고 추가 성공한 멤버 배열
        for (let i = 0; i < arr.length; i++) {
            const row = arr[i]
            const rq = { crud: "C", CHANID: chanId, USERID: row.USERID, USERNM: row.USERNM, KIND: "member", SYNC: row.SYNC }
            const res = await axios.post("/chanmsg/saveChanMember", rq)
            const rs = gst.util.chkAxiosCode(res.data, true) //true : 중복 체크 등 오류 표시 넘어감
            if (rs) brr.push(row) //if (!rs) return //loop내 오류메시지 표시하려면 break가 아닌 return을 사용해야 하나 오류 표시하지 않고 추가 성공한 항목만 담아서 표시함
        }        
        await getList()
        await nextTick()
        for (let i = 0; i < brr.length; i++) {
            const row = brr[i]
            const idx = gst.util.getKeyIndex(memberRow, row.USERID)
            if (idx > -1) memberlist.value[idx].chk = true
        }
        if (brr.length == 1) {
            gst.util.scrollIntoView(memberRow, brr[0].USERID)
        }
        if (appType == "dm") evToPanel()
        if (arr.length != brr.length) gst.util.setSnack("선택 : " + arr.length + " / 추가 : " + brr.length)
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

    function newMember() { //버튼에서 말고 로직에서 호출하므로 편의상 그대로 두기
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
                gst.util.setSnack("먼저 행을 선택하시기 바랍니다.")
                return
            } else {
                const row = arr[0] //row.USERID is one of key
                const rq = { crud: "U", CHANID: chanId, USERID: row.USERID, USERNM: row.USERNM, KIND: rowKind.value }
                const res = await axios.post("/chanmsg/saveChanMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return //서버 호출 저장 진행후 아래 처리 + 패널에도 반영
            }
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
            if (!confirm("선택한 행(" + arr.length + "건)을 삭제할까요?")) return
            for (let i = 0; i < len; i++) {
                const rq = { CHANID: chanId, USERID: arr[i].USERID }
                const res = await axios.post("/chanmsg/deleteChanMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
            }
            newMember()
            await getList()
            if (appType == "dm") evToPanel()
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function saveChanMaster() {
        try {
            const rq = { GR_ID: grId, CHANID: chanId, CHANNM: chanNm.value, STATE: state.value ? "P" : "" } //chanId=new일 경우는 신규 채널 생성
            const res = await axios.post("/chanmsg/saveChanMaster", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return false //dm은 행저장시 new일 때는 여기 마스터를 먼저 저장함
            if (chanId == "new") {
                chanId = rs.data.chanid
                if (appType == "chan") await getList() //dm new일 땐 사용자가 아닌 자동 마스터 저장
            }
            evToPanel()
            return true
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteChan() {
        try {
            if (!confirm("[" + chanNm.value + "]채널에 대해 전체 삭제를 진행합니다. 계속할까요?")) return
            const rq = { CHANID: chanId }
            const res = await axios.post("/chanmsg/deleteChan", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            evToPanel()
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function inviteToMember() {
        try {
            const arr = memberlist.value.filter(item => item.chk)
            const len = arr.length
            if (len == 0) {
                gst.util.setSnack("선택한 행이 없습니다.")
                return
            }
            if (!confirm("선택한 행(" + arr.length + "건)에 대해 초대메일을 발송합니다. 계속할까요?")) return
            for (let i = 0; i < len; i++) {
                const rq = { CHANID: chanId, USERID: arr[i].USERID }
                const res = await axios.post("/chanmsg/inviteToMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
            }
            gst.util.setSnack("메일 발송 완료")
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
                    <div class="chan_center" style="width:calc(100% - 570px);padding-right:10px">
                        <div class="chan_center_header" id="chan_center_header">
                            <div class="chan_center_header_left">
                                <img v-if="chanId != 'new'" class="coImg18" :src="gst.html.getImageUrl(chanImg)" style="margin-right:5px">
                                <div v-if="chanId == 'new'" style="display:flex;align-items:center">
                                    <div class="coDotDot">새로 만들기 ({{ appType=='dm' ? "DM" : "채널" }})</div>
                                </div>
                                <div v-else style="display:flex;align-items:center">
                                    <div v-if="appType=='dm'" class="coDotDot">{{ chanmemFullExceptMe.join(", ") }}</div>
                                    <div v-else class="coDotDot">{{ chanNm }} {{ grnm ? "[" + grnm+ "]" : "" }}</div>
                                </div>
                            </div>
                            <div class="chan_center_header_right">
                                <img class="coImg24" :src="gst.html.getImageUrl('close.png')" style="margin-right:5px;" @click="close" title="닫기">
                            </div>
                        </div>
                        <div style="width:100%;height:40px;margin-bottom:2px;padding-bottom:5px;display:flex;justify-content:space-between;align-items:center;
                            background:whitesmoke;border:1px solid lightgray;border-top:none;box-shadow:0px 2px 0px gray">
                            <div v-if="chanId" style="width:calc(100% - 220px);height:100%;display:flex;align-items:center">
                                <input type="checkbox" v-model="chkAll" @change="changeChkAll()" style="min-width:18px;margin-right:12px" />
                                <input v-if="appType=='chan'" type="text" v-model="chanNm" style="width:100%" spellcheck="false" placeholder="채널명"/>
                                <span style="min-width:40px;margin:0 5px;color:dimgray">관리 :</span>
                                <span style="min-width:100px">{{ masternm }}</span>
                                <input v-if="appType!='dm'" type="checkbox" id="checkbox" v-model="state" style="min-width:18px;margin-left:12px"/>
                                <label v-if="appType!='dm'" for="checkbox" style="min-width:50px">비공개</label>
                            </div>
                            <div style="width:220px;height:100%;display:flex;align-items:center;justify-content:flex-end">
                                <div v-if="appType=='chan'" class="coImgBtn" @click="saveChanMaster()">
                                    <img :src="gst.html.getImageUrl('white_save.png')" class="coImg24">
                                    <span class="coImgSpn">{{ (appType == "dm" ? "DM" : "채널") + "저장" }}</span>
                                </div>
                                <div class="coImgBtn" @click="deleteChan">
                                    <img :src="gst.html.getImageUrl('white_delete.png')" class="coImg24">
                                    <span class="coImgSpn">{{ (appType == "dm" ? "DM" : "채널") + "삭제" }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="chan_center_body" id="chan_center_body" ref="scrollArea" @scroll="onScrolling">
                            <div v-for="(row, idx) in memberlist" :key="row.USERID" :ref="(ele) => { memberRow[row.USERID] = ele }" :keyidx="idx" class="msg_body procMenu"  
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
                                            <span style="min-width:60px;margin-right:10px;font-weight:bold;color:darkblue">{{ row.USERNM }}</span>
                                            <span>{{ row.JOB }}</span>
                                        </div>
                                        <div style="min-width:120px;margin-right:5px;display:flex;justify-content:flex-end;align-items:center">
                                            <span v-if="row.KIND=='guest' || row.KIND=='admin'" class="kind">
                                                {{ row.KIND=='guest' ? '게스트' : '관리자' }}
                                            </span>
                                            <span v-if="row.STATE=='C' || row.STATE=='W'" class="kind">
                                                {{ row.STATE=='C' ? '초대필요' : '참여대기' }} 
                                            </span>
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
                            <div style="padding-top:5px;display:flex;align-items:center;cursor:pointer">
                                <div v-if="singleMode!=''" class="coImgBtn" @click="saveMember()">
                                    <img :src="gst.html.getImageUrl('white_save.png')" class="coImg24">
                                    <span class="coImgSpn">멤버저장</span>
                                </div>
                                <div class="coImgBtn" @click="deleteMember()">
                                    <img :src="gst.html.getImageUrl('white_delete.png')" class="coImg24">
                                    <span class="coImgSpn">멤버삭제</span>
                                </div>
                                <div class="coImgBtn" @click="inviteToMember()">
                                    <img :src="gst.html.getImageUrl('white_mail.png')" class="coImg24">
                                    <span class="coImgSpn">초대</span>
                                </div>
                            </div>
                            <div style="display:flex;align-items:center;cursor:pointer">
                                <table>
                                    <tbody>
                                        <tr>
                                            <td style="width:40px;border:none"></td>
                                            <td style="width:calc(100% - 285px);border:none"></td>
                                            <td style="width:45px;border:none"></td>
                                            <td style="width:200px;border:none"></td>
                                        </tr>
                                        <tr>
                                            <td class="tdLabel">이름</td>
                                            <td class="tdValue">
                                                <input type="text" style="width:150px" v-model="rowUsernm" disabled="true"/>
                                                <!-- <span style="margin-left:10px;color:dimgray">직책/업무</span>
                                                <input type="text" style="width:150px;margin-left:10px" v-model="rowJob" disabled="true"/> -->
                                                <input type="text" style="width:calc(100% - 190px);margin-left:5px" v-model="rowJob" :disabled="true" placeholder="직책/업무"/>
                                                <!-- <span style="margin-left:10px">{{  }}</span> -->
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
                    <div class="chan_right" style="width:550px">
                        <org-tree mode="mygroup" :kind="appType" ref="orgRef" @ev-click="applyToBody"></org-tree>
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
    input[type=text]:focus { outline:2px solid lightgreen }
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
        height:100%;padding: 0 0 0 5px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:45px;
        display:flex;justify-content:space-between;align-items:center;
        background:whitesmoke;border:1px solid lightgray;border-bottom:none;overflow:hidden
    }
    .chan_center_header_left {
        width:70%;height:100%;padding-left:3px;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        width:calc(100% - 8px);display:flex;align-items:center;cursor:pointer;border-bottom:1px solid lightgray
    }
    .chan_center_footer {
        width:calc(100% - 10px);margin:auto 10px 0 0;padding:5px;
        display:flex;flex-direction:column;
        background:whitesmoke;border:1px solid lightgray;border-radius:5px;
    }
    .chan_right {
        height:100%;border-left:1px solid lightgray; /* 여기에 다시 MsgList.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
    }
    .procMenu { padding:3px 3px 0px 3px }
    .procMenu:hover { background:var(--hover-color) }
    .kind { margin-left:5px;padding:3px 5px;font-size:12px;background:#5DB5FD;color:white;border-radius:5px }
    table { width:100%;border-collapse:collapse }
    td { padding:3px;border:1px solid lightgray }
    .tdLabel { color:dimgray;border:none }
    .tdInput { width:calc(100% - 10px) }
    .tdValue { vertical-align:middle;border:none }
</style>
