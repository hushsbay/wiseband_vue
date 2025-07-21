<script setup>
    import { ref, onMounted, nextTick } from 'vue' 
    import axios from 'axios'    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import MemberPiceach from "/src/components/MemberPiceach.vue"

    const gst = GeneralStore()

    defineExpose({ open, close, procFromParent })
    const props = defineProps({ mode: String, kind: String, grid: String }) //kind=chan/dm
    const emits = defineEmits(["ev-click"])

    let mode = ref('tree'), show = ref(true), searchText = ref(''), myteam = ref(''), mycomp = ref('')
    let depthToShow = ref(1), chkCnt = ref(0) //mygroup을 고려해서 depthToShow는 기본적으로는 반드시 1로 해야 함
    let maxLevel = 1

    const scrollArea = ref(null), orglist = ref([]), orgRow = ref({}) //orgRow는 element를 동적으로 할당

    onMounted(async () => {
        try {
            mode.value = props.mode
            if (localStorage.wiseband_orgtree_myteam == "true" || localStorage.wiseband_orgtree_myteam == "false") {
                myteam.value = (localStorage.wiseband_orgtree_myteam == "true") ? true : false
            } else { //기본을 true로 설정
                myteam.value = true
                localStorage.wiseband_orgtree_myteam = true
            }
            if (localStorage.wiseband_orgtree_mycomp == "true" || localStorage.wiseband_orgtree_mycomp == "false") {
                mycomp.value = (localStorage.wiseband_orgtree_mycomp == "true") ? true : false
            } else { //기본을 true로 설정
                mycomp.value = true
                localStorage.wiseband_orgtree_mycomp = true
            }
            await procQuery(mode.value)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function open() {
        show.value = true
    }

    function close() {
        show.value = false
    }

    async function procFromParent(kind) {
        if (kind == "refresh") {
            if (mode.value == "mygroup") reset(mode.value)
        }
    }

    function changeTab(strMode) {
        clearAllChk()
        procQuery(strMode)
    }

    async function toggleMyTeam() {
        localStorage.wiseband_orgtree_myteam = myteam.value ? true : false
        if (myteam.value) {
            localStorage.wiseband_orgtree_depthToShow = 0
            await nextTick()
            procQuery("tree")
        }
    }

    async function toggleMyComp() {
        localStorage.wiseband_orgtree_mycomp = mycomp.value ? true : false
        if (myteam.value || mycomp.value) procQuery("tree")
    }

    function selectOne() {
        if (searchText.value.trim() == "") {
            procQuery("tree")
        } else {
            procSearch()
        }
    }

    async function procQuery(strMode) {
        try {
            mode.value = strMode
            if (strMode == "tree") {
                depthToShow.value = localStorage.wiseband_orgtree_depthToShow ?? 1
            } else if (strMode == "mygroup") {
                depthToShow.value = localStorage.wiseband_orgtree_depthToShow_mygroup ?? 1
            }
            const controller = (strMode == "tree") ? "orgTree" : "qryGroupWithUser"
            const notShowMsgIfNoData = (strMode == "tree") ? false : true
            const res = await axios.post("/user/" + controller, { 
                myteam: (strMode == "tree" && myteam.value) ? gst.auth.getCookie("orgcd") : "",
                mycomp: (strMode == "tree" && mycomp.value) ? gst.auth.getCookie("toporgcd") : "",
                grid: props.grid ? props.grid : "", //qryGroupWithUser 에만 해당
                toastMsg: true
            })
            const rs = gst.util.chkAxiosCode(res.data, notShowMsgIfNoData) //NOT_FOUND일 경우도 오류메시지 표시하지 않기 
            if (!rs) return
            orglist.value = []
            maxLevel = rs.data.maxLevel
            const vips = getVips(rs)
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]
                orglist.value.push(row)
                const userlist = row.userlist
                if (userlist.length > 0) {
                    procNode(row, userlist[0], 'org')
                    for (let j = 0; j < userlist.length; j++) { //org에 userlist가 있으면 루프돌면서 추가
                        const item = userlist[j]
                        orglist.value.push(item)
                        procNode(item, null, 'user', vips)
                    }
                } else {
                    if (i == rs.list.length - 1) {
                        procNode(row, null, 'org')
                    } else {
                        procNode(row, rs.list[i + 1], 'org')
                    }
                }
            }
            const myOrgArr = rs.data.myOrgArr //예) ['O3UC01', 'O3AA01', 'S']의 코드가 들어간 오브젝트임 ###9(서버 참조)
            if (myOrgArr && myOrgArr.length > 0) { //마지막이 회사코드, 처음이 본인 소속부서임
                for (let j = myOrgArr.length - 1; j >= 0; j--) {
                    let k = 0
                    for (let i = k; i < orglist.value.length; i++) {
                        const row = orglist.value[i]
                        if (row.nodekind == "G") { //console.log(myOrgArr[j].ORG_CD+"============"+row.ORG_CD+"============"+i)
                            if (row.ORG_CD == myOrgArr[j].ORG_CD) { //console.log(myOrgArr[j].ORG_CD+"============"+i)
                                clickNode(null, row, i)
                                k = i + 1
                                break
                            }
                        }
                    }
                }
                await nextTick()
                orgRow.value[myOrgArr[0].ORG_CD].scrollIntoView(true) //true 필요. true=scrollIntoViewOptions: {block: "start", inline: "nearest"}와 동일
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function procNode(row, rowNext, kind, vips) {
        const lvl = parseInt(row.LVL) //org,user,mygroup에 모두 존재
        const org_cd = row.ORG_CD ? row.ORG_CD : row.GR_ID //1) tree,search에는 ORG_CD가 org 및 user에 모두 존재 2) mygroup에서는 GR_ID
        const nodekind = row.USERID ? "U" : "G" //사용자(U),그룹(G=회사or부서or내그룹)
        let hasChild
        if (nodekind == "U" || rowNext == null) { //사용자면 false, 다음행이 없는 마지막이면 false
            hasChild = false
        } else if (parseInt(rowNext.LVL) <= lvl) { //다음 행이 반드시 회사 아니면 부서인데 그 레벨이 현재 레벨보다 작거나 같아도 false
            hasChild = false
        } else {
            hasChild = true
        }        
        let disp = (lvl <= depthToShow.value) ? "flex" : "none"
        let expanded = (lvl < depthToShow.value) ? true : false
        const paddingLeft = lvl * 25 + 6
        row.nodekind = nodekind
        row.orgnm = row.ORG_NM ? row.ORG_NM : row.GR_NM
        row.dispstate = disp
        row.haschild = hasChild
        row.expanded = expanded
        row.paddingleft = paddingLeft + "px"
        if (nodekind == "U") {
            if (row.USERNM == '박석현' || row.USERNM == '이상병') debugger
            row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
            row.isVip = chkVips(vips, row.USERID)
            row.key = row.USERID + (row.GR_ID ? hush.cons.deli + row.GR_ID : "") //vue의 loop에서의 :key는 unique해야 하는데 내그룹은 그룹마다 같은 userid가 들어 있을 것이므로 grid로 추가 구분함
        } else {
            if (mode.value == "mygroup") {
                row.url = "violet_people2.png"
            } else {
                row.url = (row.LVL == 0 ? "violet_people3" : "violet_people2") + ".png"
            }
            row.key = org_cd
        }
    }

    function procClearSearch() {
        if (searchText.value == "") reset("tree")
    }

    async function procSearch() {
        try {
            mode.value = "search"
            const param = { searchText: searchText.value.trim() }
            const res = await axios.post("/user/procOrgSearch", param)
            const rs = gst.util.chkAxiosCode(res.data) 
            if (!rs) return
            orglist.value = []
            const vips = getVips(rs)
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]
                row.nodekind = "U"
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                row.key = row.USERID
                row.isVip = chkVips(vips, row.USERID)
                orglist.value.push(row)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function reset(strMode) {
        if (strMode == "tree" || strMode == "search") {
            searchText.value = ""
            procQuery("tree")
        } else if (strMode == "mygroup") {
            procQuery(strMode)
        }
    }

    function getVips(rs) {
        let vips = rs.data.vipList[0].VIPS //xxx,yyy..(없으면 null)
        if (vips != null) vips = "," + vips + ","
        return vips
    }

    function chkVips(vips, userid) {
        return (vips != null && vips.includes("," + userid + ",")) ? true : false
    }

    function clickNode(e, row, idx) {
        if (e && e.target.nodeName == "INPUT") return //e.currentTarget.nodeName은 DIV로 나옴
        const hasChild = row.haschild
        const nodekind = row.nodekind
        const expanded = row.expanded
        const lvl = parseInt(row.LVL)
        const rowNext = orglist.value[idx + 1]
        if (nodekind == "U" || !hasChild) return
        if (rowNext.LVL <= lvl) return
        const len = orglist.value.length
        let j = 0
        for (let i = idx + 1; i < len; i++) {
            const rowCur = orglist.value[i]
            const lvlCur = parseInt(rowCur.LVL)
            if (lvlCur <= lvl) break
            if (expanded) { //예) 클릭한 부서노드가 펼쳐져 있으면 그 아래는 모두 안보이게 하되
                rowCur.dispstatePrev = rowCur.dispstate //dispstatePrev로 이전 상태를 기억해서 나중에 펼칠 때 그 상태대로 복원하기 
                rowCur.dispstate = "none"
            } else { //펼쳐야 함
                if (lvlCur == lvl + 1) {
                    rowCur.dispstate = "flex"
                } else {
                    if (rowCur.dispstatePrev) rowCur.dispstate = rowCur.dispstatePrev
                }
            }
            j += 1
        }  
        if (j > 0) procExpCol(expanded, row)
    }

    function procExpCol(expanded, row) {
        if (row.dispstate == "none") row.dispstate = "flex"
        if (expanded) { //펼쳐져 있으면 접기 표시
            row.expanded = false
        } else {
            row.expanded = true
        }
    }

    function getCheckedUser(keyArr) { //keyArr : key중에 PICTURE도 있으므로 전부 전송시 부하가 되므로 제거하기 위해 특정 Key만 설정하는 것임
        const list = orglist.value
        let arr = []
        if (keyArr) { //예) ['USERID', 'USERNM']
            list.forEach(item => {
                if (item.nodekind == "U" && item.chk) {
                    const obj = {}
                    const brr = Object.entries(item)
                    for (const [key, value] of brr) {
                        if (keyArr.indexOf(key) > -1) obj[key] = value
                    }
                    arr.push(obj)
                }
            })
        } else {
            arr = list.filter(item => (item.nodekind == "U" && item.chk))
        }
        return arr
    }

    function changeChk(row, idx) {
        if (mode.value == "tree" || mode.value == "mygroup") {
            if (row.nodekind == "U") {
                //하위 노드가 없으므로 넘어감
            } else {
                const bool = row.chk
                const lvl = parseInt(row.LVL)
                const len = orglist.value.length
                for (let i = idx + 1; i < len; i++) {
                    const rowCur = orglist.value[i]
                    const lvlCur = parseInt(rowCur.LVL)
                    if (lvlCur <= lvl) break
                    rowCur.chk = bool
                }
            }
            const arr = getCheckedUser()
            chkCnt.value = arr.length
        } else {
            const arr = getCheckedUser()
            chkCnt.value = arr.length
        }
    }

    function changeDepth(val) {
        if (myteam.value) myteam.value = false
        if (val == true) {
            if (depthToShow.value >= maxLevel) {
                depthToShow.value = maxLevel
                return
            } else {
                depthToShow.value = parseInt(depthToShow.value) + 1
            }	
        } else {
            if (depthToShow.value <= 0) {
                depthToShow.value = 0
                return
            } else {
                depthToShow.value = parseInt(depthToShow.value) - 1
            }
        }
        if (mode.value == "tree") {
            localStorage.wiseband_orgtree_depthToShow = depthToShow.value    
        } else if (mode.value == "mygroup") {
            localStorage.wiseband_orgtree_depthToShow_mygroup = depthToShow.value    
        }        
        procQuery(mode.value)
    }

    function clearAllChk() {
        orglist.value.forEach(item => {
            if (item.chk) item.chk = false
        })
        if (chkCnt.value != 0) chkCnt.value = 0
    }

    async function setVip(bool) {
        try {
            if (chkCnt.value == 0) {
                gst.util.setToast("먼저 사용자를 선택하시기 바랍니다.")
                return
            }
            const list = getCheckedUser(["GR_ID", "USERID", "USERNM"])
            const res = await axios.post("/user/setVip", { 
                list: list, bool: bool
            })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            list.forEach(item => {
                const key = item.USERID + (item.GR_ID ? hush.cons.deli + item.GR_ID : "")
                const idx = gst.util.getKeyIndex(orgRow, key)
                orglist.value[idx].isVip = bool
            })
            let msg = (bool ? "설정 완료" : "해제 완료") + " (" + rs.data.retCnt + "명)"
            gst.util.setSnack(msg)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function applyToBody() {
        if (chkCnt.value == 0) {
            gst.util.setToast("먼저 사용자를 선택하시기 바랍니다.")
            return
        }
        const arr = getCheckedUser()
        emits("ev-click", arr, mode.value)
    }
</script>

<template>
    <div style="width:100%;height:100%;display:flex">
        <div class="applyToBody" @click="applyToBody()">
            <img :src="gst.html.getImageUrl('violet_left_arrow.png')" style="width:32px;height:32px">
        </div>
        <div style="width:calc(100% - 52px);height:100%;display:flex;flex-direction:column;border:1px solid lightgray">        
            <div style="width:100%;height:40px;display:flex;justify-content:space-between;align-items:center;background:whitesmoke">
                <div style="display:flex;align-items:center">
                    <div v-if="props.kind!='chan'" class="topMenu" :class="mode == 'tree' || mode == 'search' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('tree')">
                        <img class="coImg18" :src="gst.html.getImageUrl('dimgray_people3.png')">
                        <span style="margin-left:5px;font-weight:bold">조직도</span> 
                    </div>
                    <div class="topMenu" :class="mode == 'mygroup' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('mygroup')">
                        <img class="coImg18" :src="gst.html.getImageUrl('dimgray_people2.png')">
                        <span style="margin-left:5px;font-weight:bold">내그룹</span> 
                    </div>
                    <span style="margin:0 5px 0 10px;color:dimgray">선택:</span><span style="color:dimblue;font-weight:bold">{{ chkCnt }}</span>
                    <span class="vipBtn" style="margin-left:8px" @click="clearAllChk()">해제</span>
                </div>
                <div style="padding-right:10px;display:flex;align-items:center">
                    <span class="vipMark">VIP</span>
                    <span class="vipBtn" @click="setVip(true)">설정</span>
                    <span class="vipBtn" @click="setVip(false)">해제</span>
                </div>
            </div>
            <div class="chan_center">
                <div class="chan_center_header">
                    <div class="chan_center_header_left">
                        <input v-show="mode == 'tree' | mode == 'search'" type="search" v-model="searchText" @keyup.enter="procSearch()" @input="procClearSearch" style="width:100px" />
                        <div v-show="mode == 'tree' | mode == 'search'" class="coImgBtn" @click="selectOne()">
                            <img :src="gst.html.getImageUrl('white_search.png')" class="coImg16">
                        </div>
                        <div class="coImgBtn" @click="reset(mode)">
                            <img :src="gst.html.getImageUrl('white_refresh.png')" class="coImg16" title="새로고침">
                        </div>
                        
                        <input v-show="mode == 'tree'" type="checkbox" id="myteam" v-model="myteam" style="margin-left:10px" @change="toggleMyTeam"/>
                        <label v-show="mode == 'tree'" for="myteam" style="">내팀</label>
                        <input v-show="mode == 'tree'" type="checkbox" id="mycomp" v-model="mycomp" style="margin-left:10px" @change="toggleMyComp"/>
                        <label v-show="mode == 'tree'" for="mycomp" style="">내회사</label>
                    </div>
                    <div class="chan_center_header_right">
                        <span class="depth" style="margin-right:5px">{{ depthToShow }}</span>
                        <div class="coImgBtn" @click="changeDepth(false)"><img :src="gst.html.getImageUrl('white_minus.png')" class="coImg16"></div>
                        <div class="coImgBtn" @click="changeDepth(true)"><img :src="gst.html.getImageUrl('white_plus.png')" class="coImg16"></div>
                    </div>
                </div>
                <div v-show="mode == 'tree' || mode == 'mygroup'" class="chan_center_body" ref="scrollArea">
                    <div v-for="(row, idx) in orglist" :key="row.key" :ref="(ele) => { orgRow[row.key] = ele }" :keyidx="idx" 
                        class="org_body" @click="(e) => clickNode(e, row, idx)" 
                        :style="{display: row.dispstate}" style="border-bottom:1px solid lightgray">
                        <div v-if="!row.USERID" :style="{ paddingLeft: row.paddingleft }"
                            style="width:calc(100% - 50px);height:40px;display:flex;align-items:center">
                            <input type="checkbox" v-model="row.chk" @change="changeChk(row, idx)" :style="{ opacity: row.haschild ? 1.0 : 0.2 }"/>
                            <img class="coImg24" :src="gst.html.getImageUrl(row.url)">
                            <div style="margin-left:5px">{{ row.orgnm }}</div>
                            <span v-if="row.CNT > 0" style="margin-left:5px;color:dimgray">({{ row.CNT }})</span>
                        </div>
                        <div v-else class="coDotDot" :title="row.JOB + '/' + row.TELNO + '/' + row.EMAIL"
                            :style="{ paddingLeft: row.paddingleft }" style="width:100%;height:40px;display:flex;align-items:center">
                            <input type="checkbox" v-model="row.chk" @change="changeChk(row, idx)" />
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                            <div style="margin-left:5px;font-weight:bold">{{ row.USERNM }}</div>
                            <span v-if="row.isVip" class="vipMark">VIP</span>
                            <div style="margin-left:5px">{{ row.ORG }}</div>
                            <div style="margin-left:5px;color:dimgray">{{ row.JOB }}</div>                            
                        </div>
                        <div v-if="(mode == 'mygroup' || row.USERID) && (row.KIND=='guest' || row.KIND=='admin')" 
                            style="min-width:36px;height:40px;margin-right:0px;display:flex;justify-content:flex-end;align-items:center">
                            <span class="kind">{{ row.KIND=='guest' ? '외부인' : '관리자' }}</span>
                        </div>
                        <div v-if="mode == 'mygroup' && row.USERID && row.SYNC != 'Y'" 
                            style="min-width:32px;height:40px;margin-right:0px;display:flex;justify-content:flex-end;align-items:center">
                            <span class="kind">입력</span>
                        </div>
                    </div>
                </div>
                <div v-show="mode == 'search'" class="chan_center_body" ref="scrollArea">
                    <div v-for="(row, idx) in orglist" :key="row.key"  :keyidx="idx" 
                        class="org_body" @click="(e) => clickNode(e, row, idx)">
                        <div class="coDotDot" :title="row.JOB + ' ' + row.TELNO + ' ' + row.EMAIL"
                            style="width:100%;height:40px;padding-left:6px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                            <input type="checkbox" v-model="row.chk" @change="changeChk(row, idx)" />
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                            <div style="margin-left:5px;font-weight:bold">{{ row.USERNM }}</div>
                            <span v-if="row.isVip" class="vipMark">VIP</span>
                            <div style="margin-left:5px">{{ row.TOP_ORG_NM }}</div>
                            <div style="margin-left:5px">{{ row.ORG_NM }}</div>
                            <div style="margin-left:5px;color:dimgray">{{ row.JOB }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    input { height:28px;margin-right:8px;border:1px solid dimgray }
    input[type=search]:focus { outline:2px solid lightgreen }
    input[type="checkbox"] { min-width:16px;min-height:16px }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:var(--hover-color) }
    .topMenu:active { background:var(--active-color) }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid whitesmoke; }
    .btn_img { height:18px;padding:1px;display:flex;align-items:center;justify-content:center }
    .btn_img12 { width:12px;height:12px;padding:1px;display:flex;align-items:center;justify-content:center }
    .applyToBody { width:40px;height:100%;display:flex;align-items:center;justify-content:center;
        border-top:1px solid lightgray;border-bottom:1px solid lightgray;cursor:pointer }
    .applyToBody:hover { background:var(--hover-color) }
    .chan_center {
        width:100%;height:calc(100% - 40px);display:flex;flex-direction:column
    }
    .chan_center_header {
        width:100%;min-height:50px;margin-bottom:2px;display:flex;align-items:center;justify-content:space-between;
        background:whitesmoke;border-bottom:1px solid lightgray;overflow:hidden;box-shadow:0px 2px 0px gray
    }
    .chan_center_header_left {
        width:calc(100% - 140px);height:100%;padding:0 10px;display:flex;align-items:center;
    }
    .chan_center_header_right {
        width:100px;height:100%;padding:0 5px;display:flex;align-items:center;justify-content:flex-end;
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto
    }
    .org_body { /* 접기,펼치기 로직때문에 display:flex가 들어가면 안됨 */
        width:100%;justify-content:space-between;cursor:pointer
    }
    .org_body:hover { background:var(--hover-color) }
    .depth { width:12px;height:12px;display:flex;align-items:center;justify-content:center;border-radius:8px;background-color:dimgray;color:white;font-size:12px;padding:4px }
    .vipBtn { margin-left:5px;padding:1px 2px;font-size:12px;background:var(--primary-btn-color);color:white;border-radius:5px;cursor:pointer }
    .vipMark { margin-left:5px;padding:1px 2px 2px 2px;font-size:10px;background:black;color:white;border-radius:5px }
    .kind { padding:3px;font-size:10px;background:#5DB5FD;color:white;border-radius:5px }
</style>