<template>
    <!-- 
    원론적인 스켈레톤의 역할이 아닌 아래와 같은 문제점을 해결하기 위한 방안임 (현재는 MsgList의 자리(Depth)에서 커버중)
    예) Panel의 배열을 초기화하면 현재 떠 있는 MsgList를 라우터가 한번 더 Mounted되어 방금 삭제한 채널의 주소 라우팅이 다시 올라와서 그 채널이 없다고 뱉어냄
    -->
    <div style="width:100%;height:100%;display:flex;justify-content:center;align-items:center;background:white">
        <!-- <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/> -->
        <span>데이터가 없습니다.<br>왼쪽 패널에서 노드를 클릭하시기 바랍니다.</span>
    </div>
</template>