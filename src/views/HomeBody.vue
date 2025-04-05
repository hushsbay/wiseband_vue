<script setup>
    import { ref, onMounted, nextTick, useTemplateRef, onActivated } from 'vue' 
    import { useRoute } from 'vue-router'
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import PopupImage from "/src/components/PopupImage.vue"
    import PopupCommon from "/src/components/PopupCommon.vue"
        
    const gst = GeneralStore()
    const route = useRoute()

    /////////////////////////////////////////////////////////////////////////////////////
    //스레드(댓글) 관련 : 부모HomeBody(이하 '부모')와 자식HomeBody(이하 '자식')가 혼용되어 코딩됨
    //네이밍 규칙을 정해서, thread라는 단어가 들어가면 거의 부모 / prop이라는 단어가 들어가면 거의 자식
    //부모/자식 동시에 떠 있는 경우 문제되는 element는 파일업로드(file_upload)와 웹에디터(msgContent) 2개 : 각각 element id 만들어 hasProp()으로 구분해 사용하면 됨
    
    const props = defineProps({ data: Object }) //자식에서만 사용 : props update 문제 유의
    const emits = defineEmits(["ev-click"])

    // const hasProp = computed(() => { //바로 아래 함수 참조. 템플리트 밖<script setup>에선 반드시 true/false로만 비교해야 함. if (hasProp)으로 비교하면 안됨
    //     if (props.data && props.data.msgid) return true
    //     return false
    // })

    function hasProp() { //props 사용하는 것은 자식이므로 hasProp으로 명명. 위 computed 이용해 처리하고자 했으나 동작 이상 포기 : 캐싱없이 매번 계산하나 이 함수 사용
        if (props.data && props.data.msgid) return true //자식이 열린 상태임을 의미
        return false
    }

    let thread = ref({ msgid: null }) //부모에서만 사용 (컴포넌트에서 자식에게 data로 전달함)
    const editorId = hasProp() ? "msgContent_prop" : "msgContent"

    function openThread(msgid) { //부모에서만 사용. 라우터로 열지 않고 컴포넌트로 바로 열기
        thread.value.msgid = msgid //메시지아이디를 전달해 자식에게 화면을 open하라고 전달하는 것임
        setWidthForThread()
    }

    async function clickFromProp(obj) { //부모에서만 사용하나 자식에게서 전달받아 이벤트 처리하는 것임
        if (obj.type == "close") {
            thread.value.msgid = null //메시지아이디를 null로 해서 자식에게 close하라고 전달하는 것임
            setWidthForThread(null, obj.type)
        } else if (obj.type == "refreshParentReply") {
            const rs = await getMsg({ msgid: obj.msgid }, true)
            if (rs == null) return
            let item = msglist.value.find(function(row) { return row.MSGID == obj.msgid })
            if (item) {
                item.reply = rs.reply
                item.replyinfo = rs.replyinfo
            }
        }
    }

    function setWidthForThread(openWith, type) { //openWith : 향후 마우스 드래그나 버튼 방식으로 넓이 조정 가능하도록 하기 위함
        if (type == "close") {
            widthChanCenter.value = 'calc(100% - 20px)'
            widthChanRight.value = '0px'
        } else {
            if (openWith) {
                //위 설명 참조
            } else {
                widthChanCenter.value = 'calc(100% - 620px)'
                widthChanRight.value = '600px'
            }
        }
    }

    function setBasicInfoInProp() {
        if (route.params.chanid && route.params.grid) {
            chanId = route.params.chanid
            grId = route.params.grid
        }
    }

    function evClick(obj) { //자식에서만 사용됨
        emits('ev-click', obj)
    }
    /////////////////////////////////////////////////////////////////////////////////////

    const MAX_PICTURE_CNT = 11
    let mounting = true
    
    let widthChanCenter = ref('calc(100% - 20px)'), widthChanRight = ref('0px') //HomeBody가 부모나 자식상태 모두 기본적으로 가지고 있을 넓이
    const scrollArea = ref(null)

    let popupRefKind = ref('') //아래 ~PopupRef의 종류 설정
    const imgPopupRef = ref(null), imgParam = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련
    const linkPopupRef = ref(null), linkText = ref(''), linkUrl = ref('')
        
    let sideMenu, grId, chanId, msgidInChan
    let grnm = ref(''), channm = ref(''), chanimg = ref('')
    let chandtl = ref([]), chanmemUnder = ref([]), chandtlObj = ref({})
    let msglist = ref([])

    let editMsgId = ref(''), prevEditData = "", showHtml = ref(false)
    let msgbody = ref("") //ref("<p>구름에 \"달 <B>가듯이</B>\" 가는 나그네<br>술익는 마을마다 <span style='color:red;font-weight:bold'>타는 저녁놀</span> 하하</p>")
    let uploadFileProgress = ref([]), uploadImageProgress = ref([]) //파일, 이미지 업로드시 진행바 표시 (현재는 용량 작게 제한하므로 거의 보이지도 않음)
    let linkArr = ref([]), fileBlobArr = ref([]), imgBlobArr = ref([]) //파일객체(ReadOnly)가 아님. hover 속성 등 추가 관리 가능

    let savFirstMsgMstCdt = gst.cons.cdtAtFirst, savLastMsgMstCdt = gst.cons.cdtAtLast //가장 오래된 일시와 최근 일시
    let onGoingGetList = false, prevScrollY, prevScrollHeight, resultCnt = 0, scrollDirection = ""

    //##0 웹에디터 https://ko.javascript.info/selection-range
    //https://velog.io/@longroadhome/%EB%AA%A8%EB%8D%98JS-%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80-Range%EC%99%80-Selection
    //https://stefan.petrov.ro/inserting-an-element-at-cursor-position-in-a-content-editable-div/ => 목적이 다르고 헛점도 많이 보이지만 참고할 만한 내용도 많음
    //아래 변수는 storeCursorPosition()의 주석 참조
    let prevRange //let cursorPos = { node: null, startOffset: 0, endOffset: 0 } curPos 말고 prevRange로 기억하면 훨씬 간편해서 막음 (코딩은 그대로 둠)
    let editorIn = ref(false), editorBlurDt = Date.now()
    let inEditor = useTemplateRef('editorRef') //editor = document.getElementById(editorId) editor 대신 inEditor (템플릿 참조) 사용

    /* 라우팅 관련 정리 : 현재는 부모(Main) > 자식(Home) > 손자(HomeBody) 구조임 (스레드(댓글)용으로 손자안에 동일한 손자(HomeBody)가 있는데 그건 컴포넌트로 바로 처리 (라우팅 아님)
    1. Home.vue에서 <router-view />를 사용하면 그 자식인 여기 HomeBody.vue가 한번만 마운트되고 
       그 다음에 router.push해도 다시 마운트(아예 호출도) 안됨 : onMounted가 한번만 호출되고 끝.
    2. 그런데, <router-view :key="$route.fullPath"></router-view>와 같이 :key속성을 사용하면 router.push할 때마다 다시 마운트됨
    3. 그런데, Main.vue에서도 :key를 사용하면 Home.vue에서 router.push할 때에도 Main.vue의 onMounted가 호출되어 문제가 됨
    4. 따라서, 현재 구조에서는 여기 손자인 HomeBody.vue를 호출하는 자식인 Home.vue에서만 :key를 적용하면 슬랙과 똑같이 채널노드를 클릭할 때마다 라우팅되도록 할 수 있음
       - 만일 손자 아래 증손자가 필요하고 그것도 라우팅으로 처리하려면 매우 복잡한 핸들링이 필요하므로
       - 아예 증손자는 만들지 말든지 아니면 만들어도 라우팅 아닌 컴포넌트 호출(또는 비동기로 defineAsyncComponent)하기로 함
    5. keepalive때문에 back()시 이전에 열었던 채널 상태 복원되나, 이전 스크롤위치는 구현 필요 */

    /* <keep-alive> 구현시
    1. App.vue, Home.vue, HomeBody.vue 모두 아래와 같이 구현하니 잘되나 안되는 부분도 다음 항목처럼 발생 (해결 필요)
        <router-view v-slot="{ Component }">
            <keep-alive>
                <component :is="Component" :key="$route.fullPath" /> :key속성을 router-view가 아닌 이 행에 Component에 넣어야 잘 동작함
            </keep-alive>
        </router-view>
    2. 위에서 안되는 부분
       1) login후 /main에서 멈춤 (화면 블랭크) 2) 채널 클릭시 펼쳐진 다른 그룹은 접혀짐 3) back()시 노드 선택 색상이 안움직이는데 변경 필요
    3. 제일 중요한 부분은 채널 클릭시 HomeBody.vue의 onMounted()가 여러번 누적적으로 증가 실행되어, named view로 해결 글도 있긴 한데 구조적으로 어려워,
       App.vue, Home.vue는 기존대로 <router-view />로 다시 돌리고, HomeBody.vue만 <keep-alive 위처럼 적용하니 일단 누적/중복호출은 없어져서
       이 환경을 기본으로 문제들을 해결해 나가기로 함 (데이터 가져오기는 <keep-alive>가 지켜주나 스크롤포지션은 안지켜주는데 그 부분은 코딩으로 해결하면 됨)
       1) back()시 노드 선택 색상이 안움직이는데 변경 필요 - router.beforeEach((to, from)로 해결 완료
    4. 채널내 라우팅은 해결했으나 홈 >> DM >> Back()시 HomeBody.vue의 상태 복원은 안되고 있음. :key="$route.fullPath" 제거후 누적/중복호출 해결. 상태 복원도 잘 됨
       1) 홈 >> DM >> Back()시 Main.vue의 홈 선택 복원은 안되고 있음 : router.beforeEach((to, from)로 해결 완료
       2) 홈 클릭시 HomeBody.vue 블랭크 페이지 나옴 해결 필요 (이미 히스토리에 있으므로 안나오는데 슬랙은 그 상태로 다시 보여줌) : gst.selSideMenuTimeTag로 해결 완료
    5. 결론적으로, App.vue, Main.vue, Home.vue에 있는 <router-view>의 모습이 각각 다르며 
       router의 index.js와 각 watch 메소드를 이용해 Back() 또는 기존 URL 클릭시 캐시를 부르거나 상태복원하는 것으로 구현 완료함 */

    onMounted(async () => { //Home.vue에서 keepalive를 통해 호출되므로 처음 마운트시에만 1회 실행됨
        //그러나, 부모단에서 keepalive의 key를 잘못 설정하면 자식단에서 문제가 발생함 (심지어 onMounted가 2회 이상 발생)
        //예) Main.vue에서 <component :is="Component" :key="route.fullPath.split('/')[2]" />로 key 설정시 
        //HomeBody에서 keepalive에도 불구하고 onMounted가 2회 발생함. :key="$route.fullPath"를 사용해도 마찬가지 현상임
        //또 다른 현상은 새로고침하면 Home.vue가 먼저 실행되는 것이 아닌 HomeBody.vue의 onMounted가 먼저 실행되어서 Home.vue가 실행되면서 
        //호출하는 HomeBody.vue와 충돌해 페이지가 안뜸 => router의 index.js에서 beforeEach()로 해결함 $$76
        try {
            if (hasProp()) {
                console.log("자식 - " + JSON.stringify(props.data))
                setBasicInfoInProp()
                await getList({ msgid: props.data.msgid, kind: "withReply" })
            } else {
                console.log("부모 - " + props.data) //개발완료전에 마운트가 두번 되는지 여기 지우지 말고 끝까지 체크하기
                setBasicInfo()
                //if (!gst.selMsgId) { //홈에서 열기시에도 해당 채널 처음 열면 여기로 오므로 onActivated()와 충돌 체크 필요 : gst.selMsgId
                if (msgidInChan) { //여기는 Later.vue로부터 호출됨
                    await getList({ msgid: msgidInChan, kind: "atHome" })
                } else {
                    await getList({ lastMsgMstCdt: savLastMsgMstCdt })
                }
                //} else { //여기는 Later.vue로부터 호출됨
                //   debugger
                //   msgidInChan = gst.selMsgId
                //   gst.selMsgId = null //그렇지 않으면 Home.vue에서 채널노드 선택시 오류 발생할 수도 있음. gst.selMsgId는 나중에~ 등의 화면에서 여기까지 오는데 사용하는 임시 변수임
                //   await getList({ msgid: msgidInChan, kind: "atHome" }) //홈메뉴에서 메시지 하나 전후로 가져와서 보여 주는 UI (from 나중에..내활동..)
                //}
                try { inEditor.value.focus() } catch {}
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => { // 초기 마운트 또는 캐시상태에서 다시 삽입될 때마다 호출 : onMounted -> onActivated 순으로 호출됨
        if (mounting) {
            mounting = false
        } else {
            if (hasProp()) {
                console.log("자식A - " + JSON.stringify(props.data))
                setBasicInfoInProp()
            } else {
                console.log("부모A - " + JSON.stringify(props.data))
                setBasicInfo()
                //if (gst.selMsgId) { //onMounted일 경우는 null값이므로 if절 실행안됨
                //    msgidInChan = gst.selMsgId
                //    gst.selMsgId = null //그렇지 않으면 Home.vue에서 채널노드 선택시 오류 발생할 수도 있음. gst.selMsgId는 나중에~ 등의 화면에서 여기까지 오는데 사용하는 임시 변수임
                //    await getList({ msgid: msgidInChan, kind: "atHome" }) //홈메뉴에서 메시지 하나 전후로 가져와서 보여 주는 UI (from 나중에..내활동..)
                //} else {
                if (msgidInChan) { //여기는 Later.vue로부터 호출됨
                    debugger
                    await getList({ msgid: msgidInChan, kind: "atHome" })
                } else {
                    const key = sideMenu + chanId
                    if (gst.objSaved[key]) {
                        scrollArea.value.scrollTop = gst.objSaved[key].scrollY
                    }
                }
                //}
            }
        }
    })

    //onDeactivated(() => {
        //HomeBody.vue가 비활성화되는 싯점은 아래 1), 2)에 따라 다름
        //1) 사이드메뉴에서 '홈->나중에'를 누르는 경우는 HomeBody.vue의 onDeactivated()보다 ListLeft.vue가 먼저 호출되므로 ListLeft.vue에서 이미 gst.selSideMenu는 mnuLater로 변경되어 있음
        //2) 그러나, 홈에서 Back()을 눌러 나중에도 돌아가는 경우는 HomeBody.vue의 onDeactivated()가 먼저 호출되므로 gst.selSideMenu는 mnuHome으로 남아 있음
        //캐시된 HomeBody.vue인 경우 Home.vue보다 먼저 올라오면 Home.vue의 gst.selSideMenu 값을 받는 setBasicInfo()보다 여기 setBasicInfo()가 먼저 실행되어 gst.selSideMenu가 빈값일 수 있음
        //따라서, 아예 onDeactivated hook에서 일관되게 저장된 사이드메뉴값은 별도로 만들어 사용(sideMenu)하고, gst.selSideMenu는 Home.vue, ListLeft.vue등에서만 사용하기로 하며
        //아래 setBasicInfo()에서도 route.fullPath를 읽어 sideMenu를 무조건 가져오게 함
        /* onScrollEnd에서 처리하는 것으로 변경하고 막음
        if (!sideMenu || !chanId) return
        const key = sideMenu + chanId        
        if (!gst.objSaved[key]) gst.objSaved[key] = {}
        gst.objSaved[key].scrollY = prevScrollY*/
    //})

    function setBasicInfo() {        
        sideMenu = gst.selSideMenu //위 onDeactivated() 설명 참조
        if (!sideMenu) { //gst.selSideMenu가 빈값으로 넘어 오는 경우가 가끔 있는데 비동기실행이 어딘지 찾기가 어려워 일단 아래 코딩 보완
            //예) /main/home/home_body/20250120084532918913033423/20250122084532918913033403 : arr[2] = "home"
            const arr = route.fullPath.split("/")
            sideMenu = "mnu" + arr[2].substring(0, 1).toUpperCase() + arr[2].substring(1)
        }
        if (route.params.chanid && route.params.grid) {
            chanId = route.params.chanid
            grId = route.params.grid
            gst.selChanId = chanId //$$44 이 2행은 여기에 쓰이지 않고 Home.vue처럼 상위컴포넌트에서 watch를 통해 채널트리간 Back()시 사용자가 선택한 것으로 표시하도록 함
            gst.selGrId = grId //이 2행이 없으면 Home.vue에서 등 Back()의 경우 채널노드가 선택되지 않음. 여기 2개 변수는 Back(), click 등 복잡한 비동기가 있으므로 다른 곳에서 쓰지 않기
        }
        debugger
        if (route.params.msgid) {
            msgidInChan = route.params.msgid
        }
    }

    function saveCurScrollY(posY) {
        if (!sideMenu || !chanId) return
        const key = sideMenu + chanId        
        if (!gst.objSaved[key]) gst.objSaved[key] = {}
        gst.objSaved[key].scrollY = posY
    }

    function chanCtxMenu(e) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {

            }},
            { nm: "채널정보 보기", func: function(item, idx) {
                
            }},
            { nm: "채널링크 복사", func: function(item, idx) {
                
            }},
            { nm: "채널 설정", func: function(item, idx) {
                
            }},
            { nm: "알림 변경", func: function(item, idx) {
                
            }},
            { nm: "즐겨찾기", func: function(item, idx) {
                
            }},
            { nm: "채널 나가기", color: 'red', func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
    }

    function chanProperty() {
        alert("hahaha")
    }

    function chanMsg(kind) {
        alert("hahaha")
    }

    function chkWithinTime(dt1, dt2) {
        const secondDiff = hush.util.getDateTimeDiff(dt1, dt2)
        const minuteDiff = parseInt(secondDiff / 60)
        return (minuteDiff <= 1) ? true : false
    }

    //grid, chanid는 기본 param
    //1) lastMsgMstCdt : EndlessScroll 관련 (가장 오래된 일시를 저장해서 그것보다 더 이전의 데이터를 가져 오기 위함. 화면에서 위로 올라가는 경우임)
    //2) firstMsgMstCdt : EndlessScroll 관련 (가장 최근 일시를 저장해서 그것보다 더 최근의 데이터를 가져 오기 위함. 화면에서 아래로 내려가는 경우임)
    //3) firstMstMsgCdt + kind(scrollToBottom) : 발송 이후 작성자 입장에서는 맨 아래로 스크롤되어야 함. (향후 소켓 적용시에도 수신인 입장에서 특정 메시지 아래 모두 읽어와 보여주기)
    //4) msgid + kind(atHome) : 홈메뉴에서 메시지 하나 전후로 가져와서 보여 주는 UI (from 나중에..내활동..)
    //5) msgid + kind(withReply) : 1. 홈메뉴에서 댓글보기 누르면 오른쪽에 부모글+댓글 리스트로 보여 주는 UI 2. 나중에..내활동..에서 기본 클릭시 보여 주는 UI
    async function getList(addedParam) {
        if (onGoingGetList) return
        try {
            onGoingGetList = true
            resultCnt = 0
            debugger
            let param = { grid: grId, chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const lastMsgMstCdt = param.lastMsgMstCdt
            const firstMsgMstCdt = param.firstMsgMstCdt
            const msgid = param.msgid
            const kind = param.kind
            //let idTop //$$50 참조 (막았지만 코딩 지우지 말기 - 향후 쓰임새가 있는 내용임)
            //if (lastMsgMstCdt && lastMsgMstCdt != gst.cons.cdtAtFirst) {
            //    const eleTop = getTopMsgBody() //1) 케이스임 : 이전 데이터를 가져와 뿌린 후에 이젠에 육안으로 맨위에 보였던 idTop이 이젠 안보일테니 
            //    idTop = eleTop.id //idTop이 맨위에 보이게 스크롤하기 위해 여기서 기억하고 아래에서 처리함
            //}
            if (msgid && (kind == "atHome" || kind == "withReply")) {
                savFirstMsgMstCdt = gst.cons.cdtAtFirst
                savLastMsgMstCdt = gst.cons.cdtAtLast
            }
            if ((firstMsgMstCdt && !kind) || (msgid && kind == "atHome")) {
                scrollDirection = "down"
            } else {
                scrollDirection = ""
            }
            const res = await axios.post("/chanmsg/qry", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) {
                onGoingGetList = false
                resultCnt = 0
                return
            }
            grnm.value = rs.data.chanmst.GR_NM
            channm.value = rs.data.chanmst.CHANNM
            chanimg.value = (rs.data.chanmst.STATE == "P") ? "violet_lock.png" : "violet_channel.png"
            document.title = channm.value + "[채널]"
            chanmemUnder.value = [] //예) 11명 멤버인데 4명만 보여주기. 대신에 <div v-for="idx in MAX_PICTURE_CNT" chandtl[idx-1]로 사용가능한데 null 발생해 일단 대안으로 사용중
            for (let i = 0; i < rs.data.chandtl.length; i++) {
                const row = rs.data.chandtl[i]                
                if (row.PICTURE == null) {
                    row.url = null
                } else {
                    const uInt8Array = new Uint8Array(row.PICTURE.data)
                    const blob = new Blob([uInt8Array], { type: "image/png" })
                    const blobUrl = URL.createObjectURL(blob)
                    row.url = blobUrl
                }
                chandtlObj.value[row.USERID] = row //chandtl은 array로 쓰이는 곳이 훨씬 많을테고 메시지작성자의 blobUrl은 object로 관리하는 것이 효율적이므로 별도 추가함
                if (i < MAX_PICTURE_CNT) chanmemUnder.value.push({ url: row.url })
            }
            chandtl.value = rs.data.chandtl
            if (msgid && (kind == "atHome" || kind == "withReply")) msglist.value = [] //홈에서 열기를 선택해서 열린 것이므로 목록을 초기화함
            const msgArr = rs.data.msglist   
            for (let i = 0; i < msgArr.length; i++) { //msgArr[0]가 가장 최근일시임 (CDT 내림차순 조회 결과)
                const row = msgArr[i]
                if (msgid && (kind == "atHome" || kind == "withReply")) {
                    if (row.MSGID == msgid) row.background = "beige"
                }
                for (let item of row.msgimg) {
                    if (!item.BUFFER) continue //잘못 insert된 것임
                    const uInt8Array = new Uint8Array(item.BUFFER.data)
                    const blob = new Blob([uInt8Array], { type: "image/png" })
                    const blobUrl = URL.createObjectURL(blob)
                    item.url = blobUrl
                    item.hover = false
                    item.cdt = item.CDT
                }
                for (let item of row.msgfile) {
                    item.hover = false
                    item.name = item.BODY
                    item.size = item.FILESIZE
                    item.cdt = item.CDT
                }
                for (let item of row.msglink) {
                    item.hover = false                        
                    item.cdt = item.CDT
                    const arr = item.BODY.split(gst.cons.deli)
                    if (arr.length == 1) {
                        item.text = item.BODY
                        item.url = item.BODY
                    } else {
                        item.text = arr[0]
                        item.url = arr[1]
                    }
                }
                //동일한 작성자가 1분 이내 작성한 메시지는 프로필없이 바로 위 메시지에 붙이기 (자식/부모 각각 입장)
                const curAuthorId = row.AUTHORID
                const curCdt = row.CDT.substring(0, 19)
                if (firstMsgMstCdt || kind == "withReply") { //오름차순으로 일부를 읽어옴
                    if (i == 0) {
                        row.stickToPrev = false
                    } else {
                        if (curAuthorId != msgArr[i - 1].AUTHORID) { //i보다 i - 1이 일시가 더 오래된 것임
                            row.stickToPrev = false
                        } else {
                            const prevCdt = msgArr[i - 1].CDT.substring(0, 19)
                            row.stickToPrev = chkWithinTime(prevCdt, curCdt)
                        }
                    }
                    if (i == msgArr.length - 1) {
                        row.hasSticker = false
                    } else {
                        if (curAuthorId != msgArr[i + 1].AUTHORID) { //i보다 i + 1이 일시가 더 최근임
                            row.hasSticker = false
                        } else {
                            const nextCdt = msgArr[i + 1].CDT.substring(0, 19)
                            row.hasSticker = chkWithinTime(curCdt, nextCdt)
                        }
                    } //예) 기존 메시지리스트 = [26일데이터, 27일데이터, 28일데이터] / 새로 읽어온 리스트 = [29일, 30일, 31일]
                    msglist.value.push(row) //기존 메시지리스트 맨 아래에 추가
                } else {
                    if (i == msgArr.length - 1) {
                        row.stickToPrev = false
                    } else {
                        if (curAuthorId != msgArr[i + 1].AUTHORID) { //i보다 i + 1이 일시가 더 오래된 것임
                            row.stickToPrev = false
                        } else {
                            const prevCdt = msgArr[i + 1].CDT.substring(0, 19)
                            row.stickToPrev = chkWithinTime(prevCdt, curCdt)
                        }
                    }
                    if (i == 0) {
                        row.hasSticker = false
                    } else {
                        if (curAuthorId != msgArr[i - 1].AUTHORID) { //i보다 i - 1이 일시가 더 최근임
                            row.hasSticker = false
                        } else {
                            const nextCdt = msgArr[i - 1].CDT.substring(0, 19)
                            row.hasSticker = chkWithinTime(curCdt, nextCdt)
                        }
                    } //예) 기존 메시지리스트 = [26일데이터, 27일데이터, 28일데이터] / 새로 읽어온 리스트 = [25일, 24일, 23일]
                    msglist.value.splice(0, 0, row) //jQuery의 prepend와 동일 (메시지리스트 맨 위에 삽입)
                }
                if (row.CDT > savFirstMsgMstCdt) savFirstMsgMstCdt = row.CDT
                if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
            }
            imgBlobArr.value = []
            for (let item of rs.data.tempimagelist) {
                const uInt8Array = new Uint8Array(item.BUFFER.data)
                const blob = new Blob([uInt8Array], { type: "image/png" })
                const blobUrl = URL.createObjectURL(blob)
                imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: item.CDT })
            }
            fileBlobArr.value = []
            for (let item of rs.data.tempfilelist) {
                fileBlobArr.value.push({ hover: false, name: item.BODY, size: item.FILESIZE, cdt: item.CDT })
            }
            linkArr.value = []
            for (let item of rs.data.templinklist) {
                let text, url
                const arr = item.BODY.split(gst.cons.deli)
                if (arr.length == 1) {
                    text = item.BODY
                    url = item.BODY
                } else {
                    text = arr[0]
                    url = arr[1]
                }
                linkArr.value.push({ hover: false, text: text, url: url, cdt: item.CDT })
            }
            resultCnt = msgArr.length
            await nextTick()
            if (msgid && (kind == "atHome" || kind == "withReply")) {
                const ele = document.getElementById(msgid) //자식에서는 atHome에서는 1개이므로 문제가 없고 withReply에서는 msgid가 화면에 2개 중복될 수도 있으나 맨위로 가므로 문제없을 것임
                if (ele) ele.scrollIntoView()
            } else if (lastMsgMstCdt == gst.cons.cdtAtLast) {
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight }) //, behavior: 'smooth'
            } else if (lastMsgMstCdt) {
                if (msgArr.length > 0) {
                    //const ele = document.getElementById(idTop) //데이터를 더 읽어와 추가했으므로 scrollHeight는 더 커진 상태이므로 이전에 봤던 ele를 기준으로 위치 설정함
                    //if (ele) scrollArea.value.scrollTo({ top: ele.offsetTop - ele.offsetHeight - 10}) //10은 마진/패딩 등 알파값
                    //$$50 처음엔 위 2행으로 idTop을 기억해 처리했으나 생각해보니, 굳이 그럴 필요없이.. 
                    //스크롤이전에 prevScrollY + 새로 더해진 scrollHeight을 더해서 scrollArea의 scrollTop을 구하면 됨
                    scrollArea.value.scrollTop = (scrollArea.value.scrollHeight - prevScrollHeight) + prevScrollY
                } else {
                    //스크롤 위치는 그대로임 //scrollArea.value.scrollTop = prevScrollY
                }
            } else if (firstMsgMstCdt && kind == "scrollToBottom") { //작성자 입장에서 발송이후 스크롤 맨 아래로 위치
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (firstMsgMstCdt) {
                //scrollArea.value.scrollTop = (scrollArea.value.scrollHeight - prevScrollHeight) + prevScrollY
            }
            onGoingGetList = false //console.log(msgArr.length+"=====")
        } catch (ex) {
            onGoingGetList = false
            resultCnt = 0
            gst.util.showEx(ex, true)
        }
    }

    async function getMsg(addedParam, verbose) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryMsg", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) {
                if (verbose) gst.util.setToast(rs.msg)
                return null
            }
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function qryAction(addedParam) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryAction", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return null
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function qryActionForUser(addedParam) {
        try {
            let param = { chanid: chanId } //기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const res = await axios.post("/chanmsg/qryActionForUser", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return null
            return rs.data
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function memProfile(e, row) {
        //alert(JSON.stringify(row))
        gst.ctx.data.header = row.AUTHORNM
        gst.ctx.menu = [
            { nm: "메시지 보내기", func: function(item, idx) {
                
            }},
            { nm: "VIP로 설정", func: function(item, idx) {
                
            }},
            { nm: "퇴장 시키기", color: 'red', func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
    }

    // function displayDt(dtStr, tmOnly) { //vue의 computed method 이용할 경우 아규먼트 전달방법을 아직 파악하지 못해 일반 함수로 처리함
    //     if (dtStr.length < 19) return null
    //     const arr = dtStr.split(" ")
    //     if (tmOnly) {
    //         return arr[1].substring(0, 5)
    //     } else {
    //         const hday = hush.util.getDayFromDateStr(arr[0])
    //         return arr[0] + " (" + hday + ") " + arr[1].substring(0, 5)
    //     }
    // }

    function rowRight(e, row, index) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "반응 추가", img: "dimgray_emoti.png", func: function(item, idx) {
                alert(JSON.stringify(row))
            }},
            { nm: "스레드(댓글)", img: "dimgray_thread.png", func: function(item, idx) {
                
            }},
            { nm: "메시지 전달", img: "dimgray_forward.png", func: function(item, idx) {
                
            }},
            { nm: "읽지않음으로 표시", func: function(item, idx) {
                alert(item.nm+"@@@@"+idx)
            }},
            { nm: "리마인더 받기", child: [
                { nm: "1시간 후", func: function(item, idx) { 
                    alert(item.nm+"@@@@"+idx)
                }},
                { nm: "내일", func: function(item, idx) { 
                    
                }},
                { nm: "다음 주", func: function(item, idx) { 
                    
                }},
                { nm: "사용자 지정", func: function(item, idx) { 
                    
                }}                
            ]},
            { nm: "새 댓글시 알림 받기", func: function(item, idx) {
                
            }},
            { nm: "채널에 고정", func: function(item, idx) {
                
            }},
            { nm: "링크로 복사", func: function(item, idx) {
                
            }},
            { nm: "메시지 편집", func: function(item, idx) {
                editMsgId.value = row.MSGID
                prevEditData = document.getElementById(editorId).innerHTML
                if (prevEditData.trim() != "") {
                    //gst.util.setToast("에디터에 이미 편집중인 데이터가 있습니다.")
                    //return
                }
                msgbody.value = row.BODY
            }},
            { nm: "메시지 삭제", color: "red", func: async function(item, idx) {
                try {
                    //if (!window.confirm("삭제후엔 복구가 불가능합니다. 진행할까요?")) return
                    const res = await axios.post("/chanmsg/delMsg", { 
                        msgid: row.MSGID, chanid: chanId
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    msglist.value.splice(index, 1) //해당 메시지 배열 항목 삭제해야 함 (일단 삭제하는 사용자 화면 기준만 해당)
                    if (hasProp()) evClick({ type: "refreshParentReply", msgid: props.data.msgid })
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    const onScrollEnd = async (e) => { //scrollend 이벤트이므로 debounce가 필요없음 //import { debounce } from 'lodash'
        if (hasProp()) return //자식에서는 한번에 모든 데이터 가져오므로 EndlessScroll 필요없음
        const sTop = scrollArea.value.scrollTop 
        const ele = document.getElementById("chan_center_body") //아이디가 2개 중복되지만 자식에서는 위에서 return되므로 문제없을 것임
        const topEntryPoint = 200
        const bottomEntryPoint = (scrollArea.value.scrollHeight - ele.offsetHeight) - 200 //max ScrollTop보다 200정도 작게 정함
        //console.log(scrollArea.value.scrollTop+"@@@@"+scrollArea.value.scrollHeight+"@@@@"+ele.offsetHeight)
        const which = (prevScrollY && sTop < prevScrollY) ? "up" : "down" //e로 찾아도 있을 것임
        prevScrollY = sTop
        saveCurScrollY(prevScrollY)
        //resultCnt => 읽어온 데이터가 없을 땐 getList() 호출하지 말기
        if (which == "up" && sTop < topEntryPoint) { //스크롤이 위 방향으로 특정 위치(이하)로 오게 되면 실행
            prevScrollHeight = scrollArea.value.scrollHeight
            if (resultCnt != 0) await getList({ lastMsgMstCdt: savLastMsgMstCdt })
        } else if (scrollDirection == "down" && which == "down" && sTop > bottomEntryPoint) { 
            //수동스크롤과 자동스크롤 구분이 필요한데 정확히 찾기 어려움
            //getList()시 데이터가 추가되어 스크롤이 내려가면 여기를 만나 또 아래 getList()가 수행될 수 있으므로
            //마지막 getList() 방식이 scrollDirection(down)일 경우만 아래 처리하도록 하기
            if (resultCnt != 0) await getList({ firstMsgMstCdt: savFirstMsgMstCdt })
        }
    }

    // const getTopMsgBody = () => { //지우지 말 것. 2) 관련 : 육안으로 보이는 맨 위 MSGID의 div(msgbody 및 procMenu 클래스 보유) 찾기
    //     const rect = hush.util.getRect("#chan_center_body") //아이디가 2개 중복되지만 자식에서는 위에서 return되므로 문제없을 것임
    //     const xx = rect.left + 1 //MSGID를 갖고 있는 div는 margin/padding이 각각 5px이므로 xx, yy에 그 안의 값을 더하면 구할 수 있음
    //     let yy = rect.top + 6
    //     const ele = document.elementFromPoint(xx, yy)
    //     return ele
    // }

    async function delBlob(kind, msgid, idx, index) { //msgid = temp or real msgid
        try { //index는 메시지 배열의 항목 인덱스. idx는 그 항목내 file or image or link array의 인덱스
            let cdt = ""
            if (kind == "F") {
                cdt = (msgid == "temp") ? fileBlobArr.value[idx].cdt : msglist.value[index].msgfile[idx].cdt
            } else if (kind == "I") {
                cdt = (msgid == "temp") ? imgBlobArr.value[idx].cdt : msglist.value[index].msgimg[idx].cdt
            } else if (kind == "L") {
                cdt = (msgid == "temp") ? linkArr.value[idx].cdt : msglist.value[index].msglink[idx].cdt
            }
            const res = await axios.post("/chanmsg/delBlob", { 
                msgid: msgid, chanid: chanId, kind: kind, cdt: cdt
            })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (kind == "F") {
                if (msgid == "temp") {
                    fileBlobArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msgfile.splice(idx, 1)
                }
            } else if (kind == "I") {
                if (msgid == "temp") {
                    imgBlobArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msgimg.splice(idx, 1)
                }
            } else if (kind == "L") {
                if (msgid == "temp") {
                    linkArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msglink.splice(idx, 1)
                }
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function imgLoaded(e, row) {
        row.realWidth = e.currentTarget.naturalWidth
        row.readHeight = e.currentTarget.naturalHeight
    }

    async function pasteData(e) { //from paste event
        try {
            e.preventDefault() //tage의 .prevent가 안먹혀서 여기서 처리
            const pastedData = e.clipboardData.items //e.originalEvent.clipboardData.items
            if (pastedData.length == 0) return
            if (pastedData[0].type.includes("image")) { //예) image/png
                if (editMsgId.value) {
                    gst.util.setToast("편집중인 메시지에는 이미지 붙이기가 불가능합니다.", 3)
                    return
                }
                const clipboardItem = pastedData[0]
                const blob = clipboardItem.getAsFile() //서버에 보낼 데이터
                const blobUrl = URL.createObjectURL(blob) //화면에 보여줄 데이터
                if (blob.size > gst.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 이미지 크기 제한은 " + hush.util.formatBytes(gst.cons.uploadLimitSize) + "입니다.\n" + "현재 => " + hush.util.formatBytes(blob.size), true)
                    return
                }
                const fd = new FormData()
                fd.append("chanid", chanId)
                fd.append("kind", "I")
                fd.append("body", "") //width x height 미리 넣을 필요없어 보이며 대신 빈칸으로 넣어야 함
                fd.append("filesize", blob.size)
                fd.append("file", blob)
                uploadImageProgress.value = { url: blobUrl, percent : 0 }
                const res = await axios.post("/chanmsg/uploadBlob", fd, { 
                    headers: { 
                        'Content-Type': 'multipart/form-data' 
                    }, onUploadProgress: async (e) => {
                        const percent = (e.loaded * 100) / e.total                        
                        uploadImageProgress.value.percent = Math.round(percent)
                    }
                })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: rs.data.cdt })
            } else if (pastedData[0].type == "text/plain" || (pastedData.length >= 2 && pastedData[1].type == "text/html")) {
                const idx = (pastedData.length >= 2 && pastedData[1].type == "text/html") ? 1 : 0
                //1 : 클립보드에 text뿐만 아니라 html 데이터를 제공하므로 기본적으로 html을 적용시키는 것이 맞을 것임 
                //0 : html이 아닌 순수 text라고 봐야 함
                const clipboardItem = pastedData[idx]
                const type = clipboardItem.type
                clipboardItem.getAsString(function(str) { //const html = sanitizeHTML(str) //document.execCommand('insertHTML', false, (html))
                    insertPastedToEditor(type, str) //여기에 clipboardItem.type으로 참조하면 안읽히므로 위에서 미리 get
                })
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    } 
    
    function showImage(row, msgid) { //msgid = temp or real msgid
        try {
            imgParam.value = row
            imgParam.value.msgid = msgid
            imgParam.value.chanid = chanId
            imgPopupUrl.value = row.url
            imgPopupStyle.value = { width: row.realWidth + "px", height: row.realHeight + "px" }
            imgPopupRef.value.open()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function keyUpEnter(e) {
        if (e.ctrlKey) {
            saveMsg() //나중에 Ctrl+Enter를 saveMsg() 할 수 있도록 옵션 제공하기
        } else {
            //일단 줄바꿈으로 동작하게 하기
        }
    }

    async function saveMsg() { //파일 및 이미지 업로드만 FormData 사용하고 nest.js에서는 multer npm으로 처리
        try { //파일,이미지,링크가 있다면 미리 업로드된 상태이며 crud가 C일 때만 업로드 되며 U일 때는 슬랙과 동일하게 업로드되지 않음 (본문만 수정저장됨)
            let body = document.getElementById(editorId).innerHTML.trim()
            if (body == "") return
            let bodytext = document.getElementById(editorId).innerText.trim()
            const reg = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z가-힣0-9@:%_\+.~#(){}?&//=]*)/
            const result = reg.exec(body)
            if (result != null && !body.includes("<a href=\"" + result[0] + "\" target=\"_blank\" ")) { //웹에디터에서 이미 링크로 변환한 데이터는 또 변환하면 안됨
                let node = document.createElement('a')
                node.setAttribute("href", result[0])
                node.setAttribute("target", "_blank")
                node.style.color = "steelblue"
                node.append(result[0])
                body = body.replace(result[0], node.outerHTML)
                node.remove()
            }
            msgbody.value = body //document.getElementById(editorId).innerHTML //이 행이 없으면 발송 2회차부터 msgbody가 계속 본문에 남아 있음
            let crud = (editMsgId.value) ? "U" : "C"
            const rq = { 
                crud: crud, chanid: chanId, msgid: editMsgId.value, replyto: hasProp() ? props.data.msgid : null,
                body: msgbody.value, bodytext: bodytext,
                num_file: (editMsgId.value) ? 0 : fileBlobArr.value.length, 
                num_image: (editMsgId.value) ? 0 : imgBlobArr.value.length, 
                num_link: (editMsgId.value) ? 0 : linkArr.value.length
            }
            const res = await axios.post("/chanmsg/saveMsg", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (crud == "C") {
                if (hasProp()) { //댓글 전송후엔 작성자 입장에서는 맨아래로 스크롤하기
                    await getList({ msgid: props.data.msgid, kind: "withReply" })
                    scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
                    evClick({ type: "refreshParentReply", msgid: props.data.msgid })
                } else {
                    await getList({ firstMsgMstCdt: savFirstMsgMstCdt, kind: "scrollToBottom" }) //저장한 메시지 추가
                }
            } else {
                const rs = await getMsg({ msgid: editMsgId.value }, true)
                if (rs == null) return
                let item = msglist.value.find(function(row) { return row.MSGID == editMsgId.value })
                if (item) { //item과 rs는 구조가 달라 item = rs로 처리못하고 아래처럼 필요한 경우 추가하기로 함. 그러나 결국엔 한번에 붓는 것도 필요해 질 때도 필요해 질 것임
                    item.BODY = rs.msgmst.BODY
                    item.UDT = rs.msgmst.UDT
                }
            }
            msgbody.value = ""            
            editMsgId.value = null
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function cancelMsg() {
        msgbody.value = prevEditData
        editMsgId.value = null
    }

    function msgCopied(e) { //procMenu:hover 때문에 메시지를 복사하면 바탕색이 변하는데 아래에서 그걸 원래 배경색으로 환원시킴
        e.currentTarget.style.background = "white"
    }

    async function uploadLink(kind, text) {
        try {
            popupRefKind.value = kind
            linkText.value = text ?? ""
            linkPopupRef.value.open()
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function editorFocused(bool) {
        editorIn.value = bool
        if (!bool) editorBlurDt = Date.now()
    }

    function chkEditorFocus() {
        const ms = Date.now() - editorBlurDt
        if (ms <= 250) return true //에디터 포커스 상태에서 이모티, B, S 등의 이미지(버튼)을 누르면 그 차이가 100단위의 MiliSec 나오는데 여유있게 250으로 줌
        return false //250 넘어가면 에디터 포커스 상태에서 이미지(버튼)을 바로 누른 게 아니라는 의미임
        //위와 같이 체크하는 이유는 selection or range에서는 현재 커서가 있는 노드를 찾을 수 없음 (parentNode를 모두 뒤져도 없음)
        //1) 그래서, 에디터의 focusin/blur event로 하고자 했으나 그 상태값만으로는 체크가 어려움 : 이미지(버튼)을 누르는 순간 blur됨
        //2) blur되어도 클릭하는 순간의 갭이 짧기때문에 그걸 체크해서 disabled/enabled 효과를 내는 것임
        //참고로, let currentNode = window.getSelection().focusNode에서 parent로 올라가면 에디터 노드를 만날 수 있음
    }

    async function addEmoti() {
        const reg = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z가-힣0-9@:%_\+.~#(){}?&//=]*)/;
        const text = "https://wise.sbs.co.kr/wise/websquare/websquare.html?w2xPath=/gwlib/domino.xml&app=approv.main&dbpath=appro{yyyy}&__menuId=GWXA01&cchTag=1742267753337"
        const text1 = "https://velog.io/@longroadhome/%EB%AA%A8%EB%8D%98JS-%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80-Range%EC%99%80-Selection?aaa=가나다"
        const res = reg.exec(text)
        const res1 = reg.exec(text1)
        debugger
        return

        const exp = /<(strong|b)((>)|([\s]+)([^>]+)*>)/gi //<strong> <b  style='' >
        const exp01 = /<(strong|b)>/gi
        const exp02 = /<(strong|b)[\s]/gi
        const exp1 = /<\/(strong|b)([\s]+)*>/gi //</strong> </b >
        const exp2 = /(font-weight)([\s:]+)([a-z0-9]+)([;]?)/gi //font-weight:  bold..
        const str = "<B>style='color:red'><span style='font-weight: normal;; ;'>a<Br>aa</SPAN><B >"
        const rs = exp.exec(str) //str.match(exp)
        const rs01 = exp01.exec(str)
        const rs02 = exp02.exec(str)
        const rs1 = exp1.exec(str)
        const rs2 = exp2.exec(str)
        debugger
        const result = str.replace(rs[1], "span")
        const result1 = str.replace(rs1[0], "</span>")
        const result2 = str.replace(rs2[0], "") //font-weight:normal로 변환 대신 제거
        debugger
    }

    function makeLink() { //문자를 링크로 변환하는 것이며 addlink(별도 추가)와는 다름
        if (!chkEditorFocus()) return
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) 
        let content = range.cloneContents()
        let node = document.createElement('span')
        node.append(content) //content에 html로 읽어오는 메소드는 없고 cloneContents()로만 가능한데 append 하지 않으면 읽지 못함
        const text = node.innerHTML
        node.remove()
        storeCursorPosition()
        uploadLink('makelink', text)
    }

    function wordStyleFailed(type) { //코딩 실패 케이스 (donotdelete)
        if (!chkEditorFocus()) return
        let exp, exp1, exp2
        if (type == "B") {
            exp = /<(strong|b)([^>rR]+)*>/gi //<strong이나 <b로 시작해서 >과 BR의 R 제외한 모든 글자나 빈칸 허용되고 >로 마치는 패턴
            exp01 = /<(strong|b)([^>rR]+)*>/gi
            exp1 = /<\/(strong|b)>/gi //</strong>이나 </b>
            exp2 = /(font-weight)([\s:]+)(bold)/gi
        } else if (type == "S") { //Strike
            exp = /<s([^>pP]+)*>/gi //<s로 시작해서 >과 SPAN의 S 제외한 모든 글자나 빈칸 허용되고 >로 마치는 패턴
            exp1 = /<\/s>/gi
        }
        /* 예를 들어, Bold는 아래와 같이 2가지 케이스가 있을 것음
           1. <B>, <STRONG>의 경우 커서로 선택이 아래와 같을 수 있음
              1) <B>XYZ</B> : XYZ를 선택했을 때 innerHTML => <B>와 </B>가 안보임 (#text)
              2) X<B>YZ</B> : XYZ를 선택했을 때 innerHTML => <B>와 </B> 모두 보임
              3) <B>XY</B>Z : XYZ를 선택했을 때 innerHTML => <B>와 </B> 모두 보임
              4) X<B>Y</B>Z : XYZ를 선택했을 때 innerHTML => <B>와 </B> 모두 보임
              따라서, 1)과 2)3)4) 두가지 경우로 나눠서 처리하면 됨. 2)3)4)의 경우 cloneContents()후엔 B가 하나뿐이더라도 앞뒤로 생겨남
           2. stle="font-weight:bold"
              마찬가지로 위 네가지 형태로 나올 것이나 font-weight:400 등과 같이 숫치는 무시하기로 함 */
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0)
        let content1 = range.cloneContents() //content1,node1은 str로 받기 위한 단순 도구임
        let node, node1 = document.createElement("span")
        node1.append(content1)
        let str = node1.innerHTML //예) <B>가 한쪽에 없이 선택해도 innerHTML에서는 <B>까지 들어가도록 함
        const bool = chkSelectionInTagFailed(type) //1)~4) 모두 true 또는, 부모태그없이 XYZ만 있는 순수 텍스트인 경우는 false임
        let specific = false
        if (bool) {
            if (exp.test(str)) { //위 2)3)4) 경우인데 매칭파트를 제거하면 됨
                str = str.replace(exp, "").replace(exp1, "")
            } else if (type == "B" && exp2.test(str)) { //볼드체의 경우, <b>, font-weight 둘 다 있으면 한번에 안됨
                str = str.replace(exp2, "")
            } else { //1) 케이스이므로 parentNode를 제거해야 함
                chkSelectionInTagFailed(type, str) //true(제거옵션=>span으로변경(font-weight는제거))
                specific = true
            }
            if (!specific) {
                node = document.createElement("SPAN")
                node.innerHTML = str
            }
        } else { //해당 selection에 대해 parentNode까지 추적해보니 없으므로 type를 추가하는 케이스가 됨
            const content = range.cloneContents()
            node = document.createElement(type)
            node.append(content)
        }
        range.deleteContents()
        if (!specific) {            
            range.insertNode(node)
            //collapse안하려면 range를 refresh해야 최신으로 반영됨. selection.removeAllRanges()는 모두 deselect하는 것임
        }
        range.collapse(false)
        inEditor.value.focus()
        //msgbody.value = document.getElementById(editorId).innerHTML //데이터가 필요시 처리하면 됨
        return
    }

    function wordStyleFailed_1(type) {

        function procNodeRecursive(node1) {
            let nodes = node1.children
            for (let node of nodes) {
                if (node.tagName == "BR") continue //console.log(node.outerHTML+"###")            
                if (node.getAttribute("maker") == "hushsbay") {
                    if (node.innerHTML == "") { //console.log("!!!"+node.outerHTML)
                        delArr.push(node) //node.innerHTML = "!!!!!"
                    } else { //console.log("^^^"+node.outerHTML)
                        procNodeRecursive(node)
                    }
                } else { //console.log("******"+node.outerHTML)
                    procNodeRecursive(node)
                }
            }    
        }

        function cleanGabageNode(node1) {
            delArr = []
            procNodeRecursive(node1) //console.log("@@@"+node1.innerHTML)
            if (delArr.length == 0) return
            for (let i = delArr.length - 1; i >= 0; i--) {
                delArr[i].remove() //console.log("useless" + i)
            }            
            cleanGabageNode(node1)
        }

        if (!chkEditorFocus()) return
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        let exp01, exp02, exp1, exp2
        if (type == "B") { //exp = /<(strong|b)((>)|([\s]+)([^>]+)*>)/gi //<strong> <b  style='' > => .exec 사용시
            exp01 = /<(strong|b)>/gi
            exp02 = /<(strong|b)[\s]/gi
            exp1 = /<\/(strong|b)([\s]+)*>/gi //</strong> </b >
            exp2 = /(font-weight)([\s:]+)([a-z0-9]+)([;]?)/gi //font-weight: bold;..
        } else if (type == "S") { //Strike //exp = /<(s)((>)|([\s]+)([^>]+)*>)/gi //<s> <s  style='' > => .exec 사용시
            exp01 = /<(s)>/gi
            exp02 = /<(s)[\s]/gi
            exp1 = /<\/(s)([\s]+)*>/gi //</s> </s >
            exp2 = /(text-decoration)([\s:]+)([a-z0-9]+)([;]?)/gi //text-decoration:  line-through..
        }
        const range = selection.getRangeAt(0)
        debugger
        let content1 = range.cloneContents()
        let node1 = document.createElement("span") //단지 innerHTML에 담기 위해 생성하는 것임
        node1.append(content1) //console.log("@@@"+node1.outerHTML)
        //let html= '<span maker="hushsbay" style="font-weight: bold;"></span><span maker="hushsbay" style="font-weight: bold;"><span maker="hushsbay" style="">구</span><span maker="hushsbay" style="font-weight: normal;"><span maker="hushsbay" style=""></span><span maker="hushsbay" style="font-weight: bold;"><span maker="hushsbay" style="">름에</span> "달 <span>가</span><span maker="hushsbay" style=""><span>듯</span></span><span maker="hushsbay" style=""><span maker="hushsbay" style=""><span>이</span>" </span></span></span><span maker="hushsbay" style="font-weight: bold;"><span maker="hushsbay" style="">가는 <span maker="hushsbay" style="">나그네</span></span><span maker="hushsbay" style=""></span><br><span maker="hushsbay" style="font-weight: normal;">술익는 <span maker="hushsbay" style="">마</span><span maker="hushsbay" style=""><span maker="hushsbay" style="">을마다 </span><span style="color:red;">타는 저녁놀</span> <span maker="hushsbay" style="">하하</span></span></span><span maker="hushsbay" style=""><span maker="hushsbay" style=""></span></span></span><span maker="hushsbay" style=""><span maker="hushsbay" style=""></span></span></span><span maker="hushsbay" style="font-weight: normal;"><span maker="hushsbay" style=""></span></span><span maker="hushsbay" style=""></span></span><span maker="hushsbay" style="font-weight: bold;"></span>'
        //node1.innerHTML = html //console.log("@@@"+node1.innerHTML)
        let delArr = []
        cleanGabageNode(node1) //console.log("@@@@@@@"+node1.innerHTML)
        let str = node1.innerHTML
        if (str == "") str = "&nbsp"
        const strInnerText = node1.innerText
        //위 cloneContents()와 innerHTML로 처리된 str에서는 맨 앞과 맨뒤는 엘레멘트노드가 아닌 항상 텍스트노드임
        //또한, 사용자가 시작태그 또는 종료태그만 있도록 선택해도 자동으로 앞뒤 태그가 붙어서 문제없이 처리 가능함
        //1) 볼드체 판단 : range.commonAncestorContainer를 시작으로 msgContent 전까지 B, Strong, font-weight:bold(bold대신숫자는무시) 체크해 define
        //2) 볼드체 처리 : 추가하든 빼든, 일단 str 안에 있는 모든 볼드체 관련은 span/font-weight:bold로 변환후 (str: 텍스트 or 엘레먼트)
        //- 볼드체를 추가하려면 <span style='font-weight:bold'> + str + </span>으로 변환함
        //- 볼드체를 빼려면 <span style='font-weight:normal'> + str + </span>으로 변환함
        //위가 아닌 다른 방식(예를 들어 chkSelectionInTagFailed - focusNode)으로 처리하려면 경우의 수가 너무 많아 100% 구현이 어려울 것임
        //참고로, wordStyleFailed()와 chkSelectionInTagFailed()는 실패했어도 참고할 만한 코딩이 많으므로 지우지 말기로 함
        let container = range.commonAncestorContainer //startContainer 및 endContainer를 가지는 최상위 노드를 리턴. text일 경우는 그 위 엘레먼트 노드를 구함
        if (container.nodeName == "#text") container = container.parentNode
        let currentNode = container //container와 currentNode 둘 다 필요하므로 분리
        //debugger
        const bool = chkCurTagType(currentNode, type)
        //아래부터는 currentNode가 없어야 함 (위에서 체크용으로만 쓰임). 아래는 container(바로 위 엘레먼트 노드)임을 유의
        //RegExp.$n deprecated. 배열[0]는 매칭 결과 전체 //const rs = exp.exec(str) //if (rs != null) str = str.replace(rs[1], "span")
        str = str.replace(exp01, "<span>")
        str = str.replace(exp02, "<span ")
        str = str.replace(exp1, "</span>") //맨 뒤에 있어 앞의 text가 검색될 수도 있으므로 전체(rs1[0]) 변경 필요 //const rs1 = exp1.exec(str) //if (rs1 != null) str = str.replace(rs1[0], "</span>")
        str = str.replace(exp2, "") //font-weight:~ 제거 //const rs2 = exp2.exec(str) //if (rs2 != null) str = str.replace(rs2[0], "") //rs2[0]는 전체이므로 바로 replace 가능
        const containerInnerText = container.innerText.replace(/\n/g, "") //예) 구름에 \"달 가듯이\" 가는 나그네\n술익는 마을마다 타는 저녁놀 하하 => \n 제거
        //containerInnerText가 strInnerText와 다른데 바로 아래 if를 타면 containerInnerText 모든 문장이 영향을 받는 것임
        //debugger
        if (strInnerText == containerInnerText && container.outerHTML.startsWith("<span maker=\"hushsbay\"")) {
            //maker="hushsbay" 태그에는 다른 속성이나 여기에서 다루는 style말고는 없음. 그러나, 다른 태그의 속성이나 스타일은 추가로 있을 수 있으므로 다루기가 까다로울 것임
            cleanGabageNode(container) //console.log("@@@@@@@"+container.innerHTML)
            if (type == "B") {
                container.style["font-weight"] = (bool) ? "normal" : "bold"
            } else if (type == "S") {
                container.style["text-decoration"] = (bool) ? "none" : "line-through"
            }
            container.innerHTML = container.innerHTML.replace(exp2, "") //전체를 적용하는 것이므로 없애도 될 것임
        } else {
            range.deleteContents()
            let node = document.createElement("span")
            node.innerHTML = str
            if (type == "B") {
                node.style["font-weight"] = (bool) ? "normal" : "bold"
            } else if (type == "S") {
                node.style["text-decoration"] = (bool) ? "none" : "line-through"
            }
            node.setAttribute("maker", "hushsbay")
            range.insertNode(node)
        }
        range.collapse(false)
        inEditor.value.focus()
        //msgbody.value = document.getElementById(editorId).innerHTML //데이터가 필요시 처리하면 됨
        return
    }

    function wordStyle(type) {
        if (!chkEditorFocus()) return
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        let exp01, exp02, exp1, exp2
        if (type == "B") { //exp = /<(strong|b)((>)|([\s]+)([^>]+)*>)/gi //<strong> <b  style='' > => .exec 사용시
            exp01 = /<(strong|b)>/gi
            exp02 = /<(strong|b)[\s]/gi
            exp1 = /<\/(strong|b)([\s]+)*>/gi //</strong> </b >
            exp2 = /(font-weight)([\s:]+)([a-z0-9]+)([;]?)/gi //font-weight: bold;..
        } else if (type == "S") { //Strike //exp = /<(s)((>)|([\s]+)([^>]+)*>)/gi //<s> <s  style='' > => .exec 사용시
            exp01 = /<(s)>/gi
            exp02 = /<(s)[\s]/gi
            exp1 = /<\/(s)([\s]+)*>/gi //</s> </s >
            exp2 = /(text-decoration)([\s:]+)([a-z0-9]+)([;]?)/gi //text-decoration:  line-through..
        }
        const range = selection.getRangeAt(0)
        debugger
        let content1 = range.cloneContents()
        let node1 = document.createElement("span") //단지 innerHTML에 담기 위해 생성하는 것임
        node1.append(content1) 
        console.log(msgbody.value+"@@@"+node1.outerHTML)

        const ele = document.getElementById(editorId)
        let range1 = document.createRange()        
        range1.setStart(ele, 0)
        range1.setEnd(ele, 2)
        range.removeAllRanges()
        selection.addRange(range1)
        debugger
        
        let str = node1.innerHTML
        if (str == "") str = "&nbsp"
        const strInnerText = node1.innerText
        //위 cloneContents()와 innerHTML로 처리된 str에서는 맨 앞과 맨뒤는 엘레멘트노드가 아닌 항상 텍스트노드임
        //또한, 사용자가 시작태그 또는 종료태그만 있도록 선택해도 자동으로 앞뒤 태그가 붙어서 문제없이 처리 가능함
        //1) 볼드체 판단 : range.commonAncestorContainer를 시작으로 msgContent 전까지 B, Strong, font-weight:bold(bold대신숫자는무시) 체크해 define
        //2) 볼드체 처리 : 추가하든 빼든, 일단 str 안에 있는 모든 볼드체 관련은 span/font-weight:bold로 변환후 (str: 텍스트 or 엘레먼트)
        //- 볼드체를 추가하려면 <span style='font-weight:bold'> + str + </span>으로 변환함
        //- 볼드체를 빼려면 <span style='font-weight:normal'> + str + </span>으로 변환함
        //위가 아닌 다른 방식(예를 들어 chkSelectionInTagFailed - focusNode)으로 처리하려면 경우의 수가 너무 많아 100% 구현이 어려울 것임
        //참고로, wordStyleFailed()와 chkSelectionInTagFailed()는 실패했어도 참고할 만한 코딩이 많으므로 지우지 말기로 함
        let container = range.commonAncestorContainer //startContainer 및 endContainer를 가지는 최상위 노드를 리턴. text일 경우는 그 위 엘레먼트 노드를 구함
        if (container.nodeName == "#text") container = container.parentNode
        let currentNode = container //container와 currentNode 둘 다 필요하므로 분리
        //debugger
        const bool = chkCurTagType(currentNode, type)
        //아래부터는 currentNode가 없어야 함 (위에서 체크용으로만 쓰임). 아래는 container(바로 위 엘레먼트 노드)임을 유의
        //RegExp.$n deprecated. 배열[0]는 매칭 결과 전체 //const rs = exp.exec(str) //if (rs != null) str = str.replace(rs[1], "span")
        str = str.replace(exp01, "<span>")
        str = str.replace(exp02, "<span ")
        str = str.replace(exp1, "</span>") //맨 뒤에 있어 앞의 text가 검색될 수도 있으므로 전체(rs1[0]) 변경 필요 //const rs1 = exp1.exec(str) //if (rs1 != null) str = str.replace(rs1[0], "</span>")
        str = str.replace(exp2, "") //font-weight:~ 제거 //const rs2 = exp2.exec(str) //if (rs2 != null) str = str.replace(rs2[0], "") //rs2[0]는 전체이므로 바로 replace 가능
        const containerInnerText = container.innerText.replace(/\n/g, "") //예) 구름에 \"달 가듯이\" 가는 나그네\n술익는 마을마다 타는 저녁놀 하하 => \n 제거
        //containerInnerText가 strInnerText와 다른데 바로 아래 if를 타면 containerInnerText 모든 문장이 영향을 받는 것임
        //debugger
        if (strInnerText == containerInnerText && container.outerHTML.startsWith("<span maker=\"hushsbay\"")) {
            //maker="hushsbay" 태그에는 다른 속성이나 여기에서 다루는 style말고는 없음. 그러나, 다른 태그의 속성이나 스타일은 추가로 있을 수 있으므로 다루기가 까다로울 것임
            cleanGabageNode(container) //console.log("@@@@@@@"+container.innerHTML)
            if (type == "B") {
                container.style["font-weight"] = (bool) ? "normal" : "bold"
            } else if (type == "S") {
                container.style["text-decoration"] = (bool) ? "none" : "line-through"
            }
            container.innerHTML = container.innerHTML.replace(exp2, "") //전체를 적용하는 것이므로 없애도 될 것임
        } else {
            range.deleteContents()
            let node = document.createElement("span")
            node.innerHTML = str
            if (type == "B") {
                node.style["font-weight"] = (bool) ? "normal" : "bold"
            } else if (type == "S") {
                node.style["text-decoration"] = (bool) ? "none" : "line-through"
            }
            node.setAttribute("maker", "hushsbay")
            range.insertNode(node)
        }
        range.collapse(false)
        inEditor.value.focus()
        //msgbody.value = document.getElementById(editorId).innerHTML //데이터가 필요시 처리하면 됨
        return
        }
    
    async function okPopup(kind) {
        if (kind == "addlink" || kind == "makelink") {
            const regexp = new RegExp("^https?://")
            if (regexp.test(linkText.value) || regexp.test(linkUrl.value)) { //2개 필드중 하나라도 링크가 있으면 OK
                if (linkText.value.trim() == "") {
                    linkText.value = linkUrl.value.trim()
                } else if (linkUrl.value.trim() == "") {
                    linkUrl.value = linkText.value.trim()
                } else {
                    if (regexp.test(linkText.value) && !regexp.test(linkUrl.value)) {
                        gst.util.setSnack("http(s)://로 시작되는 링크가 필요합니다.", true)
                        return
                    }
                }
            } else {
                gst.util.setSnack("http(s)://로 시작되는 링크가 필요합니다.", true)
                return
            }
            if (kind == "addlink") {
                const rq = { chanid: chanId, kind: "L", body: linkText.value + gst.cons.deli + linkUrl.value }
                const res = await axios.post("/chanmsg/uploadBlob", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                linkArr.value.push({ hover: false, text: linkText.value, url: linkUrl.value, cdt: rs.data.cdt })
            } else {
                inEditor.value.focus()
                const range = restoreCursorPosition()
                let node = document.createElement('a')
                node.setAttribute("href", linkUrl.value)
                node.setAttribute("target", "_blank")
                node.style.color = "steelblue"
                node.append(linkText.value)
                range.deleteContents()
                range.insertNode(node)
                range.collapse(false)
                //msgbody.value = document.getElementById(editorId).innerHTML //데이터가 필요시 처리하면 됨
            }
            linkText.value = ""
            linkUrl.value = ""
            linkPopupRef.value.close()
        }
    }

    function openLink(url) { 
        window.open(url, "_blank") //popup not worked for 'going back' navigation
    }

    async function uploadFile(e) {
        try {
            const files = e.target.files
            if (fileBlobArr.value.length + files.length > gst.cons.uploadMaxCount) {
                gst.util.setToast("업로드 파일 갯수는 메시지별로 " + gst.cons.uploadMaxCount + "개(기존 파일 포함)까지만 가능합니다.", 5, true)
                return
            }            
            for (let i = 0; i < files.length; i++) {
                const size = files[i].size
                if (size > gst.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 파일 크기 제한은 " + hush.util.formatBytes(gst.cons.uploadLimitSize) + "입니다.\n" + files[i].name + " => " + hush.util.formatBytes(size), true)
                    return
                }
                const exist = fileBlobArr.value.filter(x => x.name == files[i].name)
                if (exist.length > 0) {
                    gst.util.setToast("이미 같은 이름의 파일이 존재합니다.\n" + files[i].name, 5, true)
                    return
                }                
            }
            uploadFileProgress.value = []
            const filesToUpload = []            
            for (let i = 0; i < files.length; i++) {
                const fd = new FormData()
                fd.append("chanid", chanId)
                fd.append("kind", "F")
                fd.append("body", files[i].name)
                fd.append("filesize", files[i].size)
                fd.append("file", files[i])
                uploadFileProgress.value.push({ name: files[i].name, size: files[i].size, percent : 0 }) //실패시 filesToUpload에 추가된 걸 빼지 않으려고 별도로 만든 것임
                const res = await axios.post("/chanmsg/uploadBlob", fd, { 
                    headers: { 
                        'Content-Type': 'multipart/form-data' 
                    }, onUploadProgress: async (e) => { //파일이 작으면 보이지도 않는데 나중에 파일시스템으로 이관하면 필요할 것임 (현재 구현 및 테스트 완료 상태임)
                        const percent = (e.loaded * 100) / e.total                        
                        uploadFileProgress.value[i].percent = Math.round(percent)
                    }
                })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                filesToUpload.push({ hover: false, name: files[i].name, size: files[i].size, cdt: rs.data.cdt })
            }
            fileBlobArr.value = [...fileBlobArr.value, ...filesToUpload]
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function downloadFile(msgid, row) { //msgid = temp or real msgid
        try {
            gst.util.downloadBlob("F", msgid, chanId, row.cdt, row.name)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function toggleAction(msgid, kind) { //toggleAction은 보안상 크게 문제없는 액션만 처리하기로 함
        try {
            
            const rq = { chanid: chanId, msgid: msgid, kind: kind }
            const res = await axios.post("/chanmsg/toggleAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            rs = await qryAction({ msgid: msgid }) //1개가 아닌 모든 kind 목록을 가져옴
            if (rs == null) return //rs = [{ KIND, CNT, NM }..] //NM은 이상병, 정일영 등으로 복수
            const item = msglist.value.find(function(row) { return row.MSGID == msgid })
            if (item) item.msgdtl = rs //해당 msgid 찾아 msgdtl을 통째로 업데이트함
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function changeAction(msgid, kind, newKind) { //changeAction은 보안상 크게 문제없는 액션만 처리하기로 함 : newKind 없으면 서버에서 kind로만 판단해 처리
        try {
            let job = ""
            if (kind == 'later' || kind == 'stored' || kind == 'finished' || kind == 'fixed') {
                job = (!newKind) ? "delete" : newKind
            }
            const rq = { chanid: chanId, msgid: msgid, kind: kind, job: job }
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            rs = await qryActionForUser({ msgid: msgid })
            if (rs == null) return
            const item = msglist.value.find(function(row) { return row.MSGID == msgid })
            if (item) {
                item.act_later = rs.act_later
                item.act_fixed = rs.act_fixed
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function blobSetting(e, row, idx, row5, idx5) { //row와 idx는 메시지 배열 항목 및 인덱스. row5와 idx5는 file,image,link의 배열 항목 및 인덱스
        gst.ctx.data.header = ""
        if (row5.KIND == "F") {
            gst.ctx.menu = [
                { nm: "에디터에 붙이기", func: function() {
                    
                }},
                { nm: "파일 삭제", color: 'red', func: function() {
                    delBlob(row5.KIND, row.MSGID, idx5, idx)
                }}
            ]
        } else if (row5.KIND == "I") { //클릭시 레이어팝업 메뉴 1) 회전 2) 줌인/줌아웃 3) 클릭시 50%/200% 4) 파일로 다운로드 5) 새창에서 열기 6) 삭제
            gst.ctx.menu = [
                { nm: "새창에서 열기", func: function() {
                    
                }},
                { nm: "파일로 다운로드", func: function() {
                    
                }},
                { nm: "이미지 복사", func: function() {
                    
                }},
                { nm: "에디터에 붙이기", func: function() {
                    
                }},
                { nm: "이미지 삭제", color: 'red', func: function() {
                    delBlob(row5.KIND, row.MSGID, idx5, idx)
                }}
            ]
        } else if (row5.KIND == "L") {
            gst.ctx.menu = [
                { nm: "URL링크 복사", func: function() {
                    
                }},
                { nm: "복사후 에디터에 붙이기", func: function() {
                    
                }},
                { nm: "링크 삭제", color: 'red', func: function() {
                    delBlob(row5.KIND, row.MSGID, idx5, idx)
                }}
            ]
        }
        gst.ctx.show(e)
    }
    
    async function test() {
        const res = await axios.post("/chanmsg/qry", { grid : grId, chanid : chanId })
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return            
        grnm.value = rs.data.chanmst.GR_NM
        channm.value = rs.data.chanmst.CHANNM
        document.title = channm.value
        msglist.value = [...msglist.value, ...rs.data.msglist]
    }
    
    ///////////////////////////////////////////////////////////////////////////##0 아래는 에디터 관련임
    //https://velog.io/@msdio/window%EC%9D%98-Selection%EA%B3%BC-range%EC%97%90-%EB%8C%80%ED%95%B4%EC%84%9C-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
    //selection 타입 : none, range, caret. range는 유저가 선택한(드래그한) 범위 / caret은 범위가 아닌 특정 위치의 커서
    //collapse : 선택된 상태에서 선택해제 (range 상태에서 caret 상태로 변경)
    //anchorNode / anchorOffset : selection이 시작되는 위치의 노드/offset을 반환. 일반 텍스트의 노드 이름은 "text"
    //focusNode / focusOffset : selection이 끝나는 위치의 노드/offset을 반환
    //anchor는 시작점, focus는 끝나는 지점을 나타냄. 드래그를 앞→뒤가 아니라 뒤→앞으로 했다면, anchor와 focus는 반대가 됨

    //B(Bold), S(Strike) 등은 팝업이 없어 cursorPos를 기억할 필요가 없으므로 editorIn과 editorBlurDt를 이용해 처리하고
    //팝업이 있어 selection을 잃어버리는 makelink(링크로변환) 등은 prevRange를 사용해야 함 (with storeCursorPosition/restoreCursorPosition)
    function storeCursorPosition() {
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) //크롬은 텍스트 드래그가 한번만 가능. 파폭은 Ctrl+드래그(윈도우)로 여러 개 범위 선택
        //cursorPos.node = range.startContainer
        //cursorPos.startOffset = range.startOffset
        //cursorPos.endOffset = range.endOffset
        prevRange = range
    }
                
    function restoreCursorPosition() {
        //let range = null //document.createRange()
        //range.setStart(cursorPos.node, cursorPos.startOffset)
        //range.setEnd(cursorPos.node, cursorPos.endOffset)
        const range = prevRange
        let selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        return range
    }

    function insertPastedToEditor(type, str) {
        let selection = window.getSelection() //현재 커서 위치나 선택한 범위를 나타냄
        if (selection.rangeCount == 0) return //이 함수가 에디터에 붙이기할 때만을 전제로 하므로 체크는 의미없으나 그대로 두기로 함 
        const range = selection.getRangeAt(0) 
        if (type == "text/html") {
            let node = document.createElement('span')
            node.innerHTML = str
            range.deleteContents()
            range.insertNode(node)
            range.collapse(false)
            inEditor.value.focus()
            //msgbody.value = document.getElementById(editorId).innerHTML //처리할 필요가 있을 때 추가하기로 함
            return true
        } else if (type == "text/plain") {
            range.deleteContents()
            range.insertNode(document.createTextNode(str))
            range.collapse(false)
            inEditor.value.focus()
            //msgbody.value = document.getElementById(editorId).innerHTML //처리할 필요가 있을 때 추가하기로 함
            return true
        } else {
            gst.util.setToast("복사/붙이기는 Text/Html/Image만 지원 가능합니다.", 3)
            return false
        }
    }

    function chkSelectionInTagFailed(tag, str) { //코딩 실패 케이스 (donotdelete)
        let currentNode = window.getSelection().focusNode
        while (currentNode && (currentNode.nodeName == '#text' || currentNode.id != editorId)) {
            if (tag == "B") { //아래는 초창기에 생각한 해법이었으나 focusNode로는 해결이 안되었음
                //결론은 selection/range내 노드는 여러개 있을 수 있으나 currentNode는 focusNode 기준이므로 한개만 추출됨
                //예) <p>구름에 "달 <b>가듯이</b>" 가는 나그네<br>술익는 마을마다 <span style="color:red;font-weight:bold">타는 저녁놀</span> 하하</p>
                //1) '저녁놀'만 선택해도 currentNode.textContent는 '타는 저녁놀' (return true)
                //2) '저녁놀</span> '을 선택하면 currentNode.textContent는 ' 하하'로 나옴 (return false)
                //3) '마을마다 <span style="color:red;font-weight:bold">타는 저녁놀'을 선택하면 currentNode.textContent는 '타는 저녁놀' (return true)
                //4) '마다 <span style="color:red;font-weight:bold">타는 저녁놀</span> 하하'을 선택하면 currentNode.textContent는 '술익는 마을마다' (return false)
                //결국은 selection의 방향에도 영향 받아서 마지막 커서를 뗀 그 때의 노드가 추출됨 (텍스트 역시 해당 노드의 텍스트임)
                //그래서, 사용자 기준으로는 본인이 선택한 곳에 분명히 굵게 표시된 2)의 경우도 이 코딩으로는 '하하'로 볼드체가 아니므로 문제 있음
                //그러나, 다시 생각해보니, 이 focusNode 기준으로 볼드체인지 아닌지만 판단해서 리턴해도 무방할 것으로 보이며
                //다른 웹에디터도 그리 판단할 거라 보여짐. 다만 아래 remove()는 막고 다른 방안을 모색해야 할 것으로 판단됨
                //=> 이 함수는 오로지 마지막 커서 기준으로 tag에 속하는지 알아보는 것으로만 사용하기                
                if (currentNode.tagName === tag || currentNode.tagName === "STRONG" || 
                    (currentNode.style && currentNode.style["font-weight"] === "bold")) { //#text인 경우는 .style 없음
                    if (!hush.util.isvoid(str)) {
                        let idxFound = 1
                        const arr = currentNode.textContent.split(str), brr = [] //arr length는 무조건 2 (str은 빠지므로)
                        brr.push(arr[0])
                        brr.push(str) //str => idxFound = 1
                        brr.push(arr[1])
                        for (let i = 0; i < brr.length; i++) { //https://andreiglingeanu.me/rename-element-tag/
                            if (brr[i] == "") continue
                            const ele = document.createElement("SPAN") //태그 이름만 변경하기 (속성은 모두 복사)
                            if (i != idxFound) {
                                [...currentNode.attributes].map(({ name, value }) => {
                                    ele.setAttribute(name, value)
                                })
                            } else {
                                [...currentNode.attributes].map(({ name, value }) => {
                                    ele.setAttribute(name, value)
                                })
                                ele.style["font-weight"] = "normal"
                            }
                            ele.textContent = brr[i]
                            currentNode.parentNode.insertBefore(ele, currentNode)
                        }
                        currentNode.remove()
                    }
                    return true
                }
            } else if (tag == "S") {
            }
            currentNode = currentNode.parentNode		
        }
        return false
    }

    function chkCurTagType(currentNode, type) {
        while (currentNode && currentNode.id != editorId) {
            if (type == "B") {
                if (currentNode.tagName == type || currentNode.tagName == "STRONG" || (currentNode.style && currentNode.style["font-weight"] === "bold")) {
                    return true
                } else if (currentNode.style && currentNode.style["font-weight"] && currentNode.style["font-weight"] != "bold") {
                    return false
                }
            } else if (type == "S") {
                if (currentNode.tagName == type || (currentNode.style && currentNode.style["text-decoration"] === "line-through")) {
                    return true
                } else if (currentNode.style && currentNode.style["text-decoration"] && currentNode.style["text-decoration"] != "text-decoration") {
                    return false
                }
            }
            currentNode = currentNode.parentNode
        }
        return false
    }

    function htmlView() {
        showHtml.value = true
        msgbody.value = document.getElementById(editorId).innerHTML
    }
</script>

<template>
    <div class="chan_center" :style="{ width: widthChanCenter }">
        <div class="chan_center_header">
            <div class="chan_center_header_left">
                <img v-if="!hasProp()" class="coImg18" :src="gst.html.getImageUrl(chanimg)" style="margin-right:5px">
                <div v-if="!hasProp()" class="coDotDot maintainContextMenu" @click="chanCtxMenu">{{ channm }} [{{ grnm }}] {{ chanId }}</div>
                <div v-if="hasProp()" style="margin-right:5px">스레드</div>
            </div>
            <div class="chan_center_header_right">
                <div v-if="!hasProp()" class="topMenu" style="padding:3px;display:flex;align-items:center;border:1px solid lightgray;border-radius:5px;font-weight:bold"
                    @click="chanProperty('member')">
                    <div v-for="(row, idx) in chanmemUnder" style="width:24px;height:24px;display:flex;align-items:center;margin-right:2px">
                        <img v-if="row.url" :src="row.url" style='width:100%;height:100%;border-radius:12px'>
                        <img v-else :src="gst.html.getImageUrl('user.png')" style='width:100%;height:100%'>
                    </div>
                    <span>{{ chandtl.length }}</span>
                </div>
                <div v-if="!hasProp()" class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                    <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click="chanCtxMenu">
                </div>
                <div v-if="hasProp()" class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                    <img class="coImg24" :src="gst.html.getImageUrl('close.png')" @click="() => evClick({ type: 'close' })">
                </div>
            </div>
        </div>
        <div v-if="!hasProp()" class="chan_center_nav">
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px 5px 0;border-bottom:3px solid black;border-radius:0" @click="chanMsg('M')">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                <span style="margin-left:5px;font-weight:bold">메시지</span> 
            </div>
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px" @click="chanMsg('F')">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_file.png')">
                <span style="margin-left:5px">파일</span> 
            </div>
        </div> 
        <div class="chan_center_body" id="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
            <div v-for="(row, idx) in msglist" :id="row.MSGID" class="msg_body procMenu"  
                :style="{ borderBottom: row.hasSticker ? '' : '1px solid lightgray', background: row.background ? row.background : '' }"
                @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                <div style="display:flex;align-items:center;cursor:pointer" v-show="!row.stickToPrev">
                    <img v-if="chandtlObj[row.AUTHORID] && chandtlObj[row.AUTHORID].url" :src="chandtlObj[row.AUTHORID].url" 
                        class="coImg32 maintainContextMenu" style="border-radius:16px" @click="(e) => memProfile(e, row)">
                    <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg32 maintainContextMenu" @click="(e) => memProfile(e, row)">
                    <span style="margin-left:9px;font-weight:bold">{{ row.AUTHORNM }}</span>
                    <span style="margin-left:9px;color:dimgray">{{ hush.util.displayDt(row.CDT) }}</span>
                </div>
                <div style="width:100%;display:flex;margin:10px 0">
                    <div style="width:40px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:dimgray;cursor:pointer">
                        <span v-show="row.stickToPrev && row.hover">{{ hush.util.displayDt(row.CDT, true) }}</span>
                        <img v-if="row.act_later=='later'" class="coImg18"  style="margin-top:5px" :src="gst.html.getImageUrl('violet_later.png')" title="나중에">
                        <img v-if="row.act_fixed=='fixed'" class="coImg18"  style="margin-top:5px" :src="gst.html.getImageUrl('violet_fixed.png')" title="고정">
                    </div>
                    <div v-html="row.BODY" @copy="(e) => msgCopied(e)" style=""></div>
                </div>
                <div v-if="row.UDT" style="margin-bottom:10px;margin-left:40px;color:dimgray"><span>(편집: </span><span>{{ row.UDT.substring(0, 19) }})</span></div>
                <div class="msg_body_sub"><!-- 반응, 댓글 -->
                    <div v-for="(row1, idx1) in row.msgdtl" class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM" @click="toggleAction(row.MSGID, row1.KIND)">
                        <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                        <span style="margin-left:3px">{{ row1.CNT}}</span>
                    </div>
                    <div v-if="row.msgdtl.length > 0" class="msg_body_sub1">
                        <img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘">
                    </div>     
                    <div v-if="row.reply.length > 0" class="replyAct" @click="openThread(row.MSGID)">
                        <div v-for="(row2, idx2) in row.reply" style="margin-right:0px;padding:0px;display:flex;align-items:center">
                            <img v-if="chandtlObj[row2.AUTHORID] && chandtlObj[row2.AUTHORID].url" :src="chandtlObj[row2.AUTHORID].url" 
                                class="coImg18" style="border-radius:9px">
                            <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg18">
                        </div>
                        <div v-if="row.reply.length < row.replyinfo[0].CNT_BY_USER" style="display:flex;align-items:center;margin-left:2px">
                            ..{{ row.replyinfo[0].CNT_BY_USER }}명
                        </div>
                        <div style="margin:0 5px;display:flex;align-items:center">
                            <span style="margin-right:4px;color:steelblue;font-weight:bold">댓글 </span>
                            <span style="color:steelblue;font-weight:bold">{{ row.replyinfo[0].CNT_EACH }}개</span>
                            <span style="margin:0 4px;color:dimgray">최근 :</span>
                            <span style="color:dimgray">{{ hush.util.displayDt(row.replyinfo[0].CDT_MAX) }}</span>
                        </div>
                    </div>
                </div>
                <div v-if="row.msgimg.length > 0" class="msg_body_sub"><!-- 이미지 -->
                    <div v-for="(row5, idx5) in row.msgimg" class="msg_image_each" 
                        @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="showImage(row5, row.MSGID)">
                        <img :src="row5.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row5)">
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                        </div>
                    </div>                
                </div>
                <div v-if="row.msgfile.length > 0" class="msg_body_sub"><!-- 파일 -->
                    <div v-for="(row5, idx5) in row.msgfile" class="msg_file_each" 
                        @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="downloadFile(row.MSGID, row5)">
                        <div style="height:100%;display:flex;align-items:center">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_download.png')">
                            <span style="margin:0 3px">{{ row5.name }}</span>(<span>{{ hush.util.formatBytes(row5.size) }}</span>)
                        </div>
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                        </div>
                    </div>
                </div>
                <div v-if="row.msglink.length > 0" class="msg_body_sub"><!-- 링크 -->
                    <div v-for="(row5, idx5) in row.msglink" class="msg_file_each"
                        @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="openLink(row5.url)">
                        <div style="height:100%;display:flex;align-items:center">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_addlink.png')">
                            <span style="margin:0 3px;color:#005192">{{ row5.text }}</span>
                        </div>
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                        </div>
                    </div>
                </div>
                <div v-show="row.hover" class="msg_proc">
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_watching.png')" title="알아보는중" @click="toggleAction(row.MSGID, 'watching')"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_checked.png')" title="접수완료" @click="toggleAction(row.MSGID, 'checked')"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_done.png')" title="완료" @click="toggleAction(row.MSGID, 'done')"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘" @click="openEmoti(row.MSGID)"></span>
                    <span v-if="!hasProp()" class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드열기" @click="openThread(row.MSGID)"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달" @click="forwardMsg(row.MSGID)"></span>
                    <span class="procAct">
                        <img class="coImg18" :src="gst.html.getImageUrl(!row.act_later ? 'dimgray_later.png' : 'violet_later.png')" title="나중에" @click="changeAction(row.MSGID, 'later')">
                    </span>
                    <span class="procAct">
                        <img class="coImg18" :src="gst.html.getImageUrl(!row.act_fixed ? 'dimgray_fixed.png' : 'violet_fixed.png')" title="고정" @click="changeAction(row.MSGID, 'fixed')">
                    </span>
                    <span class="procAct">
                        <img class="coImg18 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기" @click="(e) => rowRight(e, row)">
                    </span>                    
                </div>
            </div>
        </div>
        <div class="chan_center_footer">
            <div class="editor_header">
                <div v-if="editMsgId" style="margin-left:10px;display:flex;align-items:center">
                    <div class="btn" @click="saveMsg" style="margin-right:10px">저장</div>
                    <div class="btn" @click="cancelMsg">취소</div>
                </div>
                <div v-else class="saveMenu" @click="saveMsg">
                    <img class="coImg20" :src="gst.html.getImageUrl('white_send.png')" title="발송">
                </div>
                <img v-if="!editMsgId" class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_addlink.png')" 
                    title="링크추가" @click="uploadLink('addlink')">
                <span v-if="hasProp()">
                    <input v-if="!editMsgId" id="file_upload_prop" type=file multiple hidden @change="uploadFile" />
                    <label v-if="!editMsgId" for="file_upload_prop">
                        <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일추가">
                    </label>
                </span>
                <span v-else>
                    <input v-if="!editMsgId" id="file_upload" type=file multiple hidden @change="uploadFile" />
                    <label v-if="!editMsgId" for="file_upload">
                        <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일추가">
                    </label>
                </span>
                <div style="width:8px;height:20px;margin-left:12px;border-left:1px solid dimgray"></div>
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘추가" 
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="addEmoti()">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_makelink.png')" title="링크로변환"
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="makeLink()">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_bold.png')" title="굵게"
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="wordStyle('B')">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_strike.png')" title="취소"
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="wordStyle('S')">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_html.png')" title="HTMLView" 
                    @click="htmlView()"><!--개발자사용-->
            </div>
            <div v-if="hasProp()" id="msgContent_prop" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" ref="editorRef" 
                @paste="pasteData" @keyup.enter="keyUpEnter" @focusin="editorFocused(true)" @blur="editorFocused(false)">
            </div>
            <div v-else id="msgContent" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" ref="editorRef" 
                @paste="pasteData" @keyup.enter="keyUpEnter" @focusin="editorFocused(true)" @blur="editorFocused(false)">
            </div>
            <div v-if="showHtml" class="editor_body" style="background:beige">{{ msgbody }}</div>
            <div v-if="imgBlobArr.length > 0 && !editMsgId" class="msg_body_blob">
                <div v-for="(row, idx) in imgBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="showImage(row, 'temp')" class="msg_image_each">
                    <img :src="row.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row)">
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('I', 'temp', idx)">
                    </div>
                </div>                
            </div>
            <div v-if="fileBlobArr.length > 0 && !editMsgId" class="msg_body_blob">
                <div v-for="(row, idx) in fileBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="downloadFile('temp', row)" class="msg_file_each">
                    <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ hush.util.formatBytes(row.size) }}</span>)</div>
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('F', 'temp', idx)">
                    </div>
                </div><!-- 아래 진행바는 db에 파일저장시엔 용량제한이 있으므로 실제 육안으로는 보이지 않고 파일시스템 저장 적용시 대용량에 한해서 보이게 될 것임 -->
                <div v-for="(row, idx) in uploadFileProgress" v-show="row.percent > 0 && row.percent < 100" class="msg_file_each">
                    <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ row.size }}</span>)</div>
                    <div class="msg_file_seemore">
                        <span style="padding:0 5px;color:red">{{ row.percent }}%</span>
                    </div>
                </div>
            </div>
            <div v-if="linkArr.length > 0 && !editMsgId" class="msg_body_blob">
                <div v-for="(row, idx) in linkArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="openLink(row.url)" class="msg_file_each">
                    <div><span style="margin-right:3px;color:#005192">{{ row.text }}</span></div>
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('L', 'temp', idx)">
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="chan_right" v-if="thread.msgid":style="{ width: widthChanRight }">
        <home-body :data="thread" @ev-click="clickFromProp" ></home-body>
    </div>   
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
    <popup-image ref="imgPopupRef" :param="imgParam">
        <img :src="imgPopupUrl" :style='imgPopupStyle'>
    </popup-image>
    <popup-common ref="linkPopupRef" :kind="popupRefKind" @ev-click="okPopup">
        <div style="display:flex;flex-direction:column">
            <input v-model="linkText" style="width:300px;height:24px;border:1px solid dimgray" placeholder="표시 텍스트" />
            <input v-model="linkUrl" style="width:300px;height:24px;margin-top:15px;border:1px solid dimgray" placeholder="링크 http(s)://" />
            <!-- <span style="margin-top:10px;color:dimgray">링크를 한 필드에만 넣어도 됩니다.</span> -->
        </div>
    </popup-common>
</template>

<style scoped>    
    .chan_center {
        height:100%;padding: 0 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;justify-content:space-between;overflow:hidden
    }
    .chan_center_header_left {
        width:50%;height:100%;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:50%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .chan_center_nav {
        width:100%;min-height:30px;display:flex;align-items:center;
        border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        position:relative;display:flex;flex-direction:column;margin:5px 0 0 0;
    }
    .msg_body_sub {
        display:flex;margin:0 0 0 40px;display:flex;flex-wrap:wrap;justify-content:flex-start;cursor:pointer
    }
    .msg_body_sub1 {
        margin-right:10px;padding:4px 8px;display:flex;align-items:center;background:#e6e7eb;border:1px solid #e6e7eb;border-radius:12px
    }
    .msg_body_sub1:hover {
        background:whitesmoke;border:1px solid dimgray
    }
    .msg_body_sub1:active {
        background:lightsteelblue;border:1px solid lightsteelblue
    }
    .msg_body_blob {
        margin-bottom:5px;padding-left:8px;display:flex;flex-wrap:wrap;justify-content:flex-start
    }
    .msg_file_each {
        position:relative;min-width:100px;height:30px;margin:10px 10px 0 0;padding:0 5px;display:flex;align-items:center;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_file_each:active { background:lightsteelblue }
    .msg_file_seemore {
        position:absolute;top:0;right:0;padding:0 3px;height:30px;display:flex;align-items:center;background:whitesmoke;border-radius:0px
    }
    .msg_file_del {
        position:absolute;top:-10px;right:-10px;width:18px;height:18px;border-radius:9px;display:flex;align-items:center;background:beige
    }
    .msg_image_each {
        position:relative;width:80px;height:80px;margin:10px 10px 0 0;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_proc {
        position:absolute;height:20px;right:3px;top:1px;padding:5px 0 5px 10px;z-index:8888;
        display:flex;align-items:center;
        background:white;border:1px solid lightgray;border-radius:5px
    }
    .chan_center_footer {
        width:100%;margin:auto 0 10px 0;
        display:flex;flex-direction:column;
        border:1px solid lightgray;border-radius:5px;
    }
    .editor_header {
        width:100%;height:40px;display:flex;align-items:center;overflow-x:hidden;background:whitesmoke;
    }
    .editor_body {
        width:calc(100% - 10px);min-height:40px;max-height:300px;padding:5px;overflow-y:scroll
    }
    .chan_right {
        height:100%;border-left:1px solid var(--second-color); /* 여기에 다시 HomeBody.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
    }
    .topMenu { border-radius:5px;cursor:pointer }
    .topMenu:hover { background:whitesmoke;font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .replyAct { display:flex;align-items:center;cursor:pointer }
    .replyAct:hover { background:#e6e7eb;border-radius:12px }
    .replyAct:active { background:var(--active-color) }
    .procMenu { padding:5px;margin-right:10px;border-radius:5px;cursor:text }
    .procMenu:hover { background:whitesmoke }
    .procAct { padding:4px;margin-right:10px;border-radius:5px;background:white;cursor:pointer }
    .procAct:hover { background:lightgray }
    .procAct:active { background:var(--active-color) }
    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .editorMenu:active { background:var(--active-color) }
    .saveMenu { display:flex;align-items:center;padding:5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px }
    .saveMenu:hover { opacity:0.5 }
    .saveMenu:active { background:darkblue;opacity:1.0 }
    .btn { padding:3px 6px;display:flex;align-items:center;color:dimgray;border:1px solid dimgray;border-radius:5px;cursor:pointer }
    .btn:hover { background:lightgray}
    .btn:active { background:var(--active-color)}
</style>
