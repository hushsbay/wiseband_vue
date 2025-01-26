<script setup>
    import { ref, onMounted, watch } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupList from "/src/components/PopupList.vue"

    const gst = GeneralStore()
    const router = useRouter()

    const popupMenuOn = ref(false), popupMenuPos = ref({ top: '0px', bottom: '0px' })
    const popupData = ref({ id: '', lines: false })
    const kind = ref('my')
    const listChan = ref([])
    
    onMounted(async () => { 
        try {
            await getList()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    watch(kind, async () => { await getList() }) //immediate:true시 먼저 못읽는 경우도 발생할 수 있으므로 onMounted에서도 처리

    async function getList() {
        try {            
            const res = await axios.post("/menu/qryChan", { kind : kind.value })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            listChan.value = rs.list
            listChan.value.forEach((item) => {
                item.exploded = true
                procChanRow(item)
            })
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function procChanRow(item) {
        if (item.DEPTH == "1") {
            item.nodeImg = item.exploded ? "whitesmoke_expanded.png" : "whitesmoke_collapsed.png"
            item.readonlyImg = ""
            item.notioffImg = ""
            item.bookmarkImg = ""
        } else {
            if (item.CHANID == null) {
                item.nodeImg = "whitesmoke_channel.png"
                item.readonlyImg = ""
                item.notioffImg = ""
                item.bookmarkImg = ""
                item.CHANNM = "없음"
            } else {
                item.nodeImg = (item.STATE == "A") ? "whitesmoke_channel.png" : "whitesmoke_lock.png"
                item.readonlyImg = (item.KIND == "R") ? "whitesmoke_readonly.png" : ""
                item.notioffImg = (item.NOTI == "X") ? "whitesmoke_notioff.png" : ""
                item.bookmarkImg = (item.BOOKMARK == "Y") ? "whitesmoke_bookmark.png" : ""
            }
        }
    }

    function chanClick(rowId, row, idx) {
        if (row.DEPTH == "1") { //접기 or 펼치기
            if (row.exploded) {
                row.exploded = false
            } else {
                row.exploded = true
            }
            procChanRow(row)
            for (let i = idx + 1; i < listChan.value.length; i++) {
                if (listChan.value[i].DEPTH == "1") break
                listChan.value[i].exploded = row.exploded
            }
        } else {

        }
    }

    function procExpCol(type) {
        const exploded = (type == "E") ? true : false
        for (let i = 0; i < listChan.value.length; i++) {
            listChan.value[i].exploded = exploded
        }
    }

    function newMsg() {
        alert('newMsg')
    }
</script>

<template>
    <div class="chan_side">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="kind" style="background:var(--second-color);color:var(--text-white-color);border:none">
                    <option value="my">내 채널</option>
                    <option value="other">다른 채널</option>
                    <option value="all">모든 채널</option>
                </select>
            </div>
            <div class="chan_side_top_right">
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('C')">
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_collapseall.png')" title="모두접기기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('E')">
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_expandall.png')" title="모두펼치기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="newMsg">
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_compose.png')" title="새메시지">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable">
            <div v-for="(row, idx) in listChan" @click="(e) => chanClick(row.ID, row, idx)" :id="row.DEPTH == '1' ? row.GR_ID : row.CHANID">
                <div v-show="row.DEPTH == '1' || (row.DEPTH == '2' && row.exploded)" class="node"><!-- <div class="node" :style="{ padding: row.DEPTH == '1' ? '0 10px' : '0 30px' }"> -->
                    <div class="coDotDot" :title="row.DEPTH == '1' ? row.GR_NM : row.CHANNM">
                        <img class="coImg14" :src="gst.html.getImageUrl(row.nodeImg)">
                        {{ row.DEPTH == '1' ? row.GR_NM : row.CHANNM }}
                    </div>
                    <div class="nodeRight">
                        <img v-if="row.readonlyImg" class="coImg14" :src="gst.html.getImageUrl(row.readonlyImg)" title="읽기전용">
                        <img v-if="row.notioffImg" class="coImg14" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off">
                        <img v-if="row.bookmarkImg" class="coImg14" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크">
                        <span v-if="row.OTHER">other</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="chan_main">
        <router-view />
    </div>
</template>

<style scoped>    
    .chan_side {
        min-width:240px;max-width:240px;height:100%;margin-right:3px;
        display:flex;flex-direction:column;background:var(--second-color);border-top-left-radius:10px;border-bottom-left-radius:10px;
    }
    .chan_side_top {
        width:100%;height:50px;display:flex;justify-content:space-between;
    }
    .chan_side_top_left {
        width:50%;height:100%;padding-left:10px;display:flex;align-items:center;
    }
    .chan_side_top_right {
        width:50%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
    }
    .chan_side_main {
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .node {
        width:calc(100% - 30px);min-height:36px;padding:0 10px;margin:0 5px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--text-white-color);
    }
    .nodeRight {
        display:flex;align-items:center;justify-content:flex-end;
    }
    /* .node:hover { background-color:whitesmoke;color:black;cursor:pointer; }
    #btnNew:hover { background-color:var(--primary-color);cursor:pointer; } */
    .node:hover, .coImg20:hover { background:var(--second-hover-color);cursor:pointer; }
    .chan_main {
        width:100%;height:100%;display:flex;
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
</style>
