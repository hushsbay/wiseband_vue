<script setup>
    import { ref, onMounted, nextTick, useTemplateRef, onActivated, onUnmounted } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import PopupImage from "/src/components/PopupImage.vue"
    import PopupCommon from "/src/components/PopupCommon.vue"
    import PopupChanDm from "/src/components/PopupChanDm.vue"
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import MediaSearch from "/src/components/MediaSearch.vue"
            
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    //ev-click    : MsgList -> MsgList
    //ev-to-panel : MsgList -> Panel(Later, Dm..) : 가능하면 스토어에서 처리하나 element를 다루는 내용 + MsgList(Parent만) 경우는 ev-to-panel 호출 (처리해보니까 더 편리함)
    const emits = defineEmits(["ev-click", "ev-to-panel"])

    /////////////////////////////////////////////////////////////////////////////////////
    //1) 왼쪽 Panel -> MsgList 2) MsgList(부모) -> MsgList(자식)
    //프로젝트에서의 컴포넌트간의 호출은 GeneralStore.js 상단에 정리해 두었음

    defineExpose({ procFromParent })

    async function procFromParent(kind, obj) {
        if ((kind == "later" || kind == "fixed") && obj.work == "delete") {
            const msgid = (obj.msgid == obj.msgidParent) ? obj.msgid : obj.msgidParent //댓글인 경우는 부모 아이디
            const row = msglist.value.find((item) => item.MSGID == msgid)
            if (row) { //자식에 later, fixed 처리되어 있고 부모는 색상만 리셋하면 되나 여기 어차피 null이니 이 부분도 처리해서 공통화시킴
                if (kind == "later") row.act_later = null
                if (kind == "fixed") row.act_fixed = null
            }
            if (obj.msgid != obj.msgidParent) { //스레드댓글 패널 열려 있으면 전달해서 거기서 자식의 later, fixed를 제거해야 함 (MsgList에서 MsgList에게 전달)
                if (msglistRef.value) msglistRef.value.procFromParent(kind, { msgid: obj.msgid, msgidParent: obj.msgid, work: "delete" })
            }
        } else if (kind == "refreshMsg") {
            const rs = await getMsg({ msgid: obj.msgid })
            if (rs == null) return
            refreshWithGetMsg(rs, obj.msgid)
        } else if (kind == "deleteMsg") {
            const idx = msglist.value.findIndex((item) => item.MSGID == obj.msgid)
            if (idx > -1) msglist.value.splice(idx, 1)
        } else if (kind == "forwardToBody") { //from HomePanel or DmPanel
            const res = await axios.post("/chanmsg/qryChanMstDtl", { chanid: chanId })
            const rs = gst.util.chkAxiosCode(res.data, true) //오류시 No Action 
            if (!rs) return
            setChanMstDtl(rs.data.chanmst, rs.data.chandtl)
        }
    }

    /////////////////////////////////////////////////////////////////////////////////////
    //스레드(댓글) 관련 : 부모 MsgList와 자식 MsgList가 혼용되어 코딩되어 있으므로
    //네이밍 규칙을 정해서, thread라는 단어가 들어가면 거의 부모 / prop이라는 단어가 들어가면 거의 자식
    //부모,자식 동시에 떠 있는 경우 문제되는 element는 파일업로드(file_upload)와 웹에디터(msgContent) 2개인데 hasProp() 맟 childbody로 구분해 사용
    
    const props = defineProps({ data: Object }) //자식에서만 사용 : props update 문제 유의

    //const hasProp = computed(() => { if (props.data && props.data.msgid) return true; return false; }) //값이 변할때만 계산하므로 효율적이나
    //computed대신 바로 아래 함수 사용. computed는 템플리트 밖<script setup>에선 반드시 true/false로만 비교해야 함. if (hasProp)으로 비교하면 안됨
    function hasProp() { //props 사용하는 것은 자식이므로 hasProp으로 명명. 위 computed 이용해 처리하고자 했으나 동작 이상 포기 : 캐싱없이 매번 계산하나 이 함수 사용
        if (props.data && props.data.msgid) return true //자식이 열린 상태임을 의미
        return false
    }

    const msglistRef = ref(null) //MsgList(부모)가 MsgList(자식)의 procFromParent()를 호출하기 위함
    let listMsgSel = ref('all')
    let thread = ref({ msgid: null, msgidChild: null }) //부모에서만 사용 (컴포넌트에서 자식에게 data로 전달함)
    const editorId = hasProp() ? "msgContent_prop" : "msgContent"

    function openThread(msgid, msgidChild) { //부모에서만 사용. 라우터로 열지 않고 컴포넌트로 바로 열기
        if (hasProp()) return
        if (thread.value.msgid) {
            thread.value.msgid = null //메시지아이디를 null로 해서 자식에게 close하라고 전달하는 것임
            setWidthForThread(null, "close")            
        }
        thread.value.msgid = msgid //메시지아이디를 전달해 자식에게 화면을 open하라고 전달하는 것임
        thread.value.msgidChild = msgidChild //부모 아래 있는 댓글아이디를 찾을 때만 사용)
        setWidthForThread()
    }

    async function clickFromProp(obj) { //부모에서만 사용. 자식에게서 전달받아 이벤트 처리하는 것임
        if (obj.type == "close") {
            thread.value.msgid = null //메시지아이디를 null로 해서 자식에게 close하라고 전달하는 것임
            setWidthForThread(null, obj.type)
        } else if (obj.type == "refreshFromReply") {
            const rs = await getMsg({ msgid: obj.msgid }, true)
            if (rs == null) return
            refreshWithGetMsg(rs, obj.msgid)
        }
    }

    function setWidthForThread(openWith, type) { //openWith : 향후 마우스 드래그나 버튼 방식으로 넓이 조정 가능하도록 하기 위함
        if (type == "close") {
            widthChanRight.value = '0px'
            widthChanCenter.value = 'calc(100% - 20px)'            
        } else {
            if (openWith) {
                //위 설명 참조
            } else {
                widthChanRight.value = '500px'
                widthChanCenter.value = 'calc(100% - 520px)'                
            }
        }
    }

    function setBasicInfoInProp() {
        if (route.params.chanid) {
            chanId = route.params.chanid
        }
        if (props.data.msgid) { //route가 아님을 유의
            msgidInChan = props.data.msgid //댓글의 msgid일 수도 있음
        }
    }

    function evClick(obj) { //자식에서만 사용됨
        emits('ev-click', obj)
    }

    /////////////////////////////////////////////////////////////////////////////////////
    
    function evToPanel(param) { //말 그대로 패널에게 호출하는 것임 (자식에게 하는 것이 아님)
        emits("ev-to-panel", param)
    }

    let observerTop = ref(null), observerTopTarget = ref(null), observerBottom = ref(null), observerBottomTarget = ref(null)
    let afterScrolled = ref(false)

    const MAX_PICTURE_CNT = 10, adminShowID = ref(false)
    const g_userid = gst.auth.getCookie("userid"), g_usernm = gst.auth.getCookie("usernm")
    let mounting = true, appType
    
    let widthChanCenter = ref('calc(100% - 20px)')
    let widthChanRight = ref('0px') //MsgList가 부모나 자식상태 모두 기본적으로 가지고 있을 넓이
    const scrollArea = ref(null), msgRow = ref({}) //msgRow는 element를 동적으로 할당

    let popupRefKind = ref('') //아래 ~PopupRef의 종류 설정
    const imgPopupRef = ref(null), imgParam = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련
    const linkPopupRef = ref(null), linkText = ref(''), linkUrl = ref('')
    const mediaPopupRef = ref(null), popupChanDmRef = ref(null)
        
    let subTitle = ''
    let sideMenu, chanId, msgidInChan, STATE_NODATA = "nodata"
    let grnm = ref(''), chanNm = ref(''), chanMasterId = ref(''), chanMasterNm = ref(''), chanImg = ref(''), vipStr = ref(''), pageData = ref('')
    let chandtl = ref([]), chanmemUnder = ref([]), chandtlObj = ref({}), chanmemFullExceptMe = ref([])
    let msglist = ref([]), fetchByScrollEnd = ref(false)

    let editMsgId = ref(''), prevEditData = "", showHtml = ref(false)
    let msgbody = ref("") //ref("<p>구름에 \"달 <B>가듯이</B>\" 가는 나그네<br>술익는 마을마다 <span style='color:red;font-weight:bold'>타는 저녁놀</span>하하</p>")
    let uploadFileProgress = ref([]), uploadImageProgress = ref([]) //파일, 이미지 업로드시 진행바 표시 (현재는 용량 작게 제한하므로 거의 보이지도 않음)
    let linkArr = ref([]), fileBlobArr = ref([]), imgBlobArr = ref([]) //파일객체(ReadOnly)가 아님. hover 속성 등 추가 관리 가능

    let savPrevMsgMstCdt = hush.cons.cdtAtLast //가장 큰 일시(9999-99-99)로부터 시작해서 스크롤이 올라갈 때마다 점점 이전의 작은 일시가 저장됨
    let savNextMsgMstCdt = hush.cons.cdtAtFirst //가장 작은 일시(1111-11-11)로부터 시작해서 스크롤이 내려갈 때마다 점점 다음의 큰 일시가 저장됨   
    let onGoingGetList = false, prevScrollY, prevScrollHeight //, getAlsoWhenDown = ""

    const popupChanDmOn = ref(false), listPopupChanDm = ref([]), dataPopupChanDm = ref({})

    //dm 보내기 (신규)
    let showUserSearch = ref(false), userSearchedRef = useTemplateRef('userSearchedRef')
    let userSearched = ref([]), userAdded = ref([]), dmChanIdAlready = ref('')
    let searchInput = ref('searchInput'), searchedResultTop = ref(85)
    let searchUser = '', searchText = ref('') //keyup 이벤트의 한글 문제때문에 searchuser 사용(현재는 keyup마다 axios호출안함). searchText는 procClearSearch에만 사용

    //실시간 반영
    let logdt = '', perLastCdt = '', realLastCdt = ''

    //##0 웹에디터 https://ko.javascript.info/selection-range
    //https://velog.io/@longroadhome/%EB%AA%A8%EB%8D%98JS-%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80-Range%EC%99%80-Selection
    //https://stefan.petrov.ro/inserting-an-element-at-cursor-position-in-a-content-editable-div/ => 목적이 다르고 헛점도 많이 보이지만 참고할 만한 내용도 많음
    //아래 변수는 storeCursorPosition()의 주석 참조
    let prevRange //let cursorPos = { node: null, startOffset: 0, endOffset: 0 } curPos 말고 prevRange로 기억하면 훨씬 간편해서 막음 (코딩은 그대로 둠)
    let editorIn = ref(false), editorBlurDt = Date.now()
    let inEditor = useTemplateRef('editorRef') //editor = document.getElementById(editorId) editor 대신 inEditor (템플릿 참조) 사용

    /* 라우팅 관련 정리 : 현재는 부모(Main) > 자식(각종Panel) > 손자(MsgList) 구조임 
       - 스레드(댓글)용으로 손자안에 동일한 손자(MsgList)가 있는데 그건 컴포넌트로 바로 처리 (라우팅 아님)
    1. HomePanel.vue에서 <router-view />를 사용하면 그 자식인 여기 MsgList.vue가 한번만 마운트되고 그 다음에 router.push해도 다시 마운트(아예 호출도) 안됨 : onMounted가 한번만 호출되고 끝
    2. 그런데, <router-view :key="$route.fullPath"></router-view>와 같이 :key속성을 사용하면 router.push할 때마다 다시 마운트됨
    3. 그런데, Main.vue에서도 :key를 사용하면 HomePanel.vue에서 router.push할 때에도 Main.vue의 onMounted가 호출되어 문제가 됨
    4. 따라서, 현재 구조에서는 여기 손자인 MsgList.vue를 호출하는 자식인 HomePanel.vue에서만 :key를 적용하면 슬랙과 똑같이 채널노드를 클릭할 때마다 라우팅되도록 할 수 있음
       - 만일 손자 아래 증손자가 필요하고 그것도 라우팅으로 처리하려면 매우 복잡한 핸들링이 필요하므로
       - 아예 증손자는 만들지 말든지 아니면 만들어도 라우팅 아닌 컴포넌트 호출(또는 비동기로 defineAsyncComponent)하기로 함
    5. keepalive때문에 back()시 이전에 열었던 채널 상태 복원되나, 이전 스크롤위치는 구현 필요

    <keep-alive> 구현시
    1. App.vue, HomePanel.vue, MsgList.vue 모두 아래와 같이 구현하니 잘되나 안되는 부분도 다음 항목처럼 발생 (해결 필요)
        <router-view v-slot="{ Component }">
            <keep-alive>
                <component :is="Component" :key="$route.fullPath" /> :key속성을 router-view가 아닌 이 행에 Component에 넣어야 잘 동작함
            </keep-alive>
        </router-view>
    2. 위에서 안되는 부분
       1) login후 /main에서 멈춤 (화면 블랭크) 2) 채널 클릭시 펼쳐진 다른 그룹은 접혀짐 3) back()시 노드 선택 색상이 안움직이는데 변경 필요
    3. 제일 중요한 부분은 채널 클릭시 MsgList.vue의 onMounted()가 여러번 누적적으로 증가 실행되어, named view로 해결 글도 있긴 한데 구조적으로 어려워,
       App.vue, HomePanel.vue는 기존대로 <router-view />로 다시 돌리고, MsgList.vue만 <keep-alive 위처럼 적용하니 일단 누적/중복호출은 없어져서
       이 환경을 기본으로 문제들을 해결해 나가기로 함 (데이터 가져오기는 <keep-alive>가 지켜주나 스크롤포지션은 안지켜주는데 그 부분은 코딩으로 해결하면 됨)
       1) back()시 노드 선택 색상이 안움직이는데 변경 필요 - router.beforeEach((to, from)로 해결 완료
    4. 채널내 라우팅은 해결했으나 홈 >> DM >> Back()시 MsgList.vue의 상태 복원은 안되고 있음. :key="$route.fullPath" 제거후 누적/중복호출 해결. 상태 복원도 잘 됨
       1) 홈 >> DM >> Back()시 Main.vue의 홈 선택 복원은 안되고 있음 : router.beforeEach((to, from)로 해결 완료
       2) 홈 클릭시 MsgList.vue 블랭크 페이지 나옴 해결 필요 (이미 히스토리에 있으므로 안나오는데 슬랙은 그 상태로 다시 보여줌) : gst.selSideMenuTimeTag로 해결 완료
    5. 결론적으로, App.vue, Main.vue, HomePanel.vue에 있는 <router-view>의 모습이 각각 다르며 
       router의 index.js와 각 watch 메소드를 이용해 Back() 또는 기존 URL 클릭시 캐시를 부르거나 상태복원하는 것으로 구현 완료함 */

    const observerTopScroll = () => { //위로 스크롤하는 경우
        observerTop.value = new IntersectionObserver(async (entry) => {
            if (entry[0].isIntersecting) {
                await getList({ prevMsgMstCdt: savPrevMsgMstCdt })
            } else {
                return
            }
        }) //아래 observerTopTarget이 null로 나와서 오류 발생하는 것은 ##34처럼 vipStr에 데이터 담을 때 오류가 발생해 멈췄기 때문에 
        observerTop.value.observe(observerTopTarget.value) //observerTopTarget 랜더링까지 실행이 되지 않아 발생하는 것일 수 있음
    }

    const observerBottomScroll = () => { //아래로 스크롤하는 경우
        observerBottom.value = new IntersectionObserver(async (entry) => {
            if (entry[0].isIntersecting) {
                await getList({ nextMsgMstCdt: savNextMsgMstCdt })
            } else {
                return
            }
        })
        observerBottom.value.observe(observerBottomTarget.value)
    }

    let tempInfo = ref([])
    async function chkDataLog() {
        try {
            const res = await axios.post("/chanmsg/qryDataLog", { logdt : logdt, kind: "msg", chanid: chanId })
            const rs = gst.util.chkAxiosCode(res.data, true)
            const arr = rs.list
            const len = arr.length
            if (len > 0) {
                //debugger
                let msgidFrom = ""
                for (let i = 0; i < len; i++) {
                    const row = arr[i]
                    if (row.CUD == "C") {
                        msgidFrom = row.MSGID
                        break
                    }
                }
                if (msgidFrom != "") {
                    //qry()로 데이터 끝까지 읽어와서

                    if (perLastCdt < realLastCdt) {
                        //정보로 쌓아두기 (갯수 추가 등)
                    } else { //리얼타임으로 화면에 바로 반영해도 됨 (배열에 추가)

                    }
                    await nextTick() //배열추가된 부분이므로 동기 처리 필요
                }
                for (let i = 0; i < len; i++) {
                    const row = arr[i]
                    if (row.CUD == "U") { //U일 경우는 서버로부터 이미 업데이트된 데이터를 가져온 상태임 (row.msgItem)
                        //그러나, polling이 아닌 소켓 적용시에는 getMsg()로 호출하기로 함
                        tempInfo.value.push({ kind: "U", msgid: row.MSGID })
                        const parentMsgid = (row.REPLYTO != "" && row.REPLYTO != row.MSGID) ? row.REPLYTO : row.MSGID
                        const idx = gst.util.getKeyIndex(msgRow, parentMsgid) //부모아이디로 찾으면 됨
                        if (idx > -1) {
                            if (row.REPLYTO != "" && row.REPLYTO != row.MSGID) {
                                 //MSGID가 댓글 아이디임
                            } else { //부모글
                                refreshWithGetMsg(row.msgItem.data, null, idx)
                            }
                            if (msglistRef.value) msglistRef.value.procFromParent("refreshMsg", { msgid: row.MSGID })
                            //await nextTick() //배열업데이트된 부분이므로 동기 처리 필요
                        }
                    }
                }
                for (let i = 0; i < len; i++) { //C->U->D 순서로 처리하기 (타임라인 : 만들고 삭제는 있을 수 있음. 만들고 업데이트하고 삭제도 있을 수 있음)
                    const row = arr[i]
                    if (row.CUD == "D") { //서버 읽을 필요없이 바로 배열에서 제거하면 됨
                        tempInfo.value.push({ kind: "D", msgid: row.MSGID })
                        const parentMsgid = (row.REPLYTO != "" && row.REPLYTO != row.MSGID) ? row.REPLYTO : row.MSGID
                        const idx = gst.util.getKeyIndex(msgRow, parentMsgid) //부모아이디로 찾으면 됨
                        if (idx > -1) { //처리한 화면에서는 이미 지워서 화면에 없을 것임 (-1)
                            if (row.REPLYTO != "" && row.REPLYTO != row.MSGID) { //MSGID가 댓글 아이디임
                                refreshWithGetMsg(row.msgItem.data, null, idx) 
                                if (msglistRef.value) {
                                    msglistRef.value.procFromParent("refreshMsg", { msgid: parentMsgid })
                                    msglistRef.value.procFromParent("deleteMsg", { msgid: row.MSGID })
                                }
                            } else { //부모글
                                msglist.value.splice(idx, 1) //const item = msglist.value[idx]
                                clickFromProp({ type: "close" }) //부모글이 삭제된다는 것은 자식글이 없으므로 닫아도 된다는 것임 
                            }
                            await nextTick() //배열삭제된 부분이므로 동기 처리 필요
                        }
                    }
                }
            }
            logdt = rs.data.logdt //오류 발생시 이 부분이 실행되면 안될 것임!!!!!
            if (!hasProp()) setTimeout(function() { chkDataLog() }, 1000 * 20) //스레드에서는 polling 없음. 부모창에서 스레드로 리얼타임 반영함
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    onMounted(async () => { //HomePanel.vue에서 keepalive를 통해 호출되므로 처음 마운트시에만 1회 실행됨
        //그러나, 부모단에서 keepalive의 key를 잘못 설정하면 자식단에서 문제가 발생함 (심지어 onMounted가 2회 이상 발생)
        //예) Main.vue에서 <component :is="Component" :key="route.fullPath.split('/')[2]" />로 key 설정시 
        //MsgList에서 keepalive에도 불구하고 onMounted가 2회 발생함. :key="$route.fullPath"를 사용해도 마찬가지 현상임
        //또 다른 현상은 새로고침하면 HomePanel.vue가 먼저 실행되는 것이 아닌 MsgList.vue의 onMounted가 먼저 실행되어서 HomePanel.vue가 실행되면서 
        //호출하는 MsgList.vue와 충돌해 페이지가 안뜸 => router의 index.js에서 beforeEach()로 해결함 $$76
        try {
            console.log("MsgList Mounted..... " + route.fullPath)
            //if (!gst.util.chkOnMountedTwice(route, 'MsgList')) return
            subTitle = hush.util.getRnd() + 'M'
            const arr = route.fullPath.split("/") //무조건 길이는 2이상임 => /main/dm/dm_body
            appType = arr[2] //home,dm,later,msglist..
            if (appType == "msglist" && route.query.appType) appType = route.query.appType //새창에서열기 또는 링크복사시 arr[2]는 msglist이므로 appType을 다시 가져와야 함
            if (hasProp()) {
                setBasicInfoInProp()
                await getList({ msgid: msgidInChan, kind: "withReply" })
            } else {
                if (route.fullPath == "/main/dm/dm_body_new") {
                    showUserSearch.value = true
                } else {
                    setBasicInfo() //여기는 패널로부터 호출되기도 하지만 새로고침시 (캐시제거 등) 비동기로 패널보다 MsgList가 먼저 호출되기도 할 수도 있을 것에 대비 (예: 패널의 선택 색상)
                    if (msgidInChan) {
                        await getList({ msgid: msgidInChan, kind: "atHome" })
                    } else {
                        await getList({ prevMsgMstCdt: savPrevMsgMstCdt })                    
                    }
                    observerTopScroll()
                    observerBottomScroll()
                    //try { 
                        inEditor.value.focus() 
                    //} catch {}
                }
            }
            setTimeout(function() { chkDataLog() }, 1000 * 20)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => { // 초기 마운트 또는 캐시상태에서 다시 삽입될 때마다 호출 : onMounted -> onActivated 순으로 호출됨
        if (!route.fullPath.includes("_body")) return //MsgList인데 route.fullPath가 /main/home인 경우가 가끔 발생. 원인 파악 안되어 일단 차단
        console.log("MsgList Activated..... " + route.fullPath+'...'+mounting)
        if (mounting) {
            mounting = false
        } else {
            subTitle = subTitle.replace("M", "A")
            if (hasProp()) {
                setBasicInfoInProp()
            } else {
                setBasicInfo()
                observerTopScroll()
                observerBottomScroll()      
            }
            const key = msgidInChan ? msgidInChan : sideMenu + chanId
            if (gst.objSaved[key]) scrollArea.value.scrollTop = gst.objSaved[key].scrollY
            if (gst.routedToSamePanelFromMsgList) { //아래는 사이드 메뉴 같은 경우만 실행됨 : 사용자가 방내 범위내에서 노드를 클릭하거나 뒤로가기를 눌렀는데 사이드 메뉴가 안바뀌고 해당 패널내에서 라우팅하는 경우
                console.log("MsgList Activated selectRow..... " + appType + "==="+ chanId)
                if (appType == "home" || appType == "dm") {
                    evToPanel({ kind: "selectRow", chanid: chanId })
                } else if (appType == "activity" || appType == "later" || appType == "fixed") {
                    evToPanel({ kind: "selectRow", msgid: msgidInChan })
                }
            }
        }
    })

    onUnmounted(() => {
        if (observerTop && observerTop.value) observerTop.value.disconnect()
        if (observerBottom && observerBottom.value) observerBottom.value.disconnect()
    })

    function setBasicInfo() {
        sideMenu = gst.selSideMenu
        if (!sideMenu) sideMenu = "mnu" + appType.substring(0, 1).toUpperCase() + appType.substring(1)
        if (route.params.chanid) chanId = route.params.chanid
        const pMsgid = route.params.msgid
        if (pMsgid == STATE_NODATA) {
            pageData.value = pMsgid
        } else if (pMsgid == "0" || pMsgid == "nocache") { //현재 nocache는 사용처 없음
            //skip
        } else if (pMsgid) {
            msgidInChan = pMsgid //댓글의 msgid일 수도 있음
        }
    }

    function saveCurScrollY(posY) {
        if (!sideMenu || !chanId) return
        const key = msgidInChan ? msgidInChan : sideMenu + chanId
        if (!gst.objSaved[key]) gst.objSaved[key] = {}
        gst.objSaved[key].scrollY = posY
    }

    function chanCtxMenu(e) {
        gst.ctx.data.header = ""
        const disableStr = (chanMasterId.value == g_userid) ? false : true
        gst.ctx.menu = [
            { nm: "방 나가기", func: async function(item, idx) {
                try {
                    if (!confirm("퇴장시 방 관리자의 초대가 없으면 다시 들어올 수 없습니다. 계속할까요?")) return
                    const rq = { CHANID: chanId, USERID: g_userid }
                    const res = await axios.post("/chanmsg/deleteChanMember", rq)
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    //evToPanel({ kind: "delete", chanid: chanId })
                    await router.replace({ name: appType + "_dumskel" }) //DummySkeleton.vue 설명 참조 
                    evToPanel({ kind: "refreshPanel" })                   
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }},
            { nm: "방 삭제", disable: disableStr, func: async function(item, idx) {
                try {
                    if (!confirm("방 전체 삭제를 진행합니다. 계속할까요?")) return
                    const rq = { CHANID: chanId }
                    const res = await axios.post("/chanmsg/deleteChan", rq)
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    //evToPanel({ kind: "delete", chanid: chanId })
                    await router.replace({ name: appType + "_dumskel" }) //DummySkeleton.vue 설명 참조                    
                    evToPanel({ kind: "refreshPanel" })
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    async function listMsg(kind) {
        listMsgSel.value = kind
        msglist.value = []
        if (kind == 'all') {
            savPrevMsgMstCdt = hush.cons.cdtAtLast
            //console.log("listMsg-all")
            await getList({ prevMsgMstCdt: savPrevMsgMstCdt })
        } else {
            await getList({ kind: kind })
        }        
    }

    function openSearchInchan(tab) {
        mediaPopupRef.value.open(tab, chanId, chanNm.value, chanImg.value, "")
    }

    function chkWithinTime(dt1, dt2) {
        const secondDiff = hush.util.getDateTimeDiff(dt1, dt2)
        const minuteDiff = parseInt(secondDiff / 60)
        return (minuteDiff <= 1) ? true : false
    }

    function setChanMstDtl(chanmstParam, chandtlParam) {
        document.title = chanmstParam.CHANNM + " [채널-" + subTitle + "]"
        grnm.value = chanmstParam.GR_NM
        chanNm.value = chanmstParam.CHANNM
        chanMasterId.value = chanmstParam.MASTERID
        chanMasterNm.value = chanmstParam.MASTERNM
        chanImg.value = gst.util.getChanImg(chanmstParam.TYP, chanmstParam.STATE)
        chanmemUnder.value = [] //예) 11명 멤버인데 4명만 보여주기. 대신에 <div v-for="idx in MAX_PICTURE_CNT" chandtl[idx-1]로 사용가능한데 null 발생해 일단 대안으로 사용중
        chanmemFullExceptMe.value = []
        const len = chandtlParam.length
        for (let i = 0; i < len; i++) {
            const row = chandtlParam[i]    
            row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
            chandtlObj.value[row.USERID] = row //chandtl은 array로 쓰이는 곳이 훨씬 많을테고 메시지작성자의 blobUrl은 object로 관리하는 것이 효율적이므로 별도 추가함
            if (i < MAX_PICTURE_CNT) chanmemUnder.value.push({ url: row.url })
            if (row.USERID != g_userid) chanmemFullExceptMe.value.push(row.USERNM)
        }
        chandtl.value = chandtlParam
    }

    //1) prevMsgMstCdt : EndlessScroll 관련 (가장 오래된 일시를 저장해서 그것보다 더 이전의 데이터를 가져 오기 위함. 화면에서 위로 올라가는 경우임)
    //2) nextMsgMstCdt : EndlessScroll 관련 (가장 최근 일시를 저장해서 그것보다 더 최근의 데이터를 가져 오기 위함. 화면에서 아래로 내려가는 경우임)
    //3) nextMsgMstCdt + kind(scrollToBottom) : 발송 이후 작성자 입장에서는 맨 아래로 스크롤되어야 함. (향후 소켓 적용시에도 수신인 입장에서 특정 메시지 아래 모두 읽어와 보여주기)
    //4) msgid + kind(atHome) : 홈메뉴에서 메시지 하나 전후로 가져와서 보여 주는 UI (from 나중에..내활동..)
    //5) msgid + kind(withReply) : 1. 홈메뉴에서 댓글보기 누르면 오른쪽에 부모글+댓글 리스트로 보여 주는 UI 2. 나중에..내활동..에서 기본 클릭시 보여 주는 UI
    //6) kind(notyet or unread)
    async function getList(addedParam) {
        try {
            if (onGoingGetList || pageData.value == STATE_NODATA) return
            onGoingGetList = true
            let param = { chanid: chanId } //chanid는 기본 param
            if (addedParam) Object.assign(param, addedParam) //추가 파라미터를 기본 param에 merge
            const prevMsgMstCdt = param.prevMsgMstCdt
            const nextMsgMstCdt = param.nextMsgMstCdt
            const msgid = param.msgid
            const kind = param.kind
            if (msgid && (kind == "atHome" || kind == "withReply")) {
                savNextMsgMstCdt = hush.cons.cdtAtFirst
                savPrevMsgMstCdt = hush.cons.cdtAtLast
            }
            const res = await axios.post("/chanmsg/qry", param)
            const rs = gst.util.chkAxiosCode(res.data) 
            fetchByScrollEnd.value = false
            if (!rs) {
                onGoingGetList = false                
                return
            }            
            vipStr.value = ("," + rs.data.vipStr + ",") ?? "none" //데이터 없어서 null일 수도 있음 ##34
            const queryNotYetTrue = (route.query && route.query.notyet) ? true : false //query에 notyet=true이면 true
            // document.title = rs.data.chanmst.CHANNM + " [채널-" + temp + "]"
            // grnm.value = rs.data.chanmst.GR_NM
            // chanNm.value = rs.data.chanmst.CHANNM
            // chanImg.value = gst.util.getChanImg(rs.data.chanmst.TYP, rs.data.chanmst.STATE)
            // chanmemUnder.value = [] //예) 11명 멤버인데 4명만 보여주기. 대신에 <div v-for="idx in MAX_PICTURE_CNT" chandtl[idx-1]로 사용가능한데 null 발생해 일단 대안으로 사용중
            // chanmemFullExceptMe.value = []
            // const len = rs.data.chandtl.length
            // for (let i = 0; i < len; i++) {
            //     const row = rs.data.chandtl[i]    
            //     row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
            //     chandtlObj.value[row.USERID] = row //chandtl은 array로 쓰이는 곳이 훨씬 많을테고 메시지작성자의 blobUrl은 object로 관리하는 것이 효율적이므로 별도 추가함
            //     if (i < MAX_PICTURE_CNT) chanmemUnder.value.push({ url: row.url })
            //     if (row.USERID != g_userid) chanmemFullExceptMe.value.push(row.USERNM)
            // }
            // chandtl.value = rs.data.chandtl
            setChanMstDtl(rs.data.chanmst, rs.data.chandtl)
            if (msgid && (kind == "atHome" || kind == "withReply")) msglist.value = [] //홈에서 열기를 선택해서 열린 것이므로 목록을 초기화함
            const msgArr = rs.data.msglist
            if (msgArr.length == 0) {
                onGoingGetList = false
                afterScrolled.value = null //afterScrolled.value = false
                return 
            }
            afterScrolled.value = false
            const msgidParent = rs.data.msgidParent //atHome만 사용함 (댓글인 경우는 부모 아이디)
            const msgidChild = rs.data.msgidChild //atHome만 사용함 (msgidParent와 다르면 이건 댓글의 msgid임)
            for (let i = 0; i < msgArr.length; i++) { //msgArr[0]가 가장 최근일시임 (CDT 내림차순 조회 결과)
                const row = msgArr[i] //if (row.MSGID == '20250419095152486066082566') debugger
                if (kind == "withReply") {
                    if (i == 0) {
                        row.background = "beige"
                    } else if (row.MSGID == props.data.msgidChild) {
                        row.background = hush.cons.color_athome
                    }
                } else {
                    if (msgidParent && row.MSGID == msgidParent) {
                        if (queryNotYetTrue) { //여기서부터 읽지 않은 메시지라고 안내해야 함
                            row.firstNotYet = (msgidParent == msgidChild) ? "parent" : "child"
                        }
                        row.background = hush.cons.color_athome
                    }
                }
                let tempBody = row.BODY, replaced = false
                for (let item of row.msgdtlmention) {
                    let exp = new RegExp("@" + item.USERNM, "g")
                    tempBody = tempBody.replace(exp, "<span wiseband=true style='font-weight:bold'>@" + item.USERNM + "</span>")
                    replaced = true
                }
                if (replaced) row.BODY = tempBody
                gst.util.handleMsgSub(row)
                //동일한 작성자가 1분 이내 작성한 메시지는 프로필없이 바로 위 메시지에 붙이기 (자식/부모 각각 입장)
                const curAuthorId = row.AUTHORID
                const curCdt = row.CDT.substring(0, 19)
                if (nextMsgMstCdt || kind == "withReply") { //오름차순으로 일부를 읽어옴
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
                    msglist.value.splice(0, 0, row) //jQuery prepend와 동일 (메시지리스트 맨 위에 삽입)
                }
                if (row.CDT > savNextMsgMstCdt) savNextMsgMstCdt = row.CDT
                if (row.CDT < savPrevMsgMstCdt) savPrevMsgMstCdt = row.CDT
                //msgRow.value[row.MSGID.toString()] = row.MSGID
                if (row.CDT > perLastCdt) perLastCdt = row.CDT
            } //###876
            //1. perLastCdt(가져온 최근메시지CDT)와 realLastCdt(atHome에서처럼 가져오지 않았지만 실제 최근메시지CDT)를 비교해 같거나 perLastCdt가 크면 그 다음에 리얼타임으로 반영되는 추가분은 화면에 뿌려도 무방함
            //2. realLastCdt가 더 크면 중간에 (서버에서 갖고 오지 않아서) 이빨 빠진 리스트 상태이므로 리얼타임으로 반영하려고 갖고 오더라도 화면에 반영하지 말고 사용자에게 보이게 정보만 쌓아두기로 함
            //   - 그래서 그걸 클릭하면 그동안 쌓아 두었던 것을 가져 오든지 아니면 최근것부터 뿌리고 이전 스크롤하게 하기로 함
            realLastCdt = rs.list.length > 0 ? rs.list[0].CDT : ""
            logdt = rs.data.logdt
            imgBlobArr.value = []
            for (let item of rs.data.tempimagelist) {
                const blobUrl = hush.util.getImageBlobUrl(item.BUFFER.data)
                imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: item.CDT })
            }
            fileBlobArr.value = []
            for (let item of rs.data.tempfilelist) {
                fileBlobArr.value.push({ hover: false, name: item.BODY, size: item.FILESIZE, cdt: item.CDT })
            }
            linkArr.value = []
            for (let item of rs.data.templinklist) {
                let text, url
                const arr = item.BODY.split(hush.cons.deli)
                if (arr.length == 1) {
                    text = item.BODY
                    url = item.BODY
                } else {
                    text = arr[0]
                    url = arr[1]
                }
                linkArr.value.push({ hover: false, text: text, url: url, cdt: item.CDT })
            }
            await nextTick()
            if (msgidParent && kind == "atHome") { //msgid가 댓글인 경우 부모의 msgid가 필요함 (msgidParent)
                if (msgRow.value[msgidParent]) { //자식에서는 atHome에서는 1개이므로 문제가 없고 withReply에서는 msgid가 화면에 2개 중복될 수도 있으나 맨위로 가므로 문제없을 것임
                    msgRow.value[msgidParent].scrollIntoView()
                }
                if (msgidParent != msgidChild) { //atHome만 해당. 댓글에 '나중에'가 있어서 열어서 표시 필요
                    setTimeout(function() { openThread(msgidParent, msgidChild) }, 500) //setTimeout() 크게 문제되어 보이지 않음
                }
            } else if (msgid && (kind == "withReply")) { //이미 openThread()되어 있는 상태
                if (msgRow.value[props.data.msgidChild]) {
                    msgRow.value[props.data.msgidChild].scrollIntoView()
                }
            } else if (prevMsgMstCdt == hush.cons.cdtAtLast || kind == "notyet" || kind == "unread") { //notyet, unreadsms 내림차순으로 1000개만 가져옴
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight }) //, behavior: 'smooth'
            } else if (prevMsgMstCdt) {
                if (msgArr.length > 0) { //스크롤이전에 prevScrollY + 새로 더해진 scrollHeight을 더해서 scrollArea의 scrollTop을 구하면 됨
                    scrollArea.value.scrollTop = (scrollArea.value.scrollHeight - prevScrollHeight) + prevScrollY
                } else {
                    //스크롤 위치는 그대로임 //scrollArea.value.scrollTop = prevScrollY
                }
            } else if (nextMsgMstCdt && kind == "scrollToBottom") { //작성자 입장에서 발송이후 스크롤 맨 아래로 위치
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight })
            } else if (nextMsgMstCdt) {
                //그냥 두면 됨
            }
            setTimeout(function() { //초기데이터 말고는 getList + onScroll이 readMsgToBeSeen()을 두번 실행하게 하는데 이 경우 msgdtl에 read kind 필드값이 2개 이상 insert됨
                //방안: afterScrolled이 true이면 스크롤 된 것이므로 여기서 readMsgToBeSeen() 호출하지 말고 false일 경우만 호출하기로 함 : /chanmsg/updateWithNewKind 참조
                if (afterScrolled.value == false) readMsgToBeSeen() //if (!afterScrolled.value) readMsgToBeSeen()
            }, 2000)
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
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

    function refreshWithGetMsg(rs, msgid, idx) {
        try {
            let item = msgid ? msglist.value.find(function(row) { return row.MSGID == msgid }) : msglist.value[idx]
            if (item) { 
                item.BODY = rs.msgmst.BODY
                item.UDT = rs.msgmst.UDT

                item.act_later = rs.act_later
                item.act_fixed = rs.act_fixed

                item.msgdtl = rs.msgdtl
                item.msgdtlmention = rs.msgdtlmention
                item.msgfile = rs.msgfile
                item.msgimg = rs.msgimg
                item.msglink = rs.msglink

                item.reply = rs.reply
                item.replyinfo = rs.replyinfo
                //item.background = rs.act_later ? hush.cons.color_act_later : ""
            }
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
        const userObj = chandtlObj.value[row.AUTHORID]
        const imgUrl = (userObj && userObj.url) ? userObj.url : gst.html.getImageUrl('user.png')
        gst.ctx.data.header = "<img src='" + imgUrl + "' class='coImg32' style='margin-right:5px;border-radius:16px'>" + row.AUTHORNM
        const displayStr = vipStr.value.includes(',' + row.AUTHORID + ',') ? "해제" : "설정"
        const bool = vipStr.value.includes(',' + row.AUTHORID + ',') ? false : true
        gst.ctx.menu = [
            { nm: "DM 보내기", func: async function() { //1대1은 새창에서 여는 게 효율적일 수도 ..
                //1) DM의 newDm()을 호출하려면 dm 라우팅을 타야 함 2) 홈패널의 MsgList에서 DM 라우팅하면 MsgList가 수회 반복되는 문제 발생함 (Dm 패널로 가서 처리하려면 Main.vue까지 가서 Dm을 불러야 함)
                try {
                    const res = await axios.post("/menu/qryDmChkExist", { member: [row.AUTHORID] })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return null
                    let chanid = rs.data.chanid
                    if (!chanid) { //둘만의 방이 없으므로 새로 추가해야 함
                        const SYNC = chandtlObj.value[row.AUTHORID] ? chandtlObj.value[row.AUTHORID].SYNC : "Y"
                        const rq = { CHANID: "new", MEMBER: [{ USERID: row.AUTHORID, USERNM: row.AUTHORNM, SYNC: SYNC }] } //신규 DM방 생성 (멤버도 함께 생성)
                        const res = await axios.post("/chanmsg/saveChan", rq)
                        const rs = gst.util.chkAxiosCode(res.data)
                        if (!rs) return
                        chanid = rs.data.chanid
                        localStorage.wiseband_lastsel_dmchanid = chanid
                    }
                    openDmRoom(chanid, true) //window.open("/body/msglist/" + chanid + "/0?appType=dm")
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }},
            { nm: "VIP " + displayStr, func: async function(item, idx) {
                try {
                    const res = await axios.post("/user/setVip", { 
                        list: [{ USERID: row.AUTHORID, USERNM: row.AUTHORNM }], bool: bool
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    if (bool) {
                        vipStr.value += row.AUTHORID + ","
                    } else {                    
                        vipStr.value = vipStr.value.replace(row.AUTHORID + ",", "")
                    }
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowRight(e, row, index) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        let textRead, oldKind, newKind
        const msgdtlRow = row.msgdtl.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
        if (msgdtlRow) {
            oldKind = msgdtlRow.KIND
            if (msgdtlRow.KIND == "read") {
                textRead = "다시읽지않음으로 처리"
                newKind = "unread"
            } else {
                textRead = "읽음으로 처리"
                newKind = "read"
            }
        } else {
            oldKind = "notyet"
            textRead = "읽음으로 처리"
            newKind = "read"
        }
        const disableStr = (hasProp() && index == 0) ? true : false
        const colorStr = (hasProp() && index == 0) ? "" : "red"
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {
                const url = location.protocol + "//" + location.host + "/body/msglist/" + chanId + "/" + row.MSGID + "?appType=" + appType
                window.open(url)
            }},
            { nm: textRead, disable: disableStr, func: function(item, idx) {
                updateWithNewKind(row.MSGID, oldKind, newKind)
            }},
            // { nm: "리마인더 받기", child: [
            //     { nm: "1시간 후", func: function(item, idx) { 
            //         
            //     }},
            //     { nm: "내일", func: function(item, idx) { 
            //     }},
            //     { nm: "다음 주", func: function(item, idx) { 
            //     }},
            //     { nm: "사용자 지정", func: function(item, idx) { 
            //     }}                
            // ]},
            // { nm: "새 댓글시 알림 받기", func: function(item, idx) { //무조건 알림 받기가 기본
            // }},
            { nm: "채널로 메시지 전달", disable: disableStr, func: function(item, idx) {
                forwardMsg("home", row.MSGID)
            }},
            { nm: "DM으로 메시지 전달", disable: disableStr, func: function(item, idx) {
                forwardMsg("dm", row.MSGID)
            }},
            { nm: "메시지 링크로 복사", disable: disableStr, func: function(item, idx) {
                const url = location.protocol + "//" + location.host + "/body/msglist/" + chanId + "/" + row.MSGID + "?appType=home"
                navigator.clipboard.writeText(url).then(() => { //http://localhost:5173/body/msglist/20250122084532918913033403/0
                    gst.util.setToast("메시지 링크가 복사되었습니다.")
                }).catch(() => {
                    gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                })
            }},
            { nm: "메시지 편집", disable: disableStr, func: function(item, idx) {
                editMsgId.value = row.MSGID
                prevEditData = document.getElementById(editorId).innerHTML
                if (prevEditData.trim() != "") {
                    gst.util.setToast("에디터에 이미 편집중인 데이터가 있습니다.")
                    return
                }
                msgbody.value = row.BODY
            }},
            { nm: "메시지 삭제", disable: disableStr, color: colorStr, func: async function(item, idx) {
                try {
                    if (!window.confirm("삭제후 복구가 불가능합니다. 진행할까요?")) return
                    const res = await axios.post("/chanmsg/delMsg", { 
                        msgid: row.MSGID, chanid: chanId
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    msglist.value.splice(index, 1) //해당 메시지 배열 항목 삭제해야 함 (일단 삭제하는 사용자 화면 기준만 해당)
                    if (hasProp()) { //댓글 삭제시 스레드의 부모글은 chkDataLog()에 의해 업데이트 될 것이므로 바로 아래에서는 굳이 처리 안함
                        evClick({ type: "refreshFromReply", msgid: props.data.msgid })
                    } else { //이게 MsgList(부모) -> MsgList(자식)인 경우라면 필요없어 보임 (부모글 삭제시 자식에 댓글 있으면 안되고 댓글 없으면 굳이 화면에서 연동할 필요없음)
                        if (msglistRef.value) msglistRef.value.procFromParent("deleteMsg", { msgid: row.MSGID })
                    }
                    if (appType == "later" || appType == "fixed") { //수정자 기준 : 패널 열려 있을 때
                        //gst[appType].procFromBody("work", { msgid: row.MSGID, work: "delete" })
                        evToPanel({ kind: "delete", msgid: row.MSGID }) //work: delete/create(해당 아이디 조회해서 배열에 넣기) + laterCnt 구하기
                    }
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowEnter(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = true
        // debugger
        // const msgdtlArr = row.msgdtl
        // const msgdtlRow = msgdtlArr.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
        // const msgid = row.MSGID
        // if (msgdtlRow) {
        //     //사용자인 내가 이미 읽은 메시지이므로 읽음처리할 것이 없음
        // } else {
        //     updateWithNewKind(msgid, "notyet", "read")
        // }
    }

    function rowLeave(row) { //css만으로 처리가 힘들어 코딩으로 구현
        row.hover = false
    }

    const onScrolling = () => { 
        //if (!afterScrolled.value) afterScrolled.value = true
        if (afterScrolled.value == false) afterScrolled.value = true //false 조건에 유의 (아니면 마지막 hide 안됨)
        if (!scrollArea.value) return //오류 만났을 때
        prevScrollY = scrollArea.value.scrollTop //자식에서도 prevScrollY는 필요함
        prevScrollHeight = scrollArea.value.scrollHeight
        readMsgToBeSeen()
        //console.log("readMsgToBeSeen:"+"==="+prevScrollY+"==="+prevScrollHeight)
        if (hasProp()) return //자식에서는 한번에 모든 데이터 가져오므로 EndlessScroll 필요없음
        saveCurScrollY(prevScrollY)
    }

    async function refreshMsgDtlWithQryAction(msgid) {
        let rs = await qryAction({ msgid: msgid }) //1개가 아닌 모든 kind 목록을 가져옴
        if (rs == null) return //rs = [{ KIND, CNT, NM }..] //NM은 이상병, 정일영 등으로 복수
        const item = msglist.value.find(function(row) { return row.MSGID == msgid })
        if (item) item.msgdtl = rs //해당 msgid 찾아 msgdtl을 통째로 업데이트함
    }

    async function updateWithNewKind(msgid, oldKind, newKind) {
        try { //if (msgid == "20250529164700161926024750") debugger
            const rq = { chanid: chanId, msgid: msgid, oldKind: oldKind, newKind: newKind }
            const res = await axios.post("/chanmsg/updateWithNewKind", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            await refreshMsgDtlWithQryAction(msgid)
            if (hasProp()) { //스레드에서 내가 안읽은 갯수를 Parent에도 전달해서 새로고침해야 함
                evClick({ type: "refreshFromReply", msgid: props.data.msgid }) //props.data.msgid는 자식의 부모 아이디
                const rs = await getMsg({ msgid: props.data.msgid })
                if (rs == null) return
                refreshWithGetMsg(rs, props.data.msgid)
            } else { 
                //굳이 실행하지 않아도 될 듯
            }
            if (oldKind == "read" || oldKind == "unread") {
                if (listMsgSel.value == "notyet" || listMsgSel.value == "unread") { //notyet은 실제로는 사용자가 이미 읽은 상태이므로 read로 변경되어 있을 것임
                    const idx = msglist.value.findIndex((item) => item.MSGID == msgid)
                    if (idx > -1) msglist.value.splice(idx, 1)
                }
                return //패널 업데이트 필요없음 (notyet은 변동없음)
            }
            // if (appType == "home") { //if (route.fullPath.includes("/home_body/")) {
            //     //gst.home.procFromBody("updateNotyetCnt", rq)
            //     evToPanel({ kind: "updateNotyetCnt", chanid: chanId })
            // } else if (appType == "dm") { //} else if (route.fullPath.includes("/dm_body/")) {
            //     //gst.dm.procFromBody("updateNotyetCnt", rq)
            //     evToPanel({ kind: "updateNotyetCnt", chanid: chanId })
            // }
            if (appType == "home" || appType == "dm") {
                evToPanel({ kind: "updateNotyetCnt", chanid: chanId })
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function updateAllWithNewKind(oldKind, newKind) {
        try {     
            const rq = { chanid: chanId, oldKind: oldKind, newKind: newKind }
            const res = await axios.post("/chanmsg/updateAllWithNewKind", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return            
            // if (appType == "home") {
            //     gst.home.procFromBody("updateNotyetCnt", rq)
            // } else if (appType == "dm") { 
            //     gst.dm.procFromBody("updateNotyetCnt", rq)
            // }
            if (appType == "home" || appType == "dm") {
                evToPanel({ kind: "updateNotyetCnt", chanid: chanId })
            }
            listMsg('notyet')
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function readMsgToBeSeen() { //메시지가 사용자 눈에 (화면에) 보이면 읽음 처리하는 것임
        if (showUserSearch.value) return //DM방 만들기에서는 무시
        const eleTop = getTopMsgBody() //메시지 목록 맨 위에 육안으로 보이는 첫번째 row 가져오기 
        if (!eleTop) {
            return
        } else if (!eleTop.id) { //토스트메시지가 덮고 있을 경우일 수 있는데 엎어질 때까지 계속 Try하는데 스레드에서 try하면 Parent의 ele로 getTopMsgBody() 찾음
            setTimeout(function() { readMsgToBeSeen() }, 500) //토스트를 bottomMsg로 대체해서 여기 올 경우는 없을 것이나 그대로 둠
        } else {
            const idTop = eleTop.id
            let idx = msglist.value.findIndex(function(row) { return row.MSGID == idTop })
            if (idx > -1) { //오름차순/내림차순 혼재되어 있는 상황이므로 단순화해서 그냥 앞뒤로 20개씩 전후로 모두 읽어서 화면에 보이는 것만 읽음 처리 (이미 읽었으면 처리할 필요 없음)
                const len = msglist.value.length
                const start = (idx - 10 < 0) ? 0 : idx - 10
                const end = (idx + 10 > len - 1) ? len - 1 : idx + 10
                const childbodyAttr = hasProp() ? true : false
                const eleParent = document.querySelector("#chan_center_body[childbody=" + childbodyAttr + "]")
                const eleHeader = document.getElementById("header") //Main.vue 참조 //높이 고정이므로 onMounted()로 빼도 됨
                const eleHeaderHeight = eleHeader ? eleHeader.offsetHeight : 0 //Main.vue가 없는 msglist 라우팅의 경우도 있을 수 있음
                const eleHeader1 = document.getElementById("chan_center_header") //높이 고정이므로 onMounted()로 빼도 됨
                const eleNav = document.getElementById("chan_center_nav") //높이 고정이므로 onMounted()로 빼도 됨 (스레드에서는 안보임)
                const topFrom = eleHeader1.offsetHeight + eleHeaderHeight + (hasProp() ? 0 : eleNav.offsetHeight)
                for (let i = start; i <= end; i++) { //console.log(start+"#####################"+end)
                    const msgdtlArr = msglist.value[i].msgdtl
                    const msgdtlRow = msgdtlArr.find(item => (item.KIND == "read" || item.KIND == "unread") && item.ID.includes(g_userid))
                    const msgid = msglist.value[i].MSGID
                    if (msgdtlRow) { 
                        //사용자인 내가 이미 읽은 메시지이므로 읽음처리할 것이 없음
                    } else {
                        const ele = msgRow.value[msgid]
                        if (ele) {
                            const rect = ele.getBoundingClientRect()
                            if ((rect.top - topFrom + 60) >= 0 && (rect.top - topFrom + 70) <= eleParent.offsetHeight) {
                                updateWithNewKind(msgid, "notyet", "read") //알파값 60만큼 위에서 더 내려오거나 70만큼은 아래에서 더 올라와야 육안으로 보인다고 할 수 있음
                            }
                        }
                    }
                }
            }
        }
    }

    const getTopMsgBody = () => { //육안으로 보이는 맨 위 MSGID의 div (msgbody 및 procMenu 클래스 보유) 찾기
        const childbodyAttr = hasProp() ? true : false
        const rect = hush.util.getRect("#chan_center_body[childbody=" + childbodyAttr + "]")
        if (!rect) return null
        const xx = rect.left + 1 //MSGID를 갖고 있는 div는 margin/padding이 각각 5px이므로 xx, yy에 그 안의 값을 더하면 구할 수 있음
        let yy = rect.top + 6
        const ele = document.elementFromPoint(xx, yy)
        return ele
    }

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
                if (appType == "dm" && showUserSearch.value) {
                    gst.util.setSnack("Dm방 새로 만들 때에는 텍스트만 전송 가능합니다.")
                    return
                }
                if (editMsgId.value) {
                    gst.util.setToast("편집중인 메시지에는 이미지 붙이기가 불가능합니다.", 3)
                    return
                }
                const clipboardItem = pastedData[0]
                const blob = clipboardItem.getAsFile() //서버에 보낼 데이터
                const blobUrl = URL.createObjectURL(blob) //화면에 보여줄 데이터
                if (blob.size > hush.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 이미지 크기 제한은 " + hush.util.formatBytes(hush.cons.uploadLimitSize) + "입니다.\n" + "현재 => " + hush.util.formatBytes(blob.size), true)
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

    // function keyUpEnter(e) {
    //     if (e.ctrlKey) {
    //         //saveMsg() //나중에 Ctrl+Enter를 saveMsg() 할 수 있도록 옵션 제공하기
    //     } else {
    //         saveMsg() //일단 줄바꿈으로 동작하게 하기
    //     }
    // }

    function keyDownEnter(e) {
        if (e.ctrlKey) {
            //saveMsg() //나중에 Ctrl+Enter를 saveMsg() 할 수 있도록 옵션 제공하기
        } else {
            saveMsg() //일단 줄바꿈으로 동작하게 하기
        }
    }

    async function saveMsg() { //파일 및 이미지 업로드만 FormData 사용하고 nest.js에서는 multer npm으로 처리
        try { //파일,이미지,링크가 있다면 미리 업로드된 상태이며 crud가 C일 때만 업로드 되며 U일 때는 슬랙과 동일하게 업로드되지 않음 (본문만 수정저장됨)
            if (appType == "dm" && showUserSearch.value) { //DM방 새로 만들기
                if (dmChanIdAlready.value) {
                    gst.util.setSnack("위 '기존 DM방 열기' 버튼을 이용하시기 바랍니다.")
                    return
                }
                const member = []
                userAdded.value.forEach(item => { member.push({ USERID: item.USERID, USERNM: item.USERNM, SYNC: item.ORG_NM ? "Y" : "" }) })
                const rq = { CHANID: "new", MEMBER: member } //신규 DM방 생성 (멤버도 함께 생성)
                const res = await axios.post("/chanmsg/saveChan", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                chanId = rs.data.chanid
                localStorage.wiseband_lastsel_dmchanid = chanId
            }
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
                    evClick({ type: "refreshFromReply", msgid: props.data.msgid })
                } else {
                    await getList({ nextMsgMstCdt: savNextMsgMstCdt, kind: "scrollToBottom" }) //저장한 메시지 추가
                }
            } else {
                const rs = await getMsg({ msgid: editMsgId.value }, true)
                if (rs == null) return
                refreshWithGetMsg(rs, editMsgId.value)
            }            
            if (appType == "later" || appType == "fixed") { //수정자 기준 : 패널 열려 있을 때 메시지 수정후 패널내 해당 메시지 본문 업데이트
                if (crud == "U") {
                    //gst[appType].procFromBody("update", rq)
                    evToPanel({ kind: "update", msgid: editMsgId.value, bodytext: bodytext })
                }
            } else if (appType == "dm") {
                evToPanel({ kind: "update", chanid: chanId, bodytext: bodytext })
                //gst.dm.procFromBody("update", rq)
            }
            if (msglistRef.value) msglistRef.value.procFromParent("refreshMsg", { msgid: editMsgId.value }) //댓글창의 부모글 업데이트
            msgbody.value = ""            
            editMsgId.value = null
            if (appType == "dm" && showUserSearch.value) { //DM방 새로 만들기
                dmChanIdAlready.value = ""
                userAdded.value = []
                dmChanIdAlready.value = false                
                evToPanel({ kind: "refreshPanel" })
            }
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
            if (appType == "dm" && showUserSearch.value) {
                gst.util.setSnack("Dm방 새로 만들 때에는 텍스트만 전송 가능합니다.")
                return
            }
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

    function mentionEnter(row, row1) {
        let exp = new RegExp("@" + row1.USERNM, "g")
        row.BODY = row.BODY.replace(exp, "<span wiseband=true style='color:steelblue'>@" + row1.USERNM + "</span>")
    }

    function mentionLeave(row, row1) {
        let exp = new RegExp("<span wiseband=true style='color:steelblue'>@" + row1.USERNM + "</span>", "g")
        row.BODY = row.BODY.replace(exp, "@" + row1.USERNM)
    }

    function procMention(e, row) {
        const userObj = chandtlObj.value[row.USERID]
        const imgUrl = (userObj && userObj.url) ? userObj.url : gst.html.getImageUrl('user.png')
        gst.ctx.data.header = "<img src='" + imgUrl + "' class='coImg32' style='margin-right:5px;border-radius:16px'>" + row.USERNM
        gst.ctx.menu = [
            { nm: "DM 보내기", func: function() {
                
            }},
            { nm: "VIP 설정", func: function() {
                
            }}
        ]
        gst.ctx.show(e)            
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
                const rq = { chanid: chanId, kind: "L", body: linkText.value + hush.cons.deli + linkUrl.value }
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
            if (appType == "dm" && showUserSearch.value) {
                gst.util.setSnack("Dm방 새로 만들 때에는 텍스트만 전송 가능합니다.")
                return
            }            
            const files = e.target.files
            if (fileBlobArr.value.length + files.length > hush.cons.uploadMaxCount) {
                gst.util.setToast("업로드 파일 갯수는 메시지별로 " + hush.cons.uploadMaxCount + "개(기존 파일 포함)까지만 가능합니다.", 5, true)
                return
            }            
            for (let i = 0; i < files.length; i++) {
                const size = files[i].size
                if (size > hush.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 파일 크기 제한은 " + hush.util.formatBytes(hush.cons.uploadLimitSize) + "입니다.\n" + files[i].name + " => " + hush.util.formatBytes(size), true)
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
            e.target.value = '' //clear하지 않으면 동일한 파일명이 바로 올라가지 않음 (change event 관련)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function downloadFile(msgid, row) { //msgid = temp or real msgid
        try { //cdt는 msgmst가 아닌 msgsub 테이블의 필드값이여야 함
            gst.util.downloadBlob("F", msgid, chanId, row.cdt, row.name)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function toggleAction(msgid, kind) { //toggleAction은 보안상 크게 문제없는 액션만 처리하기로 함
        try {
            if (kind == "notyet") return //react typ = checked, done, watching
            const rq = { chanid: chanId, msgid: msgid, kind: kind }
            const res = await axios.post("/chanmsg/toggleAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            await refreshMsgDtlWithQryAction(msgid)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function okChanDmPopup(kind, strChanid, strMsgid) { //바로 아래 forwardMsg()에서 연결됨 : strChanid(새로 선택한 채널(DM)방), strMsgid(전달하려고 하는 기존 메시지)
        popupChanDmRef.value.close()
        const rq = { chanid: chanId, msgid: strMsgid, targetChanid: strChanid } //선택한 채널의 메시지를 targetChanid에 복사
        const res = await axios.post("/chanmsg/forwardToChan", rq) //새로운 방으로 select and insert
        let rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return
        window.open("/body/msglist/" + strChanid + "/" + rs.data.newMsgid + "?appType=" + kind)
        /* 1안은 바로 위 window.open인데 사용자 입장에서도 무리없어 보임 (개발 관점에서 효율적이기도 함)
           다만 슬랙은 새창을 띄우지 않아서 아래 2안으로 노력했는데 2안시 마지막 단계인 MsgList의 캐시제거가 살짝 구현이 안되었음. 필요시 2안으로 노력을 더 기울여도 되나 각 패널에 추가해야 하는 것이 번거로울 것임
        if (kind == appType) {
            evToPanel({ kind: "refreshPanel" })
        } else { //home->dm or dm->home 등등
            evToPanel({ kind: "forwardToSide", menu: kind })
        }*/
    }

    async function forwardMsg(kind, msgid) { //내가 편집(발송)가능한 채널과 DM방중에서 1개를 선택해 table에 insert후 해당 패널의 방으로 이동해 바로 보여주기
        popupChanDmRef.value.open(kind, msgid) //바로 위 okChanDmPopup()으로 연결됨
    }

    async function changeAction(msgid, kind, newKind) { //changeAction은 보안상 크게 문제없는 액션만 처리하기로 함 : newKind 없으면 서버에서 kind로만 판단해 처리
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            let jobIfExist = "" //데이터가 있을 경우에 한해 delete면 지우고 delete가 아닌 값이면 그 값으로 update하면 됨
            if (kind == 'later' || kind == 'stored' || kind == 'finished' || kind == 'fixed') {
                jobIfExist = (!newKind) ? "delete" : newKind
            } //else 체크 필요함
            const rq = { chanid: chanId, msgid: msgid, kind: kind, job: jobIfExist }
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            const work = rs.data.work
            rs = await qryActionForUser({ msgid: msgid })
            if (rs == null) return
            const obj = msglist.value.find((item) => item.MSGID == msgid)
            if (obj) {
                obj.act_later = rs.act_later
                obj.act_fixed = rs.act_fixed
            }
            if (hasProp()) { 
                evClick({ type: "refreshFromReply", msgid: props.data.msgid })
            } else {
                if (msglistRef.value) msglistRef.value.procFromParent("refreshMsg", { msgid: msgid })
            }
            if (appType == "later" || appType == "fixed") { //패널 열려 있을 때 changeAction()후 패널내 해당 메시지 추가 또는 제거
                //gst[appType].procFromBody("work", { msgid: msgid, work: work }) //work: delete/create(해당 아이디 조회해서 배열에 넣기) + laterCnt 구하기
                evToPanel({ kind: work, msgid: msgid }) //work: delete/create(해당 아이디 조회해서 배열에 넣기) + laterCnt 구하기
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

    function adminJob() {
        adminShowID.value = !adminShowID.value
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
    ////////////////////////////////////////////////////////////////////////////////////

    async function procClearSearch() {
        if (searchText.value == "") userSearched.value = []
    }

    async function procInput(e) {
        if (e.keyCode == 13) { //Enter
            const param = { searchText: searchUser, onlyAllUsers: true }
            const res = await axios.post("/user/procOrgSearch", param)
            const rs = gst.util.chkAxiosCode(res.data) 
            if (!rs) return
            userSearched.value = []
            const arr = []
            for (let i = 0; i < rs.list.length; i++) {
                const row = rs.list[i]
                if (row.ORG_NM == "" & row.TOP_ORG_NM == "") {
                    row.userInfo = row.USERNM + "/" + row.EMAIL
                } else {
                    row.userInfo = row.USERNM + "/" + row.JOB.trim() + "/" + row.ORG_NM + "/" + row.TOP_ORG_NM
                }
                row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                arr.push(row)
            }
            if (rs.list.length == 1) {
                addUserToDm(rs.list[0])
                searchText.value = ""
            } else {
                userSearched.value = arr
            }            
        } else if (e.keyCode == 40) { //Arrow Down (focus to result list)
            userSearchedRef.value.focus() //tabIndex를 사용해 포커싱은 되는데 해당 div에서 화살표 위아래 누를 때 선택행이 변경되도록 해야 함 (향후 도전)
        } else if (e.keyCode == 8 || e.keyCode == 46) { //BackSpace, Del
            userSearched.value = []
        } else {
            searchUser = e.target.value
        }
    }

    async function addUserToDm(row) {
        const found = userAdded.value.findIndex(item => item.USERID == row.USERID)
        if (found > -1) {
            userAdded.value[found].found = true //기존 중복 표시임
            setTimeout(function() { userAdded.value[found].found = false }, 1000)
            return
        }
        if (row.USERID == g_userid) {
            gst.util.setSnack("본인 아이디는 추가하지 않습니다.")
            return
        }
        userAdded.value.push(row)
        userAdded.value[userAdded.value.length - 1].found = true //기존 중복이 아닌 새로운 추가 표시임
        setTimeout(function() { userAdded.value[userAdded.value.length - 1].found = false }, 500)
        await nextTick()
        const topVal = document.getElementById("divAddedUser").offsetHeight + document.getElementById("divAddUser").offsetHeight
        searchedResultTop.value = topVal + 5
        ///////////////////////////////////////////////////////////
        const member = [] //기존 DM방 여부 체크
        userAdded.value.forEach(item => { member.push(item.USERID) })
        const res = await axios.post("/menu/qryDmChkExist", { member: member })
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return null
        dmChanIdAlready.value = rs.data.chanid
    }

    function delUserItem(idx) {
        userAdded.value.splice(idx, 1)
    }

    function openDmRoom(chanid, newWin) {
        if (newWin) {
            window.open("/body/msglist/" + chanid + "/0?appType=dm")
        } else {
            let obj = { name : "dm_body", params : { chanid: chanid, msgid: "0" }} //DM 패널이 아니라면 MsgList Mounted 반복되는 문제 발생
            router.push(obj)
        }
    }
</script>

<template>
    <div class="chan_main">
        <div v-if="!hasProp() && pageData==STATE_NODATA" 
            style="top:0;left:0;width:100%;height:100%;margin-right:-10000px;padding:30px 0 0 30px;background:white;z-index:9999">
            <span>데이터가 없습니다.<br>왼쪽 패널에서 노드를 클릭하시기 바랍니다.</span>
        </div>
        <div class="chan_center" :style="{ width: widthChanCenter }">
            <div v-if="showUserSearch" style="position:relative;width:100%;display:flex;flex-direction:column">
                <div id="divAddedUser" style="min-height:50px;margin-top:3px;display:flex">
                    <div style="min-width:40px;display:flex;align-items:center;font-weight:bold">대상 :</div>
                    <div class="msg_body_blob">
                        <div v-for="(row, idx) in userAdded" class="msg_file_each" @click="delUserItem(idx)" :style="{ background: row.found ? 'var(--hover-color)' : '' }">
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                            <div><span style="margin:0 3px;color:#005192">{{ row.userInfo }}</span></div>
                            <div class="msg_file_del">
                                <img class="coImg14" :src="gst.html.getImageUrl('close.png')">
                            </div>
                        </div>
                    </div>
                </div>
                <div id="divAddUser" style="min-height:30px;margin-top:3px;display:flex">
                    <div style="min-width:48px;display:flex;align-items:center;font-weight:bold">추가 :</div>
                    <div>
                        <input type="search" ref="searchInput" v-model="searchText"  spellcheck="false" style="width:402px" placeholder="이름을 넣고 Enter를 누르십시오."
                               @keyup="(e) => procInput(e)" @input="procClearSearch" @focus="searchInput.select()" />
                    </div>
                    <div style="margin-left:10px;display:flex;align-items:center">(대상인원 : {{ userAdded.length }})</div>
                </div>
                <div style="margin-top:20px;display:flex;align-items:center">
                    <div v-show="dmChanIdAlready" class="coImgBtn" @click="openDmRoom(dmChanIdAlready)">
                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                        <span class="coImgSpn">기존 DM방 열기</span>
                    </div>
                    <div v-show="dmChanIdAlready" class="coImgBtn" @click="openDmRoom(dmChanIdAlready, true)">
                        <img :src="gst.html.getImageUrl('white_save.png')" class="coImg20">
                        <span class="coImgSpn">기존 DM방 새창으로 열기 </span>
                    </div>
                </div>
                <div style="margin-top:20px">1. DM방을 새로 만듭니다.</div>
                <div style="margin-top:20px">2. 임직원 또는 등록된 외부인의 이름(일부)을 넣고 Enter를 누르면 가져옵니다.</div>
                <div style="margin-top:20px">3. 추가된 이름(대상)을 확인하고 최초 메시지를 보내고 나면 방이 만들어집니다.</div>
                <div v-show="userSearched.length > 0" style="position:absolute;left:0;margin-top:3px;display:flex" :style="{ top: searchedResultTop + 'px' }">
                    <div style="width:48px"></div>
                    <div ref="userSearchedRef" tabindex="1" 
                        style="width:390px;min-height:60px;max-height:180px;padding:5px;border:1px solid dimgray;background:whitesmoke;z-index:1000;overflow-y:scroll;overflow-x:hidden">
                        <div v-for="(row, idx) in userSearched" @click="addUserToDm(row)" class="coHover" style="width:100%;min-height:30px;display:flex;align-items:center">
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
                            <div class="coDotDot" :title="row.userInfo" style="margin-left:5px">{{ row.userInfo }}</div>
                        </div>                            
                    </div>
                </div>
            </div>
            <div v-if="!showUserSearch" class="chan_center_header" id="chan_center_header">
                <div class="chan_center_header_left">
                    <img class="coImg18" :src="gst.html.getImageUrl(chanImg)" style="margin-right:5px" @click="adminJob">
                    <span v-if="adminShowID" style="margin-right:5px">{{ chanId }}</span>
                    <div v-if="hasProp()" style="margin-right:5px" @click="adminJob">스레드</div>
                    <div v-else style="display:flex;align-items:center">                    
                        <div v-if="appType=='dm'" class="coDotDot">{{ chanmemFullExceptMe.length >= 1 ? chanmemFullExceptMe.join(", ") : "나에게" }}</div>
                        <div v-else class="coDotDot">{{ chanNm }} {{ grnm ? "[" + grnm+ "]" : "" }}</div>
                    </div>
                    <span v-show="fetchByScrollEnd" style="color:darkblue;margin-left:10px">data by scrolling</span> 
                </div>
                <div class="chan_center_header_right">
                    <div v-if="!hasProp()" class="topMenu" style="padding:3px;display:flex;align-items:center;border:1px solid lightgray;border-radius:5px;font-weight:bold">
                        <div v-for="(row, idx) in chanmemUnder" style="width:24px;height:24px;display:flex;align-items:center;margin-right:2px">
                            <member-piceach :picUrl="row.url" sizeName="wh24"></member-piceach>
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
            <div v-if="!hasProp() && !showUserSearch" class="chan_center_nav" id="chan_center_nav">
                <div class="topMenu" :class="listMsgSel == 'all' ? 'list_msg_sel' : 'list_msg_unsel'" @click="listMsg('all')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                    <span style="margin-left:5px;font-weight:bold">메시지</span> 
                </div>
                <div class="topMenu" :class="listMsgSel == 'notyet' ? 'list_msg_sel' : 'list_msg_unsel'" @click="listMsg('notyet')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg_notyet.png')">
                    <span style="margin-left:5px;font-weight:bold">아직안읽음</span> 
                </div>
                <div class="topMenu" :class="listMsgSel == 'unread' ? 'list_msg_sel' : 'list_msg_unsel'"  @click="listMsg('unread')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg_unread.png')">
                    <span style="margin-left:5px;font-weight:bold">다시안읽음</span> 
                </div>
                <div class="topMenu" :class="listMsgSel == 'msg' ? 'list_msg_sel' : 'list_msg_unsel'" @click="openSearchInchan('msg')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_msg.png')">
                    <span style="margin-left:5px;font-weight:bold">검색</span> 
                </div>
                <div class="topMenu" :class="listMsgSel == 'file' ? 'list_msg_sel' : 'list_msg_unsel'" @click="openSearchInchan('file')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_file.png')">
                    <span style="margin-left:5px;font-weight:bold">파일</span> 
                </div>
                <div class="topMenu" :class="listMsgSel == 'image' ? 'list_msg_sel' : 'list_msg_unsel'" @click="openSearchInchan('image')">
                    <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_image.png')">
                    <span style="margin-left:5px;font-weight:bold">이미지</span> 
                </div>
                <span v-if="adminShowID" style="color:darkblue;font-weight:bold;margin-left:20px">{{ msglist.length }}개</span>
                <!-- <span v-show="listMsgSel == 'notyet'" @click="updateAllWithNewKind('notyet', 'read')"
                    style="padding:2px;margin-left:15px;background:beige;border:1px solid dimgray;border-radius:5px;cursor:pointer">모두읽음처리</span>
                <span v-show="listMsgSel == 'unread'" @click="updateAllWithNewKind('unread', 'read')"
                    style="padding:2px;margin-left:15px;background:beige;border:1px solid dimgray;border-radius:5px;cursor:pointer">모두읽음처리</span> -->
                <div v-show="listMsgSel == 'notyet'" class="coImgBtn" @click="updateAllWithNewKind('notyet', 'read')" style="margin:0 0 4px 12px">
                    <span class="coImgSpn">모두읽음처리</span>
                </div>
                <div v-show="listMsgSel == 'unread'" class="coImgBtn" @click="updateAllWithNewKind('unread', 'read')" style="margin:0 0 4px 12px">
                    <span class="coImgSpn">모두읽음처리</span>
                </div>
                <span style="min-width:36px;margin:0 5px 5px 10px;color:dimgray">관리 :</span><span class="coDotDot" style="min-width:80px;margin:0 5px 5px 5px">{{ chanMasterNm }}</span>
            </div> 
            <div class="chan_center_body" id="chan_center_body" :childbody="hasProp() ? true : false" ref="scrollArea" @scroll="onScrolling">
                <div v-show="afterScrolled" ref="observerTopTarget" class="coObserverTarget">{{ hush.cons.moreData }}</div>
                <div v-for="(row, idx) in tempInfo">
                    <div>{{ row.kind + '===' + row.msgid }}</div>
                </div>
                <div v-for="(row, idx) in msglist" :key="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }" :keyidx="idx" class="msg_body procMenu"
                    :style="{ borderBottom: row.hasSticker ? '' : '1px solid lightgray', background: row.background ? row.background : '' }"
                    @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                    <div style="width:100%;display:flex;align-items:center;cursor:pointer" v-show="!row.stickToPrev">
                        <img v-if="chandtlObj[row.AUTHORID] && chandtlObj[row.AUTHORID].url" :src="chandtlObj[row.AUTHORID].url" 
                            class="coImg32 maintainContextMenu" style="border-radius:16px" @click="(e) => memProfile(e, row, chandtlObj[row.AUTHORID].url)">
                        <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg32 maintainContextMenu" @click="(e) => memProfile(e, row, gst.html.getImageUrl('user.png'))">
                        <span style="margin-left:9px;font-weight:bold">{{ row.AUTHORNM }}</span>
                        <!-- <span v-if="vipStr.includes(row.AUTHORID)" 
                            style="margin-left:8px;padding:1px;font-size:12px;background:black;color:white;border-radius:5px">VIP</span> -->
                        <span v-if="vipStr.includes(',' + row.AUTHORID + ',')" class="vipMark">VIP</span>
                        <span v-if="adminShowID" style="margin-left:9px;color:dimgray">{{ row.MSGID }}</span>
                        <span style="margin-left:9px;color:dimgray">{{ hush.util.displayDt(row.CDT) }}</span>
                        <span v-if="row.firstNotYet" style="margin-left:9px;color:maroon;font-weight:bold">
                            아직 안읽은 메시지입니다. {{ row.firstNotYet == "child" ? "(댓글)" : "" }}
                        </span>
                    </div>
                    <div style="width:100%;display:flex;margin:10px 0">
                        <div style="width:40px;display:flex;flex-direction:column;justify-content:center;align-items:center;color:dimgray;cursor:pointer">
                            <span v-show="row.stickToPrev" style="color:lightgray">{{ hush.util.displayDt(row.CDT, true) }}</span>
                            <img v-if="row.act_later=='later'" class="coImg18"  style="margin-top:5px" :src="gst.html.getImageUrl('violet_later.png')" title="나중에">
                            <img v-if="row.act_fixed=='fixed'" class="coImg18"  style="margin-top:5px" :src="gst.html.getImageUrl('violet_fixed.png')" title="고정">
                        </div>
                        <div style="width:calc(100% - 40px);overflow-x:auto">
                            <div v-html="row.BODY" @copy="(e) => msgCopied(e)"></div>
                        </div>
                    </div>
                    <div v-if="row.CDT != row.UDT" style="margin-bottom:10px;margin-left:40px;color:dimgray"><span>(편집: </span><span>{{ row.UDT.substring(0, 19) }})</span></div>
                    <div class="msg_body_sub"><!-- 반응, 댓글 -->
                        <!-- <div v-for="(row1, idx1) in row.msgdtl" class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM" @click="toggleAction(row.MSGID, row1.KIND)">
                            <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                            <span style="margin-left:3px">{{ row1.CNT}}</span>
                        </div> -->
                        <div v-for="(row1, idx1) in row.msgdtl">
                            <!-- <div v-if="row1.KIND != 'read' && row1.KIND != 'unread'" class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM" @click="toggleAction(row.MSGID, row1.KIND)">
                                <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                                <span style="margin-left:3px">{{ row1.CNT}}</span>
                            </div> -->
                            <div class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM" @click="toggleAction(row.MSGID, row1.KIND)">
                                <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                                <span style="margin-left:3px">{{ row1.CNT}}</span>
                            </div>
                        </div>
                        <!-- <div v-if="row.msgdtl.length > 0" class="msg_body_sub1">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘">
                        </div>      -->
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
                                <span v-show="row.replyinfo[0].MYNOTYETCNT > 0" class="mynotyet">{{ row.replyinfo[0].MYNOTYETCNT }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="msg_body_sub"><!-- Mention -->
                        <div v-for="(row1, idx1) in row.msgdtlmention" style="margin-top:10px">
                            <span class="maintainContextMenu" style="margin-right:5px;padding:3px;font-weight:bold;color:steelblue;background:beige" 
                            @mouseenter="mentionEnter(row, row1)" @mouseleave="mentionLeave(row, row1)" @click="(e) => procMention(e, row1)">
                                @{{ row1.USERNM }}
                            </span>
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
                        <!-- <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘" @click="openEmoti(row.MSGID)"></span> -->
                        <span v-if="!hasProp()" class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드열기" @click="openThread(row.MSGID)"></span>
                        <!-- <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달" @click="forwardMsg(row.MSGID)"></span> -->
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
                <div v-if="msglist.length == 0" style="height:100%;display:flex;justify-content:center;align-items:center">
                    <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
                </div>
                <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget">{{ hush.cons.moreData }}</div>
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
                    <!-- <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘추가" 
                        :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="addEmoti()"> -->
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
                    @paste="pasteData" @keydown.enter.prevent="keyDownEnter" @focusin="editorFocused(true)" @blur="editorFocused(false)">
                </div> <!--@keyup.enter="keyUpEnter" 로 처리시 prevent는 필요없지만 newline이 생김 : @keydown.enter.prevent로 대체-->
                <div v-else id="msgContent" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" ref="editorRef" 
                    @paste="pasteData" @keydown.enter.prevent="keyDownEnter" @focusin="editorFocused(true)" @blur="editorFocused(false)">
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
        <div class="chan_right" v-if="thread.msgid" :style="{ width: widthChanRight }">
            <msg-list :data="thread" @ev-click="clickFromProp" ref="msglistRef"></msg-list>
        </div>        
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
    <popup-chan-dm ref="popupChanDmRef" @ev-click-chandm="okChanDmPopup"></popup-chan-dm> 
    <media-search ref="mediaPopupRef"></media-search>
</template>

<style scoped>  
    .chan_main { /* 원래는 각 패널에 있다가 msglist 라우팅(새창에서열기) 때문에 여기로 이동 - 댓글 관련 */
        width:100%;height:100%;display:flex;
        background:white;border-top-right-radius:10px;border-bottom-right-radius:10px;
    }
    .chan_center {
        height:100%;padding: 0 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;justify-content:space-between;overflow:hidden
    }
    .chan_center_header_left {
        width:70%;height:100%;display:flex;align-items:center;
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
    }
    .chan_center_nav {
        width:100%;min-height:30px;display:flex;align-items:center;
        border-bottom:1px solid dimgray;overflow:hidden
    }
    .list_msg_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .list_msg_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        position:relative;width:calc(100% - 20px);display:flex;flex-direction:column;margin:5px 0 0 0; /*position:relative는 floating menu에 필요*/
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
    .msg_file_each { /*position:relative는 floating menu에 필요*/
        position:relative;min-width:100px;height:30px;margin:10px 10px 0 0;padding:0 5px;display:flex;align-items:center;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_file_each:hover { background:var(--hover-color) }
    .msg_file_each:active { background:lightsteelblue }
    .msg_file_seemore {
        position:absolute;top:0;right:0;padding:0 3px;height:30px;display:flex;align-items:center;background:whitesmoke;border-radius:0px
    }
    .msg_file_del {
        position:absolute;top:-10px;right:-10px;width:18px;height:18px;border-radius:9px;display:flex;align-items:center;background:beige
    }
    .msg_image_each {/*position:relative는 floating menu에 필요*/
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
        height:100%;border-left:var(--border-lg) /* 여기에 다시 MsgList.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
    }
    .topMenu { cursor:pointer }
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
    /*.saveMenu { display:flex;align-items:center;padding:5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px }
    .saveMenu:hover { opacity:0.5 }
    .saveMenu:active { background:darkblue;opacity:1.0 }*/
    .saveMenu { display:flex;align-items:center;padding:5px;margin:0 10px 0 5px;background:#3B693B;border-radius:5px }
    .saveMenu:hover { opacity:0.8 }
    .saveMenu:active { opacity:0.6 }
    .btn { padding:3px 6px;display:flex;align-items:center;color:dimgray;border:1px solid dimgray;border-radius:5px;cursor:pointer }
    .btn:hover { background:lightgray}
    .btn:active { background:var(--active-color)}
    .mynotyet { width:12px;height:12px;display:flex;align-items:center;justify-content:center;border-radius:8px;background-color:orange;color:white;font-size:12px;padding:4px;margin-left:10px }
    .vipMark { margin-left:5px;padding:1px 2px 2px 2px;font-size:10px;background:black;color:white;border-radius:5px }
</style>
