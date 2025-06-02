<script setup>
    import { ref, onMounted, nextTick } from 'vue'
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const router = useRouter()
    const gst = GeneralStore()    
    
    let uid = ref(''), pwd = ref(''), saveId = ref(true), nextOk = ref(false)
    let uidRef = ref(null), pwdRef = ref(null) //for focusing

    onMounted(async () => {
        const userid = gst.auth.getCookie("userid")
		if (userid) {
            saveId.value = true
            uid.value = userid
        }
        await nextTick()
        uidRef.value.focus()
    })

    async function goLogin() {
        if (uid.value == "") return
        if (uid.value.includes("@")) { //이메일 OTP 인증 진행 (해당 이메일로 6자리 숫자 발송)
            const res = await axios.post("/auth/setOtp", { uid : uid.value })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
        } else {
            //goLoginNext() 호출
        }
        nextOk.value = true
        await nextTick()
        pwdRef.value.focus()
    }

    async function goLoginNext() {
        try {
            let res, rs
            if (uid.value.includes("@")) { //이메일 OTP 인증 진행 (해당 이메일로 발송된 6자리 숫자 인증)
                res = await axios.post("/auth/verifyOtp", { uid : uid.value, otpNum : pwd.value })
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
    <div class="container">
        <div class="center_body">
            <div class="center_row" style="width:100%;padding-left:45px;justify-content:flex-start">
                <img class="coImg32" src="/src/assets/images/color_slacklogo.png"/>
                <div style="margin-left:5px;font-size:22px;font-weight:bold;cursor:pointer">WiSEBand</div>
            </div>
            <div class="center_row">
                <input type="text" v-model="uid" ref="uidRef" @keyup.enter="goLogin" placeholder="이메일" spellcheck=false autocomplete=off style="width:190px"/> 
                <div class="btn_basic" @click="goLogin">확인</div>
            </div>
            <div class="center_body" style="height:400px">
                <div v-if="nextOk" class="center_row">
                    <input type="password" v-model="pwd" ref="pwdRef" @keyup.enter="goLoginNext" placeholder="6자리 인증번호" spellcheck=false autocomplete=off style="width:190px"/>
                    <div class="btn_basic" @click="goLoginNext">인증</div>
                </div>
                <div v-if="!nextOk" class="center_row" style="flex-direction:column">
                    <div style="width:250px">
                        <div>이메일 주소를 넣고 확인을 누르면</div>
                        <div>인증번호가 전송되고 계속 진행됩니다.</div>
                    </div>
                </div>
                <div v-if="nextOk" class="center_row" style="flex-direction:column">
                    <div class="center_row">
                        <input type=checkbox v-model="saveId"/><label @click="chkSaveId" id="lbl_save" for="chk_save" style="cursor:pointer">이메일 저장</label>
                    </div>
                    <div style="width:250px">
                        <div>이메일에서 확인한 6자리 인증번호를</div>
                        <div>입력후 인증 버튼을 누르십시오.</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

    input { width:190px;height:28px;border:1px solid dimgray;border-radius:4px }
    input[type=text]:focus { outline:2px solid lightgreen }
    input[type=password]:focus { outline:2px solid lightgreen }
    input[type=checkbox] { width:18px;height:18px }

    .container { 
        width: 100%;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center 
    }

    .center_body { 
        width:300px;display:flex;flex-direction:column;align-items:center
    }

    .center_row { 
        margin-bottom:30px;display:flex;justify-content:center;align-items:center 
    }

    .btn_basic { 
        width:28px;height:28px;margin-left:10px;padding:3px 8px;display:flex;justify-content:center;align-items:center;
        border-radius:4px;background-color:var(--primary-color);color:white;cursor:pointer 
    }
    .btn_basic:hover { background:var(--second-hover-color) }
    .btn_basic:active { background:var(--active-btn) }

</style>	
