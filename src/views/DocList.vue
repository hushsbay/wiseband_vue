<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import S_CATE from '/src/testdata/S_CATE.json'
import { useRoute, useRouter } from 'vue-router'
import GeneralStore from '/src/stores/GeneralStore.js'
import S_DOCMST from '/src/testdata/S_DOCMST_BY_DT.json'

const gst = GeneralStore()
const route = useRoute()
const router = useRouter()

const cateid = ref(route.params.cateid ?? '')
const docidParam = ref(route.params.docid ?? '0')

const docs = ref([])

onMounted(() => {
  // load sample docs filtered by cate
  // ensure we pick up current route params (may include query forcing reload)
  cateid.value = route.params.cateid ?? ''
  docidParam.value = route.params.docid ?? '0'
  console.log('[DocList] onMounted', { fullPath: route.fullPath, params: route.params })
  loadDocs()
})

// react to route param changes (makes reload/restore reliable)
watch(() => route.params.cateid, (nv) => {
  cateid.value = nv ?? ''
  console.log('[DocList] watch params.cateid ->', cateid.value)
  loadDocs()
})
watch(() => route.params.docid, (nv) => {
  docidParam.value = nv ?? '0'
  console.log('[DocList] watch params.docid ->', docidParam.value)
  loadDocs()
})

// also reload when fullPath changes (covers query-only changes used to force reload)
watch(() => route.fullPath, (nv) => {
  // refresh local params then reload
  cateid.value = route.params.cateid ?? ''
  docidParam.value = route.params.docid ?? '0'
  loadDocs()
})

function loadDocs() {
  console.log('[DocList] loadDocs start', { cateid: cateid.value, docidParam: docidParam.value })
  docs.value = S_DOCMST.filter(d => d.CATEID == cateid.value)
  console.log('[DocList] loadDocs result count', docs.value.length)
  // if docidParam is passed (from drop), mark classification
  if (docidParam.value && docidParam.value != '0') {
    const idx = docs.value.findIndex(d => d.DOCID == docidParam.value)
    if (idx >= 0) {
      // set this doc's CATEID to the cate param and set a friendly tag
      docs.value[idx].CATEID = cateid.value
      docs.value[idx].CATETAG = getCatePath(cateid.value)
      gst.util.setToast('분류가 적용되었습니다.')
    } else {
      // maybe doc belongs to other cate; we still navigate and show top — no-op here
    }
  }
}

function getCatePath(cateid) {
  if (!cateid) return ''
  const arr = S_CATE
  const idx = arr.findIndex(x => x.CATEID == cateid)
  if (idx == -1) return ''
  const node = arr[idx]
  let path = node.CATENM
  // walk backwards to assemble parents
  if (node.DEPTH && node.DEPTH > 0) {
    let curDepth = node.DEPTH
    for (let i = idx - 1; i >= 0; i--) {
      const p = arr[i]
      if (p && p.DEPTH < curDepth) {
        path = p.CATENM + ' > ' + path
        curDepth = p.DEPTH
        if (curDepth == 0) break
      }
    }
  }
  return path
}

function titleToggle(item) {
  item.editTitle = !item.editTitle
  if (item.editTitle) item._titleTmp = item.TITLE
}

function saveTitle(item) {
  if (item._titleTmp != undefined) item.TITLE = item._titleTmp
  item.editTitle = false
}

function startClassDrag(e, item) {
  // store dragged doc id in localStorage to be read by AgentPanel drop
  localStorage.setItem('wiseband_dragged_doc', item.DOCID)
  gst.util.setToast('분류할 노드를 왼쪽 트리에 드래그하여 놓으세요.')
}

function handleNodeDrop(e, item) {
  e.preventDefault()
  const nd = localStorage.getItem('wiseband_dragged_node')
  if (!nd) return
  try {
    const obj = JSON.parse(nd)
    item.CATEID = obj.cateid
    item.CATETAG = obj.path
    gst.util.setToast('셀에 분류가 설정되었습니다: ' + obj.path)
  } catch (err) {
    // ignore
  }
  localStorage.removeItem('wiseband_dragged_node')
}

function tagDragStart(e, item) {
  // When user drags the tag area, indicate a request to pick a tree node for this doc
  const payload = { docid: item.DOCID }
  try { localStorage.setItem('wiseband_drag_request', JSON.stringify(payload)) } catch (err) {}
}

function removeClassification(item) {
  item.CATEID = ''
}

function sendPrompt() {
  const editor = document.getElementById('agentEditor')
  if (!editor) return
  const bodyText = editor.innerText.trim()
  if (!bodyText) return
  // append a fake doc as if sent to AI; no server call
  const newDoc = {
    DOCID: 'tmp' + Date.now(),
    CATEID: cateid.value,
    AUTHORID: 'local',
    AUTHORNM: '나',
    RQTEXT: bodyText,
    RSTEXT: 'AI 응답 (샘플) - ' + bodyText,
    RMKSTEXT: '',
    TITLE: bodyText.substring(0, 40),
    PARENTID: '',
    KIND: 'Github Copilot',
    CDT: new Date().toISOString().replace(/[-:T.]/g,'').slice(0,14)
  }
  // insert at top
  docs.value.unshift(newDoc)
  editor.innerText = ''
}

function formatCdt(cdt) {
  if (!cdt) return ''
  // if already ISO-like, try parsing
  if (typeof cdt === 'string') {
    const s = cdt.trim()
    // YYYYMMDDHHmmss
    if (/^\d{14}$/.test(s)) {
      return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)} ${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}`
    }
    // ISO
    const parsed = Date.parse(s)
    if (!isNaN(parsed)) {
      const d = new Date(parsed)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth()+1).padStart(2,'0')
      const dd = String(d.getDate()).padStart(2,'0')
      const hh = String(d.getHours()).padStart(2,'0')
      const min = String(d.getMinutes()).padStart(2,'0')
      const sec = String(d.getSeconds()).padStart(2,'0')
      return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`
    }
  }
  return String(cdt)
}
</script>

<template>
  <div class="doc_list">
    <div class="cards_wrap coScrollable">
      <div v-if="docs.length == 0" class="no-data">해당 분류에 문서가 없습니다.</div>
      <div v-for="(item, idx) in docs" :key="item.DOCID">
        <!-- request card (right aligned) -->
        <div class="msg_row rq_row">
          <div class="doc_card rq_card">
            <div class="doc_card_top">
              <div class="top_left">
                <button class="btn title" v-show="!item.editTitle" @click="titleToggle(item)">{{ item.TITLE || '제목 없음' }}</button>
                <div class="title_edit" v-show="item.editTitle">
                  <input v-model="item._titleTmp" />
                  <button class="save_btn" @click="saveTitle(item)">저장</button>
                </div>
              </div>
              <div class="top_right">
                <label class="chk_delete"><input type="checkbox"> 삭제</label>
              </div>
            </div>

            <div class="doc_card_info">
              <div class="kind">{{ item.KIND }}</div>
              <div class="card_time">{{ formatCdt(item.CDT) }}</div>
            </div>

            <div class="doc_body">
              <div class="rq_text">{{ item.RQTEXT }}</div>
            </div>
          </div>
        </div>

        <!-- response card (left aligned) -->
        <div class="msg_row rs_row">
          <div class="doc_card rs_card">
            <div class="drop_tag" @dragover.prevent @drop="(e) => handleNodeDrop(e, item)" draggable="true" @dragstart="(e) => tagDragStart(e,item)">
                {{ item.CATETAG || 'drag & drop tree node here' }}
            </div>
            <div class="doc_body">
                <div class="rs_text">{{ item.RSTEXT }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="editor_area" role="region" aria-label="AI 프롬프트 입력">
      <div id="agentEditor" class="editor" contenteditable="true" placeholder="AI 프롬프트를 입력하세요..."></div>
      <div class="editor_controls">
        <button class="send" @click="sendPrompt">전송</button>
        <button class="attach" type="button">파일</button>
        <div class="agent_name">Github Copilot</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.doc_list { display:flex; flex-direction:column; gap:12px; height:100%; box-sizing:border-box }
.no-data { color:var(--second-select-color); padding:20px }
.cards_wrap { flex:1; overflow:auto; padding:6px; box-sizing:border-box }
.doc_card { display:inline-block; border-radius:6px; padding:12px; box-sizing:border-box; width:auto }
.rq_card { box-sizing:border-box; max-width:90%; min-width:220px; background:#f5ead6 }
.rs_card { box-sizing:border-box; max-width:90%; min-width:220px; background:#c7eaff }
.msg_row { margin:0 }
.rq_row { text-align:right; margin-bottom:8px }
.rs_row { text-align:left; margin-bottom:24px }
.card_time { font-size:12px; color:#666; text-align:right; margin-top:6px }
.cardA { background: #f5ead6; }
.cardB { background: #caf0f8; }
.doc_card_top { display:flex; align-items:center; gap:8px; justify-content:space-between }
.top_left { display:flex; align-items:center; gap:8px }
.top_right { display:flex; align-items:center; gap:8px }
.chk_delete { margin-left:8px }
.btn { padding:6px 8px; border-radius:6px; border:1px solid rgba(0,0,0,0.08); background:transparent; cursor:pointer }
.title_edit input { padding:6px }
.title, .title_edit { height:36px; display:flex; align-items:center }
.title_edit input { height:24px; min-width:220px }
.save_btn { background:var(--active-color); color:white; padding:6px 10px; border-radius:6px; border:none; margin-left:8px }
.drop_tag { cursor:grab }
.doc_times { font-size:12px; color:#666; margin-top:6px }
.doc_body { margin-top:8px; padding:8px; border-radius:6px; border:1px solid rgba(0,0,0,0.06); background:rgba(255,255,255,0.6); width:100%; box-sizing:border-box }
.rq_text { width:100%;min-height:40px; padding:8px; background:rgba(255,255,255,0.4); border-radius:4px; text-align:right; white-space:pre-wrap; word-break:break-word }
.rs_text { min-height:60px; padding:8px; background:rgba(255,255,255,0.4); border-radius:4px; text-align:left; white-space:pre-wrap; word-break:break-word }
.drop_tag { display:inline-block; padding:6px 10px; background:rgba(255,255,255,0.9); border-radius:16px; margin-bottom:8px; cursor:grab; font-size:13px; color:#333 }
.kind { background:rgba(255,255,255,0.2); padding:6px 10px; border-radius:12px }
.card_time { font-size:12px; color:#666 }
.chk_delete { display:flex; align-items:center }
.doc_card_info { display:flex; justify-content:space-between; align-items:center; margin-top:6px }
.editor_area { flex:0 0 auto; background-color:var(--primary-color); padding:8px 8px 0 8px; border-radius:0; display:flex; flex-direction:column; z-index:50; box-shadow: 0 -6px 20px rgba(0,0,0,0.25); width:100%; box-sizing:border-box }
.editor { min-height:60px; padding:8px; border-radius:0; background:#ffffff; outline:none; max-height:80%; overflow:auto; box-shadow: 0 2px 6px rgba(0,0,0,0.12); width:100%; box-sizing:border-box }
.editor_controls { display:flex; align-items:center; gap:8px; margin-top:8px }
.send { background:var(--active-color); color:white; padding:8px 12px; border-radius:0; border:none }
.attach { background:var(--active-color); color:white; padding:8px 12px; border-radius:0; border:none; cursor:pointer }
.agent_name { margin-left:auto; padding:6px 10px; border-radius:0; background:rgba(255,255,255,0.2) }

/* dark mode tweaks */
@media (prefers-color-scheme: dark) {
  .cardA { background:#3b2f1f }
  .cardB { background:#12343b }
  .doc_body { background: rgba(255,255,255,0.03) }
  .editor { background:#222;color:#eee }
}
</style>