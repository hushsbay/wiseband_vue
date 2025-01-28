<script setup>
    import { ref, watch } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    //const props = defineProps({ ctxOn: Boolean, ctxData: Object })
    //const emits = defineEmits(["ev-click", "ev-out"])

    //const borderLineBottom = ref('none') //기본값
    // if (props.popupData.lines) borderLineBottom.value = "1px solid var(--border-color)"
    
    let ctxStyle = ref({})

    watch(gst.ctx.data, async () => {
        const posX = gst.ctx.data.posX
        const posY = gst.ctx.data.posY
        ctxStyle.value.left = posX + "px"
        ctxStyle.value.top = posY + "px"        
    }, { immediate: true, deep: true })
    
    // function listRowClick(e, row, idx) { //alert(e.target.id + "===" + idx + "===" + JSON.stringify(row))
    //     emits("ev-click", props.popupData.id, row, idx)
    // }

    // function focusOut() {
    //     emits("ev-out")
    // }
</script>

<template>
    <Transition>
        <div v-show="gst.ctx.on" class="popupMenu" style="position:fixed;z-index:9999" :style="ctxStyle">
            <div style="width:calc(100% - 12px);height:30px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
                <div style="font-weight:bold">더보기</div>
                <div>설정</div>
            </div>
            <div style="width:100%;display:flex;flex-direction:column;">
                <!-- <div v-for="(row, idx) in list" @click="(e) => listRowClick(e, row, idx)" :id="row.ID" class="coHover" 
                    style="width:100%;min-height:30px;display:flex;align-items:center"
                    :style="{ borderBottom: borderLineBottom }">
                    <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                        <div class="coMenuContext">
                            <img class="coMenuImg" style="background:var(--second-color)" :src="gst.html.getImageUrl(row.IMG)">
                        </div>
                    </div>
                    <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                        <div style="width:100%;display:flex;align-items:center">
                            <div class="coDotDot" style="margin-top:7px;font-weight:bold">
                                {{ row.NM }}
                            </div>
                        </div>        
                        <div style="width:100%;display:flex;align-items:center">
                            <div class="coDotDot" style="margin-top:3px;font-size:12px">
                                {{ row.RMKS }}
                            </div>
                        </div>        
                    </div>                
                </div> -->
            </div>
        </div>
    </Transition>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    .popupMenu {
        display:flex;flex-direction:column;
        background:var(--menu-color);border:1px solid var(--border-color);border-radius:8px;box-shadow:2px 2px 2px var(--shadow-color)
    }

</style>