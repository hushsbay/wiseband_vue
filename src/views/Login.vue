<script setup>
    import { ref, onMounted } from 'vue'
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const router = useRouter()
    const gst = GeneralStore()    
    
    let uid = ref(''), pwd = ref(''), saveId = ref(false)
    let uid1 = ref(null), pwd1 = ref(null) //for focusing

    onMounted(() => {
        const userid = gst.auth.getCookie("userid")
		if (userid) {
            saveId.value = true
            uid.value = userid
            pwd1.value.focus()
        } else {
            uid1.value.focus()
        }
    })

    async function goLogin() {
        try {
            const res = await axios.post("/auth/login", { uid : uid.value, pwd : pwd.value })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            gst.auth.setCookieForUser(rs.data, saveId.value)
            router.replace({ name : 'main' })
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
        <div id="gridMain">
            <div class="item">
                <img class="coImg32" src="/src/assets/images/hushsbay.png"/>
                <div style="font-size: 18px; font-weight: bold">Hushsbay</div>
            </div>
            <div class="item">
                <input type="text" v-model="uid" @keyup.enter="goLogin" ref="uid1" placeholder="아이디" spellcheck=false autocomplete=off style="width: 100%"/>
            </div>
            <div class="item">
                <div @click="goLogin" id="btn_login">로그인</div>					
            </div>
            <div class="item">
                <input type=password v-model="pwd" @keyup.enter="goLogin" ref="pwd1" placeholder="비번" spellcheck=false autocomplete=off style="width: 100%"/>
            </div>
            <div class="item">
                <input type=checkbox v-model="saveId" style="margin-left: 5px"/><label @click="chkSaveId" id="lbl_save" for="chk_save" style="cursor: pointer">아이디저장</label>
            </div>
            <div class="item">
                <span id="btn_join">간편등록</span>
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

    #gridMain {	padding: 5px;display: grid; grid-template-columns: 150px 100px; grid-auto-rows: 40px; gap: 5px; }

    .item { display: flex; justify-content: center; align-items: center; cursor: pointer; }

    .item:nth-child(1) { grid-column: 1/3; }

    .item:nth-child(3) { /* 로그인 버튼 부모 */
        width: 100%; height: 100%; padding: 6px;
        grid-column: 2;	grid-row: 2/4;
        display: flex; justify-content: center; align-items: center;
    }

    #btn_login { /* 로그인 버튼 */
        width: 100%; height: 100%;
        display: flex; justify-content: center; align-items: center;
        border-radius: 4px; background-color: #0082AD; color: white;
    }
</style>	
