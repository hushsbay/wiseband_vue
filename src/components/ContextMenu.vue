<script setup>
    import { ref, watch, nextTick } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const emits = defineEmits(["ev-menu-click"])

    let ctxStyle = ref({}) //Parent 스타일
    let ctxChildOn = ref(false), ctxChildStyle = ref({}), ctxChildMenu = ref([])

    watch(gst.ctx, async () => {
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

    watch([ctxChildMenu, ctxChildOn], async () => {
        await nextTick()
        let posX = gst.ctx.data.parentX
        let posY = gst.ctx.data.parentY
        let ctxChild = document.getElementById('ctxChild')
        const pWidth = ctxChild.offsetWidth
        const pHeight = ctxChild.offsetHeight
        if (gst.ctx.data.type.startsWith("L")) {
            ctxChildStyle.value.left = (posX - pWidth - 3) + "px"
        } else { //R
            ctxChildStyle.value.left = (posX + gst.ctx.data.parentWidth + 3) +"px"
        }
        if (gst.ctx.data.type.endsWith("B")) {
            ctxChildStyle.value.top = (posY - pHeight + 20) + "px"
        } else { //T
            ctxChildStyle.value.top = (posY - 20) + "px"
        }
    }, { immediate: true, deep: true })
    
    async function rowClick(e, row, idx) {
        if (row.line || row.disable) return
        if (row.child) { //ctxParent의 좌표타입(LB,LT,RB,RT)에 따라 left/top을 결정하면 됨
            gst.ctx.data.parentY = e.clientY
            ctxChildMenu.value = row.child
            ctxChildOn.value = !ctxChildOn.value         
        } else {
            ctxChildOn.value = false
            gst.ctx.on = false //props가 아니고 readonly도 아니므로 문제없음
            emits("ev-menu-click", row, idx)
        }        
    }
</script>

<template> <!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
    <div v-show="gst.ctx.on" id="ctxParent" class="popupMenu" :style="ctxStyle">
        <div v-if="gst.ctx.data.header" class="popupHeader">
            <div v-html="gst.ctx.data.header" class="popupHeaderItem coDotDot"></div>
        </div>
        <div v-for="(row, idx) in gst.ctx.menu" class="coHover" :style="{ color: row.disable ? 'dimgray' : '', borderBottom: row.deli ? '1px solid black' : '' }" 
            @click.stop="(e) => rowClick(e, row, idx)">
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
    <div v-show="ctxChildOn" id="ctxChild" class="popupMenu" :style="ctxChildStyle">
        <div v-for="(row, idx) in ctxChildMenu" class="coHover" :style="{ color: row.disable ? 'dimgray' : '', borderBottom: row.deli ? '1px solid black' : '' }" 
            @click.stop="(e) => rowClick(e, row, idx)">
            <div class="popupMenuItem coDotDot">
                <img v-if="row.img" class="coImg14" :src="gst.html.getImageUrl(row.img)" style="margin-right:5px">
                <span :style="{ color: row.color ? row.color : '' }">{{ row.nm }}</span>
            </div> 
        </div> 
    </div>
</template>

<style scoped>

    .popupMenu {
        position:fixed;min-width:150px;max-width:350px;z-index:9999;
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
        width:calc(100% - 8px);height:35px;padding-left:8px;
        display:flex;align-items:center;border-bottom:1px solid var(--border-color)
    }

    .popupMenuItemChild {
        width:calc(100% - 8px);height:35px;padding-left:8px;
        display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color)
    }

</style>