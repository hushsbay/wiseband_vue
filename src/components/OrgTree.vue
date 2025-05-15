<script setup>
    import { ref, onMounted } from 'vue' 
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import MemberPiceach from "/src/components/MemberPiceach.vue"

    const gst = GeneralStore()
    
    defineExpose({ open, close })

    let tab = ref(''), show = ref(true)
    let depthToShow = ref(1), chkCnt = ref(0)
    let maxLevel = 1

    const scrollArea = ref(null), orglist = ref([]) 

    onMounted(async () => {
        try {
            depthToShow.value = localStorage.wiseband_orgtree_depthToShow ?? 1
            await procQuery()                    
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

    async function procQuery() {
        orglist.value = []
        const param = { 

        }
        const res = await axios.post("/user/orgTree", param)
        const rs = gst.util.chkAxiosCode(res.data) 
        if (!rs) return
        maxLevel = rs.data.maxLevel
        for (let i = 0; i < rs.list.length; i++) {
            const row = rs.list[i]
            orglist.value.push(row)
            const userlist = row.userlist
            if (userlist.length > 0) {
                procNode(row, userlist[0], 'org')
                for (let j = 0; j < userlist.length; j++) {
                    const item = userlist[j]
                    orglist.value.push(item)
                    procNode(item, null, 'user')
                }
            } else {
                if (i == rs.list.length - 1) {
                    procNode(row, null, 'org')
                } else {
                    procNode(row, rs.list[i + 1], 'org')
                }
            }
        }
    }

    function procNode(node, rowNext, kind) {
        const row = node
        const seq = row.SEQ //org 및 user에 모두 존재
        const lvl = parseInt(row.LVL) //org 및 user에 모두 존재
        const org_cd = row.ORG_CD //org 및 user에 모두 존재
        const org_nm = row.ORG_NM //org 및 user에 모두 존재
        const top_org_cd = row.TOP_ORG_CD //user only
        const top_org_nm = row.TOP_ORG_NM //user only
        const user_id = row.USER_ID //user only
        const user_nm = row.USER_NM //user only
        const nodekind = (lvl == 0) ? "C" : (user_id ? "U" : "D") //회사(C),사용자(U),부서(D)
        let hasChild
        if (nodekind == "U" || rowNext == null) { //사용자면 false, 다음행이 없는 마지막이면 false
            hasChild = false
        } else if (parseInt(rowNext.LVL) <= lvl) { //다음 행이 반드시 회사 아니면 부서인데 그 레벨이 현재 레벨보다 작거나 같아도 false
            hasChild = false
        } else {
            hasChild = true
        }
        let parentidx = -1, _code
        let disp = (lvl <= depthToShow.value) ? "flex" : "none"
        let expanded = (lvl < depthToShow.value) ? true : false
        const paddingLeft = lvl * 20 + 3
        row.nodekind = nodekind
        row.dispstate = disp
        row.haschild = hasChild
        row.expanded = expanded
        row.paddingleft = paddingLeft + "px"
        if (nodekind == "U") {
            row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
        } else {
            row.url = (row.LVL == 0 ? "violet_people3" : "violet_people2") + ".png"
        }
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    function clickNode(e, row, idx) {
        if (e.target.nodeName == "INPUT") return //e.currentTarget.nodeName은 DIV로 나옴
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
            if (expanded) {
                rowCur.dispstatePrev = rowCur.dispstate
                rowCur.dispstate = "none"
            } else { //펼쳐야 함
                if (lvlCur == lvl + 1) {
                    rowCur.dispstate = "flex"
                } else {
                    rowCur.dispstate = rowCur.dispstatePrev
                }
            }
            j += 1
        }  
        if (j > 0) procExpCol(expanded, row, idx)
    }

    function procExpCol(expanded, row) {
        if (row.dispstate == "none") row.dispstate = "flex"
        if (expanded) { //펼쳐져 있으면 접기 표시
            row.expanded = false
        } else {
            row.expanded = true
        }
    }

    function changeChk(row, idx) {
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
        const arr = orglist.value.filter(item => (item.nodekind == "U" && item.chk))
        chkCnt.value = arr.length
    }

    function changeDepth(val) {
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
        localStorage.wiseband_orgtree_depthToShow = depthToShow.value
        procQuery()
    }
</script>

<template>    
    <div v-if="show" style="width:100%;height:100%">
        <div style="width:100%;height:40px;padding-left:10px;display:flex;align-items:center">
            <div style="display:flex;align-items:center">
                <div class="topMenu" :class="tab != 'msg' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('msg')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_people3.png')">
                    <span style="margin-left:5px;font-weight:bold">조직도</span> 
                </div>
                <div class="topMenu" :class="tab == 'msg' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('msg')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_people2.png')">
                    <span style="margin-left:5px;font-weight:bold">내그룹</span> 
                </div>
            </div>
        </div>
        <div class="chan_center">
            <div class="chan_center_header">
                <div class="chan_center_header_left">
                    <input type="search" v-model="searchText" @keyup.enter="procSearchMedia(true)" style="width:120px" />
                    <div class="coImgBtn" @click="procSearchMedia(true)"><img :src="gst.html.getImageUrl('search.png')" class="btn_img"></div>
                    <div class="coImgBtn" @click="clearText()" style="margin-left:5px"><img :src="gst.html.getImageUrl('close.png')" class="btn_img"></div>
                    <span class="depth">{{ depthToShow }}</span>
                    <div class="coImgBtn" @click="changeDepth(false)" style="margin-left:5px"><img :src="gst.html.getImageUrl('dimgray_minus.png')" class="btn_img12"></div>
                    <div class="coImgBtn" @click="changeDepth(true)" style="margin-left:5px"><img :src="gst.html.getImageUrl('dimgray_plus.png')" class="btn_img12"></div>
                    <input type="checkbox" id="myteam" v-model="myteam" @change="selectMyTeam" style="margin-left:12px"/><label for="myteam" style="font-size:14px">내팀</label>
                </div>
                <div class="chan_center_header_right">
                    <span style="margin-right:5px">선택 :</span><span style="color:dimblue;font-weight:bold">{{ chkCnt }}</span>
                </div>
            </div>
            <div class="chan_center_body" ref="scrollArea">
                <div v-for="(row, idx) in orglist" class="org_body" @click="(e) => clickNode(e, row, idx)">
                    <div v-if="!row.USER_ID" :style="{ paddingLeft: row.paddingleft, display: row.dispstate }"
                        style="width:100%;height:40px;align-items:center;border-bottom:1px solid lightgray;">
                        <input type="checkbox" v-model="row.chk" @change="changeChk(row, idx)" style="opacity:0.5"/>
                        <img class="coImg24" :src="gst.html.getImageUrl(row.url)">
                        <div style="margin-left:5px">{{ row.ORG_NM }}</div>
                    </div>
                    <div v-else :style="{ paddingLeft: row.paddingleft, display: row.dispstate }"
                        style="width:100%;height:40px;align-items:center;border-bottom:1px solid lightgray;">
                        <input type="checkbox" v-model="row.chk" @change="changeChk(row, idx)" />
                        <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                        <div style="margin-left:5px;font-weight:bold">{{ row.USER_NM }}</div>
                        <div style="margin-left:5px">{{ row.JOB }}</div>
                        <div style="margin-left:5px;color:dimgray">{{ row.TELNO }}</div>
                        <div style="margin-left:5px;color:dimgray">{{ row.EMAIL }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    input[type="checkbox"] { width:16px;height:16px; }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:var(--active-color);font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .btn_img { height:18px;padding:1px;display:flex;align-items:center;justify-content:center }
    .btn_img12 { width:12px;height:12px;padding:1px;display:flex;align-items:center;justify-content:center }
    .btn_spn { margin-left:2px;font-size:14px;color:dimgray }
    .chan_center {
        width:100%;height:calc(100% - 40px);display:flex;flex-direction:column
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_header_left {
        width:85%;height:100%;padding:0 10px;display:flex;align-items:center;
    }
    .chan_center_header_right {
        width:15%;height:100%;padding:0 10px;display:flex;align-items:center;justify-content:flex-end;
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto
    }
    .org_body {
        width:100%;display:flex;cursor:pointer
    }
    /* .item {  				
        padding:5px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid lightgray
    } */
    .org_body:hover { background:whitesmoke }
    /* .org_body:active { background:lightsteelblue } */
    .depth { width:12px;height:12px;display:flex;align-items:center;justify-content:center;border-radius:8px;background-color:dimgray;color:white;font-size:12px;padding:4px;margin-left:10px }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
</style>