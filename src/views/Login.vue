<script setup>
    import { ref, onMounted, nextTick } from 'vue'
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    import GeneralStore from '/src/stores/GeneralStore.js'

    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()    
    
    let uid = ref(''), pwd = ref(''), saveId = ref(true), nextOk = ref(false), mailOtp = ref('')
    let uidRef = ref(null), pwdRef = ref(null) //for focusing
    
    let list = ref([]), userRow = ref({}) //Test ID 제공

    onMounted(async () => {
        try {
            mailOtp.value = route.query.mailOtp
            await qry() //Test ID 제공
            const userid = gst.auth.getCookie("userid")
            if (userid) {
                saveId.value = true
                uid.value = userid
                const idx = gst.util.getKeyIndex(userRow, userid)
                if (idx > -1) {
                    list.value[idx].color = "blue"
                    userRow.value[userid].scrollIntoView()
                } //const row = list.value.find(item => item.USERID == userid)
            }
            await nextTick()
            uidRef.value.focus()            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    async function goLogin() {
        try {
            if (uid.value == "") return
            if (uid.value.includes("@")) { //이메일 OTP 인증 진행 (해당 이메일로 6자리 숫자 발송)
                const res = await axios.post("/auth/setOtp", { uid : uid.value })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                gst.util.setToast("인증번호가 이메일로 전송되었습니다.", 5)                
            } else {
                //goLoginNext() 호출
            }
            nextOk.value = true
            await nextTick()
            pwdRef.value.focus()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
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

    async function qry() {
        try {
            const res = await axios.post("/auth/qryUserList")
            const rs = gst.util.chkAxiosCode(res.data) 
            if (!rs) return
            list.value = rs.list
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function rowClick(row) {
        uid.value = row.USERID
        pwd.value = (row.ISOPEN == "Y") ? "ignore_pwd" : ""
        row.color = "blue"
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
                <input type="text" v-model="uid" ref="uidRef" @keyup.enter="goLogin" placeholder="아이디/이메일" spellcheck=false autocomplete=off style="width:190px"/> 
                <div class="btn_basic" @click="goLogin" :style="{ opacity: (mailOtp == 'Y') ? 1.0 : 0 }">확인</div>
            </div>
            <div class="center_body" style="height:100px">
                <div class="center_row">
                    <input type="password" v-model="pwd" ref="pwdRef" @keyup.enter="goLoginNext" placeholder="비밀번호/인증번호(6자리)" spellcheck=false autocomplete=off style="width:190px"/>
                    <div class="btn_basic" @click="goLoginNext">인증</div>
                </div>
                <div>
                    <div class="center_row">
                        <input type=checkbox v-model="saveId"/><label @click="chkSaveId" id="lbl_save" for="chk_save" style="cursor:pointer">아이디 저장</label>
                    </div>
                </div>
                <div v-if="mailOtp=='Y'" style="width:320px;margin-top:10px">
                    <div>[이메일 OTP 테스트 방법]</div>
                    <div>이메일 주소를 넣고 '확인'을 누른 후 이메일로</div>
                    <div>전송된 인증번호를 넣고 '인증'을 누르면 됩니다.</div>
                    <div>이메일은 사이트내 '그룹'메뉴에서 미리 등록 필요.</div>
                </div> 
                <div v-else style="width:320px">
                    <div>목록(테스트용아이디)에서 선택해 '인증'을 누르면</div>
                    <div>진행됩니다. (인증후 이름/비번 설정 가능)</div>
                    <div>- 자물쇠 아이콘 : 설정된 비번 입력해야 인증 가능</div>
                    <div>- 사람 아이콘 : 비번없이 아이디로만 인증 가능</div>
                </div>                                            
            </div>
        </div>
    </div>
    <div v-if="mailOtp!='Y'" class="listContainer">
        <div class="list">
            <div v-for="(row, idx) in list" @click="rowClick(row)" :key="row.USERID" :ref="(ele) => { userRow[row.USERID] = ele }" :keyidx="idx" 
                class="listRow" :style="{ color: row.color ? row.color : '' }">
                <img :src="gst.html.getImageUrl(row.ISOPEN == 'Y' ? 'violet_people2.png' : 'violet_lock.png')" style="width:16;height:16px;margin-right:5px" >
                <span style="margin-right:5px">{{ row.TOP_ORG_NM }}</span>
                <span style="margin-right:5px">{{ row.ORG_NM }}</span>
                <span style="margin-right:5px;font-weight:bold">{{ row.USERNM }}</span> 
                <span style="margin-right:5px">{{ row.USERID }}</span>
            </div>
        </div>
    </div>
    <div v-if="mailOtp=='Y'" style="display:flex;justify-content:center">
        <a href="javascript:location.replace('/login')">테스트 사용자 아이디 페이지로 가기</a>
    </div>
    <div v-else style="display:flex;justify-content:center;margin-top:30px">
        <a href="javascript:location.replace('/login?mailOtp=Y')">이메일 OTP 테스트 페이지로 가기</a>
    </div>
</template>

<style scoped>

    input { width:190px;height:28px;border:1px solid dimgray;border-radius:4px }
    input[type=text]:focus { outline:2px solid lightgreen }
    input[type=password]:focus { outline:2px solid lightgreen }
    input[type=checkbox] { width:18px;height:18px }

    .container {
        width:100%;height:320px;padding-top:30px;display:flex;flex-direction:column;align-items:center 
    }

    .center_body { 
        width:300px;display:flex;flex-direction:column;align-items:center
    }

    .center_row { 
        margin-bottom:20px;display:flex;justify-content:center;align-items:center 
    }

    .btn_basic { 
        width:28px;height:28px;margin-left:10px;padding:3px 8px;display:flex;justify-content:center;align-items:center;
        border-radius:4px;background-color:var(--primary-color);color:white;cursor:pointer 
    }
    .btn_basic:hover { background:var(--second-hover-color) }

    .listContainer { 
        width: 100%;height:300px;padding-top:0px;display:flex;flex-direction:column;align-items:center 
    }

    .list { 
        width:350px;height:400px;padding:5px;overflow-y:auto;border:1px solid dimgray
    }

    .listRow {
        width:100%;height:40px;display:flex;align-items:center;border-bottom:1px solid lightgray;cursor:pointer
    }

    .listRow:hover {
        background:var(--hover-color)
    }

    .listRow:active {
        background:var(--hover-color)
    }

</style>	
