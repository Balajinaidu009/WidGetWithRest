function executeWidgetCode() {
    console.log("--- Widget Execution Started ---");

    require([
        "DS/PlatformAPI/PlatformAPI",
        "DS/DataDragAndDrop/DataDragAndDrop",
        "DS/WAFData/WAFData",
        "DS/i3DXCompassServices/i3DXCompassServices"
    ], function(PlatformAPI, DataDragAndDrop, WAFData, i3DXCompassServices) {

        // CHANGED: Attach to window so onclick can find it
        window.myWidget = {
            url3DSpace: "",
            currentTreeMap: {},
            rootId: null,

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
                        .bom-container { max-height: 500px; overflow-y: auto; overflow-x: auto; width: 100%; }
                        .bom-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                        .bom-table th { background: #f1f1f1; padding: 10px; text-align: left; color: #666; font-weight: normal; position: sticky; top: 0; }
                        .tree-row:hover { background: #f9f9f9; }
                        .tree-row td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
                        .tree-toggle { cursor: pointer; color: #42a5f5; font-weight: bold; margin-right: 5px; }
                        .btn-reset { border: 1px solid #ccc; background: white; cursor: pointer; padding: 4px 8px; border-radius: 3px; font-size: 11px; }
                        .btn-primary { width: 100%; background: #42a5f5; color: white; border: none; padding: 12px; font-weight: bold; cursor: pointer; border-radius: 0 0 4px 4px; }
                    </style>
                    <div class="data-card">
                        <div class="card-header">
                            <div style="display:flex; align-items:center;">
                                <img src="${myWidget.url3DSpace}/cvservlet/files?fileType=ICON&ipml_46_iconname=I_VPMNavProduct" style="width:20px; margin-right:8px;">
                                <h3 style="margin:0; font-size: 16px;">${name}</h3>
                            </div>
                            <button id="widgetResetBtn" class="btn-reset">✕ Reset</button>
                        </div>
                        <div id="apiResult" class="bom-container">
                            <p style="padding: 20px; color: #999; text-align: center;">Expanding full structure...</p>
                        </div>
                        <button id="callApiBtn" class="btn-primary">Export to Vertex</button>
                    </div>`;

                document.getElementById("widgetResetBtn").onclick = function() {
                    contentDiv.style.display = "none";
                    dropZone.style.display = "flex";
                };
            },

            renderExpandTable: function(expandData) {
                var members = expandData.member || [];
                var map = {};
                var rootId = null;

                members.forEach(m => {
                    if (m.type === "VPMReference" || m.type === "3DShape") {
                        map[m.id] = { ...m, children: [], expanded: false };
                        if (!rootId && m.type === "VPMReference") {
                            rootId = m.id;
                            map[m.id].expanded = true; 
                        }
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

                myWidget.currentTreeMap = map;
                myWidget.rootId = rootId;
                myWidget.refreshTreeUI();
            },

            refreshTreeUI: function() {
                var container = document.getElementById("apiResult");
                if (!container) return;
                container.innerHTML = `
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
                            ${myWidget.generateTreeHTML(myWidget.currentTreeMap[myWidget.rootId], 0)}
                        </tbody>
                    </table>`;
            },

            generateTreeHTML: function(node, level) {
                if (!node) return "";
                var indent = level * 20;
                var hasChildren = node.children && node.children.length > 0;
                
                var toggleHtml = "";
                if (hasChildren) {
                    var toggleIcon = node.expanded ? "[-] " : "[+] ";
                    // CHANGED: Reference window.myWidget for global access
                    toggleHtml = `<span class="tree-toggle" onclick="window.myWidget.toggleNode('${node.id}')">${toggleIcon}</span>`;
                } else {
                    toggleHtml = `<span style="color:#ccc; margin-right:5px; font-family: monospace;">┕ </span>`;
                }

                var isShape = node.type === "3DShape";
                var iconName = isShape ? "I_Part" : "I_VPMNavProduct";
                var iconUrl = myWidget.url3DSpace + (isShape ? "/cvservlet/files?fileType=ICON&ipml_46_iconname=I_Part" : "/snresources/images/icons/small/I_VPMNavProduct.png");

                var html = `
                    <tr class="tree-row">
                        <td style="padding-left: ${indent + 10}px;">
                            <div style="display:flex; align-items:center;">
                                ${toggleHtml}
                                <img src="${iconUrl}" style="width:18px; height:18px; margin-right:6px;">
                                <span>${node.title || node.name}</span>
                            </div>
                        </td>
                        <td>${node.revision || "A"}</td>
                        <td style="color:#888;">${isShape ? "3D Shape" : "Product"}</td>
                        <td>${node.owner || ""}</td>
                        <td>${node.state || ""}</td>
                    </tr>`;

                if (node.expanded && hasChildren) {
                    node.children.forEach(child => {
                        html += myWidget.generateTreeHTML(child, level + 1);
                    });
                }
                return html;
            },

            toggleNode: function(id) {
                if (myWidget.currentTreeMap[id]) {
                    myWidget.currentTreeMap[id].expanded = !myWidget.currentTreeMap[id].expanded;
                    myWidget.refreshTreeUI();
                }
            }
        };

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}