<script setup>
    import { ref, onMounted, nextTick, useTemplateRef, onActivated, onUnmounted } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import OrgTree from "/src/components/OrgTree.vue"
            
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    const emits = defineEmits(["ev-to-panel"]) //UserList -> GroupPanel
        
    function evToPanel(param) { //말 그대로 패널에게 호출하는 것임 (자식에게 하는 것이 아님)
        emits("ev-to-panel", param)
    }

    const orgRef = ref(null)
    const scrollArea = ref(null), userRow = ref({}) //userRow는 element를 동적으로 할당
    let onGoingGetList = false, prevScrollY        
    let grnm = ref(''), masternm = ref(''), chkAll = ref(false), singleMode = ref('C')
    let userlist = ref([]), chkArr = ref([])
    let rowIssync = ref(''), rowUserid = ref(''), rowUsernm = ref(''), rowKind = ref('member')
    let rowOrg = ref(''), rowJob = ref(''), rowEmail = ref(''), rowTelno = ref(''), rowRmks = ref('')
    let mounting = true, sideMenu = "mnuGroup", grId

    onMounted(async () => {
        try {
            setBasicInfo()
            if (grId == "new") {
                //gst.util.setSnack("상단의 그룹명을 입력후 '그룹저장'을 누르시면 됩니다.", true)
            } else {
                await getList()                    
            }            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        try {
            gst.chanIdActivted = ""
            if (mounting) {
                mounting = false
            } else {
                setBasicInfo()
                const key = sideMenu + grId
                if (gst.objSaved[key]) scrollArea.value.scrollTop = gst.objSaved[key].scrollY
                evToPanel({ kind: "selectRow", grid: grId })
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function setBasicInfo() {        
        if (route.params.grid) grId = route.params.grid
    }

    function saveCurScrollY(posY) {
        if (!sideMenu || !grId) return
        const key = sideMenu + grId
        if (!gst.objSaved[key]) gst.objSaved[key] = {}
        gst.objSaved[key].scrollY = posY
    }

    async function getList(addedParam) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            let param = { grid: grId }
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            //const kind = param.kind
            const res = await axios.post("/user/qryGroupWithUser", param)
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

    const onScrolling = () => { 
        if (!scrollArea.value) return //오류 만났을 때
        prevScrollY = scrollArea.value.scrollTop
        saveCurScrollY(prevScrollY)
    }

    async function applyToBody(arr, mode) {
        try {
            if (grId == "new") {
                gst.util.setSnack("먼저 그룹이 저장되어야 합니다.", true)
                return
            }
            if (singleMode.value != "C") {
                gst.util.setSnack("먼저 (왼쪽) 그룹내 행 선택을 해제해 주시기 바랍니다.", true)
                return
            }
            const brr = [] //추가시 중복된 멤버 빼고 추가 성공한 멤버 배열
            let warn = ""
            for (let i = 0; i < arr.length; i++) {
                const row = arr[i]
                const rq = { crud: "C", GR_ID: grId, USERID: row.USERID, USERNM: row.USERNM, KIND: "member" }
                if (mode == "tree" || mode == "search") { //수동입력이 아닌 조직도에서 넘기는 것임 (SYNC=Y)
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
                const res = await axios.post("/user/saveMember", rq) //const rs = gst.util.chkAxiosCode(res.data, true) //true : 중복 체크 등 오류 표시 넘어감
                if (res.data.code != hush.cons.OK) {
                    warn = "[" + res.data.code + "] " + res.data.msg
                    break
                } else {
                    brr.push(row)
                }
            }
            if (brr.length > 0) { //예) 1개 이상 추가되었을 경우
                await getList()
                await nextTick()
                for (let i = 0; i < brr.length; i++) {
                    const row = brr[i]
                    const idx = gst.util.getKeyIndex(userRow, row.USERID)
                    if (idx > -1) userlist.value[idx].chk = true
                }
                if (brr.length > 0) gst.util.scrollIntoView(userRow, brr[0].USERID)
                if (mode == "mygroup") orgRef.value.procFromParent("refresh")
            }
            if (warn) gst.util.setSnack(warn, true) //경고있을 경우 사용자에게 알려야 함
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
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

    function getCheckedArr() {
        chkArr.value = userlist.value.filter(item => item.chk)
        return chkArr.value
    }

    function chkEditRow() {
        const arr = getCheckedArr() //userlist.value.filter(item => item.chk)
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
            rowKind.value = 'member'
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
            const arr = getCheckedArr() //userlist.value.filter(item => item.chk)
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
                //if (row.SYNC != "Y") {
                    rq.SYNC = row.SYNC
                    rq.ORG = rowOrg.value
                    rq.JOB = rowJob.value
                    rq.EMAIL = rowEmail.value
                    rq.TELNO = rowTelno.value
                //}
                rq.USERNM = rowUsernm.value
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
            const arr = getCheckedArr() //userlist.value.filter(item => item.chk)
            const len = arr.length
            if (len == 0) {
                gst.util.setSnack("선택한 행이 없습니다.")
                return
            }
            if (!confirm("선택한 행(" + arr.length + "건)을 삭제할까요?")) return
            for (let i = 0; i < len; i++) {
                const rq = { GR_ID: grId, USERID: arr[i].USERID,  USERNM: arr[i].USERNM }
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

    async function saveGroup() {
        try {
            const rq = { GR_ID: grId, GR_NM: grnm.value } //grId=new일 경우는 신규그룹 생성
            const res = await axios.post("/user/saveGroup", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (grId == "new") {
                grId = rs.data.grid
                await getList()
            }
            localStorage.wiseband_lastsel_grid = grId
            evToPanel({ kind: "saveGroup", grid: grId })
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
            evToPanel({ kind: "deleteGroup", grid: grId })
            orgRef.value.procFromParent("refresh")
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function clearAllChk() {
        userlist.value.forEach(item => {
            if (item.chk) item.chk = false
        })
        chkEditRow()
        chkAll.value = false
    }
</script>

<template>
    <div class="chan_main">
        <div class="chan_center" style="width:calc(100% - 560px);padding-right:10px">
            <div class="chan_center_header" id="chan_center_header">
                <div class="chan_center_header_left">
                    <img class="coImg18" :src="gst.html.getImageUrl('violet_people2.png')" style="margin-right:5px">
                    <div style="display:flex;align-items:center">                    
                        <div class="coDotDot">{{ grnm ? grnm : "새그룹 만들기" }}</div>
                    </div>
                </div>
                <div class="chan_center_header_right">
                    <span style="font-weight:bold">{{ userlist.length }}명</span>
                </div>
            </div>
            <div style="width:100%;height:40px;margin-bottom:2px;padding-bottom:5px;display:flex;justify-content:space-between;align-items:center;
                        background:whitesmoke;border:1px solid lightgray;border-top:none;box-shadow:0px 2px 0px gray">
                <div style="width:calc(100% - 220px);height:100%;display:flex;align-items:center">
                    <input v-show="userlist.length > 0" type="checkbox" v-model="chkAll" @change="changeChkAll()" style="min-width:18px;margin-right:5px" />
                    <input type="text" v-model="grnm" style="width:100%;margin-left:5px" spellcheck="false" placeholder="그룹명"/>
                    <span style="min-width:36px;margin-left:10px;color:dimgray">관리:</span>
                    <span class="coDotDot" style="min-width:80px">{{ masternm }}</span>
                </div>
                <div style="width:220px;height:100%;display:flex;align-items:center;justify-content:flex-end">
                    <div class="coImgBtn" @click="saveGroup()">
                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                        <span class="coImgSpn">그룹저장</span>
                    </div>
                    <div class="coImgBtn" @click="deleteGroup">
                        <img :src="gst.html.getImageUrl('white_delete.png')" class="coImg20">
                        <span class="coImgSpn">그룹삭제</span>
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
                            <div style="width:calc(100% - 100px);display:flex;align-items:center">
                                <div class="coDotDot">
                                    <span style="width:60px;margin-right:10px;font-weight:bold">{{ row.USERNM }}</span>
                                    <span>{{ row.JOB }}</span>
                                </div>
                            </div>
                            <div style="min-width:100px;display:flex;justify-content:flex-end;align-items:center">
                                <span v-if="row.KIND=='admin'" class="kind">관리자</span>
                                <span v-if="row.SYNC != 'Y'" class="kind">입력</span>
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
                <div v-if="userlist.length == 0" style="width:100%;height:100%;margin-top:50px;display:flex;justify-content:center;word-break:break-all">
                    먼저 상단의 그룹명을 설정후 '그룹저장' 버튼을<br>
                    누른 후 오른쪽 패널에서 멤버를 선택해 추가하시기 바랍니다.
                </div>
            </div>
            <div v-show="userlist.length > 0" class="chan_center_footer">
                <div style="padding-top:5px;display:flex;align-items:center;cursor:pointer">
                    <div v-if="singleMode!=''" class="coImgBtn" @click="newMember()">
                        <img :src="gst.html.getImageUrl('white_new.png')" class="coImg20">
                        <span class="coImgSpn">신규</span>
                    </div>
                    <div v-if="singleMode!=''" class="coImgBtn" @click="saveMember()">
                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                        <span class="coImgSpn">저장</span>
                    </div>
                    <div class="coImgBtn" @click="deleteMember()">
                        <img :src="gst.html.getImageUrl('white_delete.png')" class="coImg20">
                        <span class="coImgSpn">삭제</span>
                    </div>
                    <span style="margin:0 5px;font-weight:bold">선택:</span><span style="margin-right:10px;font-weight:bold">{{ chkArr.length }}</span>
                    <span class="vipBtn" @click="clearAllChk()">해제</span>
                </div>
                <div style="display:flex;align-items:center;cursor:pointer">
                    <table>
                        <tbody>
                            <tr>
                                <td style="width:40px;border:none"></td>
                                <td style="width:calc(100% - 290px);border:none"></td>
                                <td style="width:45px;border:none"></td>
                                <td style="width:200px;border:none"></td>
                            </tr>
                            <tr>
                                <td class="tdLabel">이름</td>
                                <td class="tdValue">
                                    <input type="text" style="width:100px" v-model="rowUsernm" :disabled="rowIssync == 'Y'"/>
                                    <input type="text" style="width:calc(100% - 130px);margin-left:5px" v-model="rowJob" :disabled="rowIssync == 'Y'" placeholder="직책/업무"/>
                                </td>
                                <td class="tdValue" colspan="2">
                                    <input type="radio" id="member" value="member" v-model="rowKind"><label for="member">Member</label>
                                    <input type="radio" id="admin" value="admin" v-model="rowKind"><label for="admin">Admin</label>
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
        <div class="chan_right" style="width:560px;height:calc(100% - 12px);margin:5px 0">
            <org-tree mode="tree" ref="orgRef" @ev-click="applyToBody"></org-tree>
        </div>  
    </div>
</template>

<style scoped>
    input[type="checkbox"] { min-width:16px;min-height:16px }  
    input[type=text]:focus { outline:2px solid lightgreen }
    .chan_main {
        width:100%;height:100%;display:flex;
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
    .chan_center {
        height:100%;padding: 5px 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:45px;display:flex;justify-content:space-between;align-items:center;
        background:whitesmoke;border:1px solid lightgray;border-bottom:none;overflow:hidden
    }
    .chan_center_header_left {
        width:70%;height:100%;padding-left:3px;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:30%;height:100%;padding-right:8px;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
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
        width:calc(100% - 10px);margin:auto 10px 10px 0;padding:5px;
        display:flex;flex-direction:column;
        background:whitesmoke;border:1px solid lightgray;border-radius:5px;
    }
    .chan_right {
        height:100%;border-left:1px solid lightgray;
    }
    .procMenu { padding:3px 3px 0px 3px }
    .procMenu:hover { background:var(--hover-color) }
    .kind { margin-left:5px;padding:3px 5px;font-size:10px;background:#5DB5FD;color:white;border-radius:5px }
    table { width:100%;border-collapse:collapse }
    td { padding:3px;border:1px solid lightgray }
    .tdLabel { color:dimgray;border:none }
    .tdInput { width:calc(100% - 10px) }
    .tdValue { border:none }
    .vipBtn { margin-left:5px;padding:1px 2px;font-size:12px;background:var(--primary-btn-color);color:white;border-radius:5px;cursor:pointer }
</style>
