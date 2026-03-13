function executeWidgetCode() {
    require(["UWA/Drivers/jQuery", "DS/PlatformAPI/PlatformAPI", "DS/DataDragAndDrop/DataDragAndDrop", "DS/WAFData/WAFData", "DS/i3DXCompassServices/i3DXCompassServices"], function($, PlatformAPI, DataDragAndDrop , WAFData, i3DXCompassServices) {
        var myWidget = {
            dataFull: [],
			topicName: "clickUserId",
			url3DSpace : "",
            
            displayData: function(arrData) {
                var objctInfo = arrData[0];
                var rang = 0;
                var $wdgBody = $(widget.body);
                $wdgBody.empty();

                var $table = $("<table></table>");

                $table.append("<thead><tr><th>Attribute Name</th><th>Attribute Value</th></tr></thead>");

                var $tBody = $("<tbody></tbody>");
                if(arrData && arrData.length >0){
                    var keysLst = Object.keys(objctInfo);
                    for (var i = 0; i < keysLst.length; i++) {
                        if(rang <= 15){
                            if(objctInfo[keysLst[i]] && objctInfo[keysLst[i]].length >0){
                                var $tr = $(`<tr><td>${keysLst[i]}</td><td>${objctInfo[keysLst[i]]}</td></tr>`);
                                $tr.on("click", myWidget.clicOnRow);
                                $tBody.append($tr);
                                rang++;
                            }
                        }else{
                            break;
                        }
                    }
                  }
                $table.append($tBody);
                $wdgBody.append($table);
                myWidget.dropzone($wdgBody);
            },

            onLoadWidget: function() {
				myWidget.callData();
				PlatformAPI.subscribe(myWidget.topicName, myWidget.displayInfo);
				myWidget.displayData(myWidget.dataFull);
            },

            dropzone: function(eltHTML){
                DataDragAndDrop.droppable(eltHTML[0], {
                    drop: function(data){
                       console.log('Drop data ' + data);
                       var dataDnD = JSON.parse(data);
                       var physicalid = dataDnD.data.items[0].objId;
					   widget.body.style="border:5px hidden;"
					   myWidget.displayInfo({physicalid: physicalid});
                    },
					enter: function(){
						widget.body.style="border:5px solid orange;"
					},
					leave: function(){
						widget.body.style="border:5px hidden;"
					}
                 });                 
            },

            callData: function() {
				i3DXCompassServices.getServiceUrl({
				    serviceName: '3DSpace', 
				    platformId: widget.getValue('x3dPlatformId'),
				    onComplete : function (URLResult){
						myWidget.url3DSpace = URLResult;
						console.log("Inside callData function. 3DSpace URL is : " + myWidget.url3DSpace);
					},
					onFailure : function (error){
						console.log(error);
					}
				});				
			},
			
			displayInfo: function(data) {
                //Callback function called when the event happen, is published by any other widget of the dashboard, or our widget itself
                var physicalid= data.physicalid;
				
				var urlWAF = myWidget.url3DSpace + "/DSISTools/ObjectInfo";
				console.log(urlWAF);
                var dataWAF = {
                   action: "getInfos",
                   objectIds: physicalid,
                   selects: "attribute[*],current,name,revision"
                };
                var headerWAF = {
                   SecurityContext: widget.getValue("ctx")
                };
                var methodWAF = "GET";
                WAFData.authenticatedRequest(urlWAF, {
                   method: methodWAF,
                   headers: headerWAF,
                   data: dataWAF,
                   type: "json",
                   onComplete: function(dataResp) {
                       if (dataResp.msg === "OK") {
                           myWidget.dataFull = dataResp.data;
                           myWidget.displayData(myWidget.dataFull);
                           console.log(myWidget.dataFull);
                       } else {
                           widget.body.innerHTML += "<p>Error in WebService Response</p>";
                           widget.body.innerHTML += "<p>" + JSON.stringify(dataResp) + "</p>";
                       }
                   },
                   onFailure: function(error) {
                       widget.body.innerHTML += "<p>Call Faillure</p>";
                       widget.body.innerHTML += "<p>" + JSON.stringify(error) + "</p>";
                   }
                });
			}
        };

        widget.myWidget = myWidget;

        widget.addEvent("onLoad", myWidget.onLoadWidget);
    });
}
