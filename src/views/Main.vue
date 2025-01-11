<script setup>
    import { ref, onMounted } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const router = useRouter()

    const menu = ref([])
    
    onMounted(async () => { 
        try {
            const res = await axios.post("/menu/qry", { kind : "aaaa" }) //메뉴구분이 여럿일 수 있으므로 여기서는 aaaa로 설정한 것임
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return //rs.data 또는 rs.list로 받음
            for (let item of rs.list) menu.value.push(item)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function goMenu(idx) {
        router.push({ name : 'menu', params : { menuId : menu.value[idx].ID }, query : { menuNm : menu.value[idx].NM, menuTyp : menu.value[idx].TYP } })
    }

    function logout() {
        gst.auth.logout()
        router.replace({ name : 'login' })
    }
</script>

<template>
    <div class="coMain">
        <div class="header">

        </div>
        <div class="body">
            <div class="side">
            
            </div>
            <div class="main">
                <div class="content">
                    
                </div>
                <div class="footer">
            
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>    
    .header {
        width:100%;min-height:50px;
        background:lightgray;
    }
    .body {
        width:100%;height:100%;display:flex;
    }
    .side {
        min-width:50px;height:100%;display:flex;flex-direction:column;
        background:darkgreen;        
    }
    .main {
        width:100%;height:100%;display:flex;flex-direction:column;    
    }
    .content {
        width:100%;height:100%;display:flex;
        background:white;        
    }
    .footer {
        width:calc(100% - 20px);min-height:50px;margin:auto 0 0 0;padding:0 10px;
        display:flex;align-items:center;
        background:lightyellow;        
    }
</style>
