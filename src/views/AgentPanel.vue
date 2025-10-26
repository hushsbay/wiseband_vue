<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import GeneralStore from '/src/stores/GeneralStore.js'
import S_CATE from '/src/testdata/S_CATE.json'

const gst = GeneralStore()
const router = useRouter()

const kind = ref('개인')
const cate = ref([])

onMounted(() => {
	// testdata load (only 개인 implemented)
	cate.value = S_CATE.map(item => ({ ...item, exploded: item.DEPTH == 0 ? true : false }))
})

function changeKind() {
	// currently only 개인
}

function nodeClick(row) {
	if (!row.CATEID) return
	// navigate to DocList with cateid
	router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: '0' } })
}

function allowDrop(e) { e.preventDefault() }

function handleDrop(e, row) {
	e.preventDefault()
	// two drop sources: draggedDoc (doc id) or dragged_tag (from DocList)
	const draggedDoc = localStorage.getItem('wiseband_dragged_doc')
	if (draggedDoc) {
		// navigate to agent_list with docid to indicate classification
		router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: draggedDoc } })
		localStorage.removeItem('wiseband_dragged_doc')
		return
	}
	const draggedTag = localStorage.getItem('wiseband_dragged_tag')
	if (draggedTag) {
		try {
			const obj = JSON.parse(draggedTag)
			// navigate to agent_list with cateid (target) and docid so DocList can update the doc's category
			router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: obj.docid } })
			gst.util.setToast('분류가 트리에 적용되었습니다.')
		} catch (err) {
			// ignore
		}
		localStorage.removeItem('wiseband_dragged_tag')
		return
	}

	// support drag requests coming from DocList drop_tag when user wants to pick a node
	const dragRequest = localStorage.getItem('wiseband_drag_request')
	if (dragRequest) {
		try {
			const req = JSON.parse(dragRequest)
			// req.docid contains the doc that requested a node — apply this node to that doc
			router.push({ name: 'agent_list', params: { cateid: row.CATEID, docid: req.docid } })
			gst.util.setToast('분류가 트리에 적용되었습니다.')
		} catch (err) {
			// ignore
		}
		localStorage.removeItem('wiseband_drag_request')
		return
	}
}

function nodeDragStart(e, row, idx) {
    // Build a simple path like 'Parent > Child' by walking cate backwards
    let path = row.CATENM
    if (row.DEPTH && row.DEPTH > 0) {
        // find ancestors
        for (let i = idx - 1; i >= 0; i--) {
            const p = cate.value[i]
            if (p && p.DEPTH < row.DEPTH) {
                path = p.CATENM + ' > ' + path
                // for multi-level, continue walking
                if (p.DEPTH > 0) {
                    // continue to find higher ancestors
                    let curDepth = p.DEPTH
                    for (let j = i - 1; j >= 0; j--) {
                        const pp = cate.value[j]
                        if (pp && pp.DEPTH < curDepth) {
                            path = pp.CATENM + ' > ' + path
                            curDepth = pp.DEPTH
                            if (curDepth == 0) break
                        }
                    }
                }
                break
            }
        }
    }
    const payload = { cateid: row.CATEID, path: path }
    try { localStorage.setItem('wiseband_dragged_node', JSON.stringify(payload)) } catch (e) {}
}
</script>

<template>
	<div class="agent_panel">
		<div class="agent_side">
			<div class="agent_side_top">
				<select v-model="kind" @change="changeKind" class="kind_select">
					<option>개인</option>
					<option>공유</option>
					<option>전체</option>
				</select>
			</div>
			<div class="agent_side_main coScrollable">
				<div v-for="(row, idx) in cate" :key="row.CATEID" class="node_wrap">
					<div class="node" :class="row.DEPTH == 0 ? 'nodeRoot' : 'nodeLeaf'" @click="nodeClick(row)" @dragover.prevent="allowDrop" @drop="(e) => handleDrop(e, row)" draggable="true" @dragstart="(e) => nodeDragStart(e, row, idx)">
						<img class="coImg14" :src="gst.html.getImageUrl(row.DEPTH == 0 ? 'folder.png' : 'file.png')">
						<span>{{ row.CATENM }}</span>
					</div>
				</div>
			</div>
		</div>
		<div class="agent_body">
			<router-view />
		</div>
	</div>
</template>

<style scoped>
.agent_panel { display:flex;height:100% }
.agent_side { width:320px;background:var(--second-color);border-right:1px solid #ddd;display:flex;flex-direction:column }
.agent_side_top { height:48px;display:flex;align-items:center;padding:8px }
.kind_select { width:100%;padding:6px;border-radius:6px;border:none;background:var(--second-color);color:var(--second-select-color) }
.agent_side_main { flex:1;padding:8px;overflow:auto }
.node { display:flex;align-items:center;padding:8px;border-radius:6px;cursor:pointer }
.nodeRoot { font-weight:700;color:var(--second-select-color) }
.nodeLeaf { padding-left:18px;color:var(--second-select-color) }
.node:hover { background:var(--second-hover-color) }
.agent_body { flex:1; padding:12px; overflow:auto }
</style>