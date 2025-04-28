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
        //gst.selGrId = "20250120084532918913033423"
        //gst.selChanId = "20250122084532918913033403" //사업계획 채널
        //gst.selMsgId = "20250214231036369429013674"  //맨 위쪽 데이타 (아래로 스크롤링 테스트) 희망퇴직 가즈아 2025-02-14 (금) 23:10 => onActivated() in HoeBody.vue에서 null로 처리됨
        //gst.selMsgId = "20250311152315027382004692" //맨 위쪽 데이터
        //routing param 등으로 처리해서 호출하자면 router의 index.js에서부터 home에 대한 param도 :grid,:chanid,:msgid를 추가해야 하며 home_body에도 마찬가지로 추가해야 하므로
        //라우팅이 복잡해짐. 따라서, 라우팅은 현재처럼 단순하게 가고 여기처럼 호출은 gst.selGrId,gst.selChanId,gst.selMsgId를 사용하기로 함 (gst.selMsgId는 실행후에 초기화하고 있음)
        //router.push({ path : '/main/home' })
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
