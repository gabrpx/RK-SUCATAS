import{O as i,x as o}from"./api-DE4Syt9q.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const a=[["path",{d:"M9 14 4 9l5-5",key:"102s5s"}],["path",{d:"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11",key:"f3b9sd"}]],s=i("undo-2",a),c={listarRecebimentos:()=>o.get("/api/fiado/recebimentos"),registrarRecebimento:e=>o.post("/api/fiado/recebimentos",e),removerRecebimento:e=>o.delete(`/api/fiado/recebimentos/${e}`)};export{s as U,c as f};
