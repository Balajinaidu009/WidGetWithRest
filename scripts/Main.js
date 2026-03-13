function executeWidgetCode() {
    console.log("--- Widget Execution Started ---");

    require(["DS/PlatformAPI/PlatformAPI", "DS/DataDragAndDrop/DataDragAndDrop", "DS/WAFData/WAFData", "DS/i3DXCompassServices/i3DXCompassServices"], 
    function(PlatformAPI, DataDragAndDrop, WAFData, i3DXCompassServices) {
        
        var myWidget = {
            url3DSpace: "",

            displayData: function(arrData) {
                console.log("Entering displayData with raw data:", arrData);

                var contentDiv = document.getElementById("content-display");
                var dropZone = document.getElementById("drop-zone-ui");
                
                dropZone.style.display = "none";
                contentDiv.style.display = "block";
                contentDiv.innerHTML = "";

                // API mapping logic
                var objInfo = (arrData.member && arrData.member[0]) ? arrData.member[0] : (arrData[0] ? arrData[0] : arrData);
                console.log("Mapped Object Info for UI:", objInfo);

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

                document.getElementById("resetBtn").onclick = function() { 
                    console.log("Reset button clicked. Reloading widget.");
                    location.reload(); 
                };
                
                document.getElementById("callApiBtn").onclick = function() {
                    console.log("Call Vertex API button clicked for ID:", id);
                    if (confirm("Send " + name + " to Vertex?")) {
                        var vertexUrl = "https://www.plmtrainer.com:444/Vertex-0.0.1-SNAPSHOT/vertexvis/v1/exportdata?id=" + id;
                        console.log("Vertex Export URL:", vertexUrl);
                        
                        fetch(vertexUrl)
                            .then(res => {
                                console.log("Vertex Fetch raw response status:", res.status);
                                return res.json();
                            })
                            .then(data => {
                                console.log("Vertex API response data:", data);
                                const formattedSummary = data["Summary Lines"].replace(/\n/g, "<br>");
                                document.getElementById("apiResult").innerHTML = "<div class='success-box'>" + formattedSummary + "</div>";
                            })
                            .catch(err => {
                                console.error("Vertex API fetch error:", err);
                                document.getElementById("apiResult").innerHTML = "<p style='color:red;'>Export Error: " + err.message + "</p>";
                            });
                    }
                };
            },

            onLoadWidget: function() {
                console.log("onLoadWidget triggered.");
                myWidget.callData();
                myWidget.initDropzone();
            },

            initDropzone: function() {
                var dropElement = document.getElementById("drop-zone-ui");
                console.log("Initializing drop zone on element:", dropElement);

                DataDragAndDrop.droppable(dropElement, {
                    drop: function(data) {
                        console.log("Item dropped. Raw Drop Data:", data);
                        var dataDnD = JSON.parse(data);
                        var physicalid = dataDnD.data.items[0].objId || dataDnD.data.items[0].objectId;
                        
                        console.log("Extracted Physical ID:", physicalid);
                        myWidget.fetchObjectInfo(physicalid);
                    }
                });
            },

            fetchObjectInfo: function(physicalid) {
                var securityContext = widget.getOption('currentSecurityContext');
                console.log("Attempting fetch with SecurityContext:", securityContext);
                
                if (!securityContext) {
                    console.error("Critical: securityContext is null/undefined. Check your dashboard credentials.");
                    document.getElementById("content-display").style.display = "block";
                    document.getElementById("content-display").innerHTML = "Error: No Security Context selected.";
                    return;
                }

                var urlWAF = myWidget.url3DSpace + "/resources/v1/modeler/dseng/dseng:EngItem/" + physicalid + "?$mask=dsmveng:EngItemMask.Details";
                console.log("WAFData GET Request URL:", urlWAF);

                WAFData.authenticatedRequest(urlWAF, {
                    method: "GET",
                    headers: { 
                        "SecurityContext": securityContext,
                        "Accept": "application/json"
                    },
                    type: "json",
                    onComplete: function(dataResp) {
                        console.log("WAFData onComplete. Response received:", dataResp);
                        myWidget.displayData(dataResp);
                    },
                    onFailure: function(err, responseData) {