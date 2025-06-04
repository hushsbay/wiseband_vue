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

    let scrollArea = ref(null), listGroup = ref([]), kindGroup = ref('my'), groupRow = ref({}) //groupRow는 element를 동적으로 할당
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
            gst.util.chkOnMountedTwice(route, 'GroupPanel')
            setBasicInfo()
            if (localStorage.wiseband_lastsel_group) kindGroup.value = localStorage.wiseband_lastsel_group
            await getList()
            groupClickOnLoop(true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 바로 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            debugger
            if (route.path == "/main/group") { //사이드메뉴에서 클릭한 경우
                groupClickOnLoop(true)
            } else {
                //UserList가 라우팅되는 루틴이며 UserList로부터 처리될 것임
            }
        }
    })

    async function changeKind() {
        localStorage.wiseband_lastsel_group = kindGroup.value
        await getList()
        groupClickOnLoop(true)
    }

    function setBasicInfo() {
        document.title = "WiSEBand 그룹"
        gst.selSideMenu = "mnuGroup" //UserList.vue에 Blank 방지
    }

    async function getList() {
        try { //모든 데이터 가져오기 (페이징/무한스크롤 없음)
            const res = await axios.post("/menu/qryGroup", { kind : kindGroup.value }) //my,other,all
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            listGroup.value = rs ? rs.list : []
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function groupClickOnLoop(clickNode, grid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 true. grid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        debugger
        let foundIdx = -1
        listGroup.value.forEach((item, index) => {
            procgroupRowImg(item)
            if (item.GR_ID == localStorage.wiseband_lastsel_grid) {
                gst.util.scrollIntoView(groupRow, item.GR_ID) //groupRow.value[item.GR_ID].scrollIntoView({ behavior: "smooth", block: "nearest" })
                groupClick(item, index, clickNode, grid)
                foundIdx = index
            }
        })
        if (foundIdx == -1) { //최초 실행시 그룹이 있는데 선택이 없는 사용자들은 맨 처음 그룹을 선택하게 함
            for (let i = 0; i < listGroup.value.length; i++) {
                const item = listGroup.value[i]
                procgroupRowImg(item)
                groupClick(item, i, clickNode, grid)
                if (item.GR_ID) break
            }
        }
    }

    function procgroupRowImg(item) { //svg는 이미지 컬러링이 가능하나 핸들링이 쉽지 않아 png로 별도 이미지 교체로 처리
        item.otherImg = (item.OTHER == "other") ? "person.png" : ""
        const color = item.sel ? hush.cons.color_dark : hush.cons.color_light
        item.nodeImg = color + "people2.png"
        if (item.otherImg) item.otherImg = color + item.otherImg
    }

    async function groupClick(row, idx, clickNode, grid) {
        try {
            const gridReal = grid ? grid : row.GR_ID
            listGroup.value.forEach((item) => { //const row1 = listGroup.value.find((item) => item.GR_ID == gridReal)
                if (item.GR_ID == gridReal) {
                    item.sel = true
                    procgroupRowImg(item)
                    localStorage.wiseband_lastsel_grid = gridReal
                    if (clickNode) gst.util.goBodyList('group_body', { grid: item.GR_ID })
                } else {
                    if (item.sel) {
                        item.sel = false
                        procgroupRowImg(item)
                    }
                    if (item.hover) item.hover = false
                }
            })
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

    async function handleEvFromBody(grid) { //UserList.vue에서 실행
        await getList()
        groupClickOnLoop()
        if (!grid) newGroup() //그룹삭제
    }

    function newGroup() {
        
        gst.util.goBodyList('group_body', { grid: "new" }, true)
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="kindGroup" style="background:var(--second-color);color:var(--second-select-color);border:none" @change="changeKind">
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
            <div v-for="(row, idx) in listGroup" :id="row.GR_ID" :ref="(ele) => { groupRow[row.GR_ID] = ele }"
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
            <div v-if="listGroup.length == 0" style="width:100%;height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 그룹 데이터가 없습니다.<br><br>
                    조직내 협의를 통해 그룹을 생성합니다.<br>
                    (우측상단 '새그룹' 버튼을 사용)
                </div>
            </div>
        </div>
    </div>
    <resizer nm="group" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listGroup.length > 0" id="chan_body" :style="{ width: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive>
                <component :is="Component" :key="$route.fullPath" @ev-to-panel="handleEvFromBody"/>
            </keep-alive>
        </router-view>
    </div> 
    <div v-else id="chan_body" :style="{ width: chanMainWidth }" style="display:flex;justify-content:center;align-items:center">
        <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
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
