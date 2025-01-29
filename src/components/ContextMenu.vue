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
            ctxChildStyle.value.top = (posY - pHeight + 10) + "px"
        } else { //T
            ctxChildStyle.value.top = (posY - 10) + "px"
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

<template>
    <div v-show="gst.ctx.on" id="ctxParent" class="popupMenu" 
        style="position:fixed;min-width:150px;max-width:350px;z-index:9999" :style="ctxStyle">
        <div style="width:calc(100% - 12px);height:30px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
            <div style="font-weight:bold">더보기</div>
            <div>설정</div>
        </div>
        <div style="width:100%;display:flex;flex-direction:column;"><!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
            <div v-for="(row, idx) in gst.ctx.menu" class="coHover" 
                :style="{ color: row.disable ? 'dimgray' : '' }" @click.stop="(e) => rowClick(e, row, idx)">
                <div v-if="row.line">----------</div>
                <div v-if="row.child">{{ row.nm }} ></div>
                <div v-else>{{ row.nm }}</div>                    
            </div> 
        </div>
    </div>
    <div v-show="ctxChildOn" id="ctxChild" class="popupMenu" 
        style="position:fixed;min-width:150px;max-width:350px;" :style="ctxChildStyle">
        <div style="width:100%;display:flex;flex-direction:column;"><!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
            <div v-for="(row, idx) in ctxChildMenu" class="coHover" 
                :style="{ color: row.disable ? 'dimgray' : '' }" @click.stop="(e) => rowClick(e, row, idx)">
                <div v-if="row.line">----------</div>
                <div v-if="row.child">{{ row.nm }} ></div>
                <div v-else>{{ row.nm }}</div>                    
            </div> 
        </div>
    </div>
</template>

<style scoped>

    .popupMenu {
        display:flex;flex-direction:column;
        background:var(--menu-color);border:1px solid var(--border-color);border-radius:8px;box-shadow:2px 2px 2px var(--shadow-color)
    }

</style>