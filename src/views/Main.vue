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
        <div class="header"></div>
        <div class="grid coScrollable">
            <div v-for="(item, idx) in menu" class="cell" @click="goMenu(idx)"> 
                <div class="cellTop coHover"><img :src="gst.html.getImageUrl(item.IMG)" class="coImg64"></div>
                <div class="cellBottom"><div class="cellSubBottom">{{ item.NM }}</div></div>
            </div>
        </div>
        <div class="footer" @click="logout">
            <div class="coButton, coMenu">로 그 아 웃</div>
        </div>
    </div>
</template>

<style scoped>    
    .header {
        height:50px;margin:10px;
        border:1px solid dimgray;border-radius:20px;        
    }
    .footer {
        height:50px;margin:10px;
        display:flex;align-items:center;justify-content:center;
        border:1px solid dimgray;border-radius:20px;cursor:pointer    
    }
    .grid {
        padding:0 10px;
        display:grid;grid-auto-rows:120px;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px;
        flex:1;overflow-y:auto;
    }
    .cell {
        display:flex;flex-direction:column;
        cursor:pointer;
    }
    .cellTop {
        height:100%;
        display:flex;justify-content:center;align-items:center;
        border:1px solid darkgray;border-radius:5px;        
    }
    .cellBottom {
        height:30px;width:100%; /*ellipsis가 나타나면 약간 왼쪽으로 치우친 느낌임 : 발생할 때만 동적으로 106%로 하면 center feel 구현됨*/
        display:flex;justify-content:center;align-items:center;
    }
    .cellSubBottom { /*ellipsis 구현을 위해 필요한 클래스*/
        overflow:hidden;white-space:nowrap;text-overflow:ellipsis;
        color:dimgray;
    }
</style>
