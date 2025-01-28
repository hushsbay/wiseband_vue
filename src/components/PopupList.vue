<script setup>
    import { ref } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const props = defineProps({ popupOn: Boolean, popupPos: Object, list : Array, popupData: Object }) //props update 문제 유의
    const emits = defineEmits(["ev-click", "ev-leave"])

    const borderLineBottom = ref('none') //기본값
    if (props.popupData.lines) borderLineBottom.value = "1px solid var(--border-color)"

    function listRowClick(e, row, idx) { //alert(e.target.id + "===" + idx + "===" + JSON.stringify(row))
        emits("ev-click", props.popupData.id, row, idx)
    }

    //아래는 지우기 말기 (vue말고 순수 javascript로 구현해 본 것임) : Main.vue에서 맨 처음 테스트
    // let menuDivAll = document.querySelectorAll('.coMenuDiv')
    // menuDivAll.forEach(menuDiv => menuDiv.addEventListener('mouseenter', e => {
    //     prevX = e.pageX //console.log(e.pageY + "====mouseenter===" + prevX + "@@@@" + menuDiv.offsetTop);
    //     popupMenuOn.value = true
    //     const docHeight = document.documentElement.offsetHeight
    //     if (menuDiv.offsetTop > 300) {
    //         popupMenuPos.value.top = null
    //         popupMenuPos.value.bottom = (docHeight - menuDiv.offsetTop - 150) + "px"
    //     } else {
    //         popupMenuPos.value.top = (menuDiv.offsetTop - 50) + "px"
    //         popupMenuPos.value.bottom = null
    //     } //console.log("popupMenuPos.value.top:"+popupMenuPos.value.top)
    // }))
    // menuDivAll.forEach(menuDiv => menuDiv.addEventListener('mouseleave', e => {
    //     if (e.pageX > prevX) {
    //         //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
    //     } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
    //         popupMenuOn.value = false
    //     }
    // }))
    // let popupMenu = document.querySelector('.popupMenu')
    // popupMenu.addEventListener('mouseleave', e => {
    //     popupMenuOn.value = false
    // })
</script>

<template>
    <Transition>
        <div v-show="props.popupOn" class="popupMenu" :style="props.popupPos" @mouseleave="() => { emits('ev-leave') }">
            <div style="width:calc(100% - 12px);height:40px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
                <div style="font-weight:bold">더보기</div>
                <div>설정</div>
            </div>
            <div class="coScrollable" style="width:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto;">
                <div v-for="(row, idx) in list" @click="(e) => listRowClick(e, row, idx)" :id="row.ID" class="coHover" 
                    style="width:100%;min-height:50px;display:flex;align-items:center"
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
                </div>
            </div>
            <div style="width:calc(100% - 12px);height:30px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-top:1px solid var(--border-color);background:var(--bottom-color)">
                <div style="color:steelblue;font-weight:bold">탐색막대 사용자지정</div>
                <div style="color:darkblue">안내</div>
            </div>        
        </div>
    </Transition>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    .popupMenu { /* 아래 position,width,height등을 props.popupPos로 표시하고 있음
        position:fixed;top:0px;bottom:0px;left:0px;right:0px;width:320px;height:380px;*/
        display:flex;flex-direction:column;z-index:9999;
        background:var(--menu-color);border:1px solid var(--border-color);border-radius:8px;box-shadow:2px 2px 2px var(--shadow-color)
    }

</style>