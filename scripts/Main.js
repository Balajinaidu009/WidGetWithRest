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
                    "expandDepth": 1,
                    "withPath": true,
                    "type_filter_bo": ["VPMReference"],
                    "type_filter_rel": ["VPMInstance"]
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
                var id = objInfo.id || objInfo.physicalid;

                contentDiv.innerHTML = `
                    <div class="data-card">
                        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center;">
                                <img src="${myWidget.url3DSpace}/cvservlet/files?fileType=ICON&ipml_46_iconname=I_VPMNavProduct" style="width:20px; margin-right:8px;">
                                <h3 style="margin:0;">${name}</h3>
                            </div>
                            <button id="widgetResetBtn" class="btn-reset">✕ Reset</button>
                        </div>
                        <div id="apiResult" class="loading-state" style="padding:20px; text-align:center;">
                            <p style="color:#666;">Expanding structure...</p>
                        </div>
                        <div class="card-footer">
                             <button id="callApiBtn" class="btn-primary">Export to Vertex</button>
                        </div>
                    </div>`;

                document.getElementById("widgetResetBtn").onclick = function() {
                    contentDiv.style.display = "none";
                    dropZone.style.display = "flex";
                    document.getElementById("apiResult").innerHTML = "";
                };

                document.getElementById("callApiBtn").onclick = function() {
                    console.log("Vertex Export Triggered for:", id);
                };
            },

            renderExpandTable: function(expandData) {
                var contentDiv = document.getElementById("apiResult");
                var members = expandData.member || [];
                var map = {};
                var rootId = null;

                members.forEach(m => {
                    if (m.type === "VPMReference") {
                        map[m.id] = { ...m, children: [] };
                        if (!rootId) rootId = m.id;
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
                    <div class="bom-container">
                        <table class="bom-table">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Rev</th>
                                    <th>Owner</th>
                                    <th>State</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${myWidget.generateTreeHTML(map[rootId], 0)}
                            </tbody>
                        </table>
                    </div>`;
            },

            generateTreeHTML: function(node, level) {
                if (!node) return "";
                var indent = level * 18;
                var iconUrl = myWidget.url3DSpace + "/cvservlet/files?fileType=ICON&ipml_46_iconname=I_VPMNavProduct";
                
                return `
                    <tr class="tree-row">
                        <td style="padding-left: ${indent}px;">
                            <div class="title-cell" style="display:flex; align-items:center;">
                                <span class="tree-connector" style="color:#b4b4b4; margin-right:5px;">${level > 0 ? "┕" : ""}</span>
                                <img src="${iconUrl}" style="width:18px; height:18px; margin-right:6px;">
                                <span class="node-title">${node.title || node.name}</span>
                            </div>
                        </td>
                        <td><span style="color:#368ec4; font-weight:bold;">${node.revision || "A"}</span></td>
                        <td>
                            <div style="display:flex; align-items:center;">
                                <span class="owner-initials" style="background:#a38b7a; color:#fff; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:10px; margin-right:5px;">
                                    ${node.owner ? node.owner.substring(0,2).toUpperCase() : "??"}
                                </span>
                                <span style="font-size:11px;">${node.owner || ""}</span>
                            </div>
                        </td>
                        <td>
                            <span class="state-badge work" style="background:#008eb0; color:#fff; padding:2px 6px; border-radius:2px; font-size:11px; font-weight:bold;">
                                ${node.state === "IN_WORK" ? "In Work" : node.state}
                            </span>
                        </td>
                    </tr>
                    ${(node.children || []).map(child => myWidget.generateTreeHTML(child, level + 1)).join('')}`;
            }
        };

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}