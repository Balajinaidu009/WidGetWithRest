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
                var expandUrl = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + id + "/expand";
                var body = {
                    "expandDepth": -1, // Changed to -1 for full structure depth
                    "withPath": true,
                    "type_filter_bo": ["VPMReference", "VPMRepReference"], // Added Reps for 3D Shapes
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

                // CSS for increased width and height
                contentDiv.innerHTML = `
                    <style>
                        .data-card { width: 98%; max-width: 1100px; margin: 10px auto; background: white; border: 1px solid #d1d4d4; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-family: 'Arial', sans-serif; }
                        .card-header { padding: 12px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
                        .bom-container { max-height: 500px; overflow-y: auto; overflow-x: auto; width: 100%; }
                        .bom-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                        .bom-table th { background: #f1f1f1; padding: 10px; text-align: left; color: #666; font-weight: normal; position: sticky; top: 0; }
                        .tree-row:hover { background: #f9f9f9; }
                        .tree-row td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
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
                var contentDiv = document.getElementById("apiResult");
                var members = expandData.member || [];
                var map = {};
                var rootId = null;

                members.forEach(m => {
                    if (m.type === "VPMReference" || m.type === "VPMRepReference") {
                        map[m.id] = { ...m, children: [] };
                        if (!rootId && m.type === "VPMReference") rootId = m.id;
                    }
                });

                members.forEach(m => {
                    if (m.Path && m.Path.length === 3) {
                        var pId = m.Path[0];
                        var cId = m.Path[2];
                        if (map[pId] && map[cId]) map[pId].children.push(map[cId]);
                    }
                });

                contentDiv.innerHTML = `
                    <table class="bom-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Rev</th>
                                <th>Type</th>
                                <th>Owner</th>
                                <th>State</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${myWidget.generateTreeHTML(map[rootId], 0)}
                        </tbody>
                    </table>`;
            },

            generateTreeHTML: function(node, level) {
                if (!node) return "";
                var indent = level * 20;
                
                // Switch icon based on Type
                var iconName = (node.type === "VPMRepReference") ? "I_VPMNav3DShape" : "I_VPMNavProduct";
                var typeLabel = (node.type === "VPMRepReference") ? "3D Shape" : "Physical Product";
                var iconUrl = `${myWidget.url3DSpace}/cvservlet/files?fileType=ICON&ipml_46_iconname=${iconName}`;
                
                var html = `
                    <tr class="tree-row">
                        <td style="padding-left: ${indent}px;">
                            <div style="display:flex; align-items:center;">
                                <span style="color:#ccc; margin-right:5px; font-family: monospace;">${level > 0 ? "┕" : ""}</span>
                                <img src="${iconUrl}" style="width:18px; height:18px; margin-right:6px;">
                                <span>${node.title || node.name}</span>
                            </div>
                        </td>
                        <td><span style="color:#368ec4; font-weight:bold;">${node.revision || ""}</span></td>
                        <td style="color:#888; font-size: 11px;">${typeLabel}</td>
                        <td>
                            <div style="display:flex; align-items:center;">
                                <span style="background:#a38b7a; color:#fff; width:18px; height:18px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:9px; margin-right:5px;">
                                    ${node.owner ? node.owner.substring(0,2).toUpperCase() : "??"}
                                </span>
                                <span style="font-size:11px;">${node.owner || ""}</span>
                            </div>
                        </td>
                        <td>
                            <span style="background:${node.state === 'IN_WORK' ? '#008eb0' : '#888'}; color:#fff; padding:2px 6px; border-radius:2px; font-size:10px; font-weight:bold;">
                                ${node.state || ""}
                            </span>
                        </td>
                    </tr>`;

                if (node.children) {
                    node.children.forEach(child => {
                        html += myWidget.generateTreeHTML(child, level + 1);
                    });
                }
                return html;
            }
        };

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}