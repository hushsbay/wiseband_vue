<script setup>
    import { ref, watch } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const emits = defineEmits(["ev-menu-click"])

    let ctxStyle = ref({})
    let ctxChildOn = ref(false), ctxChildStyle = ref({}), ctxChildMenu = ref([])

    watch([gst.ctx], async () => {
        if (!gst.ctx.on) ctxChildOn.value = false
        const posX = gst.ctx.data.posX
        const posY = gst.ctx.data.posY
        ctxStyle.value.left = posX + "px"
        ctxStyle.value.top = posY + "px"  
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
    <Transition>
        <div v-show="gst.ctx.on" class="popupMenu" style="position:fixed;z-index:9999" :style="ctxStyle">
            <div style="width:calc(100% - 12px);height:30px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
                <div style="font-weight:bold">더보기</div>
                <div>설정</div>
            </div>
            <div style="width:100%;display:flex;flex-direction:column;"><!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
                <div v-for="(row, idx) in gst.ctx.menu" :id="row.id" class="coHover" 
                    :style="{ color: row.disable ? 'dimgray' : '' }" @click.stop="() => rowClick(row, idx)">
                    <div v-if="row.line">----------</div>
                    <div v-if="row.child">{{ row.nm }} ></div>
                    <div v-else>{{ row.nm }}</div>                    
                </div> 
            </div>
        </div>
    </Transition>
    <div v-show="ctxChildOn" class="popupMenu" style="position:fixed" :style="ctxChildStyle">
        <div style="width:100%;display:flex;flex-direction:column;"><!-- 아래 @click.stop은 Main.vue의 gst.ctx.on=false 참조 -->
            <div v-for="(row, idx) in ctxChildMenu" :id="row.id" class="coHover" 
                :style="{ color: row.disable ? 'dimgray' : '' }" @click.stop="() => rowClick(row, idx)">
                <div v-if="row.line">----------</div>
                <div v-if="row.child">{{ row.nm }} ></div>
                <div v-else>{{ row.nm }}</div>                    
            </div> 
        </div>
    </div>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    .popupMenu {
        display:flex;flex-direction:column;
        background:var(--menu-color);border:1px solid var(--border-color);border-radius:8px;box-shadow:2px 2px 2px var(--shadow-color)
    }

</style>