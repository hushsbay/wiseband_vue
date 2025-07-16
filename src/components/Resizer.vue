<script setup>
    import { ref, onMounted, useTemplateRef } from 'vue' 
    import GeneralStore from '/src/stores/GeneralStore.js'
    
    const gst = GeneralStore()

    const props = defineProps({ nm: String })
    const emits = defineEmits(["ev-from-resizer"])

    let inDiv = useTemplateRef('divRef') 

    const resize = { //패널 리사이징

        getEle : function(resizeEle, main_side, dragMe, chan_side, chan_body) {
            resizeEle.mainSide = document.getElementById(main_side) //Main.vue 참조
            resizeEle.resizer = document.getElementById(dragMe) //vue.js npm 사용해봐도 만족스럽지 못해 자체 구현 소스 참조해 vue 소스로 응용
            resizeEle.leftSide = document.getElementById(chan_side) //resizeEle.resizer.previousElementSibling
            resizeEle.rightSide = document.getElementById(chan_body) //resizeEle.resizer.nextElementSibling 
        },

        downHandler : function(e, resizeEle, resizeObj, moveHandler, upHandler) {
            resizeObj.posX = e.clientX//마우스 위치 X값
            resizeObj.leftWidth = resizeEle.leftSide.getBoundingClientRect().width
            resizeObj.mainSideWidth = resizeEle.mainSide.getBoundingClientRect().width
            document.addEventListener('mousemove', moveHandler)
            document.addEventListener('mouseup', upHandler)
            document.body.style.cursor = 'col-resize'
            resizeEle.resizer.style.background = 'lightsteelblue'
        },

        moveHandler : function(e, resizeEle, resizeObj) {
            const dx = e.clientX - resizeObj.posX //마우스가 움직이면 기존 초기 마우스 위치에서 현재 위치값과의 차이를 계산
            document.body.style.cursor = 'col-resize' //크기 조절중 마우스 커서 변경 (resizer에 적용하면 위치가 변경되면서 커서가 해제되기 때문에 body에 적용)
            resizeEle.resizer.style.background = 'lightsteelblue'
            resizeEle.leftSide.style.userSelect = 'none' //이동중 양쪽 영역(왼쪽, 오른쪽)에서 마우스 이벤트와 텍스트 선택을 방지하기 위해 추가 (4행)
            resizeEle.leftSide.style.pointerEvents = 'none'        
            resizeEle.rightSide.style.userSelect = 'none'
            resizeEle.rightSide.style.pointerEvents = 'none'
            return dx        
            //resizeRef.chanSideWidth.value = `${resizeObj.leftWidth + dx + resizeObj.mainSideWidth}px` //아래 % 대신에 바로 px 적용
            //resizeRef.chanMainWidth.value = `calc(100% - ${resizeRef.chanSideWidth.value})`
            //초기 width 값과 마우스 드래그 거리를 더한 뒤 상위요소(container) 너비 이용해 퍼센티지 구해 left의 width로 적용
            //const newLeftWidth = ((leftWidth + dx) * 100) / resizer.parentNode.getBoundingClientRect().width
            //leftSide.style.width = `${newLeftWidth}%`
        },

        upHandler : function(resizeEle, moveHandler, upHandler) { //모든 커서 관련 사항은 마우스 이동이 끝나면 제거됨
            resizeEle.resizer.style.removeProperty('cursor')
            document.body.style.removeProperty('cursor')
            resizeEle.resizer.style.background = 'transparent'
            resizeEle.leftSide.style.removeProperty('user-select')
            resizeEle.leftSide.style.removeProperty('pointer-events')
            resizeEle.rightSide.style.removeProperty('user-select')
            resizeEle.rightSide.style.removeProperty('pointer-events')
            inDiv.value.focus() //drop 이후 html이 선택된 상태를 removeProperty('user-select')로는 해결이 안되서 focus()로 추가 처리함
            document.removeEventListener('mousemove', moveHandler)
            document.removeEventListener('mouseup', upHandler)
        }

    }
    
    let chanSideWidth = ref(localStorage["wiseband_lastsel_" + props.nm + "sidewidth"] ?? '300px')
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')
    const resizeEle = { mainSide: null, resizer: null, leftSide: null, rightSide: null }
    const resizeObj = { mainSideWidth: 0, posX: 0, leftWidth: 0 }

    onMounted(async () => {
        try {
            resize.getEle(resizeEle, 'main_side', 'dragMe', 'chan_side', 'chan_body')
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function downHandler(e) {
        resize.downHandler(e, resizeEle, resizeObj, moveHandler, upHandler)
    }

    function moveHandler(e) {
        const dx = resize.moveHandler(e, resizeEle, resizeObj)
        chanSideWidth.value = `${resizeObj.leftWidth + dx + resizeObj.mainSideWidth - 70}px` //70은 side menu의 min-width
        chanMainWidth.value = `calc(100% - ${chanSideWidth.value})`
        //console.log(resizeObj.leftWidth+"==="+dx+"==="+resizeObj.mainSideWidth+"####"+chanSideWidth.value+"$$$$"+chanMainWidth.value)
    }

    function upHandler() {
        resize.upHandler(resizeEle, moveHandler, upHandler)
        localStorage["wiseband_lastsel_" + props.nm + "sidewidth"] = chanSideWidth.value
        evToPanel(chanSideWidth.value, chanMainWidth.value)
    }

    function evToPanel(chanSideWidth, chanMainWidth) {
        emits("ev-from-resizer", chanSideWidth, chanMainWidth)
    }

    function mouseEnter() {
        resizeEle.resizer.style.background = 'lightsteelblue'
    }

    function mouseLeave() {
        resizeEle.resizer.style.background = 'transparent'
    }
</script>

<template>
    <div contenteditable ref="divRef" class="resizer" id="dragMe" @mouseenter="mouseEnter" @mouseleave="mouseLeave" @mousedown="(e) => downHandler(e)"></div>
</template>

<style scoped>
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px; /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
</style>
