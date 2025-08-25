<script setup>
    import { ref, nextTick } from 'vue' 
    import axios from 'axios'    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import OrgTree from "/src/components/OrgTree.vue"
            
    const gst = GeneralStore()

    defineExpose({ open, close, handleAliveInfo }) //부모(예:HomePanel,DmPanel) => MemberList의 open(), close() 호출
    const emits = defineEmits(["ev-from-member"]) //memberlist -> HomePanel or DmPanel

    const g_userid = gst.auth.getCookie("userid")
    const g_usernm = gst.auth.getCookie("usernm")

    const orgRef = ref(null)
    let show = ref(false), chanId = '', chanNm = ref(''), chanImg = ref(null), state = ref(false)
    const scrollArea = ref(null), memberRow = ref({}) //memberRow는 element를 동적으로 할당
    let onGoingGetList = false
        
    let grId
    let grnm = ref(''), masternm = ref(''), chkAll = ref(false), singleMode = ref('C'), stateSel = ref("A"), chkArr = ref([])
    let memberlist = ref([]), chanmemFullExceptMe = ref([]), appType
    let rowIssync = ref(''), rowUserid = ref(''), rowUsernm = ref(''), rowKind = ref('')
    let rowOrg = ref(''), rowJob = ref(''), rowEmail = ref(''), rowTelno = ref(''), rowRmks = ref(''), rowState = ref('')

    function open(strKind, strGrid, strChanid, strChannm, strChanimg) {
        show.value = true
        appType = strKind //chan or dm
        grId = strGrid //그룹 아이디
        chanId = strChanid //채널아이디 또는 new
        memberlist.value = []
        newMember()
        chanNm.value = ""
        masternm.value = ""
        if (appType == "chan") {
            if (chanId == "new") {
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

    function changeStateSel() {
        getList(stateSel.value) //여기서만 파라미터로 조회 (로컬스토리지도 필요없음. 사용자가 콤보선택시만 파라미터 사용)
    }
    
    async function getList(sel) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            stateSel.value = sel ? sel : "A"
            let param = { chanid: chanId, state: stateSel.value }
            const res = await axios.post("/chanmsg/qryChanMstDtl", param)
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
            if (rs.data.chanidAlready) gst.util.setSnack("동일한 멤버로 구성된 DM방이 이미 존재합니다. 방을 삭제하거나 멤버를 변경해 주시기 바랍니다.", true)
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
        try {
            if (appType == "chan" && chanId == "new") {
                gst.util.setSnack("먼저 채널이 저장되어야 합니다.")
                return
            } else if (appType == "chan" && singleMode.value != "C") {
                gst.util.setSnack("먼저 (왼쪽) 채널내 행 선택을 해제해 주시기 바랍니다.")
                return
            } else if (appType == "dm" && chanId == "new") {
                const ret = await saveChan()
                if (!ret) return //DM은 마스터에 저장할 내용이 없으므로 사용자가 행을 먼저 추가하더라도 백엔드에서 마스터를 먼저 저장해야 함
            }
            const brr = [], crr = [] //추가시 중복된 멤버 빼고 추가 성공한 멤버 배열 (brr=userid,crr=usernm)
            let warn = ""
            for (let i = 0; i < arr.length; i++) {
                const row = arr[i]
                const rq = { crud: "C", CHANID: chanId, USERID: row.USERID, USERNM: row.USERNM, KIND: "member", SYNC: row.SYNC }
                const res = await axios.post("/chanmsg/saveChanMember", rq) //const rs = gst.util.chkAxiosCode(res.data, true) //true : 중복 체크 등 오류 표시 넘어감
                if (res.data.code != hush.cons.OK) {
                    warn = "[" + res.data.code + "] " + res.data.msg
                    break
                } else {
                    brr.push(row.USERID)
                    crr.push(row.USERNM)
                }
            }
            if (brr.length > 0) { //예) 1개 이상 추가되었을 경우
                gst.sockToSend.push({ sendTo: "myself", data: { ev: "roomJoin", roomid: chanId, memberIdAdded: brr, memberNmAdded: crr, from: "applyToBody" }})
                await getList()
                await nextTick()
                for (let i = 0; i < brr.length; i++) {
                    const idx = gst.util.getKeyIndex(memberRow, brr[i])
                    if (idx > -1) memberlist.value[idx].chk = true
                }
                if (brr.length > 0) gst.util.scrollIntoView(memberRow, brr[0]) //첫번째 USERID
                if (appType == "dm") evToPanel("update")
                evToPanel("forwardToBody") //패널 오른쪽의 MsgList의 채널 마스터/디테일 정보 업데이트
                setTimeout(function() { gst.sockToSend.push({ sendTo: "room", data: { ev: "saveChanMember", roomid: chanId, from: "applyToBody" }}) }, 500) //roomJoin 대기
            }
            if (warn) gst.util.setSnack(warn, true) //경고있을 경우 사용자에게 알려야 함
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function changeChk(row, idx) {
        chkEditRow()
    }

    function rowClick(e, row, idx) {
        if (e.target.nodeName == "INPUT") return //e.currentTarget.nodeName은 DIV로 나옴
        memberlist.value.forEach(item => { item.chk = false })
        row.chk = true
        chkEditRow()
        chkAll.value = false
    }

    function getCheckedArr() {
        chkArr.value = memberlist.value.filter(item => item.chk)
        return chkArr.value
    }

    function chkEditRow() {
        const arr = getCheckedArr() //memberlist.value.filter(item => item.chk)
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

    async function saveMember() { //신규저장 없음 (멤버는 채널인 경우 내그룹에서 가져오고 DM의 경우는 조직도와 내그룹에서 가져옴)
        try {
            const arr = getCheckedArr() //memberlist.value.filter(item => item.chk)
            if (arr.length > 1) { //기본적으로는 이 경고가 나오지 않아야 함
                gst.util.setSnack("한 행 이상 선택되었습니다.")
                return
            }
            if (arr.length == 0) { //신규멤버 (여기서는 W입력만 해당됨)
                gst.util.setSnack("먼저 행을 선택하시기 바랍니다.")
                return
            }
            const row = arr[0] //row.USERID is one of key
            const rq = { crud: "U", CHANID: chanId, USERID: row.USERID, USERNM: row.USERNM, KIND: rowKind.value }
            const res = await axios.post("/chanmsg/saveChanMember", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "myself", data: { ev: "roomJoin", roomid: chanId, memberIdAdded: [row.USERID], memberNmAdded: [row.USERNM], from: "inviteToMember" }})
            memberlist.value.forEach(item => { //반영할 항목들이 많으면 아예 qry로 한행 읽어서 해당 배열 항목 한행만 새로고침하면 되나 여기서는 딱 한개 필드만 반영하면 되므로 아래와 같이 처리
                if (item.USERID == row.USERID) {
                    item.KIND = rowKind.value
                }
            })
            setTimeout(function() { gst.sockToSend.push({ sendTo: "room", data: { ev: "saveChanMember", roomid: chanId, from: "saveMember" }}) }, 500) //roomJoin 대기
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteMember() {
        try {
            const arr = getCheckedArr() //memberlist.value.filter(item => item.chk)
            const len = arr.length
            if (len == 0) {
                gst.util.setSnack("선택한 행이 없습니다.")
                return
            }
            if (!confirm("선택한 행(" + arr.length + "건)을 삭제할까요?")) return
            let brr = [], crr = []
            for (let i = 0; i < len; i++) {
                const rq = { CHANID: chanId, USERID: arr[i].USERID, chkOnly: true } //chkOnly: true 중요
                const res = await axios.post("/chanmsg/deleteChanMember", rq) //1) 실제 삭제가 아닌 체크만 먼저 실행. 멤버 먼저 삭제시 퇴장을 위한 리얼타임 반영으로는 안됨 (data polling시 sql 조회X)
                const rs = gst.util.chkAxiosCode(res.data)
                if (rs) {
                    brr.push(arr[i].USERID)
                    crr.push(arr[i].USERNM)
                }
            }
            if (brr.length == 0) return
            let body = hush.cons.roomLeftPrefix + crr.join(",") //2) 남아 있는 방멤버에게 메시지 전송
            const rq = { crud: "C", chanid: chanId, msgid: null, replyto: null, body: body, bodytext: body }
            const res = await axios.post("/chanmsg/saveMsg", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            for (let i = 0; i < len; i++) {
                const rq = { CHANID: chanId, USERID: arr[i].USERID } //3) 여기서 실제 멤버 삭제 : 그러면 퇴장을 위한 리얼타임 반영으로는 안되므로 아래 2)에서 소켓(roomLeave)으로 데이터 전달해 제거하도록 함
                const res = await axios.post("/chanmsg/deleteChanMember", rq)
                const rs = gst.util.chkAxiosCode(res.data)
            }
            gst.sockToSend.push({ sendTo: "myself", data: { ev: "roomLeave", roomid: chanId, memberIdLeft: brr, memberNmLeft: crr, from: "deleteMember" }}) //4) 나간 멤버 leave room + 패널에서 노드 삭제 등 처리            
            gst.sockToSend.push({ sendTo: "room", data: { ev: "deleteChanMember", roomid: chanId, from: "deleteMember" }}) //5) 삭제(퇴장)한 당사자 제외한 나머지 멤버에게 리얼타임 반영
            newMember()
            await getList()
            if (appType == "dm") evToPanel("update")
            evToPanel("forwardToBody") //패널 오른쪽의 MsgList의 채널 마스터/디테일 정보 업데이트
            if (brr.includes(g_userid)) { //6) 본인을 삭제하는 경우는 나가기
                setTimeout(function() { close() }, 500)
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function saveChan() {
        try {
            const rq = { GR_ID: grId, CHANID: chanId, CHANNM: chanNm.value, STATE: state.value ? "P" : "" } //chanId=new일 경우는 신규 채널 생성
            const res = await axios.post("/chanmsg/saveChan", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return false //dm은 행저장시 new일 때는 여기 마스터를 먼저 저장함
            if (chanId == "new") {
                chanId = rs.data.chanid
                if (appType == "chan") await getList() //dm new일 땐 사용자가 아닌 자동 마스터 저장
                let brr = [], crr = []
                const len = memberlist.value.length
                if (len > 0) {
                    for (let i = 0; i < len; i++) {
                        const row = memberlist.value[i]
                        brr.push(row.USERID)
                        crr.push(row.USERNM)
                    }                    
                    gst.sockToSend.push({ sendTo: "myself", data: { ev: "roomJoin", roomid: chanId, memberIdAdded: brr, memberNmAdded: crr, from: "saveChan" }})
                }
                evToPanel("create")
            } else {
                evToPanel("update")
                evToPanel("forwardToBody") //패널 오른쪽의 MsgList의 채널 마스터/디테일 정보 업데이트
            }            
            setTimeout(function() { gst.sockToSend.push({ sendTo: "room", data: { ev: "saveChan", roomid: chanId, from: "saveChan" }}) }, 500) //roomJoin 대기
            return true
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function deleteChan() { //메시지가 없어야 삭제 가능하므로 roomLeave 굳이 안해도 크게 무리 없음 (재접속시 roomJoin하지 않을 것임)
        try {
            if (!confirm("방 전체 삭제를 진행합니다. 계속할까요?")) return
            const rq = { CHANID: chanId }
            const res = await axios.post("/chanmsg/deleteChan", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.sockToSend.push({ sendTo: "room", data: { ev: "deleteChan", roomid: chanId, from: "deleteChan" }}) //멤버가 모두 퇴장했으므로 알려 주는 것이 불가능해 별 의미 없을 것임
            evToPanel("delete")
            setTimeout(function() { close() }, 500)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function inviteToMember() { //메일 발송은 리얼타임 반영 없음 : 일단, 방멤버가 초대했다고 명시적으로 알리는 정도로 가름함
        try {
            let arr = [] //const arr = getCheckedArr() //memberlist.value.filter(item => item.chk)
            memberlist.value.forEach(item => {
                if (item.chk) arr.push(item.USERID)
            })
            const len = arr.length
            if (len == 0) {
                gst.util.setSnack("선택한 행이 없습니다.")
                return
            }
            if (!confirm("선택한 행(" + arr.length + "건)에 대해 초대메일을 발송합니다.\n계속할까요?")) return
            let channmStr = ""
            if (appType == 'dm') {
                channmStr = (chanmemFullExceptMe.value.length >= 1) ? chanmemFullExceptMe.value.join(", ") + ", " + g_usernm: g_usernm
            } else {
                channmStr = chanNm + (grnm ? "[" + grnm+ "]" : "")
            }
            const rq = { CHANID: chanId, CHANNM: channmStr, USERIDS: arr }
            const res = await axios.post("/chanmsg/inviteToMember", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return            
            gst.util.setSnack("초대 완료")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function clearAllChk() {
        memberlist.value.forEach(item => {
            if (item.chk) item.chk = false
        })
        chkEditRow()
        chkAll.value = false
    }

    function evToPanel(kind) { //말 그대로 패널에게 호출하는 것임
        emits("ev-from-member", chanId, kind)
    }

    function handleAliveInfo(data) {
        if (!show.value) return
        console.log("!@##" + JSON.stringify(data))
        const len = memberlist.value.length
        for (let i = 0; i < len; i++) {
            const row = memberlist.value[i]
            if (data.userids && data.userids.includes(row.USERID)) {
                row.alive = true
            } else {
                row.alive = false
            }
        }
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div class="chan_main">
                    <div class="chan_center" style="width:calc(100% - 560px);padding-right:10px">
                        <div class="chan_center_header" id="chan_center_header">
                            <div class="chan_center_header_left">
                                <div class="coDotDot">
                                    <img v-if="chanId != 'new'" class="coImg18" :src="gst.html.getImageUrl(chanImg)" style="margin-right:5px">
                                    <span v-if="chanId == 'new'">새로 만들기 ({{ appType=='dm' ? "DM" : "채널" }})</span>
                                    <span v-else>
                                        <span v-if="appType=='dm'" class="coDotDot">{{ chanmemFullExceptMe.length >= 1 ? chanmemFullExceptMe.join(", ") : "나에게" }}</span>
                                        <span v-else>{{ chanNm }} {{ grnm ? "[" + grnm+ "]" : "" }}</span>
                                    </span>
                                </div>
                            </div>
                            <div class="chan_center_header_right">
                                <select v-model="stateSel" style="margin-right:10px;background:transparent;border:none" @change="changeStateSel">
                                    <option value="A">모두조회</option>
                                    <option value="C">초대필요</option>
                                </select>
                                <span style="font-weight:bold;margin-right:10px">{{ memberlist.length }}명</span>
                                <img class="coImg24" :src="gst.html.getImageUrl('close.png')" style="margin-right:5px" @click="close" title="닫기">
                            </div>
                        </div>
                        <div style="width:calc(100% - 12px);height:40px;margin-bottom:2px;padding:0 5px 5px 5px;display:flex;justify-content:space-between;align-items:center;
                            background:whitesmoke;border:1px solid lightgray;border-top:none;box-shadow:0px 2px 0px gray">
                            <div v-if="chanId" style="width:calc(100% - 220px);height:100%;display:flex;align-items:center">
                                <input v-show="memberlist.length > 0" type="checkbox" v-model="chkAll" @change="changeChkAll()" style="min-width:18px;margin-right:10px" />
                                <input v-if="appType=='chan'" type="text" v-model="chanNm" style="width:100%" spellcheck="false" placeholder="채널명"/>
                                <input v-if="appType!='dm'" type="checkbox" id="checkbox" v-model="state" style="min-width:18px;margin-left:10px"/>
                                <label v-if="appType!='dm'" for="checkbox" style="min-width:48px">비공개</label>
                                <span style="min-width:36px;margin-left:10px;color:dimgray">관리:</span>
                                <span class="coDotDot" style="min-width:80px">{{ masternm }}</span>
                            </div>
                            <div style="width:220px;height:100%;display:flex;align-items:center;justify-content:flex-end">
                                <div v-if="appType=='chan'" class="coImgBtn" @click="saveChan()">
                                    <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                                    <span class="coImgSpn">{{ (appType == "dm" ? "DM" : "채널") + "방저장" }}</span>
                                </div>
                                <div class="coImgBtn" @click="deleteChan">
                                    <img :src="gst.html.getImageUrl('white_delete.png')" class="coImg20">
                                    <span class="coImgSpn">{{ (appType == "dm" ? "DM" : "채널") + "방삭제" }}</span>
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
                                    <img :src="gst.html.getImageUrl(row.alive ? 'online.png' : 'offline.png')" style="margin-top:-25px;margin-left:-8px">
                                </div>
                                <div style="width:calc(100% - 60px);display:flex;flex-direction:column">
                                    <div style="width:100%;height:24px;display:flex;align-items:center;justify-content:space-between">
                                        <div style="width:calc(100% - 100px);display:flex;align-items:center">
                                            <div class="coDotDot">
                                                <span style="width:60px;margin-right:10px;font-weight:bold">{{ row.USERNM }}</span>
                                                <span>{{ row.JOB }}</span>
                                            </div>
                                        </div>
                                        <div style="min-width:100px;display:flex;justify-content:flex-end;align-items:center">
                                            <span v-if="row.KIND=='guest' || row.KIND=='admin'" class="kind">
                                                {{ row.KIND=='guest' ? '게스트' : '관리자' }}
                                            </span>
                                            <span v-if="row.STATE=='C'" class="kind">초대필요</span>
                                        </div>
                                    </div>
                                    <div style="width:100%;height:24px;display:flex;align-items:center;justify-content:space-between">
                                        <div style="width:calc(100% - 150px)">
                                            <div class="coDotDot">
                                                <span>{{ row.ORG }}</span>
                                            </div>
                                        </div>
                                        <div style="width:150px;display:flex;justify-content:flex-end">
                                            <div class="coDotDot">
                                                <span style="color:dimgray">{{ row.EMAIL }}</span>
                                            </div>
                                        </div>                           
                                    </div>
                                    <div style="width:100%;height:24px;display:flex;align-items:center;justify-content:space-between">
                                        <div style="width:calc(100% - 150px)">
                                            <div class="coDotDot">
                                                <span style="color:dimgray">{{ row.RMKS }}</span>
                                            </div>
                                        </div>
                                        <div style="width:150px;display:flex;justify-content:flex-end">
                                            <div class="coDotDot">
                                                <span style="color:dimgray">{{ row.TELNO }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div v-if="memberlist.length == 0 && stateSel == 'A'">
                                <div v-if="appType=='chan'" style="width:100%;height:100%;margin-top:50px;display:flex;justify-content:center;word-break:break-all">
                                    채널은 조직내 협의를 통해 생성합니다.<br>
                                    먼저 상단의 채널명과 공개여부를 설정하고<br> 
                                    '채널방저장' 버튼을 누른 후 오른쪽 패널에서<br>
                                    멤버를 선택해 추가하시기 바랍니다.<br><br>
                                    채널에 참여할 멤버는 내그룹에서 선택 가능합니다.<br>
                                    좌측 사이드 '내그룹' 메뉴를 이용해 멤버를 설정합니다.
                                </div>
                                <div v-else style="width:100%;height:100%;margin-top:50px;display:flex;justify-content:center;word-break:break-all">
                                    DM방은 사용자가 원하는 대로 생성합니다.<br>
                                    오른쪽 패널에서 멤버를 선택해 추가하시기 바랍니다.
                                </div>
                            </div>
                        </div>
                        <div v-show="memberlist.length > 0" class="chan_center_footer">
                            <div style="padding-top:5px;display:flex;justify-content:space-between;align-items:center;cursor:pointer">
                                <div style="display:flex;align-items:center">
                                    <div v-if="singleMode!=''" class="coImgBtn" @click="saveMember()">
                                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                                        <span class="coImgSpn">저장</span>
                                    </div>
                                    <div class="coImgBtn" @click="deleteMember()">
                                        <img :src="gst.html.getImageUrl('white_delete.png')" class="coImg20">
                                        <span class="coImgSpn">삭제</span>
                                    </div>
                                    <span style="margin:0 5px;font-weight:bold">선택:</span><span style="margin-right:5px;font-weight:bold">{{ chkArr.length }}</span>
                                    <span class="vipBtn" @click="clearAllChk()">해제</span>
                                </div>
                                <div style="display:flex;align-items:center">                                    
                                    <div class="coImgBtn" @click="inviteToMember()">
                                        <img :src="gst.html.getImageUrl('white_mail.png')" class="coImg20">
                                        <span class="coImgSpn">초대(메일)</span>
                                    </div>
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
                                                <input type="text" style="width:calc(100% - 190px);margin-left:5px" v-model="rowJob" :disabled="true" placeholder="직책/업무"/>
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
                    <div class="chan_right" style="width:560px">
                        <org-tree mode="mygroup" :kind="appType" :grid="grId" ref="orgRef" @ev-click="applyToBody"></org-tree>
                    </div>  
                </div>
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
</template>

<style scoped>
    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    input[type=text]:focus { outline:2px solid lightgreen }
    .popup {
        position:fixed;width:90%;min-width:1200px;height:90%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px 10px 20px 20px;z-index:1000;background:white;
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
        height:100%;display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:calc(100% - 12px);min-height:45px;padding:0 5px 0 5px;
        display:flex;justify-content:space-between;align-items:center;
        background:whitesmoke;border:1px solid lightgray;border-bottom:none;overflow:hidden
    }
    .chan_center_header_left {
        width:70%;height:100%;padding-left:5px;display:flex;align-items:center;font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .chan_center_body {
        width:calc(100% - 12px);height:100%;padding:0 5px 0 7px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
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
    .kind { margin-left:5px;padding:3px 5px;font-size:10px;background:#5DB5FD;color:white;border-radius:5px }
    table { width:100%;border-collapse:collapse }
    td { padding:3px;border:1px solid lightgray }
    .tdLabel { color:dimgray;border:none }
    .tdInput { width:calc(100% - 10px) }
    .tdValue { vertical-align:middle;border:none }
    .vipBtn { margin-left:5px;padding:1px 2px;font-size:12px;background:var(--primary-btn-color);color:white;border-radius:5px;cursor:pointer }
</style>
