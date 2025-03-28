<script setup>
    import { ref, watch, nextTick } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const emits = defineEmits(["ev-menu-click"])

    let ctxStyle = ref({}) //Parent 스타일
    let ctxChildOn = ref(false), ctxChildStyle = ref({}), ctxChildMenu = ref([])

    let prevX

    watch([gst.ctx], async () => { //4번씩 실행됨 : lodash의 debounce로 처리해도 문제 (10으로 잡아도 3번 처리, 500 잡으면 느리게 중첩으로 보여 문제 있음)
        if (!gst.ctx.on) ctxChildOn.value = false
        let posX = gst.ctx.data.posX
        let posY = gst.ctx.data.posY
        await nextTick()
        const docWidth = document.documentElement.offsetWidth
        const docHeight = document.documentElement.offsetHeight
        let ctxParent = document.getElementById('ctxParent')
        const pWidth = ctxParent.offsetWidth
        const pHeight = ctxParent.offsetHeight
        let ctxType
        if (posX + pWidth > docWidth) {
            ctxStyle.value.left = (posX - pWidth) + "px"
            ctxType = "L"
            gst.ctx.data.parentX = posX - pWidth
        } else {
            ctxStyle.value.left = posX + "px"
            ctxType = "R"
            gst.ctx.data.parentX = posX
        }
        if (posY + pHeight > docHeight) {
            ctxStyle.value.top = (posY - pHeight) + "px"
            ctxType += "B"
        } else {
            ctxStyle.value.top = posY + "px"
            ctxType += "T"
        }
        gst.ctx.data.type = ctxType
        gst.ctx.data.parentWidth = pWidth
    }, { immediate: true, deep: true })

    watch([ctxChildMenu], async () => {
        await nextTick()
        let posX = gst.ctx.data.parentX
        let posY = gst.ctx.data.parentY
        const docWidth = document.documentElement.offsetWidth
        const docHeight = document.documentElement.offsetHeight
        //const pWidth = document.getElementById('ctxChild').offsetWidth //렌더링이 보장되어야 하는데 잘안됨. 대신 right로 해결
        //const pHeight = document.getElementById('ctxChild').offsetHeight //렌더링이 보장되어야 하는데 잘안됨. 대신 bottom으로 해결
        if (gst.ctx.data.type.startsWith("L")) {
            ctxChildStyle.value.left = null
            ctxChildStyle.value.right = (docWidth - posX + 3) + "px"
        } else { //R
            ctxChildStyle.value.left = (posX + gst.ctx.data.parentWidth + 3) +"px"
            ctxChildStyle.value.right = null
        }
        if (gst.ctx.data.type.endsWith("B")) {
            ctxChildStyle.value.top = null
            ctxChildStyle.value.bottom = (docHeight - posY - 20) + "px"
        } else { //T
            ctxChildStyle.value.top = (posY - 20) + "px"
            ctxChildStyle.value.bottom = null
        }    
    }, { immediate: true, deep: true })
    
    async function rowClick(row, idx) {
        if (row.disable) return
        if (row.child) {
            //child는 mouseEnter에서 처리하도록 함
        } else {
            ctxChildOn.value = false
            gst.ctx.on = false //props가 아니고 readonly도 아니므로 문제없음
            emits("ev-menu-click", row, idx)
        }        
    }

    function mouseEnter(e, row) {
        ctxChildMenu.value = []
        ctxChildOn.value = false
        if (row.disable) return
        if (row.child) {
            prevX = e.pageX
            gst.ctx.data.parentY = e.clientY
            ctxChildMenu.value = row.child
            ctxChildOn.value = true
        }
    }

    function mouseLeave(e, row) {
        if (row.child) { //child가 떠 있는 반대방향으로 나갈 때는 child 닫기
            if ((gst.ctx.data.type.startsWith("L") && e.pageX > prevX) || (gst.ctx.data.type.startsWith("R") && e.pageX < prevX)) {
                ctxChildMenu.value = []
                ctxChildOn.value = false
            }
        } else {
            ctxChildMenu.value = []
            ctxChildOn.value = false
        }
    }

    function mouseLeaveChild() {
        ctxChildMenu.value = []
        ctxChildOn.value = false
    }
</script>

<template> <!-- 아래 @click.stop은 Main.vue 참조 -->
    <!-- 전체 fixed는 클릭시 ctx를 닫으나 클릭시 psg_proc 메뉴도 안보이게 되고 클릭후 다시 우클릭해야 ctx가 떠서 슬랙과 동일하지 않아서 일단 막음
         이걸 막게 되면 gst에 의존하지 않고 완전한 모듈을 만들려고 한 목표는 실패임 -> 향후 독립적인 모듈화 다시 시도하기 
    <div v-show="gst.ctx.on" style="width:100%;height:100%;position:fixed;top:0;left:0;background:transparent;z-index:9999" @click="gst.ctx.hide" @mousedown.right="gst.ctx.hide"> -->
        <div v-show="gst.ctx.on" id="ctxParent" class="popupMenu" :style="ctxStyle">
            <div v-if="gst.ctx.data.header" class="popupHeader">
                <div v-html="gst.ctx.data.header" class="popupHeaderItem coDotDot"></div>
            </div>
            <div v-for="(row, idx) in gst.ctx.menu" class="coHover" :style="{ color: row.disable ? 'dimgray' : '', borderBottom: row.deli ? '1px solid black' : '' }" 
                @mouseenter="(e) => mouseEnter(e, row)" @mouseleave="(e) => mouseLeave(e, row)"         
                @click.stop="rowClick(row, idx)"> 
                <div v-if="row.child" class="popupMenuItemChild coDotDot">
                    <div style="display:flex;align-items:center">
                        <img v-if="row.img" class="coImg14" :src="gst.html.getImageUrl(row.img)" style="margin-right:5px">
                        <span :style="{ color: row.color ? row.color : '' }">{{ row.nm }}</span>
                    </div>
                    <div style="color:dimgray;margin-right:8px">></div>
                </div>
                <div v-else class="popupMenuItem coDotDot">
                    <img v-if="row.img" class="coImg14" :src="gst.html.getImageUrl(row.img)" style="margin-right:5px">
                    <span :style="{ color: row.color ? row.color : '' }">{{ row.nm }}</span>
                </div>                    
            </div> 
        </div>
        <div v-show="ctxChildOn" id="ctxChild" class="popupMenu" :style="ctxChildStyle" @mouseleave="mouseLeaveChild">
            <div v-for="(row, idx) in ctxChildMenu" class="coHover" :style="{ color: row.disable ? 'dimgray' : '', borderBottom: row.deli ? '1px solid black' : '' }" 
                @click.stop="rowClick(row, idx)">
                <div class="popupMenuItem coDotDot">
                    <img v-if="row.img" class="coImg14" :src="gst.html.getImageUrl(row.img)" style="margin-right:5px">
                    <span :style="{ color: row.color ? row.color : '' }">{{ row.nm }}</span>
                </div> 
            </div> 
        </div>
    <!-- </div> -->
</template>

<style scoped>

    .popupMenu {
        position:fixed;min-width:100px;max-width:350px;z-index:9999;
        display:flex;flex-direction:column;
        background:var(--bottom-color);border:1px solid var(--border-color);border-radius:5px;
        box-shadow:1px 1px 1px var(--shadow-color)
    }

    .popupHeader {
        width:calc(100% - 12px);height:30px;padding:6px;
        display:flex;justify-content:space-between;align-items:center;
        border-bottom:1px solid var(--border-color)
    }

    .popupHeaderItem {
        display:flex;align-items:center;
        color:var(--primary-color);font-weight:bold
    }

    .popupMenuItem {
        width:calc(100% - 8px);height:35px;padding:0 8px;
        display:flex;align-items:center;border-bottom:1px solid var(--border-color)
    }

    .popupMenuItemChild {
        width:calc(100% - 8px);height:35px;padding-left:8px;
        display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color)
    }

</style>