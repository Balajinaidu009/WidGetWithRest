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
                resultContainer.innerHTML = '<div class="loading-state">Expanding full structure...</div>';

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
    
    // Extracting properties from the API response
    var name = objInfo.title || objInfo.name || "---";
    var revision = objInfo.revision || "";
    var ein = objInfo.enterprise_item_number || "None";
    var state = objInfo.state || "IN_WORK";
    var owner = objInfo.owner || "Unknown";
    var modDate = objInfo.modified || "---"; // Or objInfo.modification_date depending on mask
    var type = objInfo.type || "Physical Product";

contentDiv.innerHTML = `
    <div class="data-card">
        <div class="header-container">
            <div class="header-main">
                <img src="${myWidget.url3DSpace}/snresources/images/icons/large/I_VPMNavProduct108x144.png" class="type-icon-header">
                <div class="header-info">
                    <div class="title-row">
                        <h2 class="header-title">${name} ${revision}</h2>
                        <button id="widgetResetBtn" class="btn-icon-reset">✕</button>
                    </div>
                    <div class="property-layout">
                        <div class="property-grid">
                            <div class="prop-item">
                                <span class="prop-label">Enterprise Item Number :</span>
                                <span class="prop-value highlight">${ein}</span>
                            </div>
                            <div class="prop-item">
                                <span class="prop-label">Modification Date :</span>
                                <span class="prop-value">${modDate}</span>
                            </div>
                            <div class="prop-item">
                                <span class="prop-label">Maturity State :</span>
                                <span class="state-badge work">${state}</span>
                                <span class="prop-action">Freeze ▾</span>
                            </div>
                            <div class="prop-item">
                                <span class="prop-label">Type :</span>
                                <span class="prop-value">${type}</span>
                            </div>
                            <div class="prop-item">
                                <span class="prop-label">Owner :</span>
                                <div class="owner-chip">
                                    <span class="owner-initials-small">${owner.substring(0,1).toUpperCase()}</span>
                                    <span class="prop-value highlight">${owner}</span>
                                </div>
                            </div>
                        </div>
                        <div class="description-column">
                            <span class="prop-value description-text">${objInfo.description || "No description"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="toolbar">
            <button class="btn-reset" onclick="executeWidgetCode.expandAll()">Expand All</button>
            <button class="btn-reset" onclick="executeWidgetCode.collapseAll()">Collapse All</button>
            <span class="selection-hint">(Select items to export)</span>
        </div>
        
        <div id="apiResult" class="bom-container"></div>
        <button id="callApiBtn" class="btn-primary">Export Selected to Vertex</button>
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
                                <th style="width: 40px; text-align:center;"><input type="checkbox" id="selectAllNodes"></th>
                                <th style="width: 40px; text-align:center;"></th> <th style="width: 35%;">Title</th>
                                <th style="width: 20%;">Title (Instance)</th>
                                <th style="width: 60px;">Rev</th>
                                <th style="width: 120px;">Type</th>
                                <th style="width: 150px;">Modification Date</th>
                                <th style="width: 120px;">Owner</th>
                                <th style="width: 100px;">State</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${myWidget.generateTreeHTML(map[rootId], 0, null)}
                        </tbody>
                    </table>`;

                // Handle select all checkbox
                document.getElementById("selectAllNodes").onclick = function() {
                    var checkboxes = document.querySelectorAll(".node-checkbox");
                    checkboxes.forEach(cb => cb.checked = this.checked);
                };
            },

            generateTreeHTML: function(node, level, parentUniqueId) {
                if (!node) return "";
                var indent = level * 20;
                var isShape = node.type === "3DShape";
                var hasChildren = node.children && node.children.length > 0;
                
                var hasSubAssembly = node.children && node.children.some(c => c.type === "VPMReference");
                var isPhysicalProduct = node.type === "VPMReference";

                var isHidden = level > 1 ? "hidden" : "";
                var toggleChar = level >= 1 ? "+" : "-";

                var rowId = "row_" + node.id + "_" + Math.floor(Math.random() * 1000000);
                var parentAttr = parentUniqueId ? `data-parent="${parentUniqueId}"` : "";
                // Logic for Is Latest Revision
                var isLatest = node.is_latest_revision === "TRUE" || node.is_latest_revision === true;
                var latestIcon = isLatest 
                    ? `<span class="status-icon icon-latest-true">✔</span>` 
                    : `<span class="status-icon icon-latest-false">✖</span>`;

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
                        <td style="text-align: center;">
                            <input type="checkbox" class="node-checkbox" data-id="${node.id}">
                        </td>
                        <td style="text-align: center;">${latestIcon}</td>
                        <td style="padding-left: ${indent + 10}px;">
                            <div class="title-cell">
                                ${hasChildren ? `<span class="tree-toggle" onclick="executeWidgetCode.toggleNode('${rowId}')">${toggleChar}</span>` : '<span class="tree-leaf-spacer"></span>'}
                                <img src="${iconUrl}" class="type-icon-3dx">
                                <span class="node-title highlight-blue">${node.title || node.name}</span>
                            </div>
                        </td>
                        <td><span class="instance-text">${node.instance_name || "---"}</span></td>
                        <td><span class="rev-text highlight-blue">${node.revision || "---"}</span></td>
                        <td style="color: #888;">${node.type}</td>
                        <td><span class="mod-date">${node.modified || "---"}</span></td>
                        <td>
                            <div style="display:flex; align-items:center;">
                                <span class="owner-initials-small">${node.owner ? node.owner.substring(0,2).toUpperCase() : "??"}</span>
                                <span class="highlight-blue">${node.owner || ""}</span>
                            </div>
                        </td>
                        <td>
                            <span class="state-badge ${node.state ? node.state.toLowerCase().replace(' ', '') : 'work'}">
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
            },

            handleExport: function() {
                var selectedIds = [];
                document.querySelectorAll(".node-checkbox:checked").forEach(cb => {
                    selectedIds.push(cb.getAttribute("data-id"));
                });

                if (selectedIds.length === 0) {
                    alert("Please select at least one item to export.");
                    return;
                }
                
                console.log("Exporting IDs to Vertex:", selectedIds);
                // Your Vertex Export logic goes here
            }
        };

        // --- EXPOSED GLOBAL UTILITIES ---
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