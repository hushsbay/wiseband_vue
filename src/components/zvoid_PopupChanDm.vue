<script setup>
    import { ref } from 'vue' 
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const props = defineProps({ popupOn: Boolean, list : Array, popupData: Object }) //props update 문제 유의
    const emits = defineEmits(["ev-click", "ev-leave"])

    let chanRow = ref({})

    // onMounted(async () => {
    //     const res = await axios.post("/menu/qryChan", { kind : "my" })
    //     const rs = gst.util.chkAxiosCode(res.data) 
    //     if (!rs) return
    //     debugger
    //     for (let i = 0; i < rs.list.length; i++) {
    //         const row = rs.list[i]
            
    //     }    
    // })

    function mouseEnter(row) {
        if (row.sel) return
        row.hover = true
    }

    function mouseLeave(row) {
        if (row.sel) return
        row.hover = false
    }

    function listRowClick(row) {
        emits("ev-click", row)
    }
</script>

<template>
    <Transition>
        <div v-if="props.popupOn" class="overlay" @click="() => { emits('ev-leave') }">
            <div class="popupMenu">
                <div class="popupHeader">
                    <div class="popupHeaderLeft">{{ popupData.title }}</div>
                </div>
                <div class="popupList">
                    <!-- <div v-for="(row, idx) in list" @click="listRowClick(row)" 
                        class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                        <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                            <div class="coMenuContext">
                                <img class="coMenuImg" style="background:var(--second-color)" :src="gst.html.getImageUrl(row.IMG)">
                            </div>
                        </div>
                        <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="coDotDot" style="margin-top:7px;font-weight:bold">{{ row.CHANNM }}</div>
                            </div>        
                            <div style="width:100%;display:flex;align-items:center">
                                <div class="coDotDot" style="margin-top:3px;font-size:12px">{{ row.MASTERNM }}</div>
                            </div>        
                        </div>                
                    </div> -->
                    <div class="coScrollable">
                        <div v-for="(row, idx) in list" :key="row.DEPTH == '1' ? row.GR_ID : row.CHANID" :ref="(ele) => { chanRow[row.DEPTH == '1' ? row.GR_ID : row.CHANID] = ele }" :keyidx="idx"
                            @click="chanClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)">
                            <div v-show="row.DEPTH == '1' || (row.DEPTH == '2' && row.exploded)" :class="['node', row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']">
                                <div class="coDotDot" :title="row.DEPTH == '1' ? row.GR_NM : row.CHANNM" :style="{ paddingLeft: row.DEPTH == '1' ? '0' : '15px' }">
                                    <img class="coImg14" :src="gst.html.getImageUrl(row.nodeImg)">
                                    {{ row.DEPTH == '1' ? row.GR_NM : row.CHANNM }}
                                </div>
                                <div class="nodeRight">
                                    <span style="margin-right:5px;color:darkgray">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span>
                                    <img v-if="row.notioffImg" class="coImg14" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off">
                                    <img v-if="row.bookmarkImg" class="coImg14" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크">
                                    <img v-if="row.otherImg" class="coImg14" :src="gst.html.getImageUrl(row.otherImg)" title="다른 채널">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="popupFooter"></div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    /* .popup {
        position:fixed;width:90%;height:90%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;border-radius:10px
    }*/

    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }

    .popupMenu { /*top:0px;bottom:0px;height:380px; 3개는 props.popupPos로 표시 */
        position:fixed;width:60%;height:60%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;border-radius:10px
    }

    .popupHeader {
        width:calc(100% - 12px);height:36px;padding:6px;
        display:flex;justify-content:space-between;align-items:center;
        border-bottom:1px solid var(--border-color);background:var(--second-select-color)
    }

    .popupHeaderLeft {
        padding-left:8px;
        display:flex;align-items:center;
        color:var(--primary-color);font-weight:bold
    }

    .popupList {
        width:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto
    }

    .popupFooter {
        width:calc(100% - 12px);height:10px;padding:6px;
        display:flex;justify-content:space-between;align-items:center;
        border-top:1px solid var(--border-color);background:var(--second-select-color)
    }

    .popupFooterLeft {
        padding-left:8px;
        display:flex;align-items:center;
        color:steelblue;font-weight:bold
    }

    .node { /* min-height:36px */
        width:calc(100% - 30px);min-height:36px;padding:0 10px;margin:0 5px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--second-select-color);border-radius:5px;cursor:pointer;
    }
    .nodeRight { display:flex;align-items:center;justify-content:flex-end }
    .coImg20:hover { background:var(--second-hover-color); }
    .coImg20:active { background:var(--active-color);border-radius:9px }
    .nodeHover { background:var(--second-hover-color) }
    .nodeSel { background:var(--second-select-color);color:var(--primary-color) }

</style>