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

            // --- 1. INITIALIZATION ---
            onLoadWidget: function() {
                console.log("onLoadWidget: Initializing Service URLs and Dropzone.");
                myWidget.callData();
                myWidget.initDropzone();
            },

            callData: function() {
                var platformId = widget.getValue('x3dPlatformId');
                console.log("Compass: Fetching 3DSpace URL for platformId:", platformId);

                i3DXCompassServices.getServiceUrl({
                    serviceName: '3DSpace',
                    platformId: platformId,
                    onComplete: function(url) {
                        myWidget.url3DSpace = url;
                        console.log("Compass: 3DSpace URL set to:", url);
                    },
                    onFailure: function(err) {
                        console.error("Compass: Failed to retrieve 3DSpace URL.", err);
                    }
                });
            },

            // --- 2. DRAG AND DROP HANDLING ---
            initDropzone: function() {
                var dropElement = document.getElementById("drop-zone-ui");
                console.log("Dropzone: Binding to element:", dropElement);

                DataDragAndDrop.droppable(dropElement, {
                    drop: function(data) {
                        console.log("Dropzone: Item dropped. Parsing JSON...");
                        var dataDnD = JSON.parse(data);
						console.log("dataDnD:", dataDnD);
						console.log("dataDnD.data:", dataDnD.data);
						console.log("dataDnD.data.items:", dataDnD.data.items);
                        
                        // Extract ID and Context from the dropped item metadata
                        var physicalid = dataDnD.data.items[0].objectId;
                        var dropContext = dataDnD.data.items[0].contextId;

                        console.log("Dropzone: Extracted ID ->", physicalid);
                        console.log("Dropzone: Extracted Context ->", dropContext);

                        myWidget.fetchObjectInfo(physicalid, dropContext);
                    }
                });
            },

            // --- 3. DATA FETCHING (3DEXPERIENCE) ---
            fetchObjectInfo: function(physicalid, dropContext) {
                // Priority: Context from Drop > Context from Widget Options
                var securityContext = dropContext || widget.getOption('currentSecurityContext');
                console.log("WAFData: Final SecurityContext used:", securityContext);

                if (!securityContext) {
                    console.error("WAFData: No Security Context available.");
                    return;
                }

                var urlWAF = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + physicalid + "?$mask=dsmveng:EngItemMask.Details";
                console.log("WAFData: GET Request to ->", urlWAF);

                WAFData.authenticatedRequest(urlWAF, {
                    method: "GET",
                    headers: {
                        "SecurityContext": securityContext,
                        "Accept": "application/json"
                    },
                    type: "json",
                    onComplete: function(dataResp) {
                        console.log("WAFData: Success! Data received.", dataResp);
                        myWidget.displayData(dataResp);
                    },
                    onFailure: function(err, responseData) {
                        console.error("WAFData: Failure (401/Auth Error).", err);
                        console.log("WAFData: Response Body:", responseData);
                    }
                });
				// var urlWAFPost = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + physicalid + "/expand";
                //console.log("urlWAFPost: POST Request to ->", urlWAFPost);
				
            },

            // --- 4. UI RENDERING ---
            displayData: function(arrData) {
                console.log("UI: Rendering object details card.");
                var contentDiv = document.getElementById("content-display");
                var dropZone = document.getElementById("drop-zone-ui");

                // Switch Visibility
                dropZone.style.display = "none";
                contentDiv.style.display = "block";
                contentDiv.innerHTML = "";

                // API mapping (handle 'member' array or direct object)
                var objInfo = (arrData.member && arrData.member[0]) ? arrData.member[0] : (arrData[0] ? arrData[0] : arrData);
                
                var name = objInfo.name || objInfo.attributes?.['displayName'] || "Unknown";
                var type = objInfo.type || "VPMReference";
                var rev = objInfo.revision || "A";
                var id = objInfo.id || objInfo.physicalid;

                var cardHTML = `
                    <div class="data-card">
                        <div class="card-header">
                            <h3>Object Details</h3>
                            <button class="btn-text" id="resetBtn">Reset</button>
                        </div>
                        <div class="card-body">
                            <div class="prop-row"><span>Name</span><strong>${name}</strong></div>
                            <div class="prop-row"><span>Type</span><strong>${type}</strong></div>
                            <div class="prop-row"><span>Revision</span><code class="id-badge">${rev}</code></div>
                        </div>
                        <div class="card-footer">
                            <button id="callApiBtn" class="btn-primary">Send to Vertex</button>
                        </div>
                        <div id="apiResult"></div>
                    </div>`;

                contentDiv.innerHTML = cardHTML;

                // Bind Reset Button
                document.getElementById("resetBtn").onclick = function() {
                    console.log("UI: Resetting widget state.");
                    location.reload();
                };

                // Bind Vertex Export Button
                document.getElementById("callApiBtn").onclick = function() {
                    myWidget.exportToVertex(id, name);
                };
            },

            // --- 5. VERTEX EXTERNAL API CALL ---
            exportToVertex: function(id, name) {
                console.log("Vertex: Starting export for ID:", id);
                if (confirm("Send " + name + " to Vertex?")) {
                    var vertexUrl = "https://www.plmtrainer.com:444/Vertex-0.0.1-SNAPSHOT/vertexvis/v1/exportdata?id=" + id;
                    
                    fetch(vertexUrl)
                        .then(res => res.json())
                        .then(data => {
                            console.log("Vertex: Export Success.", data);
                            const formattedSummary = data["Summary Lines"].replace(/\n/g, "<br>");
                            document.getElementById("apiResult").innerHTML = `<div class='success-box'>${formattedSummary}</div>`;
                        })
                        .catch(err => {
                            console.error("Vertex: Export Failed.", err);
                            document.getElementById("apiResult").innerHTML = `<p style='color:red;'>Export Error: ${err.message}</p>`;
                        });
                }
            }
        };

        // Register the widget onLoad event
        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}