<script setup>
    import { ref } from 'vue' 
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupImage from "/src/components/PopupImage.vue"

    const gst = GeneralStore()
    
    defineExpose({ open, close })

    let tab = ref(''), show = ref(false), chanid = ''
    let fileName = ref(''), frYm = ref(''), toYm = ref(''), authorNm = ref(''), bodyText = ref('')
    let savLastMsgMstCdt

    const scrollArea = ref(null), filelist = ref([]), imagelist = ref([]) 
    let prevScrollY = 0 //Intersection Observer 오류(parameter 1 is not of type 'Element') 해결이 어려워 onScrollEnd에서 처리함

    const imgPopupRef = ref(null), imgParam = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련

    function open(strTabid, strChanid) {
        show.value = true
        tab.value = strTabid
        chanid = strChanid
        procSearch(true)
    }

    function close() {
        show.value = false
    }

    function changeTab(kind) {
        tab.value = kind
        procSearch(true)
    }

    async function procSearch(refresh) {
        if (refresh) {
            savLastMsgMstCdt = hush.cons.cdtAtLast
            if (tab.value == "file") {
                filelist.value = []
            } else if (tab.value == "image") {
                imagelist.value = []
            }
        }
        const param = { 
            chanid: chanid, kind: tab.value, lastMsgMstCdt: savLastMsgMstCdt,
            fileName: fileName.value.trim(), frYm: frYm.value.trim(), toYm: toYm.value.trim(), 
            authorNm: authorNm.value.trim(), bodyText: bodyText.value.trim()
        }
        const res = await axios.post("/chanmsg/searchMedia", param)
        const rs = gst.util.chkAxiosCode(res.data) 
        if (!rs) return
        for (let i = 0; i < rs.list.length; i++) {
            const row = rs.list[i]
            if (tab.value == "image") {
                if (!row.BUFFER) continue
                const uInt8Array = new Uint8Array(row.BUFFER.data)
                const blob = new Blob([uInt8Array], { type: "image/png" })
                const blobUrl = URL.createObjectURL(blob)
                row.url = blobUrl
                row.cdt = row.CDT
                imagelist.value.push(row)
            } else if (tab.value == "file") {
                filelist.value.push(row)
            }
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
        if (which == "down" && sTop > bottomEntryPoint) await procSearch()
    }

    function downloadFile(msgid, row) {
        try {
            gst.util.downloadBlob("F", msgid, chanid, row.CDT, row.BODY)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function rowRight(e, row, index) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
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
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <div style="display:flex">
                        <div class="topMenu" :class="tab == 'file' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('file')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                            <span style="margin-left:5px;font-weight:bold">파일</span> 
                        </div>
                        <div class="topMenu" :class="tab == 'image' ? 'tab_sel' : 'tab_unsel'" @click="changeTab('image')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                            <span style="margin-left:5px;font-weight:bold">이미지</span> 
                        </div>
                    </div>
                    <img class="coImg24" :src="gst.html.getImageUrl('close.png')" style="margin-right:10px;" @click="close" title="닫기">
                </div>
                <div v-if="tab=='file'" class="chan_center">
                    <div class="chan_center_header">
                        <div class="chan_center_header_left">
                            <input type="search" v-model="fileName" @keyup.enter="procSearch(true)" style="width:120px" placeholder="파일명" />
                            <input type="search" v-model="frYm" @keyup.enter="procSearch(true)" style="width:90px;margin-right:2px" placeholder="YYYYMM" /> - 
                            <input type="search" v-model="toYm" @keyup.enter="procSearch(true)" style="width:90px;margin-left:2px" placeholder="YYYYMM" />
                            <input type="search" v-model="authorNm" @keyup.enter="procSearch(true)" style="width:100px" placeholder="전송자" />
                            <input type="search" v-model="bodyText" @keyup.enter="procSearch(true)" style="width:120px" placeholder="본문" />
                            <div class="coImgBtn" @click="procSearch(true)">
                                <img :src="gst.html.getImageUrl('search.png')" style="height:18px;padding:1px;display:flex;align-items:center;justify-content:center" >
                                <span style="margin-left:2px;font-size:14px;color:dimgray">검색</span>
                            </div>
                        </div>
                        <div class="chan_center_header_right"></div>
                    </div>
                    <div class="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
                        <div v-for="(row, idx) in filelist" class="file_body" style="border-bottom:1px solid lightgray;cursor:pointer"
                            @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                                <div style="width:100%;display:flex;align-items:center">
                                    <div style="width:160px;height:36px;margin:0 0 0 10px;display:flex;align-items:center">{{ hush.util.displayDt(row.CDT) }}</div>
                                    <div class="coDotDot" @click="downloadFile(row.MSGID, row)"
                                         style="width:calc(100% - 170px);height:36px;display:flex;align-items:center;text-decoration:underline;font-weight:bold;color:steelblue">
                                        {{ row.BODY }}
                                    </div>
                                </div>
                                <div style="width:100%;display:flex;align-items:center">
                                    <div style="width:160px;height:36px;margin:0 0 0 10px;display:flex;align-items:center">{{ row.AUTHORNM }}</div>
                                    <div class="coDotDot" style="width:calc(100% - 170px);height:36px;display:flex;align-items:center">{{ row.BODYTEXT }}</div>
                                </div>
                        </div>
                    </div>
                </div>
                <div v-if="tab=='image'" class="chan_center">
                    <div class="chan_center_header">
                        <div class="chan_center_header_left">
                            <input type="search" v-model="frYm" @keyup.enter="procSearch(true)" style="width:90px;margin-right:2px" placeholder="YYYYMM" /> - 
                            <input type="search" v-model="toYm" @keyup.enter="procSearch(true)" style="width:90px;margin-left:2px" placeholder="YYYYMM" />
                            <input type="search" v-model="authorNm" @keyup.enter="procSearch(true)" style="width:100px" placeholder="전송자" />
                            <input type="search" v-model="bodyText" @keyup.enter="procSearch(true)" style="width:120px" placeholder="본문" />
                            <div class="coImgBtn" @click="procSearch(true)">
                                <img :src="gst.html.getImageUrl('search.png')" style="height:18px;padding:1px;display:flex;align-items:center;justify-content:center" >
                                <span style="margin-left:2px;font-size:14px;color:dimgray">검색</span>
                            </div>
                        </div>
                        <div class="chan_center_header_right"></div>
                    </div>
                    <div class="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
                        <div class="image_body">
                            <div v-for="(row, idx) in imagelist" class="item" style="border-bottom:1px solid lightgray;cursor:pointer"
                                @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                                <div style="width:40%;height:100%;padding:5px;display:flex;justify-content:center;align-items:center">
                                    <img :src="row.url" style='width:95%;height:95%' @load="(e) => imgLoaded(e, row)" @click="showImage(row, row.MSGID)">
                                </div>
                                <div style="width:60%;height:100%;display:flex;flex-direction:column">
                                    <div style="height:30px">{{ hush.util.displayDt(row.CDT) }}</div>
                                    <div style="height:30px">{{ row.AUTHORNM }}</div>
                                    <div style="height:calc(100% - 60px);overflow:hidden">{{ row.BODYTEXT }}</div>                                    
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

    .popup {
        position:fixed;width:90%;height:90%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column
    }

    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }

    .topMenu { cursor:pointer }
    .topMenu:hover { background:var(--active-color);font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .chan_center {
        width:100%;height:calc(100% - 40px);padding: 0 0 0 10px;
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
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .file_body {
        display:flex;flex-direction:column
    }
    .file_body:hover { background:whitesmoke }
    .file_body:active { background:lightsteelblue }
    .image_body {	
        padding:5px;
        display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));grid-auto-rows:150px; gap:5px; 
    }
    .item {  				
        padding:10px;display:flex;justify-content:center;align-items:center;border:0px solid lightgray
    }
    .item:hover { background:whitesmoke }
    .item:active { background:lightsteelblue }
</style>