function executeWidgetCode() {
    console.log("--- Widget Execution Started ---");

    require([
        "DS/PlatformAPI/PlatformAPI",
        "DS/DataDragAndDrop/DataDragAndDrop",
        "DS/WAFData/WAFData",
        "DS/i3DXCompassServices/i3DXCompassServices"
    ], function(PlatformAPI, DataDragAndDrop, WAFData, i3DXCompassServices) {

        var myWidget = {
            url3DSpace: "",

            onLoadWidget: function() {
                myWidget.callData();
                myWidget.initDropzone();
            },

            callData: function() {
                var platformId = widget.getValue('x3dPlatformId');
                i3DXCompassServices.getServiceUrl({
                    serviceName: '3DSpace',
                    platformId: platformId,
                    onComplete: function(url) {
                        myWidget.url3DSpace = url;
                    }
                });
            },

            initDropzone: function() {
                var dropElement = document.getElementById("drop-zone-ui");
                DataDragAndDrop.droppable(dropElement, {
                    drop: function(data) {
                        var dataDnD = JSON.parse(data);
                        var physicalid = dataDnD.data.items[0].objectId;
                        var dropContext = dataDnD.data.items[0].contextId;
                        myWidget.fetchObjectInfo(physicalid, dropContext);
                    }
                });
            },

            fetchObjectInfo: function(physicalid, securityContext) {
                var urlWAF = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + physicalid + "?$mask=dsmveng:EngItemMask.Details";
                WAFData.authenticatedRequest(urlWAF, {
                    method: "GET",
                    headers: { "SecurityContext": securityContext, "Accept": "application/json" },
                    type: "json",
                    onComplete: function(dataResp) {
                        myWidget.displayData(dataResp);
                        myWidget.getCsrfAndExpand(physicalid, securityContext);
                    }
                });
            },

            getCsrfAndExpand: function(physicalid, securityContext) {
                var csrfUrl = myWidget.url3DSpace + "/resources/v1/application/CSRF";
                WAFData.authenticatedRequest(csrfUrl, {
                    method: "GET",
                    headers: { "SecurityContext": securityContext },
                    type: "json",
                    onComplete: function(csrfResp) {
                        myWidget.executeExpand(physicalid, securityContext, csrfResp.csrf.name, csrfResp.csrf.value);
                    }
                });
            },

            executeExpand: function(id, context, csrfName, csrfValue) {
                var resultContainer = document.getElementById("apiResult");
                resultContainer.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px;">
                        <div class="spinner"></div>
                        <p style="margin-top:15px; color:#666; font-size:13px;">Loading 1st Level Structure...</p>
                    </div>`;

                var expandUrl = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + id + "/expand";
                var body = {
                    "expandDepth": -1,
                    "withPath": true,
                    "type_filter_bo": ["VPMReference", "VPMRepReference"],
                    "type_filter_rel": ["VPMInstance", "VPMRepInstance"]
                };

                WAFData.authenticatedRequest(expandUrl, {
                    method: "POST",
                    headers: {
                        "SecurityContext": context,
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        [csrfName]: csrfValue
                    },
                    data: JSON.stringify(body),
                    type: "json",
                    onComplete: function(expandData) {
                        myWidget.renderExpandTable(expandData);
                    }
                });
            },

            displayData: function(arrData) {
                var contentDiv = document.getElementById("content-display");
                var dropZone = document.getElementById("drop-zone-ui");
                
                dropZone.style.display = "none";
                contentDiv.style.display = "block";

                var objInfo = (arrData.member && arrData.member[0]) ? arrData.member[0] : (arrData[0] ? arrData[0] : arrData);
                var name = objInfo.title || objInfo.name || "Selected Object";

                contentDiv.innerHTML = `
                    <style>
                        .data-card { width: 98%; max-width: 1100px; margin: 10px auto; background: white; border: 1px solid #d1d4d4; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-family: 'Arial', sans-serif; }
                        .card-header { padding: 12px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                        .toolbar { padding: 8px 20px; background: #f9f9f9; border-bottom: 1px solid #eee; display: flex; gap: 10px; }
                        .bom-container { max-height: 500px; min-height: 200px; overflow-y: auto; overflow-x: auto; width: 100%; position: relative; }
                        .bom-table { width: 100%; border-collapse: collapse; font-size: 13px; color: #333; }
                        .bom-table th { background: #f1f1f1; padding: 10px; text-align: left; color: #666; font-weight: normal; position: sticky; top: 0; border-bottom: 1px solid #ddd; z-index: 10; }
                        .tree-row td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
                        .tree-row.hidden { display: none; }
                        .tree-toggle { 
                            cursor: pointer; width: 16px; height: 16px; display: inline-flex; align-items: center; 
                            justify-content: center; border: 1px solid #ccc; font-size: 12px; margin-right: 6px; 
                            background: #fff; color: #666; user-select: none; border-radius: 2px; font-family: monospace;
                        }
                        .type-icon-3dx { width: 18px; height: 18px; vertical-align: middle; margin-right: 6px; }
                        .state-badge { padding: 2px 8px; color: white; border-radius: 12px; font-size: 10px; font-weight: bold; }
                        .btn-reset, .btn-tool { border: 1px solid #ccc; background: white; cursor: pointer; padding: 4px 12px; border-radius: 3px; font-size: 11px; transition: 0.2s; }
                        .btn-tool:hover { background: #42a5f5; color: white; border-color: #42a5f5; }
                        .btn-primary { width: 100%; background: #42a5f5; color: white; border: none; padding: 12px; font-weight: bold; cursor: pointer; border-radius: 0 0 4px 4px; }
                        .spinner { width: 30px; height: 30px; border: 3px solid #f3f3f3; border-top: 3px solid #42a5f5; border-radius: 50%; animation: spin 1s linear infinite; }
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    </style>
                    <div class="data-card">
                        <div class="card-header">
                            <div style="display:flex; align-items:center;">
                                <img src="${myWidget.url3DSpace}/cvservlet/files?fileType=ICON&ipml_46_iconname=I_VPMNavProduct" style="width:20px; margin-right:8px;">
                                <h3 style="margin:0; font-size: 16px;">${name}</h3>
                            </div>
                            <button id="widgetResetBtn" class="btn-reset">✕ Reset</button>
                        </div>
                        <div class="toolbar">
                            <button class="btn-tool" onclick="executeWidgetCode.expandAll()">Expand All</button>
                            <button class="btn-tool" onclick="executeWidgetCode.collapseAll()">Collapse All</button>
                        </div>
                        <div id="apiResult" class="bom-container"></div>
                        <button id="callApiBtn" class="btn-primary">Export to Vertex</button>
                    </div>`;

                document.getElementById("widgetResetBtn").onclick = function() {
                    contentDiv.style.display = "none";
                    dropZone.style.display = "flex";
                };
            },

            renderExpandTable: function(expandData) {
                var contentDiv = document.getElementById("apiResult");
                var members = expandData.member || [];
                var map = {};
                var rootId = null;

                members.forEach(m => {
                    if (m.type === "VPMReference" || m.type === "3DShape") {
                        map[m.id] = { ...m, children: [] };
                        if (!rootId && m.type === "VPMReference") rootId = m.id;
                    }
                });

                members.forEach(m => {
                    if (m.Path && m.Path.length >= 3) {
                        for (var i = 0; i < m.Path.length - 2; i += 2) {
                            var parentId = m.Path[i];
                            var childId = m.Path[i + 2];
                            if (map[parentId] && map[childId]) {
                                var exists = map[parentId].children.some(c => c.id === childId);
                                if (!exists) { map[parentId].children.push(map[childId]); }
                            }
                        }
                    }
                });

                contentDiv.innerHTML = `
                    <table class="bom-table">
                        <thead>
                            <tr>
                                <th style="width: 45%;">Title</th>
                                <th>Rev</th>
                                <th>Type</th>
                                <th>Owner</th>
                                <th>State</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${myWidget.generateTreeHTML(map[rootId], 0, null)}
                        </tbody>
                    </table>`;
            },

            generateTreeHTML: function(node, level, parentUniqueId) {
                if (!node) return "";
                var indent = level * 20;
                var isShape = node.type === "3DShape";
                var hasChildren = node.children && node.children.length > 0;
                
                // Logic for 3DPart Icon
                var hasSubAssembly = node.children && node.children.some(c => c.type === "VPMReference");
                var isPhysicalProduct = node.type === "VPMReference";

                // --- 1 LEVEL DEEP LOGIC ---
                var isHidden = level > 1 ? "hidden" : "";
                var toggleChar = level >= 1 ? "+" : "-";

                var rowId = "row_" + node.id + "_" + Math.floor(Math.random() * 1000000);
                var parentAttr = parentUniqueId ? `data-parent="${parentUniqueId}"` : "";

                var iconUrl = "";
                if (isShape) {
                    iconUrl = myWidget.url3DSpace + "/cvservlet/files?fileType=ICON&ipml_46_iconname=I_Part&taxonomies=types%2FPLMEntity%2FPLMReference%2FPLMCoreRepReference%2FLPAbstractRepReference%2FLPAbstract3DRepReference%2FPHYSICALAbstract3DRepReference%2FVPMRepReference%2F3DShape";
                } else if (isPhysicalProduct && !hasSubAssembly) {
                    iconUrl = myWidget.url3DSpace + "/cvservlet/files?fileType=ICON&ipml_46_iconname=I_VPMNavProduct&taxonomies=types%2FPLMEntity%2FPLMReference%2FPLMCoreReference%2FLPAbstractReference%2FPHYSICALAbstractReference%2FVPMReference&icon_95_2ddefaultthb_46_subtype=3DPart";
                } else {
                    iconUrl = myWidget.url3DSpace + "/snresources/images/icons/small/I_VPMNavProduct.png";
                }

                var html = `
                    <tr class="tree-row ${isHidden}" id="${rowId}" ${parentAttr}>
                        <td style="padding-left: ${indent + 10}px;">
                            <div style="display: flex; align-items: center;">
                                ${hasChildren ? `<span class="tree-toggle" onclick="executeWidgetCode.toggleNode('${rowId}')">${toggleChar}</span>` : '<span style="width:24px"></span>'}
                                <img src="${iconUrl}" class="type-icon-3dx">
                                <span class="node-title">${node.title || node.name}</span>
                            </div>
                        </td>
                        <td style="color: #42a5f5; font-weight: bold;">${node.revision || "A"}</td>
                        <td style="color: #666;">${isShape ? "3D Shape" : (hasSubAssembly ? "Assembly" : "3D Part")}</td>
                        <td>${node.owner || ""}</td>
                        <td>
                            <span class="state-badge" style="background:${node.state === 'IN_WORK' ? '#008eb0' : (node.state === 'RELEASED' ? '#00a65a' : '#7a7a7a')};">
                                ${node.state || ""}
                            </span>
                        </td>
                    </tr>`;

                if (node.children) {
                    node.children.forEach(child => {
                        html += myWidget.generateTreeHTML(child, level + 1, rowId);
                    });
                }
                return html;
            }
        };

        // --- EXPOSED UTILITIES ---
        executeWidgetCode.toggleNode = function(rowId) {
            var row = document.getElementById(rowId);
            var toggleBtn = row.querySelector('.tree-toggle');
            var isExpanding = toggleBtn.innerText === "+";
            toggleBtn.innerText = isExpanding ? "-" : "+";
            setChildVisibility(rowId, isExpanding);
        };

        executeWidgetCode.expandAll = function() {
            document.querySelectorAll('.tree-row').forEach(r => r.classList.remove('hidden'));
            document.querySelectorAll('.tree-toggle').forEach(t => t.innerText = "-");
        };

        executeWidgetCode.collapseAll = function() {
            document.querySelectorAll('.tree-row[data-parent]').forEach(r => {
                var parentRow = document.getElementById(r.getAttribute('data-parent'));
                if (parentRow && parentRow.hasAttribute('data-parent')) {
                    r.classList.add('hidden');
                } else {
                    r.classList.remove('hidden');
                }
            });
            document.querySelectorAll('.tree-toggle').forEach(t => t.innerText = "+");
            var rootToggle = document.querySelector('.tree-row:not([data-parent]) .tree-toggle');
            if (rootToggle) rootToggle.innerText = "-";
        };

        function setChildVisibility(pid, visible) {
            document.querySelectorAll(`[data-parent="${pid}"]`).forEach(r => {
                if (visible) {
                    r.classList.remove('hidden');
                    var childToggle = r.querySelector('.tree-toggle');
                    if (childToggle && childToggle.innerText === "-") setChildVisibility(r.id, true);
                } else {
                    r.classList.add('hidden');
                    setChildVisibility(r.id, false);
                }
            });
        }

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}