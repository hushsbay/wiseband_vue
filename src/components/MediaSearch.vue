<script setup>
    import { ref } from 'vue' 
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupImage from "/src/components/PopupImage.vue"

    const gst = GeneralStore()
    
    defineExpose({ open, close })

    let tab = ref(''), show = ref(false), chanid = '', channm = ref(''), chanimg = ref(null)
    let rdoOpt = ref('all')
    let frYm = ref(''), toYm = ref(''), authorNm = ref(''), searchText = ref(''), fileExt = ref('')
    let savLastMsgMstCdt

    const scrollArea = ref(null), filelist = ref([]), imagelist = ref([]), msglist = ref([]) 
    let prevScrollY = 0 //Intersection Observer 오류(parameter 1 is not of type 'Element') 해결이 어려워 onScrollEnd에서 처리함

    const imgPopupRef = ref(null), imgParam = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련

    function open(strTabid, strChanid, strChannm, strChanimg, strSearchText) {
        show.value = true
        tab.value = strTabid
        chanid = strChanid
        channm.value = strChannm
        chanimg.value = strChanimg
        if (strTabid == "msg") {
            searchText.value = strSearchText //Main.vue에서 넘어온 검색어            
            procSearchMsg(true)
        } else {
            procSearchMedia(true)
        }        
    }

    function close() {
        show.value = false
    }

    function changeTab(kind) {
        tab.value = kind
        if (kind == "msg") {
            procSearchMsg(true)
        } else {
            procSearchMedia(true)
        }
    }

    function clearText() {
        fileExt.value = ''
        frYm.value = ''
        toYm.value = ''
        authorNm.value = ''
        searchText.value = ''
    }

    async function procSearchMedia(refresh) {
        if (refresh) {
            savLastMsgMstCdt = hush.cons.cdtAtLast
            prevScrollY = 0
            if (tab.value == "file") {
                filelist.value = []
            } else if (tab.value == "image") {
                imagelist.value = []
            }
        }
        const param = { 
            chanid: chanid, kind: tab.value, lastMsgMstCdt: savLastMsgMstCdt, rdoOpt: rdoOpt.value, 
            fileExt: fileExt.value.trim(), frYm: frYm.value.trim(), toYm: toYm.value.trim(), 
            authorNm: authorNm.value.trim(), searchText: searchText.value.trim()
        }
        const res = await axios.post("/chanmsg/searchMedia", param)
        const rs = gst.util.chkAxiosCode(res.data) 
        if (!rs) return
        for (let i = 0; i < rs.list.length; i++) {
            const row = rs.list[i]
            row.chanImg = gst.util.getChanImg(row.TYP, row.STATE)
            if (tab.value == "image") {
                if (!row.BUFFER) continue
                row.url = hush.util.getImageBlobUrl(row.BUFFER.data)
                row.cdt = row.CDT
                imagelist.value.push(row)
            } else if (tab.value == "file") {
                filelist.value.push(row)
            }
            if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
        }
    }

    async function procSearchMsg(refresh) {
        if (refresh) {
            savLastMsgMstCdt = hush.cons.cdtAtLast
            prevScrollY = 0
            msglist.value = []
        }
        const param = { 
            chanid: chanid, kind: tab.value, lastMsgMstCdt: savLastMsgMstCdt, rdoOpt: rdoOpt.value, 
            frYm: frYm.value.trim(), toYm: toYm.value.trim(), authorNm: authorNm.value.trim(), searchText: searchText.value.trim()
        }
        const res = await axios.post("/chanmsg/searchMsg", param)
        const rs = gst.util.chkAxiosCode(res.data) 
        if (!rs) return
        for (let i = 0; i < rs.list.length; i++) {
            const row = rs.list[i]
            row.chanImg = gst.util.getChanImg(row.TYP, row.STATE)
            gst.util.handleMsgSub(row)
            msglist.value.push(row)
            if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
        }
    }

    function saveCurScrollY(posY) {
        if (!gst.objSaved[tab.value]) gst.objSaved[tab.value] = {}
        gst.objSaved[tab.value].scrollY = posY
    }

    const onScrollEnd = async (e) => { //scrollend 이벤트이므로 debounce가 필요없음 //import { debounce } from 'lodash'
        const sTop = scrollArea.value.scrollTop     
        let which = (sTop <= prevScrollY) ? "up" : "down" //down만 필요하므로 stop,up은 필요없으므로 <=로 체크함
        prevScrollY = sTop
        saveCurScrollY(prevScrollY) 
        const ele = document.getElementById("chan_center_body")
        const bottomEntryPoint = (scrollArea.value.scrollHeight - ele.offsetHeight) - 200 //max ScrollTop보다 200정도 작게 정함
        if (which == "down" && sTop > bottomEntryPoint) {
            if (tab.value == "msg") {
                await procSearchMsg()
            } else {
                await procSearchMedia()
            }
        }
    }

    function downloadFile(msgid, chanid, row) {
        try {
            const cdtsub = row.CDTSUB ?? row.CDT //msgmst의 cdt가 아닌 msgsub의 cdt가 필요
            gst.util.downloadBlob("F", msgid, chanid, cdtsub, row.BODY)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    function imgLoaded(e, row) {
        row.realWidth = e.currentTarget.naturalWidth
        row.readHeight = e.currentTarget.naturalHeight
    }

    function showImage(row, msgid) {
        try {
            imgParam.value = row
            imgParam.value.msgid = msgid
            imgParam.value.chanid = chanid
            imgPopupUrl.value = row.url
            imgPopupStyle.value = { width: row.realWidth + "px", height: row.realHeight + "px" }
            imgPopupRef.value.open()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function openLink(url) { 
        window.open(url, "_blank")
    }

    function openNewWin(chanid, msgid) {
        let url = "/body/msglist/" + chanid + "/" + msgid
        window.open(url)
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <div style="display:flex;align-items:center">
                        <div class="topMenu" :class="tab == 'msg' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('msg')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_msg.png')">
                            <span style="margin-left:5px;font-weight:bold">메시지</span> 
                        </div>
                        <div class="topMenu" :class="tab == 'file' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('file')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_file.png')">
                            <span style="margin-left:5px;font-weight:bold">파일</span> 
                        </div>
                        <div class="topMenu" :class="tab == 'image' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('image')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_image.png')">
                            <span style="margin-left:5px;font-weight:bold">이미지</span> 
                        </div>
                        <div v-if="chanid != ''" style="margin-left:10px;padding:6px;display:flex;align-items:center;border:1px solid lightgray">
                            <img class="coImg18" :src="gst.html.getImageUrl(chanimg)" style="margin-right:5px">
                            <div class="coDotDot">{{ channm }}</div>
                        </div>
                        <div v-else style="margin-left:10px;padding:0 6px 0 3px;display:flex;align-items:center;border:1px solid lightgray">
                            <input type="radio" id="all" value="all" v-model="rdoOpt" /><label for="all">채널+DM</label>
                            <input type="radio" id="chan" value="chan" v-model="rdoOpt" style="margin-left:10px"/><label for="chan">채널</label>
                            <input type="radio" id="dm" value="dm" v-model="rdoOpt" style="margin-left:10px"/><label for="dm">DM</label>
                        </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;align-items:center">
                        <img class="coImg24" :src="gst.html.getImageUrl('close.png')" style="margin-right:10px;" @click="close" title="닫기">
                    </div>
                </div>
                <div v-if="tab=='file'" class="chan_center"><!--파일 검색-->
                    <div class="chan_center_header">
                        <div class="chan_center_header_left">
                            <input type="search" v-model="frYm" @keyup.enter="procSearchMedia(true)" style="width:90px;margin-right:2px" placeholder="YYYYMM" /> - 
                            <input type="search" v-model="toYm" @keyup.enter="procSearchMedia(true)" style="width:90px;margin-left:2px" placeholder="YYYYMM" />
                            <input type="search" v-model="authorNm" @keyup.enter="procSearchMedia(true)" style="width:100px" placeholder="전송자" />
                            <input type="search" v-model="searchText" @keyup.enter="procSearchMedia(true)" style="width:120px" placeholder="본문" />
                            <input type="search" v-model="fileExt" @keyup.enter="procSearchMedia(true)" style="width:60px" placeholder="확장자" />
                            <div class="coImgBtn" @click="procSearchMedia(true)">
                                <img :src="gst.html.getImageUrl('white_search.png')" class="coImg24">
                                <span class="coImgSpn">검색</span>
                            </div>
                            <div class="coImgBtn" @click="clearText()">
                                <img :src="gst.html.getImageUrl('white_cancel.png')" class="coImg24">
                                <span class="coImgSpn">Clear</span>
                            </div>
                        </div>
                        <div class="chan_center_header_right"></div>
                    </div>
                    <div class="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
                        <div v-for="(row, idx) in filelist" class="file_body" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)">
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="div_cdt">{{ hush.util.displayDt(row.CDT) }}</div>
                                <div style="display:flex;align-items:center">
                                    <img class="coImg18" :src="gst.html.getImageUrl(row.chanImg)" style="margin-right:5px">
                                    <div class="coDotDot">{{ row.CHANNM }}</div>
                                </div>
                            </div>
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="div_authornm">
                                    <div>{{ row.AUTHORNM }}</div>
                                    <div v-show="row.hover" class="div_newwin" @click="openNewWin(row.CHANID, row.MSGID)">새창</div>
                                </div>
                                <div class="div_bodytext coDotDot">{{ row.BODYTEXT }}</div>
                            </div>
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="div_cdt"></div>
                                <div class="div_bodytext coDotDot" @click="downloadFile(row.MSGID, row.CHANID, row)" style="text-decoration:underline;font-weight:bold;color:steelblue">
                                    {{ row.BODY }}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else-if="tab=='image'" class="chan_center"><!--이미지 검색-->
                    <div class="chan_center_header">
                        <div class="chan_center_header_left">
                            <input type="search" v-model="frYm" @keyup.enter="procSearchMedia(true)" style="width:90px;margin-right:2px" placeholder="YYYYMM" /> - 
                            <input type="search" v-model="toYm" @keyup.enter="procSearchMedia(true)" style="width:90px;margin-left:2px" placeholder="YYYYMM" />
                            <input type="search" v-model="authorNm" @keyup.enter="procSearchMedia(true)" style="width:100px" placeholder="전송자" />
                            <input type="search" v-model="searchText" @keyup.enter="procSearchMedia(true)" style="width:120px" placeholder="본문" />
                            <div class="coImgBtn" @click="procSearchMedia(true)">
                                <img :src="gst.html.getImageUrl('white_search.png')" class="coImg24">
                                <span class="coImgSpn">검색</span>
                            </div>
                            <div class="coImgBtn" @click="clearText()">
                                <img :src="gst.html.getImageUrl('white_cancel.png')" class="coImg24">
                                <span class="coImgSpn">Clear</span>
                            </div>
                        </div>
                        <div class="chan_center_header_right"></div>
                    </div>
                    <div class="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
                        <div class="image_body">
                            <div v-for="(row, idx) in imagelist" class="item" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)">
                                <div style="width:100%;height:80%;display:flex">
                                    <div style="width:40%;height:100%;display:flex;justify-content:center;align-items:center">
                                        <img :src="row.url" style='max-width:95%;max-height:95%' @load="(e) => imgLoaded(e, row)" @click="showImage(row, row.MSGID)">
                                    </div>
                                    <div style="width:60%;height:100%;padding:5px;display:flex;flex-direction:column">
                                        <div style="height:30px">{{ hush.util.displayDt(row.CDT) }}</div>
                                        <div style="height:30px;display:flex;justify-content:space-between;align-items:center">
                                            <div>{{ row.AUTHORNM }}</div>
                                            <div v-show="row.hover" class="div_newwin" @click="openNewWin(row.CHANID, row.MSGID)">새창</div>
                                        </div>
                                        <div style="display:flex;align-items:center">
                                            <img class="coImg18" :src="gst.html.getImageUrl(row.chanImg)" style="margin-right:5px">
                                            <div class="coDotDot">{{ row.CHANNM }}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style="width:100%;height:20%;padding-left:5px;display:flex;align-items:center">
                                    <div class="coDotDot">{{ row.BODYTEXT }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else class="chan_center"><!--메시지 검색-->
                    <div class="chan_center_header">
                        <div class="chan_center_header_left">
                            <input type="search" v-model="frYm" @keyup.enter="procSearchMsg(true)" style="width:90px;margin-right:2px" placeholder="YYYYMM" /> - 
                            <input type="search" v-model="toYm" @keyup.enter="procSearchMsg(true)" style="width:90px;margin-left:2px" placeholder="YYYYMM" />
                            <input type="search" v-model="authorNm" @keyup.enter="procSearchMsg(true)" style="width:100px" placeholder="전송자" />
                            <input type="search" v-model="searchText" @keyup.enter="procSearchMsg(true)" style="width:120px" placeholder="본문" />
                            <div class="coImgBtn" @click="procSearchMsg(true)">
                                <img :src="gst.html.getImageUrl('white_search.png')" class="coImg24">
                                <span class="coImgSpn">검색</span>
                            </div>
                            <div class="coImgBtn" @click="clearText()">
                                <img :src="gst.html.getImageUrl('white_cancel.png')" class="coImg24">
                                <span class="coImgSpn">Clear</span>
                            </div>
                        </div>
                        <div class="chan_center_header_right"></div>
                    </div>
                    <div class="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
                        <div v-for="(row, idx) in msglist" class="file_body" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)">
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="div_cdt">{{ hush.util.displayDt(row.CDT) }}</div>
                                <div style="display:flex;align-items:center">
                                    <img class="coImg18" :src="gst.html.getImageUrl(row.chanImg)" style="margin-right:5px">
                                    <div class="coDotDot">{{ row.CHANNM }}</div>
                                </div>
                            </div>
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="div_authornm">
                                    <div>{{ row.AUTHORNM }}</div>
                                    <div v-show="row.hover" class="div_newwin" @click="openNewWin(row.CHANID, row.MSGID)">새창</div>
                                </div>
                                <div class="div_bodytext coDotDot">{{ row.BODYTEXT }}</div>
                            </div>
                            <div style="width:calc(100% - 20px);padding:0 10px;display:flex;justify-content:space-between;align-items:center">
                                <div></div>
                                <div v-if="row.msgimg.length > 0 || row.msgfile.length > 0 || row.msglink.length > 0"
                                    style="width:calc(100% - 170px);margin-bottom:5px;display:flex;align-items:center;flex-wrap:wrap">
                                    <div v-for="(row5, idx5) in row.msgimg" class="msg_image_each" @click="showImage(row5, row.MSGID)"><!--이미지-->
                                        <img :src="row5.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row5)">
                                    </div>                
                                    <div v-for="(row5, idx5) in row.msgfile" class="msg_file_each" @click="downloadFile(row.MSGID, row.CHANID, row5)"><!--파일-->
                                        <div style="height:100%;display:flex;align-items:center">
                                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_download.png')">
                                            <span style="margin:0 3px">{{ row5.name }}</span>(<span>{{ hush.util.formatBytes(row5.size) }}</span>)
                                        </div>                                    
                                    </div>
                                    <div v-for="(row5, idx5) in row.msglink" class="msg_file_each" @click="openLink(row5.url)"><!--링크-->
                                        <div style="height:100%;display:flex;align-items:center">
                                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_addlink.png')">
                                            <span style="margin:0 3px;color:#005192">{{ row5.text }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
    <popup-image ref="imgPopupRef" :param="imgParam">
        <img :src="imgPopupUrl" :style='imgPopupStyle'>
    </popup-image>
</template>

<style scoped>
    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    input[type=search]:focus { outline:2px solid lightgreen }
    .popup {
        position:fixed;width:90%;height:90%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;border-radius:10px
    }
    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:var(--hover-color);border-radius:5px }
    .topMenu:active { background:var(--active-color);border-radius:5px }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .btn_img { height:18px;padding:1px;display:flex;align-items:center;justify-content:center }
    .btn_spn { margin-left:2px;font-size:14px;color:dimgray }
    .chan_center {
        width:100%;height:calc(100% - 40px);
        display:flex;flex-direction:column;border:1px solid dimgray
    }
    .chan_center_header {
        width:100%;min-height:60px;
        display:flex;align-items:center;justify-content:space-between;
        background:whitesmoke;border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_header_left {
        width:99%;height:100%;padding:20px;display:flex;align-items:center;
        font-size:18px;
    }
    .chan_center_header_right {
        width:1%;height:100%;padding:20px;display:flex;align-items:center;justify-content:flex-end;
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .file_body {
        width:100%;display:flex;flex-direction:column;border-bottom:1px solid lightgray;cursor:pointer
    }
    .file_body:hover { background:var(--hover-color) }
    .image_body {	
        padding:5px;
        display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));grid-auto-rows:150px; gap:5px; 
    }
    .item {  				
        padding:5px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid lightgray
    }
    .item:hover { background:var(--hover-color) }
    .msg_body_sub {
        display:flex;margin-bottom:10px;display:flex;flex-wrap:wrap;justify-content:flex-start;cursor:pointer
    }
    .msg_file_each {
        position:relative;min-width:100px;height:30px;margin:10px 10px 0 0;padding:0 5px;display:flex;align-items:center;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_image_each {
        position:relative;width:80px;height:80px;margin:10px 10px 0 0;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .div_cdt { width:160px;height:36px;padding:0 10px;display:flex;align-items:center }
    .div_authornm { width:160px;height:36px;padding:0 10px;display:flex;justify-content:space-between;align-items:center }
    .div_newwin { padding:3px;border-radius:5px;background:var(--primary-btn-color);color:white;cursor:pointer }
    .div_bodytext { width:calc(100% - 180px);height:36px;display:flex;align-items:center }
</style>