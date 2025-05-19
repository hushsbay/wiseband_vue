<script setup>
    import { ref, onMounted, nextTick } from 'vue'
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const router = useRouter()
    const gst = GeneralStore()    
    
    let uid = ref(''), pwd = ref(''), saveId = ref(true), nextOk = ref(false)
    let uidRef = ref(null), pwdRef = ref(null) //for focusing

    onMounted(() => {
        const userid = gst.auth.getCookie("userid")
		if (userid) {
            saveId.value = true
            uid.value = userid
        }
        uidRef.value.focus()
    })

    async function goLogin() {
        if (uid.value.includes("@")) { //이메일 OTP 인증 진행 (해당 이메일로 6자리 숫자 발송)
            const res = await axios.post("/auth/setOtp", { uid : uid.value })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
        } else {
            //아이디,비번 인증 진행
        }
        nextOk.value = true
        await nextTick()
        pwdRef.value.focus()
    }

    async function goLoginNext() {
        try {
            let res, rs
            if (uid.value.includes("@")) { //이메일 OTP 인증 진행 (해당 이메일로 발송된 6자리 숫자 인증)
                res = await axios.post("/auth/verifyOtp", { uid : uid.value, pwd : pwd.value })
            } else { //아이디,비번 인증 진행
                res = await axios.post("/auth/login", { uid : uid.value, pwd : pwd.value })
            }
            rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.auth.setCookieForUser(rs.data, saveId.value)
            await router.replace({ name : 'main' })
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function chkSaveId() {
        saveId.value = !saveId.value
    }
</script>

<template>
    <div class="container coLogin">
        <div class="center_body">
            <div class="center_row">
                <img class="coImg32" src="/src/assets/images/hushsbay.png"/>
                <div style="font-size: 18px; font-weight: bold">WiSEBand</div>
            </div>
            <div class="center_row">
                <input type="text" v-model="uid" ref="uidRef" @keyup.enter="goLogin" placeholder="이메일" spellcheck=false autocomplete=off style="width:150px;margin-right:10px"/> 
                <div class="center_btn" @click="goLogin">확인</div>
            </div>
            <div class="center_body" style="height:400px;border:0px solid red">
                <div v-if="nextOk" class="center_row">
                    <input type="password" v-model="pwd" ref="pwdRef" @keyup.enter="goLoginNext" placeholder="6자리 인증번호" spellcheck=false autocomplete=off style="width:150px;margin-right:10px"/>
                    <div class="center_btn" @click="goLoginNext">인증</div>
                </div>
                <div v-if="!nextOk" class="center_row" style="flex-direction:column">
                    <div>주소를 넣고 확인을 누르면 해당 이메일로</div>
                    <div>6자리 인증번호가 전송되고 계속 진행됩니다.</div>
                </div>
                <div v-if="nextOk" class="center_row" style="flex-direction:column">
                    <div style="display:flex;margin-bottom:10px">
                        <input type=checkbox v-model="saveId"/><label @click="chkSaveId" id="lbl_save" for="chk_save" style="cursor: pointer">이메일저장</label>
                    </div>
                    <div>이메일을 열고 6자리 인증번호 입력후</div>
                    <div>인증 버튼을 눌러 주시기 바랍니다.</div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    body { background: black; }

    .container { 
        max-width: 900px; width: 100%; height: 100%; margin: 0 auto; 
        display: flex; flex-direction: column; justify-content: center; align-items: center; 
        background-image: url('https://images.unsplash.com/photo-1505144808419-1957a94ca61e?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHx0b3BpYy1mZWVkfDIyNHxibzhqUUtUYUUwWXx8ZW58MHx8fHx8');
        background-position: center; background-size: cover;
    }

    .center_body { width:300px;display:flex;flex-direction:column }
    .center_row { margin-top:10px;display:flex;justify-content:center;align-items:center }
    .center_btn { width:28px;height:28px;padding:0 4px;display:flex;justify-content:center;align-items:center;border-radius:4px;background-color:#0082AD;color:white;cursor:pointer }

</style>	
