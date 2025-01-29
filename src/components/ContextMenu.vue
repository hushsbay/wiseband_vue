<script setup>
    import { ref, watch, nextTick } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const emits = defineEmits(["ev-menu-click"])

    let ctxStyle = ref({}) //Parent 스타일
    let ctxChildOn = ref(false), ctxChildStyle = ref({}), ctxChildMenu = ref([])

    watch([gst.ctx], async () => {
        if (!gst.ctx.on) ctxChildOn.value = false
        let posX = gst.ctx.data.posX
        let posY = gst.ctx.data.posY
        await nextTick()
        const docWidth = document.documentElement.offsetWidth
        const docHeight = document.documentElement.offsetHeight
        let ctxParent = document.getElementById('ctxParent')
        const pWidth = ctxParent.offsetWidth
        const pHeight = ctxParent.offsetHeight
        if (posX + pWidth > docWidth) {
            ctxStyle.value.left = (posX - pWidth) + "px"
        } else {
            ctxStyle.value.left = posX + "px"
        }
        if (posY + pHeight > docHeight) {
            ctxStyle.value.top = (posY - pHeight) + "px"
        } else {
            ctxStyle.value.top = posY + "px"
        }
    }, { immediate: true, deep: true })
    
    function rowClick(row, idx) {
        if (row.line || row.disable) return
        if (row.child) {
            ctxChildMenu.value = row.child
            ctxChildStyle.value.left = '300px'
            ctxChildStyle.value.top = '300px'
            ctxChildOn.value = true
        } else {
            ctxChildOn.value = false
            gst.ctx.on = false //props가 아님. readonly도 아님
            emits("ev-menu-click", row, idx)
        }        
    }
</script>

<template>
    <div v-show="gst.ctx.on" id="ctxParent" class="popupMenu" 
        style="position:fixed;min-width:200px;max-width:400px;z-index:9999" :style="ctxStyle">
        <div style="width:calc(100% - 12px);height:30px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
            <div style="font-weight:bold">더보기</div>
            <div>설정</div>
        </div>
        <div style="width:100%;display:flex;flex-direction:column;"><!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
            <div v-for="(row, idx) in gst.ctx.menu" class="coHover" 
                :style="{ color: row.disable ? 'dimgray' : '' }" @click.stop="() => rowClick(row, idx)">
                <div v-if="row.line">----------</div>
                <div v-if="row.child">{{ row.nm }} ></div>
                <div v-else>{{ row.nm }}</div>                    
            </div> 
        </div>
    </div>
    <div v-show="ctxChildOn" id="ctxChild" class="popupMenu" 
        style="position:fixed;min-width:200px;max-width:400px;" :style="ctxChildStyle">
        <div style="width:100%;display:flex;flex-direction:column;"><!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
            <div v-for="(row, idx) in ctxChildMenu" class="coHover" 
                :style="{ color: row.disable ? 'dimgray' : '' }" @click.stop="() => rowClick(row, idx)">
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