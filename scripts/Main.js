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
                        console.log("3DSpace URL set:", url);
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

                        // Start the process
                        myWidget.fetchObjectInfo(physicalid, dropContext);
                    }
                });
            },

            // --- STEP 1: Get Details (GET) ---
            fetchObjectInfo: function(physicalid, securityContext) {
                var urlWAF = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + physicalid + "?$mask=dsmveng:EngItemMask.Details";
                
                WAFData.authenticatedRequest(urlWAF, {
                    method: "GET",
                    headers: { "SecurityContext": securityContext, "Accept": "application/json" },
                    type: "json",
                    onComplete: function(dataResp) {
                        myWidget.displayData(dataResp);
                        // Move to Step 2
                        myWidget.getCsrfAndExpand(physicalid, securityContext);
                    }
                });
            },

            // --- STEP 2: Get CSRF Token (GET) ---
            getCsrfAndExpand: function(physicalid, securityContext) {
                // This is the specific endpoint for Modeler tokens
                var csrfUrl = myWidget.url3DSpace + "/resources/v1/application/CSRF";

                WAFData.authenticatedRequest(csrfUrl, {
                    method: "GET",
                    headers: { "SecurityContext": securityContext },
                    type: "json",
                    onComplete: function(csrfResp) {
                        var tokenName = csrfResp.csrf.name; // Usually ENO_CSRF_TOKEN
                        var tokenValue = csrfResp.csrf.value;
                        
                        console.log("CSRF Token Obtained:", tokenValue);
                        
                        // Move to Step 3
                        myWidget.executeExpand(physicalid, securityContext, tokenName, tokenValue);
                    }
                });
            },

            // --- STEP 3: Expand Assembly (POST) ---
            executeExpand: function(id, context, csrfName, csrfValue) {
                var expandUrl = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + id + "/expand";
                var body = {
                    "expandDepth": 1,
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
                        [csrfName]: csrfValue // Inject the CSRF token
                    },
                    data: JSON.stringify(body),
                    type: "json",
                    onComplete: function(expandData) {
                        console.log("Expand Success:", expandData);
                        // You can now render the children in the UI
						myWidget.renderExpandTable(expandData);
                    },
                    onFailure: function(err) {
                        console.error("Expand Failed:", err);
                    }
                });
            },

            displayData: function(arrData) {
                // UI Rendering Logic (Same as your previous version)
                var contentDiv = document.getElementById("content-display");
                var dropZone = document.getElementById("drop-zone-ui");
                dropZone.style.display = "none";
                contentDiv.style.display = "block";

                var objInfo = (arrData.member && arrData.member[0]) ? arrData.member[0] : (arrData[0] ? arrData[0] : arrData);
                
                var name = objInfo.name || objInfo.attributes?.['displayName'] || "Unknown";
                var type = objInfo.type || "VPMReference";
                var rev = objInfo.revision || "A";
                var id = objInfo.id || objInfo.physicalid;

                contentDiv.innerHTML = `
                    <div class="data-card">
                        <h3>${name}</h3>
                        <p>Type: ${type} | Revision: ${rev}</p>
                        <button id="callApiBtn" class="btn-primary">Send to Vertex</button>
                        <div id="apiResult"></div>
                    </div>`;

                document.getElementById("callApiBtn").onclick = function() {
                    myWidget.exportToVertex(id, name);
                };
            },
			renderExpandTable: function(expandData) {
    var contentDiv = document.getElementById("apiResult");
    var members = expandData.member || [];

    // Filter to get only the References (Physical Products)
    var products = members.filter(m => m.type === "VPMReference");

    var tableHTML = `
        <div class="bom-container">
            <table class="bom-table">
                <thead>
                    <tr>
                        <th><input type="checkbox"></th>
                        <th>Title</th>
                        <th>Revision</th>
                        <th>Type</th>
                        <th>Owner</th>
                        <th>State</th>
                    </tr>
                </thead>
                <tbody>`;

    products.forEach((prod, index) => {
        // Simple indentation logic: if it's not the first item, indent it to look like a child
        var indentClass = index === 0 ? "" : "indent-level-" + index;
        var stateLabel = prod.state === "IN_WORK" ? "In Work" : prod.state;

        tableHTML += `
            <tr class="${indentClass}">
                <td><input type="checkbox"></td>
                <td class="title-cell">
                    <span class="tree-icon">${index === products.length - 1 ? "└─" : "├─"}</span>
                    <img src="https://kim.3dexperience.3ds.com/enovia/common/images/iconSmallPhysicalProduct.png" class="type-icon">
                    ${prod.title}
                </td>
                <td><span class="rev-link">${prod.revision}</span></td>
                <td>Physical Product</td>
                <td><span class="owner-badge">${prod.owner.substring(0,2).toUpperCase()}</span> ${prod.owner}</td>
                <td><span class="state-badge work">${stateLabel}</span></td>
            </tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    contentDiv.innerHTML = tableHTML;
},

            exportToVertex: function(id, name) {
                // Your Vertex Fetch logic
            }
        };

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}