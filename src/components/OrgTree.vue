<script setup>
    import { ref, onMounted } from 'vue' 
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    
    defineExpose({ open, close })

    let tab = ref(''), show = ref(true)
    let depthToShow = 3

    const scrollArea = ref(null), orglist = ref([]) 

    onMounted(async () => {
        try {
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
        //debugger
        //debugger
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
        let disp = (lvl <= depthToShow) ? "flex" : "none"
        let expanded = (lvl < depthToShow) ? true : false
        // if (lvl > 0 && _objUpperLevel[lvl - 1]) parentidx = _objUpperLevel[lvl - 1]
        // const expcolImg = (expanded) ? "minus_1.png" : "plus_1.png"
        const paddingLeft = lvl * 20 + 3
        // if (nodekind == "U") {
        //     _code = user_id
        // } else {
        //     _code = org_cd
        // }
        row.nodekind = nodekind
        row.dispstate = disp
        row.haschild = hasChild
        row.expanded = expanded
        row.paddingleft = paddingLeft + "px"
        //row.parentidx = parentidx
        //_objUpperLevel[lvl] = i
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    function clickNode(row, idx) {
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
            const lvlNext = parseInt(rowCur.LVL)
            if (lvlNext <= lvl) break
            if (expanded) {
                rowCur.dispstatePrev = rowCur.dispstate
                rowCur.dispstate = "none"
            } else { //펼쳐야 함
                if (lvlNext == lvl + 1) {
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
</script>

<template>    
    <div v-if="show" style="width:100%;height:100%">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="display:flex;align-items:center">
                <div class="topMenu" :class="tab == 'msg' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('msg')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                    <span style="margin-left:5px;font-weight:bold">메시지</span> 
                </div>
            </div>
            <div style="display:flex;justify-content:flex-end;align-items:center">
                <!-- <img class="coImg24" :src="gst.html.getImageUrl('close.png')" style="margin-right:10px;" @click="close" title="닫기"> -->
            </div>
        </div>
        <div class="chan_center">
            <div class="chan_center_header">
                <div class="chan_center_header_left">
                    <!-- <input type="search" v-model="frYm" @keyup.enter="procSearchMedia(true)" style="width:90px;margin-right:2px" placeholder="YYYYMM" /> - 
                    <input type="search" v-model="toYm" @keyup.enter="procSearchMedia(true)" style="width:90px;margin-left:2px" placeholder="YYYYMM" />
                    <input type="search" v-model="authorNm" @keyup.enter="procSearchMedia(true)" style="width:100px" placeholder="전송자" />
                    <input type="search" v-model="searchText" @keyup.enter="procSearchMedia(true)" style="width:120px" placeholder="본문" />
                    <input type="search" v-model="fileExt" @keyup.enter="procSearchMedia(true)" style="width:60px" placeholder="확장자" /> -->
                    <div class="coImgBtn" @click="procSearchMedia(true)">
                        <img :src="gst.html.getImageUrl('search.png')" class="btn_img">
                        <span class="btn_spn">검색</span>
                    </div>
                    <div class="coImgBtn" @click="clearText()" style="margin-left:5px">
                        <img :src="gst.html.getImageUrl('close.png')" class="btn_img">
                        <span class="btn_spn">Clear</span>
                    </div>
                </div>
                <div class="chan_center_header_right"></div>
            </div>
            <div class="chan_center_body" ref="scrollArea">
                <div v-for="(row, idx) in orglist" class="org_body" 
                    @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="clickNode(row, idx)">
                    <div v-if="!row.USER_ID" :style="{ paddingLeft: row.paddingleft, display: row.dispstate }"
                        style="width:100%;height:40px;align-items:center;border-bottom:1px solid lightgray;">
                        <div>{{ row.ORG_NM }}</div>
                        <div>===={{ row.expanded }}</div>
                    </div>
                    <div v-else :style="{ paddingLeft: row.paddingleft, display: row.dispstate }"
                        style="width:100%;height:40px;align-items:center;border-bottom:1px solid lightgray;">
                        <div>{{ row.USER_NM }}</div>
                        <div>===={{ row.expanded }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:var(--active-color);font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .btn_img { height:18px;padding:1px;display:flex;align-items:center;justify-content:center }
    .btn_spn { margin-left:2px;font-size:14px;color:dimgray }
    .chan_center {
        width:100%;height:calc(100% - 40px);
        display:flex;flex-direction:column;border:1px solid dimgray
    }
    .chan_center_header {
        width:100%;min-height:60px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_header_left {
        width:99%;height:100%;padding:20px;display:flex;align-items:center;
        font-size:18px;
    }
    .chan_center_header_right {
        width:1%;height:100%;padding:20px;display:flex;align-items:center;justify-content:flex-end;
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;background:beige
    }
    .org_body {
        width:100%;display:flex;cursor:pointer
    }
    .item {  				
        padding:5px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid lightgray
    }
    .item:hover { background:whitesmoke }
    .item:active { background:lightsteelblue }
</style>