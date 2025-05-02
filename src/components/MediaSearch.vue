<script setup>
    import { ref, onMounted } from 'vue' 
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    
    defineExpose({ open, close })

    let observerBottom = ref(null), observerBottomTarget = ref(null)
    let afterScrolled = ref(false)

    let tab = ref(''), show = ref(false), chanid = ''
    let fileName = ref(''), frYm = ref(''), toYm = ref(''), authorNm = ref(''), bodyText = ref('')
    let savLastMsgMstCdt

    const scrollArea = ref(null), filelist = ref([]), imagelist = ref([]) 

    function open(strTabid, strChanid) {
        show.value = true
        tab.value = strTabid
        chanid = strChanid
    }

    function close() {
        show.value = false
    }

    function changeTab(kind) {
        tab.value = kind
    }

    async function procSearch(refresh) {
        if (refresh) {
            savLastMsgMstCdt = hush.cons.cdtAtLast
            if (tab == "file") {
                filelist.value = []
            } else if (tab == "image") {
                imagelist.value = []
            }
        }
        const param = { chanid: chanid, kind: tab.value, lastMsgMstCdt: savLastMsgMstCdt }
        const res = await axios.post("/chanmsg/searchMedia", param)
        const rs = gst.util.chkAxiosCode(res.data) 
        if (!rs) return
        for (let i = 0; i < rs.list.length; i++) { 
            if (tab.value == "file") {
                filelist.value.push(rs.list[i])
            } else if (tab.value == "image") {
                imagelist.value.push(rs.list[i])
            }
        }
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
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
                <div v-if="tab=='file'" style="width:100%;height:100%;border:1px solid dimgray">
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
                    <div class="chan_center_body" ref="scrollArea">
                        <div v-for="(row, idx) in filelist" class="msg_body" style="border-bottom:1px solid lightgray"
                            @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                                <div style="width:100%;display:flex;align-items:center">
                                    <div style="width:160px;height:36px;margin:0 0 0 10px;display:flex;align-items:center">{{ hush.util.displayDt(row.CDT) }}</div>
                                    <div class="coDotDot" style="width:calc(100% - 170px);height:36px;display:flex;align-items:center">{{ row.BODY }}</div>
                                </div>
                                <div style="width:100%;display:flex;align-items:center">
                                    <div style="width:160px;height:36px;margin:0 0 0 10px;display:flex;align-items:center">{{ row.AUTHORNM }}</div>
                                    <div class="coDotDot" style="width:calc(100% - 170px);height:36px;display:flex;align-items:center">{{ row.BODYTEXT }}</div>
                                </div>
                        </div>
                        <div v-show="afterScrolled" ref="observerBottomTarget" style="width:100%;height:200px;display:flex;justify-content:center;align-items:center"></div>
                    </div>
                </div>
                <div v-if="tab=='image'" style="width:100%;height:100%;border:1px solid dimgray">
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
                    <div class="chan_center_body" ref="scrollArea">
                        <div v-for="(row, idx) in imagelist" class="msg_body procMenu" style="border-bottom:1px solid lightgray"
                            @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                            <div style="display:flex;align-items:center;cursor:pointer">
                                {{ row.BODYTEXT }}
                            </div>
                        </div>
                        <div v-show="afterScrolled" ref="observerBottomTarget" style="width:100%;height:200px;display:flex;justify-content:center;align-items:center"></div>
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
    .msg_body {
        display:flex;flex-direction:column
    }
    .msg_body:hover { background:whitesmoke }
    .msg_body:active { background:lightsteelblue }
</style>