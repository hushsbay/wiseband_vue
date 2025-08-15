<script setup>
    import { ref } from 'vue' 
    import axios from 'axios'    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()

    defineExpose({ open, close })
    const emits = defineEmits(["evToMain"])

    let show = ref(false)
    let editmode = ref(false)
    let user = ref(null), usernm = ref(''), pwdOld = ref(''), pwdNew = ref(''), pwdAgain = ref('')

    async function open() {
        show.value = true
        const res = await axios.post("/user/getUserInfo")
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return
        user.value = rs.data
        usernm.value = user.value.USERNM
        setImgUrl(user.value.PICTURE)
    }

    function close() {
        show.value = false
    }

    function setImgUrl(pict) {
        user.value.url = (pict) ? hush.util.getImageBlobUrl(pict.data) : null
    }

    async function changePwd() {
        try {
            const strOld = pwdOld.value.trim(), strNew = pwdNew.value.trim(), strAgain = pwdAgain.value.trim()
            if (strNew == "") {
                gst.util.setSnack("새 비번이 빈칸입니다.")
                return
            }
            if (strNew != strAgain) {
                gst.util.setSnack("새 비번과 새 비번(확인)이 다릅니다.")
                return
            }
            const res = await axios.post("/user/changePwd", { pwdOld: strOld, pwdNew: strNew, toastMsg: true })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }
    
    async function changeUserName() { //실사용도 가능한 것이지만 현실적으로 보면 테스트용에 가까움 (테스트시 아이디의 이름 변경하는 것임)
        try {
            if (!editmode.value) {
                editmode.value = true
            } else {
                const res = await axios.post("/user/setUserInfo", { usernm: usernm.value })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                user.value.USERNM = usernm.value
                gst.auth.setCookie("usernm", usernm.value)
                emits("evToMain", user.value)
                editmode.value = false
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function uploadImgFile(e) {
        try {
            const file = e.target.files[0]
            const fd = new FormData()
            fd.append("file", file)
            const res = await axios.post("/user/setUserInfo", fd, { headers: { 'Content-Type': 'multipart/form-data' }})
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            e.target.value = '' //clear하지 않으면 동일한 파일명이 바로 올라가지 않음 (change event 관련)
            setImgUrl(rs.data.PICTURE)
            emits("evToMain", user.value)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div class="popupHeader">
                    <div v-if="user" class="popupHeaderLeft">
                        <img v-if="user && user.url" :src="user.url" class="coImg64" style="border-radius:32px">
                        <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg64">
                        <input v-if="editmode" type="text" style="width:200px;margin-left:9px" v-model="usernm" @keydown.enter="changeUserName" spellcheck="false"/>
                        <span v-else style="margin-left:9px;font-size:16px;font-weight:bold">{{ user.USERNM }}</span>
                    </div>
                    <div class="popupHeaderRight">
                        <span class="btn_basic" @click="changeUserName">이름변경</span>
                        <input id="profile_upload" type=file hidden accept="image/*" @change="uploadImgFile" />
                        <label for="profile_upload"><span class="btn_basic">이미지변경</span></label>
                    </div>
                </div>
                <div class="popupList">
                    <div class="listItem">
                        <span style="min-width:100px">사용자 아이디</span>
                        <span style="margin-left:9px;font-weight:bold">{{ gst.auth.getCookie("userid") }}</span>
                        <span style="margin-left:9px;font-weight:bold">({{ gst.auth.getCookie("orgnm") }}</span>
                        <span style="margin-left:9px;font-weight:bold">{{ gst.auth.getCookie("toporgnm") }})</span>
                    </div>
                    <div class="listItem">
                        <span style="min-width:100px">기존 비번</span><span><input type="password" style="width:200px;margin-left:9px" v-model="pwdOld" spellcheck="false"/></span>
                        <span>(기존 비번 없으면 빈칸)</span>
                    </div>                    
                    <div class="listItem">
                        <span style="min-width:100px">새 비번</span><span><input type="password" style="width:200px;margin-left:9px" v-model="pwdNew" spellcheck="false"/></span>
                    </div>
                    <div class="listItem">
                        <span style="min-width:100px">새 비번(확인)</span><span><input type="password" style="width:200px;margin-left:9px" v-model="pwdAgain" spellcheck="false"/></span>
                        <div class="btn_basic" @click="changePwd">비번변경</div>
                    </div>
                    <div class="listItem"><span>원래 비번없이 테스트 가능한데 이 사용자아이디를 본인만 사용하고자 할 때</span></div>
                    <div class="listItem"><span>이름과 비번을 변경해 테스트를 진행합니다.</span></div>
                </div>
                <div class="popupFooter">
                    <div class="popupFooterLeft"></div>
                    <div class="popupFooterLeft">
                        <div class="btn_basic" @click="close">닫기</div>
                    </div>
                </div>      
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
</template>

<style scoped>
    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    input[type=search]:focus { outline:2px solid lightgreen }
    .popup {
        position:fixed;width:500px;height:70%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;border-radius:10px
    }
    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }

    .popupMenu { /*top:0px;bottom:0px;height:380px; 3개는 props.popupPos로 표시 */
        position:fixed;width:300px;left:60px;
        display:flex;flex-direction:column;z-index:9999;
        background:white;border:1px solid var(--border-color);border-radius:8px;box-shadow:2px 2px 2px gray
    }

    .popupHeader {
        width:calc(100% - 12px);height:70px;padding:6px;
        display:flex;justify-content:space-between;align-items:center;
        border-bottom:1px solid var(--border-color);background:var(--second-select-color);border-radius:10px
    }

    .popupHeaderLeft {
        padding-left:8px;display:flex;align-items:center;color:var(--primary-color)
    }

    .popupHeaderRight {
        padding-right:8px;display:flex;align-items:center;color:var(--primary-color)
    }

    .popupList {
        width:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto
    }

    .listItem {
        width:100%;margin-top:20px;display:flex;align-items:center;
    }

    .popupFooter {
        width:calc(100% - 12px);height:30px;padding:6px;
        display:flex;justify-content:space-between;align-items:center;        
    }

    .popupFooterLeft {
        padding-left:8px;
        display:flex;align-items:center;
        color:steelblue;font-weight:bold
    }

    .btn_basic { 
        height:28px;margin-left:10px;padding:0 8px;display:flex;justify-content:center;align-items:center;
        border:1px solid dimgray;border-radius:4px;background-color:var(--primary-color);color:var(--second-select-color);cursor:pointer 
    }
    .btn_basic:hover { background:var(--second-hover-color) }
</style>