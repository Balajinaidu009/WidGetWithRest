function executeWidgetCode() {
    require(["DS/PlatformAPI/PlatformAPI", "DS/DataDragAndDrop/DataDragAndDrop", "DS/WAFData/WAFData", "DS/i3DXCompassServices/i3DXCompassServices"], function( PlatformAPI, DataDragAndDrop, WAFData, i3DXCompassServices) {
		// Define $ locally so your existing code doesn't break
        var myWidget = {
            dataFull: [],
            url3DSpace: "",

            displayData: function(arrData) {
                var $contentDiv = $("#content-display");
                var $dropZone = $("#drop-zone-ui");
                
                $dropZone.hide();
                $contentDiv.show().empty();

                if (!arrData || arrData.length === 0) {
                    $contentDiv.html("<div class='data-card'><p>No data found.</p><button onclick='location.reload()'>Back</button></div>");
                    return;
                }

                var objInfo = arrData[0];
                var cardHTML = `
                    <div class="data-card">
                        <div class="card-header">
                            <h3><span class="fonticon fonticon-info"></span> Object Details</h3>
                            <button class="btn-text" onclick="location.reload()">Reset</button>
                        </div>
                        <div class="card-body">
                            <div class="prop-row"><span>Name</span><strong>${objInfo.name || "N/A"}</strong></div>
                            <div class="prop-row"><span>Type</span><strong>${objInfo.type || "N/A"}</strong></div>
                            <div class="prop-row"><span>Revision</span><code class="id-badge">${objInfo.revision || "A"}</code></div>
                        </div>
                        <div class="card-footer">
                            <button id="callApiBtn" class="btn-primary">Send to Vertex</button>
                        </div>
                        <div id="apiResult"></div>
                    </div>`;

                $contentDiv.append(cardHTML);

                // Vertex Export Logic (Matching Phase 3 of your flow)
                $("#callApiBtn").on("click", function() {
                    if (confirm("Send " + objInfo.name + " to Vertex?")) {
                        var vertexUrl = "https://www.plmtrainer.com:444/Vertex-0.0.1-SNAPSHOT/vertexvis/v1/exportdata?id=" + objInfo.id;
                        
                        // Using WAFData for the Vertex call if it requires auth, otherwise use fetch
                        fetch(vertexUrl)
                            .then(res => res.json())
                            .then(data => {
                                const formattedSummary = data["Summary Lines"].replace(/\n/g, "<br>");
                                $("#apiResult").html("<div class='success-box'>" + formattedSummary + "</div>");
                            })
                            .catch(err => {
                                $("#apiResult").html("<p class='error-text'>Error: " + err.message + "</p>");
                            });
                    }
                });
            },

            onLoadWidget: function() {
                myWidget.callData();
                myWidget.initDropzone();
            },

            initDropzone: function() {
                var dropElement = document.getElementById("drop-zone-ui");
                DataDragAndDrop.droppable(dropElement, {
                    drop: function(data) {
                        var dataDnD = JSON.parse(data);
                        var physicalid = dataDnD.data.items[0].objId;
                        $(widget.body).removeClass("drag-over");
                        myWidget.fetchObjectInfo(physicalid);
                    },
                    enter: function() { $(widget.body).addClass("drag-over"); },
                    leave: function() { $(widget.body).removeClass("drag-over"); }
                });
            },

            fetchObjectInfo: function(physicalid) {
                var urlWAF = myWidget.url3DSpace + "/DSISTools/ObjectInfo";
                var dataWAF = {
                    action: "getInfos",
                    objectIds: physicalid,
                    selects: "attribute[*],current,name,revision,type"
                };
                
                WAFData.authenticatedRequest(urlWAF, {
                    method: "GET",
                    headers: { SecurityContext: widget.getValue("ctx") },
                    data: dataWAF,
                    type: "json",
                    onComplete: function(dataResp) {
                        if (dataResp.msg === "OK") {
                            myWidget.displayData(dataResp.data);
                        } else {
                            $("#content-display").show().html("<p>Error fetching data</p>");
                        }
                    }
                });
            },
            callData: function() {
                i3DXCompassServices.getServiceUrl({
                    serviceName: '3DSpace',
                    platformId: widget.getValue('x3dPlatformId'),
                    onComplete: function(url) { myWidget.url3DSpace = url; }
                });
            }
        };

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}