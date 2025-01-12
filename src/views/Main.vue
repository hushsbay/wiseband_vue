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
                <div class="menu"> 
                    <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_home.png')"></div>
                    <div class="menuText">홈</div>
                </div>
                <div class="menu"> 
                    <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_dm.png')"></div>
                    <div class="menuText">DM</div>
                </div>
                <div class="menu"> 
                    <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_notify.png')"></div>
                    <div class="menuText">내활동</div>
                </div>
                <div class="menu"> 
                    <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_later.png')"></div>
                    <div class="menuText">나중에</div>
                </div>
                <div class="menu"> 
                    <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_channel.png')"></div>
                    <div class="menuText">채널</div>
                </div>
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
        min-width:70px;height:100%;
        display:flex;flex-direction:column;align-items:center;
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
        width:calc(100% - 20px);min-height:40px;margin:auto 0 0 0;padding:0 10px;
        display:flex;align-items:center;
        background:lightyellow;        
    }
    .menu { 
        width:55px;height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;align-items:center;
        color:white;cursor:pointer; }
    .menuDiv { width:35px;height:35px; display:flex;flex-direction:column;align-items:center; }
    .menuImg { width:20px;height:20px;padding:6px;border-radius:8px; }
    .menuImg:hover { width:22px;height:22px;background-color:hsla(160, 100%, 37%, 0.5); }
    .menuText { font-size:12px;color:white;font-weight:bold }
</style>
