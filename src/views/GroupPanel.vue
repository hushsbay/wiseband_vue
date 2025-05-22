<script setup>
    import { ref, onMounted, onActivated, watch } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import Resizer from "/src/components/Resizer.vue"
        
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    let scrollArea = ref(null), groupRow = ref({}) //groupRow는 element를 동적으로 할당
    let mounting = true

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_groupsidewidth ?? '300px') //localStorage 이름 유의
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')

    function handleFromResizer(chanSideVal, chanMainVal) {
        chanSideWidth.value = chanSideVal
        chanMainWidth.value = chanMainVal
    }
    //////////////////////////////////////////////////////////////////////////////////////

    onMounted(async () => {
        try {
            setBasicInfo()
            if (localStorage.wiseband_lastsel_group) gst.kindGroup = localStorage.wiseband_lastsel_group
            await getList()
            groupClickOnLoop(true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/group") {
                groupClickOnLoop()
            } else {
                //UserList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
            }
        }
    })

    watch([() => gst.selGroup], () => { //UserList -> GeneralStore -> watch
        //패널에서 클릭한 채널노드의 상태를 기억하는데 뒤로가기하면 UserList의 라우팅에서 처리
        groupRow.value[gst.selGroup].scrollIntoView({ behavior: "smooth", block: "nearest" })
        groupClick(null, null, gst.selGroup)
    })

    watch(() => gst.kindGroup, async () => {
        localStorage.wiseband_lastsel_group = gst.kindGroup
        await getList() 
        groupClickOnLoop()
    })

    function setBasicInfo() {
        document.title = "WiSEBand 그룹"
        gst.selSideMenu = "mnuGroup" //MsgList.vue에 Blank 방지
    }

    async function getList() {
        try { //모든 데이터 가져오기 (페이징,무한스크롤 필요없음)
            const res = await axios.post("/menu/qryGroup", { kind : gst.kindGroup }) //my,other,all
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.listGroup = rs.list
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function groupClickOnLoop(refresh) {
        gst.listGroup.forEach((item, index) => {
            procgroupRowImg(item)
            if (item.GR_ID == localStorage.wiseband_lastsel_grid) {
                groupRow.value[item.GR_ID].scrollIntoView({ behavior: "smooth", block: "nearest" })
                groupClick(item, index, null, refresh)
            }
        })
    }

    function procgroupRowImg(item) { //svg는 이미지 컬러링이 가능하나 핸들링이 쉽지 않아 png로 별도 이미지 교체로 처리
        item.otherImg = (item.OTHER == "other") ? "person.png" : ""
        const color = item.sel ? hush.cons.color_dark : hush.cons.color_light
        item.nodeImg = color + "collapsed.png"
        if (item.otherImg) item.otherImg = color + item.otherImg
    }

    async function groupClick(row, idx, grid, refresh) {
        try {
            const gridReal = grid ? grid : row.GR_ID
            gst.listGroup.forEach((item) => {
                item.sel = false
                item.hover = false
                procgroupRowImg(item)
            })
            const row1 = gst.listGroup.find((item) => item.GR_ID == gridReal)
            if (row1) {
                row1.sel = true
                procgroupRowImg(row1)
                localStorage.wiseband_lastsel_grid = gridReal
                gst.util.goBodyList('group_body', { grid: row1.GR_ID }, refresh)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        if (!row.CHANID) {            
            gst.ctx.menu = [
                { nm: "채널 생성" },
                { nm: "환경 설정" }
            ]
        } else {
            gst.ctx.menu = [
                { nm: "메시지목록 새로고침", func: function(item, idx) {
                    gst.util.goMsgList('home_body', { chanid: row.CHANID }, true)
                }},
                { nm: "새창에서 열기", deli: true, func: async function(item, idx) {
                    let url = gst.util.getUrlForOneMsgNotYet(row.CHANID)
                    window.open(url)
                }},
                { nm: "정보 보기", func: function(item, idx) {

                }},
                { nm: "즐겨찾기" },
                { nm: "초대" },
                { nm: "복사", img: hush.cons.color_dark + "person.png", child: [
                    { nm: "채널 복사", func: function(item, idx) { 
                        
                    }},
                    { nm: "링크 복사" }
                ]},                
                { nm: "나가기", color: "red" }
            ]            
        }
        gst.ctx.show(e)
    }

    function mouseEnter(row) {
        if (row.sel) return
        row.hover = true
    }

    function mouseLeave(row) {
        if (row.sel) return
        row.hover = false
    }

    function handleEvFromBody() { //UserList.vue에서 실행
        groupClickOnLoop()
    }

    function newGroup() {
        gst.util.goBodyList('group_body', { grid: "new" }, true)
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="gst.kindGroup" style="background:var(--second-color);color:var(--second-select-color);border:none">
                    <option value="my">내 그룹</option>
                    <option value="other">다른 그룹</option>
                    <option value="all">모든 그룹</option>
                </select>                
            </div>
            <div class="chan_side_top_right">
                <div style="padding:5px;border-radius:8px;" @click="newGroup">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'compose.png')" title="새그룹">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea">
            <div v-for="(row, idx) in gst.listGroup" :id="row.GR_ID" :ref="(ele) => { groupRow[row.GR_ID] = ele }"
                @click="groupClick(row, idx)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div :class="['node', row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']">
                    <div class="coDotDot" :title="row.GR_NM">
                        <img class="coImg14" :src="gst.html.getImageUrl(row.nodeImg)">
                        {{ row.GR_NM }}
                    </div>
                    <div class="nodeRight">
                        <img v-if="row.otherImg" class="coImg14" :src="gst.html.getImageUrl(row.otherImg)" title="다른 그룹">
                    </div>
                </div>
            </div>
        </div>
    </div>
    <resizer nm="group" @ev-from-resizer="handleFromResizer"></resizer>
    <div id="chan_body" :style="{ width: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive>
                <component :is="Component" :key="$route.fullPath" @ev-to-panel="handleEvFromBody"/>
            </keep-alive>
        </router-view>
    </div>    
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>    
    .chan_side {
        height:100%; /* width는 resizing처리됨 */
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
