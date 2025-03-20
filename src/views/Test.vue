<script setup>
    import { ref, onMounted, nextTick, watch } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupList from "/src/components/PopupList.vue"

    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    document.title = "DM"

    function test() {
        gst.selGrId = "20250120084532918913033423"
        gst.selChanId = "20250122084532918913033403" //사업계획 채널
        gst.selMsgId = "20250214231036369429013674" //희망퇴직 가즈아 2025-02-14 (금) 23:10 => onActivated() in HoeBody.vue에서 null로 처리됨
        router.push({ path : '/main/home' })
    }
</script>

<template>
    <div style="width:100%;height:100%;background:white;">
       <div>0000000000000000000000</div>
       <div>0000000000000000000000</div>
       <div>0000000000000000000000</div>
       <div>0000000000000000000000</div>
       <div>0000000000000000000000</div>
       <div>0000000000000000000000</div>       
       <button style="margin:20px" @click="test">특정 채널/메시지 열기</button>
    </div>
    
</template>

<style scoped>    
    
</style>
